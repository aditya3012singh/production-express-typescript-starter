import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
    traceId: string;
    requestId?: string;
}

export const contextStorage = new AsyncLocalStorage<LogContext>();
