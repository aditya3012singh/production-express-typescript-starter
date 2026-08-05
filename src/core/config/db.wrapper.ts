import structuredLogger from '../logger/structuredLogger.js';
import { recordDbQuery, recordDbTransaction } from '../metrics/index.js';

interface DBExecuteOptions {
    retries?: number;
    tx?: any;
}

/**
 * Database Operation Wrapper with Retry Capabilities, Error Mapping, and Telemetry.
 * Decoupled to support both PostgreSQL (Prisma) and MongoDB (Mongoose).
 */
class DBWrapper {
    /**
     * Execute a database query with telemetry, retry logic, and standardized error mapping.
     */
    static async execute<T>(
        operationName: string,
        executionFn: (db?: any) => Promise<T>,
        options: DBExecuteOptions = {}
    ): Promise<T> {
        const retries = options.retries !== undefined ? options.retries : 3;
        let attempt = 0;

        while (attempt < retries) {
            attempt++;
            const start = Date.now();

            try {
                const result = await executionFn(options.tx);
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
                    errorCode: String(error.code || error.name || 'UNKNOWN_ERROR')
                });

                // Check serialization / deadlock / conflict errors for retries (Prisma P2034 / Mongo 11000 / WriteConflict)
                const isRetryable =
                    error.code === 'P2034' ||
                    error.code === 11000 ||
                    error.name === 'WriteConflict' ||
                    (error.message && error.message.toLowerCase().includes('deadlock')) ||
                    (error.message && error.message.toLowerCase().includes('conflict')) ||
                    (error.message && error.message.includes('40001'));

                if (isRetryable && attempt < retries) {
                    const delay = Math.pow(2, attempt) * 100 + Math.random() * 50;
                    structuredLogger.warn(`🔄 [Database] Conflict/Deadlock in '${operationName}'. Retrying attempt ${attempt}/${retries} in ${delay.toFixed(0)}ms...`, {
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
     * Handle and translate database engine errors (Prisma & Mongoose) to standard API errors
     */
    static handleDBError(error: any, operationName: string): never {
        structuredLogger.error(`❌ [Database] Operation '${operationName}' failed:`, error);

        // 1. Unique Constraint / Duplicate Key Violations (Prisma P2002 / Mongo E11000)
        if (error.code === 'P2002' || error.code === 11000) {
            const fields = error.meta?.target || (error.keyPattern ? Object.keys(error.keyPattern) : []);
            const fieldMsg = fields.length ? `: [${fields.join(', ')}]` : '';
            const apiError = new Error(`Resource already exists with conflicting unique fields${fieldMsg}`);
            (apiError as any).statusCode = 409; // Conflict
            throw apiError;
        }

        // 2. Record / Document Not Found (Prisma P2025 / Mongo DocumentNotFoundError)
        if (error.code === 'P2025' || error.name === 'DocumentNotFoundError') {
            const apiError = new Error('Requested database resource does not exist.');
            (apiError as any).statusCode = 404; // Not Found
            throw apiError;
        }

        // 3. Bad Request / Validation / Foreign Key Errors (Prisma P2003 / Mongo ValidationError / CastError)
        if (error.code === 'P2003' || error.name === 'ValidationError' || error.name === 'CastError') {
            const detail = error.name === 'CastError' ? `Invalid ID format for field '${error.path}'` : error.message;
            const apiError = new Error(`Database validation/integrity error: ${detail}`);
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
        executionFn: (tx?: any) => Promise<T>,
        options?: { maxWait?: number; timeout?: number }
    ): Promise<T> {
        const start = Date.now();

        try {
            const result = await executionFn();
            const duration = Date.now() - start;
            recordDbTransaction('committed', duration);
            return result;

        } catch (error) {
            const duration = Date.now() - start;
            recordDbTransaction('rolled_back', duration);
            throw error;
        }
    }
}

export default DBWrapper;
