import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  const status  = err.status ?? 500;
  const message = err.message ?? 'Internal server error';
  if (status >= 500) console.error('[loop-voice]', err);
  res.status(status).json({ success: false, error: err.code ?? 'INTERNAL_ERROR', message });
}
