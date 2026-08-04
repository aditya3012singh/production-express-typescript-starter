import client from 'prom-client';

export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name']
});

export const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name']
});

export const cacheHitRatio = new client.Gauge({
  name: 'cache_hit_ratio',
  help: 'Ratio of cache hits to total requests',
  labelNames: ['cache_name']
});
