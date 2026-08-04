import client from 'prom-client';

export const apiRequestsTotal = new client.Counter({
  name: 'express_api_requests_total',
  help: 'Total number of HTTP requests processed by Express',
  labelNames: ['method', 'route', 'status']
});

export const apiRequestDurationMs = new client.Histogram({
  name: 'express_api_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

export const apiErrorsTotal = new client.Counter({
  name: 'express_api_errors_total',
  help: 'Total number of HTTP requests that resulted in an error',
  labelNames: ['method', 'route', 'status', 'error_type']
});
