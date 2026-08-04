import { Request, Response, NextFunction } from 'express';

export function timeoutGuard(timeoutMs = 30000) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const timeoutId = setTimeout(() => {
            if (!res.headersSent) {
                res.status(503).json({
                    success: false,
                    message: 'Request timeout: The server took too long to respond.'
                });
            }
        }, timeoutMs);

        res.on('finish', () => clearTimeout(timeoutId));
        res.on('close', () => clearTimeout(timeoutId));
        
        next();
    };
}
