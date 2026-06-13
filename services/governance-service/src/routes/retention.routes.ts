// services/governance-service/src/routes/retention.routes.ts
// Data retention policy management and deletion scheduling.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RetentionEngine } from '../services/retentionEngine';
import { requireMachineScope } from '../middleware/machineAuth';

export const retentionRouter = Router();
const engine = new RetentionEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── GET /v1/governance/retention/policies ────────────────────────────────────
// List all retention policy classes.

retentionRouter.get('/policies', asyncHandler(async (_req, res) => {
  const policies = engine.getPolicies();
  res.json({ success: true, data: policies, meta: { total: policies.length } });
}));

// ── GET /v1/governance/retention/policies/:class ─────────────────────────────

retentionRouter.get('/policies/:class', asyncHandler(async (req, res) => {
  const policy = engine.getPolicyForClass(req.params.class!);
  if (!policy) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Retention policy for class '${req.params.class}' not found` } });
  }
  res.json({ success: true, data: policy });
}));

// ── GET /v1/governance/retention/effective-days ──────────────────────────────
// Returns effective retention days for a data class in a country.

retentionRouter.get('/effective-days', asyncHandler(async (req, res) => {
  const { data_class, country } = req.query;
  if (typeof data_class !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'data_class is required' } });
  }
  const days = engine.getEffectiveDays(data_class, typeof country === 'string' ? country : undefined);
  res.json({ success: true, data: { data_class, country: country ?? null, effective_days: days } });
}));

// ── POST /v1/governance/retention/schedule ───────────────────────────────────
// Schedule a data deletion for an entity.
// Requires scope: governance:retention:write

const ScheduleSchema = z.object({
  entity_id:    z.string().min(1),
  entity_type:  z.enum(['alias', 'identity', 'consent', 'trust_score']),
  country_code: z.string().length(2).toUpperCase(),
  data_class:   z.string().min(1),
  reason:       z.enum(['user_request', 'retention_policy', 'legal_hold_lifted', 'account_closure']),
  requested_by: z.string().min(1),
});

retentionRouter.post(
  '/schedule',
  requireMachineScope('governance:retention:write'),
  asyncHandler(async (req, res) => {
    const parsed = ScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const scheduled = await engine.scheduleDeletion(parsed.data);
    res.status(201).json({ success: true, data: scheduled });
  }),
);

// ── GET /v1/governance/retention/scheduled ───────────────────────────────────
// List all scheduled deletions, optionally filtered by status.

retentionRouter.get('/scheduled', asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await engine.listScheduled({
    status: typeof status === 'string' ? status : undefined,
    page:   page  ? Number(page)  : 1,
    limit:  limit ? Math.min(Number(limit), 200) : 50,
  });
  res.json({ success: true, data: result.data, meta: { total: result.total } });
}));

// ── PATCH /v1/governance/retention/scheduled/:id/complete ────────────────────

retentionRouter.patch(
  '/scheduled/:id/complete',
  requireMachineScope('governance:retention:write'),
  asyncHandler(async (req, res) => {
    await engine.markComplete(req.params.id!);
    res.json({ success: true, data: { message: 'Deletion marked complete' } });
  }),
);

// ── PATCH /v1/governance/retention/scheduled/:id/cancel ──────────────────────

retentionRouter.patch(
  '/scheduled/:id/cancel',
  requireMachineScope('governance:retention:write'),
  asyncHandler(async (req, res) => {
    await engine.cancel(req.params.id!);
    res.json({ success: true, data: { message: 'Deletion cancelled' } });
  }),
);
