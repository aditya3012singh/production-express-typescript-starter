import amqp from 'amqplib';
import logger from '../../logger/structuredLogger.js';
import { IEventBus } from '../eventBus.interface.js';

export class RabbitMQEventBus implements IEventBus {
    private connection?: any;
    private channel?: any;
    private isConnected = false;
    private exchangeName = 'app_events';
    private rabbitUri = process.env.RABBITMQ_URI || 'amqp://localhost:5672';

    async connect(): Promise<boolean> {
        try {
            await this.initialize();
            return true;
        } catch (error) {
            return false;
        }
    }

    async initialize(): Promise<void> {
        try {
            logger.info('🔌 [RabbitMQ] Connecting to RabbitMQ broker...');
            this.connection = await amqp.connect(this.rabbitUri);
            this.channel = await this.connection.createChannel();

            await this.channel.assertExchange(this.exchangeName, 'topic', {
                durable: true
            });

            this.isConnected = true;
            logger.info('✅ [RabbitMQ] Connected and exchange initialized.');
        } catch (error) {
            this.isConnected = false;
            logger.error('❌ [RabbitMQ] Failed to connect/initialize RabbitMQ:', error);
            throw error;
        }
    }

    isHealthy(): boolean {
        return this.isConnected;
    }

    async emitEvent(eventName: string, payload: any, eventId?: string): Promise<void> {
        return this.publish(eventName, payload, eventId);
    }

    async publish(eventName: string, payload: any, eventId?: string): Promise<void> {
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
        return this.subscribe(eventName, handler);
    }

    async subscribe(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        if (!this.channel) {
            throw new Error('[RabbitMQ] Event bus channel is not initialized.');
        }

        const appName = process.env.APP_NAME || 'base-backend';
        const handlerIdentifier = handler.name || 'default';
        const queueName = `q_${eventName}_${appName}_${handlerIdentifier}`;
        
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

    getHealthStatus(): any {
        return {
            connected: this.isConnected,
            exchange: this.exchangeName,
            timestamp: new Date().toISOString()
        };
    }

    getDeadLetterQueue(): any[] {
        return [];
    }

    async retryDeadLetter(_index: number): Promise<boolean> {
        return false;
    }

    clearDeadLetterQueue(): void {}

    async disconnect(): Promise<void> {
        return this.shutdown();
    }

    async shutdown(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
        this.isConnected = false;
        logger.info('🔌 [RabbitMQ] Disconnected from RabbitMQ.');
    }
}

const rabbitMQEventBus = new RabbitMQEventBus();
export default rabbitMQEventBus;
