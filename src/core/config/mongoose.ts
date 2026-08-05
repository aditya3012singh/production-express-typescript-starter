import mongoose from 'mongoose';
import logger from '../logger/logger.js';

class MongooseDatabase {
    static async connect(): Promise<void> {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/base_backend';
            logger.info('🔌 [MongoDB] Connecting to MongoDB cluster...');
            
            await mongoose.connect(mongoUri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            logger.info('✅ [MongoDB] Connected to MongoDB database successfully.');
        } catch (error) {
            logger.error('❌ [MongoDB] Connection to MongoDB failed:', error);
            process.exit(1);
        }
    }

    static async disconnect(): Promise<void> {
        await mongoose.disconnect();
        logger.info('🔌 [MongoDB] Disconnected from MongoDB cluster.');
    }
}

export default MongooseDatabase;
