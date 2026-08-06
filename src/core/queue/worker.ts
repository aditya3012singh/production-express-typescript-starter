import { Worker, Job } from 'bullmq';
import env from '../config/env.js';
import logger from '../logger/structuredLogger.js';
import EmailService from '../email/email.service.js';

const connectionOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
};

const queueName = env.QUEUE_NAME || 'default_queue';

// Job Handlers Registry
const jobHandlers: Record<string, (data: any) => Promise<void>> = {
    /**
     * Send test email job handler
     */
    send_test_email: async (data: any) => {
        logger.info('[Worker] Processing send_test_email job...');
        await EmailService.sendEmail({
            to: data.to,
            subject: data.subject || 'Hello from base backend!',
            text: data.text || 'This is a test email sent asynchronously via background queues.',
            html: data.html || '<p>This is a test email sent asynchronously via background queues.</p>',
        });
    },
};

/**
 * Initialize and start the BullMQ Worker
 */
export function startWorker(): Worker {
    logger.info(`[Worker] ⚙️ Starting background worker on queue: ${queueName}...`);

    const worker = new Worker(
        queueName,
        async (job: Job) => {
            const handler = jobHandlers[job.name];
            if (!handler) {
                logger.warn(`[Worker] ⚠️ No registered handler found for job: ${job.name}`);
                return;
            }

            logger.info(`[Worker] 🏃 Executing job ${job.name} (ID: ${job.id})`);
            const start = Date.now();
            
            try {
                await handler(job.data);
                const duration = Date.now() - start;
                logger.info(`[Worker] ✅ Job ${job.name} (ID: ${job.id}) completed in ${duration}ms`);
            } catch (error) {
                logger.error(`[Worker] ❌ Job ${job.name} (ID: ${job.id}) failed:`, error);
                throw error;
            }
        },
        {
            connection: connectionOptions,
            concurrency: env.WORKER_CONCURRENCY || 5,
        }
    );

    worker.on('active', (job) => {
        logger.debug(`[Worker] Job active: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[Worker] Job failed: ${job?.id}. Error: ${err.message}`);
    });

    worker.on('error', (err) => {
        logger.error(`[Worker] General worker error:`, err);
    });

    process.on('SIGTERM', async () => {
        logger.info('[Worker] 🛑 SIGTERM received. Closing worker...');
        await worker.close();
        logger.info('[Worker] 📥 Worker closed.');
    });

    return worker;
}

// Automatically start if executed directly
const isDirectRun = process.argv[1]?.endsWith('worker.js') || 
                     process.argv[1]?.endsWith('worker') ||
                     process.argv[1]?.endsWith('worker.ts');
if (isDirectRun) {
    startWorker();
}
