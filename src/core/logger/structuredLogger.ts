import logger from './logger.js';
import { contextStorage } from './context.js';

class StructuredLogger {
    /**
     * Get trace ID for the current context (resolves dynamically from AsyncLocalStorage)
     */
    getTraceId(): string {
        return contextStorage.getStore()?.traceId || 'system';
    }

    /**
     * Log with structured flat format
     */
    log(level: string, message: string, metadata: any = {}): void {
        const store = contextStorage.getStore();
        
        let formattedMeta: Record<string, any> = {};
        if (metadata && typeof metadata === 'object') {
            if (metadata instanceof Error) {
                formattedMeta = { error: metadata.message, stack: metadata.stack };
            } else {
                formattedMeta = { ...metadata };
            }
        } else if (metadata !== undefined && metadata !== null) {
            formattedMeta = { extra: metadata };
        }

        const traceId = formattedMeta.traceId || store?.traceId || 'system';
        const requestId = formattedMeta.requestId || store?.requestId;
        
        logger.log({
            level,
            message,
            traceId,
            ...(requestId ? { requestId } : {}),
            timestamp: new Date().toISOString(),
            ...formattedMeta
        });
    }

    /**
     * Log info level
     */
    info(message: string, metadata: any = {}): void {
        this.log('info', message, metadata);
    }

    /**
     * Log error level
     */
    error(message: string, metadata: any = {}): void {
        this.log('error', message, metadata);
    }

    /**
     * Log warn level
     */
    warn(message: string, metadata: any = {}): void {
        this.log('warn', message, metadata);
    }

    /**
     * Log debug level
     */
    debug(message: string, metadata: any = {}): void {
        this.log('debug', message, metadata);
    }

    /**
     * Log request start
     */
    logRequestStart(traceId: string | undefined, method: string, path: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('REQUEST_START', {
            traceId: activeTrace,
            method,
            path,
            ...metadata
        });
    }

    /**
     * Log request end
     */
    logRequestEnd(traceId: string | undefined, statusCode: number, duration: number, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('REQUEST_END', {
            traceId: activeTrace,
            statusCode,
            durationMs: duration,
            ...metadata
        });
    }

    /**
     * Log event emission
     */
    logEventEmitted(traceId: string | undefined, eventName: string, eventId: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('EVENT_EMITTED', {
            traceId: activeTrace,
            eventName,
            eventId,
            ...metadata
        });
    }

    /**
     * Log event received
     */
    logEventReceived(traceId: string | undefined, eventName: string, eventId: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('EVENT_RECEIVED', {
            traceId: activeTrace,
            eventName,
            eventId,
            ...metadata
        });
    }

    /**
     * Log listener execution
     */
    logListenerExecution(traceId: string | undefined, eventName: string, listenerName: string, duration: number, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('LISTENER_EXECUTED', {
            traceId: activeTrace,
            eventName,
            listenerName,
            durationMs: duration,
            ...metadata
        });
    }

    /**
     * Log job queued
     */
    logJobQueued(traceId: string | undefined, jobId: string | number | undefined, jobName: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('JOB_QUEUED', {
            traceId: activeTrace,
            jobId,
            jobName,
            ...metadata
        });
    }

    /**
     * Log job started
     */
    logJobStarted(traceId: string | undefined, jobId: string | number | undefined, jobName: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('JOB_STARTED', {
            traceId: activeTrace,
            jobId,
            jobName,
            ...metadata
        });
    }

    /**
     * Log job completed
     */
    logJobCompleted(traceId: string | undefined, jobId: string | number | undefined, jobName: string, duration: number, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('JOB_COMPLETED', {
            traceId: activeTrace,
            jobId,
            jobName,
            durationMs: duration,
            ...metadata
        });
    }

    /**
     * Log job failed
     */
    logJobFailed(traceId: string | undefined, jobId: string | number | undefined, jobName: string, error: string, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.error('JOB_FAILED', {
            traceId: activeTrace,
            jobId,
            jobName,
            error,
            ...metadata
        });
    }

    /**
     * Log error with trace
     */
    logError(traceId: string | undefined, message: string, error: Error, metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.error(message, {
            traceId: activeTrace,
            error: error.message,
            stack: error.stack,
            ...metadata
        });
    }

    /**
     * Log performance metric
     */
    logMetric(traceId: string | undefined, metricName: string, value: number, unit = 'ms', metadata: Record<string, any> = {}): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('METRIC', {
            traceId: activeTrace,
            metricName,
            value,
            unit,
            ...metadata
        });
    }

    /**
     * Log event flow chain
     */
    logEventFlowChain(traceId: string | undefined, chain: Array<{ step: number; service: string; duration?: number; timestamp: string }>): void {
        const activeTrace = traceId || this.getTraceId();
        this.info('EVENT_FLOW_CHAIN', {
            traceId: activeTrace,
            chain: chain.map(step => ({
                step: step.step,
                service: step.service,
                duration: step.duration,
                timestamp: step.timestamp
            })),
            totalDuration: chain.reduce((sum, step) => sum + (step.duration || 0), 0)
        });
    }
}

const structuredLogger = new StructuredLogger();
export default structuredLogger;
