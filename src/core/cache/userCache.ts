import RedisClient from './redis.client.js';
import userRepository from '../../modules/auth/repositories/user.repository.js';
import structuredLogger from '../logger/structuredLogger.js';
import { recordCacheAccess } from '../metrics/index.js';

const CACHE_PREFIX = 'user:';
const TTL = 3600; // 1 hour in seconds

export interface CachedUser {
    id: string;
    username: string;
    email: string;
    role: 'USER' | 'ADMIN';
    profilePic: string | null;
    linkedin: string | null;
    github: string | null;
    createdAt: Date;
}

class UserCache {
    /**
     * Get user from Cache or DB
     */
    static async get(userId: string): Promise<CachedUser | null> {
        const key = `${CACHE_PREFIX}${userId}`;
        const redis = RedisClient.client;

        if (!redis) {
            return userRepository.findById(userId) as Promise<CachedUser | null>;
        }

        try {
            // 1. Fetch from Cache
            const cached = await redis.get(key);
            if (cached) {
                recordCacheAccess('UserCache', true);
                return JSON.parse(cached);
            }

            // 2. Fetch from database if miss
            recordCacheAccess('UserCache', false);
            const user = await userRepository.findById(userId);

            if (user) {
                // Save to Redis (async)
                redis.set(key, JSON.stringify(user), 'EX', TTL).catch((err: any) => {
                    structuredLogger.error(`[UserCache] Set failed for key ${key}:`, { error: err.message });
                });
            }

            return user as CachedUser | null;

        } catch (error) {
            structuredLogger.error(`[UserCache] Fetch failed for ${userId}:`, { error: (error as any).message });
            // Fallback: Query directly from DB to prevent API blockages
            return userRepository.findById(userId) as Promise<CachedUser | null>;
        }
    }

    /**
     * Invalidate Cache entry
     */
    static async invalidate(userId: string): Promise<void> {
        const key = `${CACHE_PREFIX}${userId}`;
        const redis = RedisClient.client;
        if (!redis) return;

        try {
            await redis.del(key);
            structuredLogger.debug(`[UserCache] Invalidated cache entry for user: ${userId}`);
        } catch (error) {
            structuredLogger.error(`[UserCache] Invalidation failed for ${userId}:`, { error: (error as any).message });
        }
    }
}

export default UserCache;
