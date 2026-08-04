import RedisClient from '../cache/redis.client.js';
import { prisma } from '../config/db.wrapper.js';
import structuredLogger from '../logger/structuredLogger.js';

class HealthCheckService {
    private lastCheck: any = null;

    async checkRedis(): Promise<any> {
        try {
            const pong = RedisClient.client ? await RedisClient.client.ping() : null;
            return {
                status: pong === 'PONG' ? 'healthy' : 'unhealthy',
                connected: pong === 'PONG',
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            structuredLogger.logError('unknown', 'Redis health check failed', error);
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkQueue(): Promise<any> {
        try {
            const pong = RedisClient.client ? await RedisClient.client.ping() : null;
            if (pong !== 'PONG') {
                throw new Error('Redis ping failed');
            }

            return {
                status: 'healthy',
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            structuredLogger.logError('unknown', 'Queue health check failed', error);
            return {
                status: 'degraded',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkDatabase(): Promise<any> {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database check timeout after 5s')), 5000)
            );

            await Promise.race([
                prisma.$queryRaw`SELECT 1`,
                timeoutPromise
            ]);

            return {
                status: 'healthy',
                connected: true,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            structuredLogger.logError('unknown', 'Database health check failed', error);
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async getHealthStatus(): Promise<any> {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Health check timeout after 15s')), 15000)
            );

            const checksPromise = (async () => {
                const [redisHealth, queueHealth, dbHealth] = await Promise.all([
                    this.checkRedis(),
                    this.checkQueue(),
                    this.checkDatabase()
                ]);

                let overallStatus = 'healthy';
                if (redisHealth.status === 'unhealthy' || dbHealth.status === 'unhealthy') {
                    overallStatus = 'unhealthy';
                } else if (
                    redisHealth.status === 'degraded' ||
                    queueHealth.status === 'degraded' ||
                    dbHealth.status === 'degraded'
                ) {
                    overallStatus = 'degraded';
                }

                const health = {
                    status: overallStatus,
                    timestamp: new Date().toISOString(),
                    checks: {
                        redis: redisHealth,
                        queue: queueHealth,
                        database: dbHealth
                    }
                };

                this.lastCheck = health;
                return health;
            })();

            return await Promise.race([checksPromise, timeoutPromise]);
        } catch (error: any) {
            structuredLogger.logError('unknown', 'Health check failed', error);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
                checks: {}
            };
        }
    }

    getLastCheck(): any {
        return this.lastCheck;
    }
}

const healthCheckService = new HealthCheckService();
export default healthCheckService;
