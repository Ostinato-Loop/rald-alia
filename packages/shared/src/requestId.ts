// X-Request-ID middleware
// Adds a unique request ID to every inbound request.
// If caller provides X-Request-ID it is preserved (for distributed tracing).
// The ID is attached to req.requestId and echoed in the response header.

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
