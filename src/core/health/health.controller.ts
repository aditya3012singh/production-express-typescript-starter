import { Request, Response, NextFunction } from 'express';
import healthCheckService from './healthCheck.js';

class HealthController {
    static async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const health = await healthCheckService.getHealthStatus();
            const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
            res.status(statusCode).json(health);
        } catch (error) {
            next(error);
        }
    }
}

export default HealthController;
