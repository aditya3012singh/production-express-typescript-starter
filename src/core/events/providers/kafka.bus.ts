import { Kafka, Producer, Consumer } from 'kafkajs';
import logger from '../../logger/logger.js';
import { IEventBus } from '../eventBus.interface.js';

export class KafkaEventBus implements IEventBus {
    private kafka?: Kafka;
    private producer?: Producer;
    private consumer?: Consumer;
    private isConnected = false;
    private clientId = 'base-backend';
    private topicName = 'app_events';
    private brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

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
            logger.info(`🔌 [Kafka] Connecting to Kafka brokers (${this.brokers.join(', ')})...`);
            this.kafka = new Kafka({
                clientId: this.clientId,
                brokers: this.brokers
            });

            this.producer = this.kafka.producer();
            await this.producer.connect();

            this.consumer = this.kafka.consumer({ groupId: 'base-backend-group' });
            await this.consumer.connect();

            this.isConnected = true;
            logger.info('✅ [Kafka] Connected to Kafka successfully.');
        } catch (error) {
            this.isConnected = false;
            logger.error('❌ [Kafka] Failed to connect/initialize Kafka:', error);
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
        if (!this.producer) {
            throw new Error('[Kafka] Event bus producer is not initialized.');
        }

        await this.producer.send({
            topic: this.topicName,
            messages: [
                {
                    key: eventName,
                    value: JSON.stringify({
                        eventId,
                        eventName,
                        payload,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
    }

    async onEvent(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        return this.subscribe(eventName, handler);
    }

    async subscribe(eventName: string, handler: (payload: any) => Promise<void>): Promise<void> {
        if (!this.consumer) {
            throw new Error('[Kafka] Event bus consumer is not initialized.');
        }

        await this.consumer.subscribe({ topic: this.topicName, fromBeginning: false });

        await this.consumer.run({
            eachMessage: async ({ message }) => {
                try {
                    const key = message.key?.toString();
                    if (key === eventName && message.value) {
                        const content = JSON.parse(message.value.toString());
                        await handler(content.payload);
                    }
                } catch (error) {
                    logger.error(`[Kafka] Error handling event ${eventName}:`, error);
                }
            }
        });
    }

    getHealthStatus(): any {
        return {
            connected: this.isConnected,
            brokers: this.brokers,
            topic: this.topicName,
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
        await this.producer?.disconnect();
        await this.consumer?.disconnect();
        this.isConnected = false;
        logger.info('🔌 [Kafka] Disconnected from Kafka.');
    }
}

const kafkaEventBus = new KafkaEventBus();
export default kafkaEventBus;
