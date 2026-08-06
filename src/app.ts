import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './core/config/env.js';
import { traceIdMiddleware } from './api/middleware/traceId.middleware.js';
import { metricsMiddleware } from './api/middleware/metrics.middleware.js';
import { responseFormatter } from './api/middleware/responseFormatter.js';
import { timeoutGuard } from './api/middleware/timeout.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { register } from './core/metrics/index.js';
import { apiRateLimiter } from './api/middleware/rateLimiter.js';
import AuthRouter from './modules/auth/auth.routes.js';
import HealthRouter from './core/health/health.routes.js';
import healthCheckService from './core/health/healthCheck.js';
import passport from './modules/auth/passport.js';
import { TracedRequest } from './api/middleware/traceId.middleware.js';
import logger from './core/logger/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './core/config/swagger.js';

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// CORS configuration
const origins = env.ALLOWED_ORIGINS || [];
app.use(cors({
    origin: env.NODE_ENV === 'production' ? origins : true,
    credentials: true
}));

// Request Tracking and Logger middleware
app.use(traceIdMiddleware);
app.use(metricsMiddleware);
if (env.NODE_ENV !== 'test') {
    app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

app.use(responseFormatter);
app.use(timeoutGuard(30000));

// Passport OAuth Middleware
app.use(passport.initialize());

// Swagger API Interactive Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res, next) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        next(err);
    }
});

// General API Health check endpoint (Observability check)
app.get('/api/health-check', async (req: TracedRequest, res, next) => {
    try {
        const health = await healthCheckService.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
        res.status(statusCode).json({
            ...health,
            traceId: req.traceId
        });
    } catch (error: any) {
        logger.error('Failed to get health status:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
            traceId: req.traceId
        });
    }
});

// Global API Rate Limiter
app.use('/api/', apiRateLimiter);

// App Router bindings
app.use('/api/auth', AuthRouter);
app.use('/api/health', HealthRouter);

// Global Uncaught Error Handler
app.use(errorHandler);

export default app;
