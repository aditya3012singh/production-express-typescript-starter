import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../../core/config/env.js';
import { TracedRequest } from './traceId.middleware.js';

export function authenticateJWT(req: TracedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        
        jwt.verify(token, env.JWT_ACCESS_SECRET, (err: any, user: any) => {
            if (err) {
                res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token' });
                return;
            }
            req.user = user;
            req.userId = user.id;
            next();
        });
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized: Missing authorization token' });
    }
}

export function authorizeRole(roles: string[]) {
    return (req: TracedRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
            return;
        }
        next();
    };
}
