import client from 'prom-client';
import {
  apiRequestsTotal,
  apiRequestDurationMs,
  apiErrorsTotal
} from './apiMetrics.js';

import {
  cacheHitsTotal,
  cacheMissesTotal,
  cacheHitRatio
} from './cacheMetrics.js';

import {
  dbQueriesTotal,
  dbQueryDurationMs,
  dbTransactionsTotal,
  dbTransactionDurationMs,
  dbErrorsTotal
} from './dbMetrics.js';

// Export the core Prometheus registry
const register = client.register;
export { register };

// Enable default system metrics (CPU, Memory, Event Loop Lag, etc.)
client.collectDefaultMetrics({
  prefix: 'node_'
});

// Re-export metrics components
export {
  apiRequestsTotal,
  apiRequestDurationMs,
  apiErrorsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  cacheHitRatio,
  dbQueriesTotal,
  dbQueryDurationMs,
  dbTransactionsTotal,
  dbTransactionDurationMs,
  dbErrorsTotal
};

// ============================================================================
// METRIC RECORDING HELPER FUNCTIONS
// ============================================================================

/**
 * Record cache hit or miss metric
 */
export function recordCacheAccess(cacheName: string, isHit: boolean): void {
  if (isHit) {
    cacheHitsTotal.labels(cacheName).inc();
  } else {
    cacheMissesTotal.labels(cacheName).inc();
  }
}

/**
 * Record database query metrics
 */
export function recordDbQuery({ operation, model, durationMs, success, errorCode }: {
  operation: string;
  model: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}): void {
  dbQueriesTotal.labels(operation, model).inc();
  dbQueryDurationMs.labels(operation, model).observe(durationMs);

  if (!success) {
    dbErrorsTotal.labels(operation, model, errorCode || 'unknown').inc();
  }
}

/**
 * Record database transactions metrics
 */
export function recordDbTransaction(status: 'committed' | 'rolled_back', durationMs: number): void {
  dbTransactionsTotal.labels(status).inc();
  dbTransactionDurationMs.labels(status).observe(durationMs);
}

/**
 * Record API request metrics
 */
export function recordApiRequest({ method, endpoint, statusCode, duration }: {
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
}): void {
  apiRequestsTotal.labels(method, endpoint, statusCode.toString()).inc();
  apiRequestDurationMs.labels(method, endpoint, statusCode.toString()).observe(duration);
  
  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
    apiErrorsTotal.labels(endpoint, errorType, statusCode.toString()).inc();
  }
}
