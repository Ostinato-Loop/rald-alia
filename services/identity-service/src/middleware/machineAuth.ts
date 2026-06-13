// Machine JWT verification middleware
// Drop-in replacement for X-Internal-Secret on all internal service routes.
// Attach to any route that should only be callable by other ALIA services.

import { Request, Response, NextFunction } from 'express';
import { verifyMachineJwt, type MachineJwtClaims } from '@rald-alia/shared/machineJwt';

declare global {
  namespace Express {
    interface Request {
      machine?: MachineJwtClaims;
    }
  }
}

// Require any valid machine JWT
export function requireMachineJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Machine bearer token required' });
    return;
  }

  let claims: MachineJwtClaims;
  try {
    claims = verifyMachineJwt(header.slice(7));
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.code ?? 'MACHINE_TOKEN_INVALID', message: err.message });
    return;
  }

  req.machine = claims;
  next();
}

// Require machine JWT with a specific scope
export function requireMachineScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireMachineJwt(req, res, () => {
      if (!req.machine!.allowed_scopes.includes(scope)) {
        res.status(403).json({
          success: false,
          error:   'INSUFFICIENT_SCOPE',
          message: `Machine token missing required scope: ${scope}`,
        });
        return;
      }
      next();
    });
  };
}

// Require machine JWT from a specific trusted service
export function requireMachineFrom(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireMachineJwt(req, res, () => {
      if (req.machine!.service_name !== serviceName) {
        res.status(403).json({
          success: false,
          error:   'FORBIDDEN_SERVICE',
          message: `Route only accessible by service: ${serviceName}`,
        });
        return;
      }
      next();
    });
  };
}
