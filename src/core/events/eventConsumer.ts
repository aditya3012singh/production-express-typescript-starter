import dualModeEventBus from './dualModeEventBus.js';
import logger from '../logger/logger.js';

interface ListenerConfig {
    eventName: string;
    handler: (payload: any) => Promise<void>;
}

class EventConsumer {
    private isInitialized = false;
    private listeners = new Map<string, Array<(payload: any) => Promise<void>>>();

    async initialize(): Promise<void> {
        try {
            logger.info('[EventConsumer] 🚀 Initializing event consumer...');
            await dualModeEventBus.initialize();
            this.isInitialized = true;
            logger.info('[EventConsumer] ✅ Event consumer initialized');
        } catch (error) {
            logger.error('[EventConsumer] ❌ Error initializing event consumer:', error);
            throw error;
        }
    }

    async registerListener(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Event consumer not initialized');
        }

        try {
            await dualModeEventBus.onEvent(eventName, handler);

            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName)!.push(handler);

            logger.info('[EventConsumer] 📥 Listener registered:', {
                eventName,
                handlerName: handler.name || 'anonymous'
            });
        } catch (error) {
            logger.error('[EventConsumer] ❌ Error registering listener:', error);
            throw error;
        }
    }

    async registerListeners(listenerConfigs: ListenerConfig[]): Promise<void> {
        try {
            logger.info('[EventConsumer] 📥 Registering multiple listeners...');
            for (const config of listenerConfigs) {
                await this.registerListener(config.eventName, config.handler);
            }
            logger.info('[EventConsumer] ✅ All listeners registered');
        } catch (error) {
            logger.error('[EventConsumer] ❌ Error registering listeners:', error);
            throw error;
        }
    }

    getListeners(): Map<string, Array<(payload: any) => Promise<void>>> {
        return this.listeners;
    }

    getListenerCount(): number {
        let count = 0;
        for (const handlers of this.listeners.values()) {
            count += handlers.length;
        }
        return count;
    }

    printStatus(): void {
        const health = dualModeEventBus.getHealthStatus();

        console.log('\n' + '='.repeat(70));
        console.log('📊 EVENT CONSUMER STATUS');
        console.log('='.repeat(70));
        console.log(`Mode: ${health.mode.toUpperCase()}`);
        console.log(`Initialized: ${this.isInitialized ? '✅' : '❌'}`);
        console.log(`Registered Listeners: ${this.getListenerCount()}`);
        console.log(`Subscribed Events: ${this.listeners.size}`);

        if (health.mode === 'dual') {
            console.log(`\nRedis Connected: ${health.redis.connected ? '✅' : '❌'}`);
            console.log(`Redis Subscribed Channels: ${health.redis.subscribedChannels}`);
            console.log(`Dead Letter Queue Size: ${health.redis.deadLetterQueueSize}`);
        }

        console.log('='.repeat(70) + '\n');
    }

    async shutdown(): Promise<void> {
        try {
            logger.info('[EventConsumer] 🛑 Shutting down event consumer...');
            await dualModeEventBus.shutdown();
            this.isInitialized = false;
            logger.info('[EventConsumer] ✅ Event consumer shut down');
        } catch (error) {
            logger.error('[EventConsumer] ❌ Error shutting down event consumer:', error);
        }
    }
}

const eventConsumer = new EventConsumer();
export default eventConsumer;
