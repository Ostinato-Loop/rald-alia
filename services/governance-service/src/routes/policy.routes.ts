// services/governance-service/src/routes/policy.routes.ts
// Governance policy CRUD and rule validation.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PolicyEngine } from '../services/policyEngine';
import { requireMachineScope } from '../middleware/machineAuth';

export const policyRouter = Router();
const engine = new PolicyEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const PolicyRuleSchema = z.object({
  condition: z.string().min(1),
  action:    z.enum(['permit', 'deny', 'review', 'alert']),
  priority:  z.number().int().min(0).max(1000),
  metadata:  z.record(z.unknown()).optional(),
});

const CreatePolicySchema = z.object({
  name:            z.string().min(1).max(200),
  description:     z.string().optional(),
  type:            z.enum(['rate_limit', 'kyc', 'compliance', 'fraud', 'routing', 'consent']),
  scope:           z.enum(['global', 'country', 'institution', 'merchant', 'developer']),
  country:         z.string().length(2).optional(),
  institution_id:  z.string().optional(),
  service:         z.string().optional(),
  rules:           z.array(PolicyRuleSchema).min(1),
  active:          z.boolean().default(true),
  effective_from:  z.string().datetime().optional(),
  effective_until: z.string().datetime().optional(),
});

// ── POST /v1/governance/policies ─────────────────────────────────────────────

policyRouter.post(
  '/',
  requireMachineScope('governance:policies:write'),
  asyncHandler(async (req, res) => {
    const parsed = CreatePolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const policy = await engine.createPolicy(parsed.data);
    res.status(201).json({ success: true, data: policy });
  }),
);

// ── GET /v1/governance/policies ──────────────────────────────────────────────

policyRouter.get('/', asyncHandler(async (req, res) => {
  const { scope, country, service, active, page, limit } = req.query;
  const result = await engine.listPolicies({
    scope:   typeof scope   === 'string' ? scope   : undefined,
    country: typeof country === 'string' ? country : undefined,
    service: typeof service === 'string' ? service : undefined,
    active:  active === 'true' ? true : active === 'false' ? false : undefined,
    page:    page  ? Number(page)  : 1,
    limit:   limit ? Math.min(Number(limit), 200) : 50,
  });
  res.json({ success: true, data: result.policies, meta: { total: result.total } });
}));

// ── GET /v1/governance/policies/:id ──────────────────────────────────────────

policyRouter.get('/:id', asyncHandler(async (req, res) => {
  const policy = await engine.getPolicy(req.params.id!);
  if (!policy) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
  }
  res.json({ success: true, data: policy });
}));

// ── PATCH /v1/governance/policies/:id ────────────────────────────────────────

policyRouter.patch(
  '/:id',
  requireMachineScope('governance:policies:write'),
  asyncHandler(async (req, res) => {
    const UpdateSchema = CreatePolicySchema.partial().omit({ type: true, scope: true });
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const updated = await engine.updatePolicy(req.params.id!, parsed.data);
    res.json({ success: true, data: updated });
  }),
);

// ── DELETE /v1/governance/policies/:id ───────────────────────────────────────
// Soft-delete: sets active = false.

policyRouter.delete(
  '/:id',
  requireMachineScope('governance:policies:write'),
  asyncHandler(async (req, res) => {
    await engine.deactivatePolicy(req.params.id!);
    res.json({ success: true, data: { message: 'Policy deactivated' } });
  }),
);

// ── POST /v1/governance/validate ─────────────────────────────────────────────
// Validate an action against active policies. Returns decision + risk signals.

const ValidateSchema = z.object({
  type:           z.string().min(1),
  scope:          z.string().min(1),
  country:        z.string().length(2).optional(),
  institution_id: z.string().optional(),
  service:        z.string().optional(),
  context:        z.record(z.unknown()),
});

policyRouter.post('/validate', asyncHandler(async (req, res) => {
  const parsed = ValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const result = await engine.validateRequest(parsed.data);
  res.json({ success: true, data: result });
}));
