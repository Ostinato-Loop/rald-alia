// ALIA Machine Auth Middleware — canonical shared version
// Copy this into each service's src/middleware/machineAuth.ts,
// OR import directly from @rald-alia/shared/machineAuth.
//
// Provides three middleware guards:
//   requireMachineJwt        — any valid machine token
//   requireMachineScope(s)   — token must have specific scope
//   requireMachineFrom(name) — token must be from a specific service

import { Request, Response, NextFunction } from 'express';
import { verifyMachineJwt, type MachineJwtClaims } from './machineJwt';

declare global {
  namespace Express {
    interface Request {
      machine?: MachineJwtClaims;
    }
  }
}

function extractAndVerify(req: Request, res: Response): MachineJwtClaims | null {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error:   'UNAUTHORIZED',
      message: 'Machine bearer token required on this internal route',
    });
    return null;
  }
  try {
    return verifyMachineJwt(header.slice(7));
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error:   err.code ?? 'MACHINE_TOKEN_INVALID',
      message: err.message,
    });
    return null;
  }
}

/** Require any valid machine JWT. Attaches claims to req.machine. */
export function requireMachineJwt(req: Request, res: Response, next: NextFunction): void {
  const claims = extractAndVerify(req, res);
  if (!claims) return;
  req.machine = claims;
  next();
}

/** Require a machine JWT that includes the given scope string. */
export function requireMachineScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const claims = extractAndVerify(req, res);
    if (!claims) return;
    if (!claims.allowed_scopes.includes(scope)) {
      res.status(403).json({
        success: false,
        error:   'INSUFFICIENT_SCOPE',
        message: `Machine token is missing required scope: '${scope}'`,
        token_scopes: claims.allowed_scopes,
      });
      return;
    }
    req.machine = claims;
    next();
  };
}

/** Require a machine JWT issued specifically to a named service. */
export function requireMachineFrom(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const claims = extractAndVerify(req, res);
    if (!claims) return;
    if (claims.service_name !== serviceName) {
      res.status(403).json({
        success: false,
        error:   'FORBIDDEN_SERVICE',
        message: `This route is only accessible by service: '${serviceName}'`,
        token_service: claims.service_name,
      });
      return;
    }
    req.machine = claims;
    next();
  };
}
