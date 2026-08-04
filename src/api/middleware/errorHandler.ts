import { Response, NextFunction } from 'express';
import structuredLogger from '../../core/logger/structuredLogger.js';
import { TracedRequest } from './traceId.middleware.js';

export function errorHandler(err: any, req: TracedRequest, res: Response, next: NextFunction): void {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    // Log error with structured log details
    structuredLogger.logError(req.traceId, message, err, {
        path: req.path,
        method: req.method,
        statusCode
    });

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
    });
}
