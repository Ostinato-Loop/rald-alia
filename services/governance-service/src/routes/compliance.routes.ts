// services/governance-service/src/routes/compliance.routes.ts
// Compliance engine routes — framework registry, alias gates, compliance checks.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ComplianceEngine } from '../services/complianceEngine';

export const complianceRouter = Router();
const engine = new ComplianceEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── GET /v1/governance/compliance/frameworks ──────────────────────────────────
// List all compliance frameworks, optionally filtered by country.

complianceRouter.get('/frameworks', asyncHandler(async (req, res) => {
  const { country } = req.query;
  const frameworks  = engine.getFrameworks(typeof country === 'string' ? country : undefined);
  res.json({ success: true, data: frameworks, meta: { total: frameworks.length } });
}));

// ── POST /v1/governance/compliance/check ──────────────────────────────────────
// Run a compliance check for an entity performing an action in a jurisdiction.

const CheckSchema = z.object({
  entity_id:    z.string().min(1),
  entity_type:  z.enum(['person', 'business', 'merchant', 'developer', 'institution']),
  country:      z.string().length(2),
  action:       z.string().min(1),
  amount:       z.number().positive().optional(),
  currency:     z.string().length(3).optional(),
});

complianceRouter.post('/check', asyncHandler(async (req, res) => {
  const parsed = CheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const result = await engine.runComplianceCheck(parsed.data);
  const status = result.compliant ? 200 : 422;
  res.status(status).json({ success: result.compliant, data: result });
}));

// ── POST /v1/governance/compliance/alias-gate ─────────────────────────────────
// Check if alias creation is permitted for a user in a given country.
// Enforces: alias count limit, KYC gate, verification requirements.

const AliasGateSchema = z.object({
  user_id:     z.string().min(1),
  country:     z.string().length(2),
  alias_type:  z.string().min(1),
  is_verified: z.boolean().optional(),
});

complianceRouter.post('/alias-gate', asyncHandler(async (req, res) => {
  const parsed = AliasGateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const result = await engine.checkAliasCreation(parsed.data);
  const status = result.allowed ? 200 : 422;
  res.status(status).json({ success: result.allowed, data: result });
}));

// ── GET /v1/governance/compliance/report ──────────────────────────────────────
// Generate a compliance summary report for a country or institution.

complianceRouter.get('/report', asyncHandler(async (req, res) => {
  const { country, institution_id, from, to, type } = req.query;
  const report = await engine.generateReport({
    institution_id: typeof institution_id === 'string' ? institution_id : undefined,
    country:        typeof country        === 'string' ? country        : undefined,
    from:           typeof from           === 'string' ? from           : undefined,
    to:             typeof to             === 'string' ? to             : undefined,
    type:           typeof type           === 'string' ? type           : undefined,
  });
  res.json({ success: true, data: report });
}));
