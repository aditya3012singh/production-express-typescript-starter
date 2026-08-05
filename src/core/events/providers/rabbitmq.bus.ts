import amqp from 'amqplib';
import logger from '../../logger/logger.js';
import { IEventBus } from '../eventBus.interface.js';

export class RabbitMQEventBus implements IEventBus {
    private connection?: any;
    private channel?: any;
    private exchangeName = 'app_events';
    private rabbitUri = process.env.RABBITMQ_URI || 'amqp://localhost:5672';

    async initialize(): Promise<void> {
        try {
            logger.info('🔌 [RabbitMQ] Connecting to RabbitMQ broker...');
            this.connection = await amqp.connect(this.rabbitUri);
            this.channel = await this.connection.createChannel();
            
            // Assert durable topic exchange
            await this.channel.assertExchange(this.exchangeName, 'topic', {
                durable: true
            });

            logger.info('✅ [RabbitMQ] Connected and exchange initialized.');
        } catch (error) {
            logger.error('❌ [RabbitMQ] Failed to connect/initialize RabbitMQ:', error);
            throw error;
        }
    }

    async emitEvent(eventName: string, payload: any, eventId?: string): Promise<void> {
        if (!this.channel) {
            throw new Error('[RabbitMQ] Event bus channel is not initialized.');
        }

        const messageBuffer = Buffer.from(JSON.stringify({
            eventId,
            payload,
            timestamp: new Date().toISOString()
        }));

        this.channel.publish(this.exchangeName, eventName, messageBuffer, {
            persistent: true
        });
    }

    async onEvent(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        if (!this.channel) {
            throw new Error('[RabbitMQ] Event bus channel is not initialized.');
        }

        const queueName = `q_${eventName}`;
        await this.channel.assertQueue(queueName, { durable: true });
        await this.channel.bindQueue(queueName, this.exchangeName, eventName);

        await this.channel.consume(queueName, async (msg: any) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    await handler(content.payload);
                    this.channel?.ack(msg);
                } catch (error) {
                    logger.error(`[RabbitMQ] Error handling event ${eventName}:`, error);
                    this.channel?.nack(msg, false, false);
                }
            }
        });
    }

    async shutdown(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
        logger.info('🔌 [RabbitMQ] Disconnected from RabbitMQ.');
    }
}
