import { Request, Response, NextFunction } from 'express';
import { RaldAliaError } from '@rald-alia/shared';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof RaldAliaError) {
    return res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  const e = err as Error;
  console.error('[routing-service] Unhandled error:', e?.message ?? err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
