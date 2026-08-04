import logger from '../../logger/logger.js';

interface EventBusInterface {
    onEvent(eventName: string, handler: (payload: any) => Promise<void>): Promise<void>;
}

/**
 * Register all domain event listeners
 */
export function registerListeners(eventBus: EventBusInterface): void {
    logger.info('🎧 Registering core system event listeners...');
    
    // Core event listener registrations can be added here in project implementations
}
