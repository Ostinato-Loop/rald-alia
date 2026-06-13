// Machine JWT middleware for resolution-engine
// Used on /resolve/verify — requires machine token with correct scope.

import { Request, Response, NextFunction } from 'express';
import { verifyMachineJwt, type MachineJwtClaims } from '@rald-alia/shared/machineJwt';

declare global {
  namespace Express {
    interface Request {
      machine?: MachineJwtClaims;
    }
  }
}

export function requireMachineScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    if (!claims.allowed_scopes.includes(scope)) {
      res.status(403).json({
        success: false,
        error:   'INSUFFICIENT_SCOPE',
        message: `Machine token missing required scope: ${scope}`,
      });
      return;
    }

    req.machine = claims;
    next();
  };
}
