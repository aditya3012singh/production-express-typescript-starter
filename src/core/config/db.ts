import { PrismaClient } from '@prisma/client';
import structuredLogger from '../logger/structuredLogger.js';

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
    ]
});

prisma.$on('query' as any, (e: any) => {
    const duration = e.duration;
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

class Database {
    static client = prisma;

    static async connect(): Promise<void> {
        await prisma.$connect();
    }

    static async disconnect(): Promise<void> {
        await prisma.$disconnect();
    }
}

export { prisma };
export default Database;
