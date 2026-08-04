import RedisClient from './redis.client.js';
import { prisma } from '../config/db.wrapper.js';
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
            return prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    profilePic: true,
                    linkedin: true,
                    github: true,
                    createdAt: true
                }
            }) as Promise<CachedUser | null>;
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
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    profilePic: true,
                    linkedin: true,
                    github: true,
                    createdAt: true
                }
            });

            if (user) {
                // Save to Redis (async, do not await to optimize thread block duration)
                redis.set(key, JSON.stringify(user), 'EX', TTL).catch((err: any) => {
                    structuredLogger.error(`[UserCache] Set failed for key ${key}:`, { error: err.message });
                });
            }

            return user as CachedUser | null;

        } catch (error) {
            structuredLogger.error(`[UserCache] Fetch failed for ${userId}:`, { error: (error as any).message });
            // Fallback: Query directly from DB to prevent API blockages
            return prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    profilePic: true,
                    linkedin: true,
                    github: true,
                    createdAt: true
                }
            }) as Promise<CachedUser | null>;
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

    /**
     * Cache warmup routine
     */
    static async warmUp(): Promise<void> {
        structuredLogger.info('🔥 [UserCache] Starting user cache warmup...');
        const redis = RedisClient.client;
        if (!redis) {
            structuredLogger.warn('⚠️ [UserCache] Redis unavailable. Skipping warmup.');
            return;
        }

        try {
            const users = await prisma.user.findMany({
                take: 100, // Warm up 100 most active/recent users
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    profilePic: true,
                    linkedin: true,
                    github: true,
                    createdAt: true
                }
            });

            let count = 0;

            for (const user of users) {
                const key = `${CACHE_PREFIX}${user.id}`;
                await redis.set(key, JSON.stringify(user), 'EX', TTL);
                count++;
            }

            structuredLogger.info(`✅ [UserCache] Warmup completed. Cached ${count} active users.`);
        } catch (error) {
            structuredLogger.error('❌ [UserCache] Warmup failed:', { error: (error as any).message });
        }
    }
}

export default UserCache;
