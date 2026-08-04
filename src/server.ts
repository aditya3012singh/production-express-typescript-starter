import http from 'http';
import app from './app.js';
import env from './core/config/env.js';
import logger from './core/logger/logger.js';
import RedisClient from './core/cache/redis.client.js';
import { prisma } from './core/config/db.wrapper.js';
import dualModeEventBus from './core/events/dualModeEventBus.js';
import { registerListeners } from './core/events/listeners/index.js';
import UserCache from './core/cache/userCache.js';
import SocketServer from './integrations/socket/socket.server.js';

class ServerApp {
    private static server: http.Server;

    static async start(): Promise<void> {
        logger.info('🚀 Booting Base Backend Server...');
        const start = Date.now();

        try {
            // 1. Verify Database Connection
            logger.info('[Database] Checking connection to postgres database...');
            await prisma.$connect();
            logger.info('✅ [Database] Connection verified.');

            // 2. Initialize Redis Connection
            RedisClient.initialize();

            // 3. Initialize Distributed Event Bus
            await dualModeEventBus.initialize();
            
            // Register event listeners
            registerListeners(dualModeEventBus);

            // 4. Cache Warmup (async, non-blocking)
            UserCache.warmUp().catch(err => {
                logger.error('❌ [Cache] Warmup failed:', err);
            });

            // 5. Initialize HTTP Server & Sockets
            this.server = http.createServer(app);
            
            // Initialize Socket.io server
            SocketServer.initialize(this.server);

            const port = env.PORT || 4000;
            this.server.listen(port, () => {
                const elapsed = Date.now() - start;
                logger.info(`🚀 API Server successfully started on port ${port} (${elapsed}ms)`);
            });

            // Graceful shutdown handling
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            logger.error('❌ Critical server boot failure:', error);
            process.exit(1);
        }
    }

    static async shutdown(): Promise<void> {
        logger.info('🛑 SIGTERM/SIGINT received. Initiating graceful shutdown...');
        
        if (this.server) {
            this.server.close(async () => {
                logger.info('[Server] HTTP server closed.');

                try {
                    // Close Redis
                    if (RedisClient.client) {
                        await RedisClient.client.quit();
                        logger.info('[Server] Redis client connection closed.');
                    }

                    // Close Event Bus
                    await dualModeEventBus.shutdown();

                    // Disconnect Prisma
                    await prisma.$disconnect();
                    logger.info('[Server] Database connection closed.');

                    logger.info('👋 Graceful shutdown complete.');
                    process.exit(0);
                } catch (err) {
                    logger.error('[Server] Error during shutdown:', err);
                    process.exit(1);
                }
            });
        } else {
            process.exit(0);
        }
    }
}

export default ServerApp;
