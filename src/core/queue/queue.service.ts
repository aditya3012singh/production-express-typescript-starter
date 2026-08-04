import { Queue } from 'bullmq';
import env from '../config/env.js';
import logger from '../logger/logger.js';

const connectionOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
};

const queueName = env.QUEUE_NAME || 'default_queue';

class QueueService {
    private static queue: Queue | null = null;

    /**
     * Get the active BullMQ Queue instance
     */
    static getQueue(): Queue | null {
        if (this.queue) {
            return this.queue;
        }

        try {
            logger.info(`[QueueService] 📦 Initializing BullMQ Queue: ${queueName}`);
            this.queue = new Queue(queueName, {
                connection: connectionOptions,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            });
        } catch (error) {
            logger.error(`[QueueService] ❌ Failed to initialize BullMQ Queue:`, error);
        }

        return this.queue;
    }

    /**
     * Add a job to the background queue
     */
    static async addJob(jobName: string, data: any = {}, options: any = {}): Promise<any> {
        const queue = this.getQueue();
        if (!queue) {
            logger.error(`[QueueService] ❌ Queue not initialized. Cannot queue job: ${jobName}`);
            return null;
        }

        try {
            const job = await queue.add(jobName, data, options);
            logger.info(`[QueueService] 🚀 Job ${jobName} queued successfully (ID: ${job.id})`);
            return job;
        } catch (error) {
            logger.error(`[QueueService] ❌ Failed to add job ${jobName} to queue:`, error);
            throw error;
        }
    }
}

export default QueueService;
