import eventBus from './eventBus.js';
import redisEventBus from './redisEventBus.js';
import logger from '../logger/structuredLogger.js';
import structuredLogger from '../logger/structuredLogger.js';
import metricsCollector from '../metrics/metricsCollector.js';
import { IEventBus } from './eventBus.interface.js';

class DualModeEventBus implements IEventBus {
    private localBus = eventBus;
    private distributedBus = redisEventBus;
    public mode: 'local' | 'distributed' | 'dual' = 'dual';
    private isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

    /**
     * Initialize dual mode event bus
     */
    async initialize(): Promise<void> {
        try {
            logger.info('[DualModeEventBus] 🚀 Initializing dual mode event bus...');

            if (this.isRedisEnabled) {
                const connected = await this.distributedBus.connect();
                if (connected) {
                    this.mode = 'dual';
                    logger.info('[DualModeEventBus] ✅ Dual mode enabled (local + Redis)');
                } else {
                    this.mode = 'local';
                    logger.warn('[DualModeEventBus] ⚠️ Redis unavailable, falling back to local mode');
                }
            } else {
                this.mode = 'local';
                logger.info('[DualModeEventBus] ℹ️ Redis disabled, using local mode only');
            }
        } catch (error) {
            logger.error('[DualModeEventBus] ❌ Error initializing dual mode:', error);
            this.mode = 'local';
        }
    }

    /**
     * Emit event to both local and Redis buses
     */
    async emitEvent(eventName: string, payload: any, eventId?: string): Promise<void> {
        const id = eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        try {
            const startTime = Date.now();

            // Always emit to local bus
            this.localBus.emitEvent(eventName, payload);

            // Log event emission with structured logger
            structuredLogger.logEventEmitted(id, eventName, id, {
                mode: this.mode,
                buses: ['local', this.mode === 'dual' ? 'redis' : 'none']
            });

            // Record metrics
            metricsCollector.recordEventEmitted(eventName);

            // Emit to Redis if available
            if (this.mode === 'dual' && this.distributedBus.isHealthy()) {
                await this.distributedBus.publish(eventName, payload, id);
            }

            const duration = Date.now() - startTime;
            structuredLogger.logMetric(id, 'event_emission_time', duration, 'ms', {
                eventName,
                mode: this.mode
            });
        } catch (error: any) {
            logger.error('[DualModeEventBus] ❌ Error emitting event:', error);
            structuredLogger.logError(id, 'Error emitting event', error, {
                eventName,
                mode: this.mode
            });
            metricsCollector.recordError('EventEmissionError');
        }
    }

    /**
     * Register listener for both local and Redis events
     */
    async onEvent(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        try {
            // Always register to local bus
            this.localBus.onEvent(eventName, handler);

            // Register to Redis if available
            if (this.mode === 'dual' && this.distributedBus.isHealthy()) {
                await this.distributedBus.subscribe(eventName, handler);
            }

            logger.info(`[DualModeEventBus] ✅ Listener registered: ${eventName} (mode: ${this.mode})`);
        } catch (error: any) {
            logger.error('[DualModeEventBus] ❌ Error registering listener:', error);
            structuredLogger.logError('unknown', `Error registering listener: ${eventName}`, error, {
                eventName,
                mode: this.mode
            });
            metricsCollector.recordError('ListenerRegistrationError');
        }
    }

    /**
     * Get metrics from both buses
     */
    getMetrics(): any {
        const localMetrics = this.localBus.getMetrics();
        const redisHealth = this.distributedBus.getHealthStatus();

        return {
            mode: this.mode,
            local: localMetrics,
            redis: redisHealth,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Print metrics summary
     */
    printMetricsSummary(): void {
        const metrics = this.getMetrics();

        console.log('\n' + '='.repeat(70));
        console.log('📊 DUAL MODE EVENT BUS METRICS');
        console.log('='.repeat(70));
        console.log(`Mode: ${metrics.mode.toUpperCase()}`);
        console.log(`Timestamp: ${metrics.timestamp}`);

        console.log('\n📍 LOCAL EVENT BUS:');
        console.log(`  Total Events Emitted: ${metrics.local.summary.totalEventsEmitted}`);
        console.log(`  Total Listener Executions: ${metrics.local.summary.totalListenerExecutions}`);
        console.log(`  Failed Executions: ${metrics.local.summary.failedListenerExecutions}`);
        console.log(`  Success Rate: ${metrics.local.summary.successRate}`);

        if (metrics.mode === 'dual') {
            console.log('\n🌐 REDIS EVENT BUS:');
            console.log(`  Connected: ${metrics.redis.connected ? '✅' : '❌'}`);
            console.log(`  Subscribed Channels: ${metrics.redis.subscribedChannels}`);
            console.log(`  Idempotency Store Size: ${metrics.redis.idempotencyStoreSize}`);
            console.log(`  Dead Letter Queue Size: ${metrics.redis.deadLetterQueueSize}`);
        }

        console.log('='.repeat(70) + '\n');
    }

    getDeadLetterQueue(): any[] {
        return this.distributedBus.getDeadLetterQueue();
    }

    async retryDeadLetter(index: number): Promise<boolean> {
        return this.distributedBus.retryDeadLetter(index);
    }

    clearDeadLetterQueue(): void {
        this.distributedBus.clearDeadLetterQueue();
    }

    getHealthStatus(): any {
        return {
            mode: this.mode,
            local: {
                healthy: true
            },
            redis: this.distributedBus.getHealthStatus(),
            timestamp: new Date().toISOString()
        };
    }

    async shutdown(): Promise<void> {
        try {
            logger.info('[DualModeEventBus] 🛑 Shutting down dual mode event bus...');
            
            if (this.mode === 'dual') {
                await this.distributedBus.disconnect();
            }
            
            logger.info('[DualModeEventBus] ✅ Dual mode event bus shut down');
        } catch (error) {
            logger.error('[DualModeEventBus] ❌ Error shutting down:', error);
        }
    }
}

const dualModeEventBus = new DualModeEventBus();
export default dualModeEventBus;
