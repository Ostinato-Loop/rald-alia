// packages/shared/src/validate.ts
// Zod validation middleware factory — uniform error format across all services.
//
// Usage:
//   import { validateBody, validateQuery, validateParams } from '@rald-alia/shared/validate';
//
//   router.post('/aliases', validateBody(CreateAliasSchema), asyncHandler(async (req, res) => {
//     const { alias_type, phone } = req.body; // already validated + typed
//   }));

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type ZodSchema, ZodError } from 'zod';

function formatZodError(err: ZodError): Record<string, string[]> {
  const flat = err.flatten();
  return {
    ...flat.fieldErrors as Record<string, string[]>,
    ...(flat.formErrors.length ? { _form: flat.formErrors } : {}),
  };
}

function validationErrorResponse(res: Response, errors: Record<string, string[]>) {
  return res.status(400).json({
    success: false,
    error: {
      code:    'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors,
    },
  });
}

/** Validates `req.body` against a Zod schema.
 *  On success, replaces req.body with the parsed (coerced + defaulted) value. */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return validationErrorResponse(res, formatZodError(result.error));
    }
    req.body = result.data;
    next();
  };
}

/** Validates `req.query` against a Zod schema. */
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return validationErrorResponse(res, formatZodError(result.error));
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

/** Validates `req.params` against a Zod schema. */
export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return validationErrorResponse(res, formatZodError(result.error));
    }
    (req as any).validatedParams = result.data;
    next();
  };
}

// ── Common param schemas ──────────────────────────────────────────────────────
import { z } from 'zod';

export const UUIDParam    = z.object({ id: z.string().uuid() });
export const PageQuery    = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const CountryCode  = z.string().length(2).toUpperCase();
export const AliasTypeEnum = z.enum([
  'phone', 'bank_account', 'national_id',
  'passport', 'email', 'merchant_id',
]);
