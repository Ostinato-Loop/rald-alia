import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  console.error('[registry-service] FATAL: JWT_SECRET is not set');
  process.exit(1);
}

export interface AuthPayload {
  sub:          string;
  type:         'user' | 'machine' | 'admin';
  service_name?: string;
  role?:        string;
  iat:          number;
  exp:          number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Bearer token required' });
    return;
  }
  try {
    const token   = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET!) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Token invalid or expired' });
  }
}

export function requireMachineOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) { requireAuth(req, res, () => requireMachineOrAdmin(req, res, next)); return; }
  if (req.auth.type === 'machine' || req.auth.type === 'admin') { next(); return; }
  res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Machine or admin token required' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) { requireAuth(req, res, () => requireAdmin(req, res, next)); return; }
  if (req.auth.type === 'admin') { next(); return; }
  res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Admin token required' });
}
