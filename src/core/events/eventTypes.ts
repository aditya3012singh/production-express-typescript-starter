export const EventTypes = {
    // Auth Events
    USER_REGISTERED: 'UserRegistered' as const,
    USER_AUTHENTICATED: 'UserAuthenticated' as const
};

export type EventTypeKeys = typeof EventTypes[keyof typeof EventTypes];

export const EventSchemas: Record<EventTypeKeys, object> = {
    [EventTypes.USER_REGISTERED]: {
        type: 'object',
        properties: {
            userId: { type: 'string' },
            email: { type: 'string' },
            username: { type: 'string' }
        },
        required: ['userId', 'email', 'username']
    },
    [EventTypes.USER_AUTHENTICATED]: {
        type: 'object',
        properties: {
            userId: { type: 'string' },
            ip: { type: 'string' },
            userAgent: { type: 'string' }
        },
        required: ['userId']
    }
};
