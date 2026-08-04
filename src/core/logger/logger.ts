import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, errors, printf } = winston.format;

// Standard console formatting for local development
const consoleFormat = printf(({ level, message, timestamp, traceId, requestId, error, stack, ...meta }) => {
    const traceSection = traceId ? ` [traceId:${traceId}]` : '';
    const requestSection = requestId ? ` [reqId:${requestId}]` : '';
    const errorSection = stack ? `\n❌ Stack:\n${stack}` : (error ? `\n❌ Error: ${error}` : '');
    const metaSection = Object.keys(meta as Record<string, unknown>).length ? `\n📦 Metadata: ${JSON.stringify(meta, null, 2)}` : '';
    
    return `${timestamp} [${level.toUpperCase()}]${traceSection}${requestSection}: ${message}${errorSection}${metaSection}`;
});

// Configure winston logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }), // Automatically capture stacks
        process.env.NODE_ENV === 'production' ? json() : consoleFormat
    ),
    transports: [
        new winston.transports.Console(),
        // Daily rotating file transport for error logs
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error'
        }),
        // Daily rotating file transport for all system logs (combined)
        new DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ]
});

export default logger;
