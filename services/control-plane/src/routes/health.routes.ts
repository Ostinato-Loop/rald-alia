// services/control-plane/src/routes/health.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { NetworkHealthService } from '../services/networkHealth';
import { requireMachineScope } from '../middleware/machineAuth';

export const healthRouter = Router();
const svc = new NetworkHealthService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /v1/health — full network health check (all services in parallel)
healthRouter.get(
  '/',
  requireMachineScope('control:health:read'),
  asyncHandler(async (_req, res) => {
    const status = await svc.check();
    const httpStatus = status.overall === 'healthy' ? 200 : status.overall === 'degraded' ? 207 : 503;
    res.status(httpStatus).json({ success: true, data: status });
  }),
);

// GET /v1/health/:service — single service health check
healthRouter.get(
  '/:service',
  requireMachineScope('control:health:read'),
  asyncHandler(async (req, res) => {
    const result = await svc.checkService(req.params.service!);
    if (!result) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Unknown service: ${req.params.service}` } });
    }
    const httpStatus = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 207 : 503;
    res.status(httpStatus).json({ success: true, data: result });
  }),
);
