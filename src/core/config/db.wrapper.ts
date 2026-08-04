import { PrismaClient, Prisma } from '@prisma/client';
import structuredLogger from '../logger/structuredLogger.js';
import { recordDbQuery, recordDbTransaction } from '../metrics/index.js';

// Global single instance of PrismaClient
const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
    ]
});

// Configure Prisma extensions to track slow queries and engine errors
prisma.$on('query' as any, (e: any) => {
    const duration = e.duration;
    // Log slow queries (> 150ms)
    if (duration > 150) {
        structuredLogger.warn(`🐌 [Database] Slow query detected (${duration}ms): ${e.query}`, {
            durationMs: duration,
            params: e.params
        });
    }
});

prisma.$on('error' as any, (e: any) => {
    structuredLogger.error(`❌ [Database] Engine error: ${e.message}`);
});

interface DBExecuteOptions {
    retries?: number;
    tx?: Prisma.TransactionClient;
}

/**
 * Database Operation Wrapper with Retry Capabilities and Telemetry
 */
class DBWrapper {
    /**
     * Execute a database query with telemetry
     */
    static async execute<T>(
        operationName: string,
        executionFn: (db: PrismaClient | Prisma.TransactionClient) => Promise<T>,
        options: DBExecuteOptions = {}
    ): Promise<T> {
        const retries = options.retries !== undefined ? options.retries : 3;
        const dbClient = options.tx || prisma;
        let attempt = 0;
        
        while (attempt < retries) {
            attempt++;
            const start = Date.now();
            
            try {
                const result = await executionFn(dbClient);
                const duration = Date.now() - start;
                
                // Track metric success
                recordDbQuery({
                    operation: operationName,
                    model: 'generic',
                    durationMs: duration,
                    success: true
                });

                return result;

            } catch (error: any) {
                const duration = Date.now() - start;
                
                // Track metric failure
                recordDbQuery({
                    operation: operationName,
                    model: 'generic',
                    durationMs: duration,
                    success: false,
                    errorCode: error.code || error.name
                });

                // Concurrency serialization failure or deadlocks (PostgreSQL code '40001' or Prisma P2034)
                const isSerializationFailure = error.code === 'P2034' || error.message?.includes('deadlock') || error.message?.includes('40001');

                if (isSerializationFailure && attempt < retries) {
                    const delay = Math.pow(2, attempt) * 100 + Math.random() * 50;
                    structuredLogger.warn(`🔄 [Database] Deadlock/Serialization conflict in '${operationName}'. Retrying attempt ${attempt}/${retries} in ${delay.toFixed(0)}ms...`, {
                        error: error.message
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Map database errors to standard HTTP-friendly API exceptions
                this.handleDBError(error, operationName);
            }
        }
        throw new Error('Database query execution retries exhausted.');
    }

    /**
     * Handle and translate internal Database/Prisma errors to standard API errors
     */
    static handleDBError(error: any, operationName: string): never {
        structuredLogger.error(`❌ [Database] Operation '${operationName}' failed:`, error);

        // 1. Prisma Unique Constraint Violation (P2002)
        if (error.code === 'P2002') {
            const fields = error.meta?.target || [];
            const apiError = new Error(`Resource already exists with conflicting unique fields: [${fields.join(', ')}]`);
            (apiError as any).statusCode = 409; // Conflict
            throw apiError;
        }

        // 2. Prisma Record Not Found (P2025)
        if (error.code === 'P2025') {
            const apiError = new Error('Requested database resource does not exist.');
            (apiError as any).statusCode = 404; // Not Found
            throw apiError;
        }

        // 3. Prisma Foreign Key Constraint Violation (P2003)
        if (error.code === 'P2003') {
            const apiError = new Error(`Database integrity violation: Foreign key constraint failed on [${error.meta?.field_name || 'relationship'}]`);
            (apiError as any).statusCode = 400; // Bad Request
            throw apiError;
        }

        // Fallback standard error
        const apiError = new Error(error.statusCode ? error.message : 'A database query transaction error occurred.');
        (apiError as any).statusCode = error.statusCode || 500;
        throw apiError;
    }

    /**
     * Run a transaction with auto-retries and transaction boundary instrumentation
     */
    static async transaction<T>(
        operationName: string,
        executionFn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
    ): Promise<T> {
        const start = Date.now();
        
        try {
            const result = await prisma.$transaction(async (tx) => {
                return await executionFn(tx);
            }, options);
            
            const duration = Date.now() - start;
            recordDbTransaction('committed', duration);
            return result;
            
        } catch (error) {
            const duration = Date.now() - start;
            recordDbTransaction('rolled_back', duration);
            throw error; // Let execute catch it for retry logic or mapping
        }
    }
}

export { prisma };
export default DBWrapper;
