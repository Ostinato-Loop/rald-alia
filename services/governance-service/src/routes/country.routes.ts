// services/governance-service/src/routes/country.routes.ts
// Country governance — status lifecycle and profile queries.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CountryGovernanceEngine, type CountryStatus } from '../services/countryGovernance';
import { CountryRulesEngine } from '../services/countryRules';
import { requireMachineScope } from '../middleware/machineAuth';

export const countryRouter = Router();
const engine      = new CountryGovernanceEngine();
const rulesEngine = new CountryRulesEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── GET /v1/governance/countries ─────────────────────────────────────────────
// List all ALIA jurisdictions and their current governance status.

countryRouter.get('/', asyncHandler(async (_req, res) => {
  const countries = await engine.list();
  res.json({ success: true, data: countries });
}));

// ── GET /v1/governance/countries/summary ─────────────────────────────────────

countryRouter.get('/summary', asyncHandler(async (_req, res) => {
  const summary = await engine.eligibilitySummary();
  res.json({ success: true, data: summary });
}));

// ── GET /v1/governance/countries/:code ───────────────────────────────────────

countryRouter.get('/:code', asyncHandler(async (req, res) => {
  const code = req.params.code!.toUpperCase();
  const rec  = await engine.get(code);
  if (!rec) {
    return res.status(404).json({ success: false, error: { code: 'COUNTRY_NOT_FOUND', message: `Country ${code} is not a registered ALIA jurisdiction` } });
  }
  res.json({ success: true, data: rec });
}));

// ── GET /v1/governance/countries/:code/profile ───────────────────────────────
// Returns the full country profile: regulatory body, KYC tiers, limits, frameworks.

countryRouter.get('/:code/profile', asyncHandler(async (req, res) => {
  const code    = req.params.code!.toUpperCase();
  const status  = await engine.get(code);
  const profile = rulesEngine.getProfile(code);

  if (!status) {
    return res.status(404).json({ success: false, error: { code: 'COUNTRY_NOT_FOUND', message: `Country ${code} is not a registered ALIA jurisdiction` } });
  }

  res.json({
    success: true,
    data: {
      governance: status,
      profile:    profile ?? null,
      rules:      rulesEngine.getRules(code),
      requirements: profile ? rulesEngine.getComplianceRequirements(code) : null,
    },
  });
}));

// ── GET /v1/governance/countries/:code/events ────────────────────────────────

countryRouter.get('/:code/events', asyncHandler(async (req, res) => {
  const code = req.params.code!.toUpperCase();
  const events = await engine.getEvents(code);
  res.json({ success: true, data: events });
}));

// ── POST /v1/governance/countries/:code/status ───────────────────────────────
// Admin-only: transition country to a new status.
// Requires scope: governance:countries:write

const TransitionSchema = z.object({
  to_status:  z.enum(['DISABLED', 'INTERNAL', 'PRIVATE_BETA', 'PUBLIC_BETA', 'GA'] as [CountryStatus, ...CountryStatus[]]),
  actor_id:   z.string().min(1),
  actor_type: z.string().default('admin'),
  notes:      z.string().optional(),
});

countryRouter.post(
  '/:code/status',
  requireMachineScope('governance:countries:write'),
  asyncHandler(async (req, res) => {
    const code   = req.params.code!.toUpperCase();
    const parsed = TransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.flatten() } });
    }

    const updated = await engine.transition({
      country_code: code,
      to_status:    parsed.data.to_status,
      actor_id:     parsed.data.actor_id,
      actor_type:   parsed.data.actor_type,
      notes:        parsed.data.notes,
    });

    res.json({ success: true, data: updated });
  }),
);

// ── POST /v1/governance/countries/:code/check ────────────────────────────────
// Quick eligibility gate — check if a country allows a specific operation.

countryRouter.post('/:code/check', asyncHandler(async (req, res) => {
  const code   = req.params.code!.toUpperCase();
  const result = await engine.isOperational(code);
  res.json({ success: true, data: result });
}));
