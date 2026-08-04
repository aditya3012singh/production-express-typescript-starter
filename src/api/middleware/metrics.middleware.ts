import { Request, Response, NextFunction } from 'express';
import { recordApiRequest } from '../../core/metrics/index.js';
import structuredLogger from '../../core/logger/structuredLogger.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const endpoint = normalizeEndpoint(req.path);
  
  const originalEnd = res.end;
  res.end = function(...args: any[]): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    try {
      recordApiRequest({
        method: req.method,
        endpoint,
        statusCode,
        duration
      });
    } catch (error: any) {
      structuredLogger.error('Failed to record API metrics', {
        error: error.message,
        endpoint,
        method: req.method
      });
    }
    
    return originalEnd.apply(res, args as any);
  };
  
  next();
}

function normalizeEndpoint(path: string): string {
  path = path.split('?')[0];
  path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  path = path.replace(/\/\d+(?=\/|$)/g, '/:id');
  return path || '/';
}
