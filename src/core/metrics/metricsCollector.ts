interface EventMetrics {
    emitted: number;
    received: number;
    failed: number;
    byType: Record<string, number>;
}

interface JobMetrics {
    queued: number;
    started: number;
    completed: number;
    failed: number;
    byType: Record<string, { queued: number; completed: number; failed: number }>;
}

interface RequestMetrics {
    total: number;
    successful: number;
    failed: number;
    byMethod: Record<string, number>;
    byPath: Record<string, number>;
}

interface ListenerMetrics {
    executed: number;
    failed: number;
    byName: Record<string, { executed: number; failed: number }>;
}

interface TimingMetrics {
    eventProcessing: number[];
    jobProcessing: number[];
    requestProcessing: number[];
    listenerExecution: number[];
}

interface ErrorMetrics {
    total: number;
    byType: Record<string, number>;
}

interface MetricsSchema {
    events: EventMetrics;
    jobs: JobMetrics;
    requests: RequestMetrics;
    listeners: ListenerMetrics;
    timings: TimingMetrics;
    errors: ErrorMetrics;
    startTime: Date;
}

class MetricsCollector {
    private metrics!: MetricsSchema;

    constructor() {
        this.reset();
    }

    /**
     * Record event emitted
     */
    recordEventEmitted(eventName: string): void {
        this.metrics.events.emitted++;
        if (!this.metrics.events.byType[eventName]) {
            this.metrics.events.byType[eventName] = 0;
        }
        this.metrics.events.byType[eventName]++;
    }

    /**
     * Record event received
     */
    recordEventReceived(eventName: string): void {
        this.metrics.events.received++;
    }

    /**
     * Record event failed
     */
    recordEventFailed(eventName: string): void {
        this.metrics.events.failed++;
    }

    /**
     * Record job queued
     */
    recordJobQueued(jobName: string): void {
        this.metrics.jobs.queued++;
        if (!this.metrics.jobs.byType[jobName]) {
            this.metrics.jobs.byType[jobName] = { queued: 0, completed: 0, failed: 0 };
        }
        this.metrics.jobs.byType[jobName].queued++;
    }

    /**
     * Record job started
     */
    recordJobStarted(jobName: string): void {
        this.metrics.jobs.started++;
    }

    /**
     * Record job completed
     */
    recordJobCompleted(jobName: string, duration: number): void {
        this.metrics.jobs.completed++;
        if (!this.metrics.jobs.byType[jobName]) {
            this.metrics.jobs.byType[jobName] = { queued: 0, completed: 0, failed: 0 };
        }
        this.metrics.jobs.byType[jobName].completed++;
        this.pushTiming('jobProcessing', duration);
    }

    /**
     * Record job failed
     */
    recordJobFailed(jobName: string): void {
        this.metrics.jobs.failed++;
        if (!this.metrics.jobs.byType[jobName]) {
            this.metrics.jobs.byType[jobName] = { queued: 0, completed: 0, failed: 0 };
        }
        this.metrics.jobs.byType[jobName].failed++;
    }

    /**
     * Record request details
     */
    recordRequest(method: string, path: string, statusCode: number, duration: number): void {
        this.metrics.requests.total++;
        
        if (statusCode >= 200 && statusCode < 400) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }

        if (!this.metrics.requests.byMethod[method]) {
            this.metrics.requests.byMethod[method] = 0;
        }
        this.metrics.requests.byMethod[method]++;

        if (!this.metrics.requests.byPath[path]) {
            this.metrics.requests.byPath[path] = 0;
        }
        this.metrics.requests.byPath[path]++;

        this.pushTiming('requestProcessing', duration);
    }

    /**
     * Record listener execution
     */
    recordListenerExecution(listenerName: string, duration: number, failed = false): void {
        this.metrics.listeners.executed++;
        
        if (failed) {
            this.metrics.listeners.failed++;
        }

        if (!this.metrics.listeners.byName[listenerName]) {
            this.metrics.listeners.byName[listenerName] = { executed: 0, failed: 0 };
        }
        this.metrics.listeners.byName[listenerName].executed++;
        if (failed) {
            this.metrics.listeners.byName[listenerName].failed++;
        }
        this.pushTiming('listenerExecution', duration);
    }

    /**
     * Record error occurrences
     */
    recordError(errorType: string): void {
        this.metrics.errors.total++;
        if (!this.metrics.errors.byType[errorType]) {
            this.metrics.errors.byType[errorType] = 0;
        }
        this.metrics.errors.byType[errorType]++;
    }

    private pushTiming(arrayName: keyof TimingMetrics, duration: number): void {
        const arr = this.metrics.timings[arrayName];
        if (arr) {
            arr.push(duration);
            if (arr.length > 1000) {
                arr.shift();
            }
        }
    }

    private calculateAverage(timings: number[]): number {
        if (timings.length === 0) return 0;
        return Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
    }

    private calculatePercentile(timings: number[], percentile: number): number {
        if (timings.length === 0) return 0;
        const sorted = [...timings].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Get metrics summary
     */
    getMetrics(): any {
        const uptime = Date.now() - this.metrics.startTime.getTime();

        return {
            timestamp: new Date().toISOString(),
            uptime: {
                ms: uptime,
                seconds: Math.round(uptime / 1000),
                minutes: Math.round(uptime / 60000)
            },
            events: {
                emitted: this.metrics.events.emitted,
                received: this.metrics.events.received,
                failed: this.metrics.events.failed,
                successRate: this.metrics.events.emitted > 0
                    ? ((this.metrics.events.emitted - this.metrics.events.failed) / this.metrics.events.emitted * 100).toFixed(2) + '%'
                    : 'N/A',
                byType: this.metrics.events.byType
            },
            jobs: {
                queued: this.metrics.jobs.queued,
                started: this.metrics.jobs.started,
                completed: this.metrics.jobs.completed,
                failed: this.metrics.jobs.failed,
                successRate: this.metrics.jobs.completed > 0
                    ? ((this.metrics.jobs.completed / (this.metrics.jobs.completed + this.metrics.jobs.failed)) * 100).toFixed(2) + '%'
                    : 'N/A',
                byType: this.metrics.jobs.byType
            },
            requests: {
                total: this.metrics.requests.total,
                successful: this.metrics.requests.successful,
                failed: this.metrics.requests.failed,
                successRate: this.metrics.requests.total > 0
                    ? ((this.metrics.requests.successful / this.metrics.requests.total) * 100).toFixed(2) + '%'
                    : 'N/A',
                byMethod: this.metrics.requests.byMethod,
                byPath: this.metrics.requests.byPath
            },
            listeners: {
                executed: this.metrics.listeners.executed,
                failed: this.metrics.listeners.failed,
                successRate: this.metrics.listeners.executed > 0
                    ? (((this.metrics.listeners.executed - this.metrics.listeners.failed) / this.metrics.listeners.executed) * 100).toFixed(2) + '%'
                    : 'N/A',
                byName: this.metrics.listeners.byName
            },
            timings: {
                eventProcessing: {
                    avg: this.calculateAverage(this.metrics.timings.eventProcessing),
                    p50: this.calculatePercentile(this.metrics.timings.eventProcessing, 50),
                    p95: this.calculatePercentile(this.metrics.timings.eventProcessing, 95),
                    p99: this.calculatePercentile(this.metrics.timings.eventProcessing, 99)
                },
                jobProcessing: {
                    avg: this.calculateAverage(this.metrics.timings.jobProcessing),
                    p50: this.calculatePercentile(this.metrics.timings.jobProcessing, 50),
                    p95: this.calculatePercentile(this.metrics.timings.jobProcessing, 95),
                    p99: this.calculatePercentile(this.metrics.timings.jobProcessing, 99)
                },
                requestProcessing: {
                    avg: this.calculateAverage(this.metrics.timings.requestProcessing),
                    p50: this.calculatePercentile(this.metrics.timings.requestProcessing, 50),
                    p95: this.calculatePercentile(this.metrics.timings.requestProcessing, 95),
                    p99: this.calculatePercentile(this.metrics.timings.requestProcessing, 99)
                },
                listenerExecution: {
                    avg: this.calculateAverage(this.metrics.timings.listenerExecution),
                    p50: this.calculatePercentile(this.metrics.timings.listenerExecution, 50),
                    p95: this.calculatePercentile(this.metrics.timings.listenerExecution, 95),
                    p99: this.calculatePercentile(this.metrics.timings.listenerExecution, 99)
                }
            },
            errors: {
                total: this.metrics.errors.total,
                byType: this.metrics.errors.byType
            }
        };
    }

    /**
     * Reset metrics
     */
    reset(): void {
        this.metrics = {
            events: {
                emitted: 0,
                received: 0,
                failed: 0,
                byType: {}
            },
            jobs: {
                queued: 0,
                started: 0,
                completed: 0,
                failed: 0,
                byType: {}
            },
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byMethod: {},
                byPath: {}
            },
            listeners: {
                executed: 0,
                failed: 0,
                byName: {}
            },
            timings: {
                eventProcessing: [],
                jobProcessing: [],
                requestProcessing: [],
                listenerExecution: []
            },
            errors: {
                total: 0,
                byType: {}
            },
            startTime: new Date()
        };
    }
}

// Singleton instance
const metricsCollector = new MetricsCollector();
export default metricsCollector;
