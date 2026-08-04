import EventEmitter from 'events';
import logger from '../logger/logger.js';

interface MetricSchema {
    totalEventsEmitted: number;
    totalListenerExecutions: number;
    failedListenerExecutions: number;
    totalRetries: number;
    eventTimings: Record<string, number[]>;
    listenerErrors: Record<string, Array<{ error: string; timestamp: Date; retryCount: number }>>;
}

class DomainEventBus extends EventEmitter {
    public metrics: MetricSchema;
    public debugMode: boolean;
    public criticalEvents: Set<string>;
    public retryConfig: {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
    };

    constructor() {
        super();
        this.setMaxListeners(50);
        
        this.metrics = {
            totalEventsEmitted: 0,
            totalListenerExecutions: 0,
            failedListenerExecutions: 0,
            totalRetries: 0,
            eventTimings: {},
            listenerErrors: {}
        };
        
        this.debugMode = process.env.EVENT_DEBUG === 'true';
        this.criticalEvents = new Set([]);
        this.retryConfig = {
            maxRetries: 3,
            initialDelayMs: 100,
            maxDelayMs: 5000
        };
    }

    validateEventPayload(eventName: string, payload: any): boolean {
        if (!eventName || typeof eventName !== 'string') {
            logger.error('[EventBus] ❌ Invalid event name:', eventName);
            return false;
        }

        if (!payload || typeof payload !== 'object') {
            logger.error('[EventBus] ❌ Invalid payload for event:', eventName);
            return false;
        }

        if (Object.keys(payload).length === 0) {
            logger.warn('[EventBus] ⚠️ Empty payload for event:', eventName);
        }

        return true;
    }

    sanitizePayload(payload: any): any {
        if (!payload) return {};
        
        const sanitized = { ...payload };
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    calculateBackoffDelay(retryCount: number): number {
        const delay = this.retryConfig.initialDelayMs * Math.pow(2, retryCount);
        return Math.min(delay, this.retryConfig.maxDelayMs);
    }

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    emitEvent(eventName: string, payload: any): void {
        if (!this.validateEventPayload(eventName, payload)) {
            logger.error('[EventBus] ❌ Event validation failed:', eventName);
            return;
        }

        this.metrics.totalEventsEmitted++;

        const eventId = this.generateEventId();
        const timestamp = new Date();
        const sanitizedPayload = this.sanitizePayload(payload);

        logger.info(`[EventBus] 📤 Emitting: ${eventName}`, {
            eventId,
            eventName,
            timestamp: timestamp.toISOString(),
            payloadKeys: Object.keys(payload || {}),
            payloadSize: JSON.stringify(payload).length
        });

        if (this.debugMode) {
            logger.debug(`[EventBus] 🔍 DEBUG - Full payload for ${eventName}:`, sanitizedPayload);
        }

        this.emit(eventName, {
            eventName,
            payload,
            timestamp,
            eventId
        });
    }

    async executeHandlerWithRetry(
        eventName: string, 
        handler: Function, 
        event: any, 
        retryCount = 0
    ): Promise<{ success: boolean; error?: Error; retries: number }> {
        const startTime = Date.now();
        const handlerName = handler.name || 'anonymous';

        try {
            await Promise.race([
                handler(event.payload),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Handler timeout after 30s')), 30000)
                )
            ]);

            const executionTime = Date.now() - startTime;

            this.metrics.totalListenerExecutions++;
            if (!this.metrics.eventTimings[eventName]) {
                this.metrics.eventTimings[eventName] = [];
            }
            this.metrics.eventTimings[eventName].push(executionTime);

            logger.info(`[EventBus] ✅ Listener completed: ${eventName} (${handlerName})`, {
                eventId: event.eventId,
                executionTimeMs: executionTime,
                retries: retryCount
            });

            return { success: true, retries: retryCount };
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            const isCriticalEvent = this.criticalEvents.has(eventName);
            const shouldRetry = isCriticalEvent && retryCount < this.retryConfig.maxRetries;

            this.metrics.failedListenerExecutions++;
            if (!this.metrics.listenerErrors[eventName]) {
                this.metrics.listenerErrors[eventName] = [];
            }
            this.metrics.listenerErrors[eventName].push({
                error: error.message,
                timestamp: new Date(),
                retryCount
            });

            if (shouldRetry) {
                const backoffDelay = this.calculateBackoffDelay(retryCount);
                this.metrics.totalRetries++;

                logger.warn(`[EventBus] ⚠️ Listener failed, retrying: ${eventName} (${handlerName})`, {
                    eventId: event.eventId,
                    error: error.message,
                    executionTimeMs: executionTime,
                    retryCount: retryCount + 1,
                    backoffDelayMs: backoffDelay
                });

                await this.sleep(backoffDelay);
                return this.executeHandlerWithRetry(eventName, handler, event, retryCount + 1);
            } else {
                logger.error(`[EventBus] ❌ Listener failed (no more retries): ${eventName} (${handlerName})`, {
                    eventId: event.eventId,
                    error: error.message,
                    executionTimeMs: executionTime,
                    retryCount,
                    stack: error.stack
                });

                return { success: false, error, retries: retryCount };
            }
        }
    }

    async emitAndWait(eventName: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Event ${eventName} timed out after 5000ms`));
            }, 5000);

            const listeners = this.listeners(eventName);
            
            if (listeners.length === 0) {
                clearTimeout(timeout);
                logger.warn(`[EventBus] ⚠️ No listeners for: ${eventName} - allowing by default`);
                resolve({ allowed: true });
                return;
            }

            const handler = listeners[0];
            Promise.resolve(handler({ eventName, payload, timestamp: new Date() }))
                .then(result => {
                    clearTimeout(timeout);
                    logger.info(`[EventBus] ✅ ${eventName} validation result:`, result);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    logger.error(`[EventBus] ❌ ${eventName} validation error:`, error);
                    reject(error);
                });
        });
    }

    onEvent(eventName: string, handler: Function): void {
        logger.info(`[EventBus] 📥 Registering listener for: ${eventName}`, {
            handlerName: handler.name || 'anonymous'
        });
        
        this.on(eventName, async (event: any) => {
            try {
                if (this.debugMode) {
                    logger.debug(`[EventBus] 🔍 DEBUG - Processing event: ${eventName}`, {
                        eventId: event.eventId,
                        handlerName: handler.name || 'anonymous'
                    });
                }

                const result = await this.executeHandlerWithRetry(eventName, handler, event);

                if (!result.success) {
                    logger.error(`[EventBus] ❌ Listener execution failed after retries: ${eventName}`, {
                        eventId: event.eventId,
                        error: result.error?.message
                    });
                }
            } catch (error: any) {
                logger.error(`[EventBus] ❌ Unexpected error in listener: ${eventName}`, {
                    eventId: event.eventId,
                    error: error.message,
                    stack: error.stack
                });
            }
        });
    }

    generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    getMetrics(): any {
        const avgTimings: Record<string, any> = {};
        Object.entries(this.metrics.eventTimings).forEach(([eventName, timings]) => {
            if (timings.length > 0) {
                avgTimings[eventName] = {
                    count: timings.length,
                    avgMs: Math.round(timings.reduce((a, b) => a + b, 0) / timings.length),
                    minMs: Math.min(...timings),
                    maxMs: Math.max(...timings)
                };
            }
        });

        return {
            summary: {
                totalEventsEmitted: this.metrics.totalEventsEmitted,
                totalListenerExecutions: this.metrics.totalListenerExecutions,
                failedListenerExecutions: this.metrics.failedListenerExecutions,
                totalRetries: this.metrics.totalRetries,
                successRate: this.metrics.totalListenerExecutions > 0
                    ? ((this.metrics.totalListenerExecutions - this.metrics.failedListenerExecutions) / this.metrics.totalListenerExecutions * 100).toFixed(2) + '%'
                    : 'N/A'
            },
            timings: avgTimings,
            errors: this.metrics.listenerErrors
        };
    }

    printMetricsSummary(): void {
        const metrics = this.getMetrics();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 EVENT BUS METRICS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Events Emitted: ${metrics.summary.totalEventsEmitted}`);
        console.log(`Total Listener Executions: ${metrics.summary.totalListenerExecutions}`);
        console.log(`Failed Executions: ${metrics.summary.failedListenerExecutions}`);
        console.log(`Total Retries: ${metrics.summary.totalRetries}`);
        console.log(`Success Rate: ${metrics.summary.successRate}`);
        
        if (Object.keys(metrics.timings).length > 0) {
            console.log('\n📈 EXECUTION TIMINGS (ms):');
            Object.entries(metrics.timings).forEach(([eventName, timing]: [string, any]) => {
                console.log(`  ${eventName}: avg=${timing.avgMs}ms, min=${timing.minMs}ms, max=${timing.maxMs}ms (${timing.count} executions)`);
            });
        }
        
        if (Object.keys(metrics.errors).length > 0) {
            console.log('\n❌ ERRORS:');
            Object.entries(metrics.errors).forEach(([eventName, errors]: [string, any]) => {
                console.log(`  ${eventName}: ${errors.length} error(s)`);
                errors.slice(-3).forEach((err: any) => {
                    console.log(`    - ${err.error} (retry #${err.retryCount})`);
                });
            });
        }
        
        console.log('='.repeat(60) + '\n');
    }

    resetMetrics(): void {
        this.metrics = {
            totalEventsEmitted: 0,
            totalListenerExecutions: 0,
            failedListenerExecutions: 0,
            totalRetries: 0,
            eventTimings: {},
            listenerErrors: {}
        };
        logger.info('[EventBus] 🔄 Metrics reset');
    }
}

const eventBus = new DomainEventBus();
export default eventBus;
