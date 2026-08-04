import { Response, NextFunction } from 'express';
import { TracedRequest } from './traceId.middleware.js';

export interface FormattedResponse extends Response {
    ok?: (data?: any, message?: string) => Response;
    created?: (data?: any, message?: string) => Response;
}

export function responseFormatter(req: TracedRequest, res: FormattedResponse, next: NextFunction): void {
    res.ok = (data: any = {}, message = 'Operation successful'): Response => {
        return res.status(200).json({ success: true, message, data });
    };

    res.created = (data: any = {}, message = 'Resource created successfully'): Response => {
        return res.status(201).json({ success: true, message, data });
    };
    
    next();
}
