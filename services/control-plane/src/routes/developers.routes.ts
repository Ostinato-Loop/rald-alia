// services/control-plane/src/routes/developers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeveloperQueueService } from '../services/developerQueue';
import { requireMachineScope } from '../middleware/machineAuth';

export const developersRouter = Router();
const svc = new DeveloperQueueService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /v1/developers — list developer queue (admin view across all statuses)
developersRouter.get(
  '/',
  requireMachineScope('control:developers:read'),
  asyncHandler(async (req, res) => {
    const { status, country, page, limit } = req.query;
    const result = await svc.listQueue({
      status:  typeof status  === 'string' ? status  : undefined,
      country: typeof country === 'string' ? country : undefined,
      page:    page  ? Number(page)  : 1,
      limit:   limit ? Math.min(Number(limit), 200) : 50,
    });
    res.json({ success: true, data: result.items, meta: { total: result.total } });
  }),
);

// GET /v1/developers/stats — aggregate counts per status
developersRouter.get(
  '/stats',
  requireMachineScope('control:developers:read'),
  asyncHandler(async (_req, res) => {
    const stats = await svc.getStats();
    res.json({ success: true, data: stats });
  }),
);

// POST /v1/developers/:id/approve — applied → verified
const ActorSchema = z.object({ actor_id: z.string().min(1) });

developersRouter.post(
  '/:id/approve',
  requireMachineScope('control:developers:write'),
  asyncHandler(async (req, res) => {
    const parsed = ActorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const result = await svc.approve(req.params.id!, parsed.data.actor_id);
    res.json({ success: true, data: result });
  }),
);

// POST /v1/developers/:id/activate — verified → active
developersRouter.post(
  '/:id/activate',
  requireMachineScope('control:developers:write'),
  asyncHandler(async (req, res) => {
    const parsed = ActorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const result = await svc.activate(req.params.id!, parsed.data.actor_id);
    res.json({ success: true, data: result });
  }),
);

// POST /v1/developers/:id/suspend — active → suspended
const SuspendSchema = z.object({ actor_id: z.string().min(1), reason: z.string().min(1) });

developersRouter.post(
  '/:id/suspend',
  requireMachineScope('control:developers:write'),
  asyncHandler(async (req, res) => {
    const parsed = SuspendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const result = await svc.suspend(req.params.id!, parsed.data.actor_id, parsed.data.reason);
    res.json({ success: true, data: result });
  }),
);

// POST /v1/developers/:id/revoke — any → revoked
const RevokeSchema = z.object({ actor_id: z.string().min(1), reason: z.string().min(1) });

developersRouter.post(
  '/:id/revoke',
  requireMachineScope('control:developers:write'),
  asyncHandler(async (req, res) => {
    const parsed = RevokeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const result = await svc.revoke(req.params.id!, parsed.data.actor_id, parsed.data.reason);
    res.json({ success: true, data: result });
  }),
);
