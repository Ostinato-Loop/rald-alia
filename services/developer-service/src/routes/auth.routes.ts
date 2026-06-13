// services/developer-service/src/routes/auth.routes.ts
// API key verification endpoint — consumed by other ALIA services and an
// API gateway to authenticate developer requests.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeveloperEngine } from '../services/developerEngine';

export const authRouter = Router();
const engine = new DeveloperEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── POST /v1/auth/verify-key ──────────────────────────────────────────────────
// Accepts a plain API key and returns the associated developer/project context.
// Used by an API gateway or service middleware to authenticate incoming requests.

const VerifyKeySchema = z.object({
  key: z.string().min(1),
});

authRouter.post('/verify-key', asyncHandler(async (req, res) => {
  const parsed = VerifyKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }

  const result = await engine.verifyApiKey(parsed.data.key);
  if (!result.valid) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_API_KEY', message: result.error } });
  }

  res.json({ success: true, data: result });
}));

// ── GET /v1/auth/scopes — list all available API scopes ───────────────────────

import { AVAILABLE_SCOPES } from '../services/developerEngine';

authRouter.get('/scopes', (_req, res) => {
  res.json({
    success: true,
    data:    AVAILABLE_SCOPES.map((scope) => ({
      scope,
      description: SCOPE_DESCRIPTIONS[scope] ?? scope,
    })),
  });
});

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'alias:resolve':    'Resolve any ALIA alias to routing metadata',
  'alias:create':     'Register new aliases (subject to country compliance checks)',
  'alias:read':       'Read alias metadata (type, status, country)',
  'identity:verify':  'Submit KYC documents for identity verification',
  'trust:read':       'Read trust scores for entities',
  'consent:grant':    'Request consent from users on behalf of your application',
  'consent:read':     'Read active consents for a subject',
  'routing:initiate': 'Initiate a payment routing request',
  'registry:read':    'Read ALIA registry records (entity status across all dimensions)',
};
