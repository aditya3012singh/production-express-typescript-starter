import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import http from 'http';
import RedisClient from '../../core/cache/redis.client.js';
import env from '../../core/config/env.js';
import logger from '../../core/logger/structuredLogger.js';
import SocketConfig from '../../core/config/socket.js';

class SocketServer {
    static io: Server | null = null;

    static initialize(server: http.Server): Server {
        logger.info('🔌 Starting Socket.IO integration setup...');

        const origins = env.ALLOWED_ORIGINS || [];
        const isProd = env.NODE_ENV === 'production';

        this.io = new Server(server, {
            cors: {
                origin: isProd ? origins : '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        // 🔗 Enable Redis Adapter for Horizontal Scaling
        const redisClient = RedisClient.client;
        if (redisClient) {
            try {
                const pubClient = redisClient.duplicate();
                const subClient = redisClient.duplicate();
                
                this.io.adapter(createAdapter(pubClient, subClient));
                logger.info('✅ Socket.IO Redis adapter enabled successfully.');
            } catch (err: any) {
                logger.error(`❌ Socket.IO Redis adapter integration failed: ${err.message}`);
            }
        }

        // Attach core config singleton
        SocketConfig.setIo(this.io);

        this.setupMiddleware();
        this.setupEventHandlers();

        return this.io;
    }

    static setupMiddleware(): void {
        if (!this.io) return;

        this.io.use((socket: Socket, next) => {
            const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
            
            if (!userId) {
                logger.warn('🔌 [Socket] Connection rejected: Missing userId in auth payload.');
                return next(new Error('Authentication failed: Missing userId'));
            }

            (socket as any).userId = userId;
            next();
        });
    }

    static setupEventHandlers(): void {
        if (!this.io) return;

        this.io.on('connection', (socket: Socket) => {
            const userId = (socket as any).userId;
            logger.info(`🔌 [Socket] Client connected: User ${userId} (Socket ID: ${socket.id})`);

            // Join personal room for private socket channels
            const userRoom = `user:${userId}`;
            socket.join(userRoom);
            
            const sockets = this.io?.sockets.adapter.rooms.get(userRoom);
            const count = sockets ? (sockets.size || (sockets as any).length) : 0;
            logger.info(`🏠 User ${userId} joined private room: ${userRoom} (Total in room: ${count})`);

            // Presence Tracking (Online Status)
            this.updatePresence(userId, true);

            socket.on('disconnect', () => {
                logger.info(`🔌 [Socket] Client disconnected: User ${userId} (Socket ID: ${socket.id})`);
                
                setTimeout(() => {
                    const activeConnections = this.io?.sockets.adapter.rooms.get(userRoom);
                    if (!activeConnections || activeConnections.size === 0) {
                        this.updatePresence(userId, false);
                    }
                }, 5000); // 5s debounce to prevent online/offline flicker on refresh
            });
        });
    }

    static updatePresence(userId: string, isOnline: boolean): void {
        const status = isOnline ? 'online' : 'offline';
        logger.debug(`📡 [Presence] User ${userId} is now ${status}`);
        
        this.io?.emit('presence_change', { userId, status });
    }
}

export default SocketServer;
