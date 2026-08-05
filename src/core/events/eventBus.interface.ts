export interface IEventBus {
    initialize(): Promise<void>;
    emitEvent(eventName: string, payload: any, eventId?: string): Promise<void>;
    onEvent(eventName: string, handler: (payload: any) => Promise<void>): Promise<void>;
    getDeadLetterQueue?(): any[];
    retryDeadLetter?(index: number): Promise<boolean>;
    clearDeadLetterQueue?(): void;
    getHealthStatus?(): any;
    shutdown?(): Promise<void>;
}
