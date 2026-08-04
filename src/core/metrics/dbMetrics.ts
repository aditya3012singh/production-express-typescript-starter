import client from 'prom-client';

export const dbQueriesTotal = new client.Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries executed',
  labelNames: ['operation', 'model']
});

export const dbQueryDurationMs = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in milliseconds',
  labelNames: ['operation', 'model'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
});

export const dbTransactionsTotal = new client.Counter({
  name: 'db_transactions_total',
  help: 'Total number of database transactions executed',
  labelNames: ['status'] // 'committed', 'rolled_back'
});

export const dbTransactionDurationMs = new client.Histogram({
  name: 'db_transaction_duration_ms',
  help: 'Duration of database transactions in milliseconds',
  labelNames: ['status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

export const dbErrorsTotal = new client.Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors encountered',
  labelNames: ['operation', 'model', 'error_code']
});
