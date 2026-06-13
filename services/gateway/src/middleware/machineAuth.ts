import { Request, Response, NextFunction } from 'express';
import { verifyMachineJwt, type MachineJwtClaims } from '@rald-alia/shared/machineJwt';

declare global {
  namespace Express {
    interface Request {
      machine?: MachineJwtClaims;
    }
  }
}

export function requireMachineJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Machine bearer token required' });
    return;
  }
  try {
    req.machine = verifyMachineJwt(header.slice(7));
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.code ?? 'MACHINE_TOKEN_INVALID', message: err.message });
  }
}

export function requireMachineScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireMachineJwt(req, res, () => {
      if (!req.machine!.allowed_scopes.includes(scope)) {
        res.status(403).json({ success: false, error: 'INSUFFICIENT_SCOPE', message: `Scope '${scope}' required` });
        return;
      }
      next();
    });
  };
}
