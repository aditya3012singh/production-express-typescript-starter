import { Kafka, Producer, Consumer } from 'kafkajs';
import logger from '../../logger/logger.js';
import { IEventBus } from '../eventBus.interface.js';

export class KafkaEventBus implements IEventBus {
    private kafka?: Kafka;
    private producer?: Producer;
    private consumer?: Consumer;
    private clientId = 'base-backend';
    private topicName = 'app_events';
    private brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

    async initialize(): Promise<void> {
        try {
            logger.info('🔌 [Kafka] Connecting to Kafka brokers...');
            this.kafka = new Kafka({
                clientId: this.clientId,
                brokers: this.brokers
            });

            this.producer = this.kafka.producer();
            await this.producer.connect();

            this.consumer = this.kafka.consumer({ groupId: 'base-backend-group' });
            await this.consumer.connect();

            logger.info('✅ [Kafka] Connected successfully.');
        } catch (error) {
            logger.error('❌ [Kafka] Failed to connect/initialize Kafka:', error);
            throw error;
        }
    }

    async emitEvent(eventName: string, payload: any, eventId?: string): Promise<void> {
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

    async shutdown(): Promise<void> {
        await this.producer?.disconnect();
        await this.consumer?.disconnect();
        logger.info('🔌 [Kafka] Disconnected from Kafka.');
    }
}
