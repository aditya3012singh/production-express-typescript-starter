import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import structuredLogger from '../../core/logger/structuredLogger.js';
import { contextStorage } from '../../core/logger/context.js';

export interface TracedRequest extends Request {
    traceId?: string;
    requestId?: string;
    userId?: string;
    user?: any;
}

export function traceIdMiddleware(req: TracedRequest, res: Response, next: NextFunction): void {
    const traceparent = req.headers['traceparent'] as string | undefined;
    const parts = traceparent?.split('-');
    const incomingTraceId = (req.headers['x-trace-id'] as string | undefined) || (parts?.length === 4 ? parts[1] : undefined);
    
    const traceId = incomingTraceId || crypto.randomUUID().replace(/-/g, '');
    const requestId = `req_${crypto.randomUUID().replace(/-/g, '')}`;
    
    req.traceId = traceId;
    req.requestId = requestId;
    
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Request-ID', requestId);
    
    const startTime = Date.now();
    structuredLogger.logRequestStart(traceId, req.method, req.path, {
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    
    const originalEnd = res.end;
    res.end = function(...args: any[]): any {
        const duration = Date.now() - startTime;
        
        structuredLogger.logRequestEnd(traceId, res.statusCode, duration, {
            requestId,
            contentLength: res.get('content-length')
        });
        
        return originalEnd.apply(res, args as any);
    };
    
    contextStorage.run({ traceId, requestId }, () => {
        next();
    });
}

export async function withTraceId<T>(traceId: string, fn: (traceId: string) => Promise<T>): Promise<T> {
    try {
        return await contextStorage.run({ traceId }, () => fn(traceId));
    } catch (error: any) {
        structuredLogger.logError(traceId, 'Error in traced function', error);
        throw error;
    }
}

export function createEventTraceContext(traceId: string, eventName: string): any {
    return {
        traceId,
        eventName,
        eventId: `evt_${crypto.randomUUID()}`,
        timestamp: new Date().toISOString()
    };
}

export function createJobTraceContext(traceId: string, jobName: string): any {
    return {
        traceId,
        jobName,
        jobId: `job_${crypto.randomUUID()}`,
        timestamp: new Date().toISOString()
    };
}
