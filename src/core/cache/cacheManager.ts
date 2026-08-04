import UserCache from './userCache.js';
import structuredLogger from '../logger/structuredLogger.js';

class CacheManager {
    /**
     * Update user details in the system (invalidates cache to keep sync)
     */
    static async handleUserUpdate(userId: string): Promise<void> {
        structuredLogger.debug(`[CacheManager] User updated: ${userId}. Invalidating cache...`);
        await UserCache.invalidate(userId);
    }
}

export default CacheManager;
