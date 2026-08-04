import { Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { TracedRequest } from "./traceId.middleware.js";

export const validateRequest = (schema: ZodSchema) => (req: TracedRequest, res: Response, next: NextFunction): any => {
    try {
        const shape = (schema as any).shape || {};
        const hasTopLevelKeys = Object.keys(shape).some(key => ["body", "query", "params"].includes(key));
        
        if (hasTopLevelKeys) {
            const validated = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            }) as any;
            (req as any).validated = validated;
            if (validated.body !== undefined) req.body = validated.body;
            if (validated.query !== undefined) req.query = validated.query;
            if (validated.params !== undefined) req.params = validated.params;
        } else {
            const validatedBody = schema.parse(req.body) as any;
            (req as any).validated = { body: validatedBody };
            req.body = validatedBody;
        }
        
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues || [];
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        next(error);
    }
};

export default validateRequest;
