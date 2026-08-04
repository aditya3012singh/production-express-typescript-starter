import { Request } from 'express';

interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

interface PaginationOptions {
    defaultLimit?: number;
    maxLimit?: number;
    defaultPage?: number;
}

interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    prevPage: number | null;
    nextPage: number | null;
}

interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta;
}

/**
 * Parse pagination parameters from request query
 */
export const parsePagination = (req: Request, options: PaginationOptions = {}): PaginationParams => {
    const {
        defaultLimit = 10,
        maxLimit = 100,
        defaultPage = 1
    } = options;

    const page = Math.max(1, parseInt(req.query.page as string) || defaultPage);
    const limit = Math.min(
        maxLimit,
        Math.max(1, parseInt(req.query.limit as string) || defaultLimit)
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};

/**
 * Create pagination metadata
 */
export const createPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => {
    const totalPages = Math.ceil(total / limit);
    const hasPrev = page > 1;
    const hasNext = page < totalPages;

    return {
        total,
        page,
        limit,
        totalPages,
        hasPrev,
        hasNext,
        prevPage: hasPrev ? page - 1 : null,
        nextPage: hasNext ? page + 1 : null
    };
};

/**
 * Paginate Prisma database results
 */
export const paginateQuery = async <T>(
    model: { findMany: Function; count: Function },
    pagination: PaginationParams,
    findManyArgs: any = {}
): Promise<PaginatedResult<T>> => {
    const { page, limit, offset } = pagination;

    const [items, total] = await Promise.all([
        model.findMany({
            ...findManyArgs,
            take: limit,
            skip: offset
        }),
        model.count({
            where: findManyArgs.where
        })
    ]);

    return {
        data: items,
        meta: createPaginationMeta(total, page, limit)
    };
};

/**
 * Paginate memory arrays
 */
export const paginateArray = <T>(items: T[], page: number, limit: number): PaginatedResult<T> => {
    const total = items.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedItems = items.slice(start, end);

    return {
        data: paginatedItems,
        meta: createPaginationMeta(total, page, limit)
    };
};
