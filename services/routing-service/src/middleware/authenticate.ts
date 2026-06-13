import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@rald-alia/shared';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  // Allow service-to-service calls from trusted internal header
  if (req.headers['x-internal-service'] === process.env['INTERNAL_SERVICE_SECRET']) {
    req.userId = req.headers['x-user-id'] as string | undefined;
    return next();
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Missing Bearer token');
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    req.userId = payload['sub'] as string;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
