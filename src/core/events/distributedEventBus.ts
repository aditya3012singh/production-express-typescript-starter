import { createClient, RedisClientType } from 'redis';
import logger from '../logger/structuredLogger.js';
import structuredLogger from '../logger/structuredLogger.js';
import metricsCollector from '../metrics/metricsCollector.js';

interface DeadLetterEntry {
    eventName: string;
    message: string;
    error: string;
    timestamp: string;
    retries: number;
}

class RedisEventBus {
    private publisher: RedisClientType | null = null;
    private subscriber: RedisClientType | null = null;
    private isConnected = false;
    private handlers = new Map<string, Array<(payload: any) => Promise<void>>>();
    private idempotencyStore = new Map<string, number>();
    private deadLetterQueue: DeadLetterEntry[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    async connect(): Promise<boolean> {
        try {
            let redisUrl = process.env.REDIS_URL;
            
            if (redisUrl && redisUrl.includes('${REDIS_PASSWORD}')) {
                redisUrl = redisUrl.replace('${REDIS_PASSWORD}', process.env.REDIS_PASSWORD || '');
            }
            
            if (!redisUrl) {
                const password = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
                redisUrl = `redis://${password}${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
            }

            this.publisher = createClient({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > this.maxReconnectAttempts) {
                            logger.error('[RedisEventBus] ❌ Max reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
                        logger.warn(`[RedisEventBus] ⚠️ Reconnecting in ${delay}ms (attempt ${retries + 1})`);
                        return delay;
                    }
                }
            }) as RedisClientType;

            this.subscriber = createClient({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > this.maxReconnectAttempts) {
                            logger.error('[RedisEventBus] ❌ Subscriber max reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
                        logger.warn(`[RedisEventBus] ⚠️ Subscriber reconnecting in ${delay}ms (attempt ${retries + 1})`);
                        return delay;
                    }
                }
            }) as RedisClientType;

            this.publisher.on('error', (err) => {
                logger.error('[RedisEventBus] ❌ Publisher error:', err);
                this.isConnected = false;
            });

            this.subscriber.on('error', (err) => {
                logger.error('[RedisEventBus] ❌ Subscriber error:', err);
                this.isConnected = false;
            });

            await this.publisher.connect();
            await this.subscriber.connect();

            this.isConnected = true;
            this.reconnectAttempts = 0;

            logger.info('[RedisEventBus] ✅ Connected to Redis');
            return true;
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Failed to connect to Redis:', error);
            this.isConnected = false;
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.publisher) {
                await this.publisher.quit();
            }
            if (this.subscriber) {
                await this.subscriber.quit();
            }
            this.isConnected = false;
            logger.info('[RedisEventBus] ✅ Disconnected from Redis');
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error disconnecting from Redis:', error);
        }
    }

    async publish(eventName: string, payload: any, eventId: string): Promise<boolean> {
        if (!this.isConnected || !this.publisher) {
            logger.warn('[RedisEventBus] ⚠️ Not connected to Redis, skipping publish');
            return false;
        }

        try {
            const message = JSON.stringify({
                eventName,
                payload,
                eventId,
                timestamp: new Date().toISOString(),
                source: 'distributed'
            });

            const subscribers = await this.publisher.publish(eventName, message);

            structuredLogger.logEventEmitted(eventId, eventName, eventId, {
                subscribers,
                payloadSize: message.length,
                source: 'redis'
            });

            metricsCollector.recordEventEmitted(eventName);

            logger.info(`[RedisEventBus] 📤 Published: ${eventName}`, {
                eventId,
                subscribers,
                payloadSize: message.length
            });

            await this.storeEventInRedis(eventName, message, eventId);

            return true;
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error publishing event:', error);
            metricsCollector.recordEventFailed(eventName);
            return false;
        }
    }

    async subscribe(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        if (!this.isConnected || !this.subscriber) {
            logger.warn('[RedisEventBus] ⚠️ Not connected to Redis, cannot subscribe');
            return;
        }

        try {
            if (!this.handlers.has(eventName)) {
                this.handlers.set(eventName, []);
            }
            this.handlers.get(eventName)!.push(handler);

            await this.subscriber.subscribe(eventName, async (message) => {
                let eventData: any;
                try {
                    eventData = JSON.parse(message);
                    const startTime = Date.now();
                    
                    if (this.isEventProcessed(eventData.eventId)) {
                        logger.warn(`[RedisEventBus] ⚠️ Duplicate event detected: ${eventData.eventId}`);
                        structuredLogger.warn('Duplicate event detected', {
                            traceId: eventData.eventId,
                            eventName,
                            eventId: eventData.eventId
                        });
                        return;
                    }

                    this.markEventProcessed(eventData.eventId);

                    structuredLogger.logEventReceived(eventData.eventId, eventName, eventData.eventId, {
                        source: eventData.source
                    });

                    logger.info(`[RedisEventBus] 📥 Received: ${eventName}`, {
                        eventId: eventData.eventId,
                        source: eventData.source
                    });

                    await handler(eventData.payload);

                    const duration = Date.now() - startTime;

                    structuredLogger.logListenerExecution(eventData.eventId, eventName, handler.name || 'anonymous', duration, {
                        source: 'redis'
                    });

                    metricsCollector.recordEventReceived(eventName);
                    metricsCollector.recordListenerExecution(handler.name || 'anonymous', duration, false);

                    logger.info(`[RedisEventBus] ✅ Handler completed: ${eventName}`, {
                        eventId: eventData.eventId,
                        duration
                    });
                } catch (error: any) {
                    logger.error(`[RedisEventBus] ❌ Error handling event: ${eventName}`, error);
                    
                    structuredLogger.logError(eventData?.eventId || 'unknown', `Error handling event: ${eventName}`, error, {
                        eventName
                    });

                    metricsCollector.recordEventFailed(eventName);
                    metricsCollector.recordError('EventHandlingError');
                    
                    this.addToDeadLetterQueue(eventName, message, error);
                }
            });

            logger.info(`[RedisEventBus] 📥 Subscribed to: ${eventName}`, {
                handlerName: handler.name || 'anonymous'
            });
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error subscribing to event:', error);
        }
    }

    isEventProcessed(eventId: string): boolean {
        return this.idempotencyStore.has(eventId);
    }

    markEventProcessed(eventId: string): void {
        this.idempotencyStore.set(eventId, Date.now());
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [id, timestamp] of this.idempotencyStore.entries()) {
            if (timestamp < oneHourAgo) {
                this.idempotencyStore.delete(id);
            }
        }
    }

    async storeEventInRedis(eventName: string, message: string, eventId: string): Promise<void> {
        if (!this.isConnected || !this.publisher) return;

        try {
            const key = `event:${eventName}:${eventId}`;
            const ttl = 24 * 60 * 60; // 24 hours

            await this.publisher.setEx(key, ttl, message);
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error storing event in Redis:', error);
        }
    }

    addToDeadLetterQueue(eventName: string, message: string, error: Error): void {
        try {
            const deadLetterEntry: DeadLetterEntry = {
                eventName,
                message,
                error: error.message,
                timestamp: new Date().toISOString(),
                retries: 0
            };

            this.deadLetterQueue.push(deadLetterEntry);

            logger.error('[RedisEventBus] ❌ Event added to dead letter queue:', {
                eventName,
                error: error.message,
                queueSize: this.deadLetterQueue.length
            });

            this.storeDeadLetterInRedis(deadLetterEntry);
        } catch (err) {
            logger.error('[RedisEventBus] ❌ Error adding to dead letter queue:', err);
        }
    }

    async storeDeadLetterInRedis(deadLetterEntry: DeadLetterEntry): Promise<void> {
        if (!this.isConnected || !this.publisher) return;

        try {
            const key = `deadletter:${deadLetterEntry.eventName}:${Date.now()}`;
            const ttl = 7 * 24 * 60 * 60; // 7 days

            await this.publisher.setEx(key, ttl, JSON.stringify(deadLetterEntry));
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error storing dead letter in Redis:', error);
        }
    }

    getDeadLetterQueue(): DeadLetterEntry[] {
        return this.deadLetterQueue;
    }

    async retryDeadLetter(index: number): Promise<boolean> {
        if (index < 0 || index >= this.deadLetterQueue.length) {
            logger.error('[RedisEventBus] ❌ Invalid dead letter index');
            return false;
        }

        try {
            const deadLetterEntry = this.deadLetterQueue[index];
            const event = JSON.parse(deadLetterEntry.message);

            logger.info('[RedisEventBus] 🔄 Retrying dead letter event:', {
                eventName: deadLetterEntry.eventName,
                retries: deadLetterEntry.retries + 1
            });

            const handlers = this.handlers.get(deadLetterEntry.eventName) || [];

            for (const handler of handlers) {
                try {
                    await handler(event.payload);
                } catch (error) {
                    deadLetterEntry.retries++;
                    logger.error('[RedisEventBus] ❌ Retry failed:', error);
                    return false;
                }
            }

            this.deadLetterQueue.splice(index, 1);
            logger.info('[RedisEventBus] ✅ Dead letter event retried successfully');
            return true;
        } catch (error) {
            logger.error('[RedisEventBus] ❌ Error retrying dead letter:', error);
            return false;
        }
    }

    clearDeadLetterQueue(): void {
        this.deadLetterQueue = [];
        logger.info('[RedisEventBus] 🔄 Dead letter queue cleared');
    }

    isHealthy(): boolean {
        return this.isConnected;
    }

    getHealthStatus(): any {
        return {
            connected: this.isConnected,
            idempotencyStoreSize: this.idempotencyStore.size,
            deadLetterQueueSize: this.deadLetterQueue.length,
            subscribedChannels: this.handlers.size
        };
    }
}

const redisEventBus = new RedisEventBus();
export default redisEventBus;
