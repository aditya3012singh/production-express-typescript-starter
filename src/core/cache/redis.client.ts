import { Redis, RedisOptions } from 'ioredis';
import env from '../config/env.js';
import logger from '../logger/structuredLogger.js';

class RedisClient {
    static client: Redis | null = null;

    /**
     * Initialize connection to Redis
     */
    static initialize(): Redis {
        if (this.client) {
            return this.client;
        }

        const redisOptions: RedisOptions = {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
            maxRetriesPerRequest: null, // Essential for BullMQ compatibility
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };

        const connectionTarget = env.REDIS_URL || redisOptions;

        logger.info(`[Redis] 🚀 Connecting to Redis at ${env.REDIS_URL ? 'REDIS_URL' : `${env.REDIS_HOST}:${env.REDIS_PORT}`}...`);
        
        if (typeof connectionTarget === 'string') {
            this.client = new Redis(connectionTarget, redisOptions);
        } else {
            this.client = new Redis(redisOptions);
        }

        this.client.on('connect', () => {
            logger.info('[Redis] ✅ Connection established successfully.');
        });

        this.client.on('error', (err: any) => {
            logger.error(`[Redis] ❌ Client connection failed: ${err.message}`);
        });

        return this.client;
    }
}

export default RedisClient;
