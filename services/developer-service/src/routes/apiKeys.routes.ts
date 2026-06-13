// services/developer-service/src/routes/apiKeys.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeveloperEngine, AVAILABLE_SCOPES } from '../services/developerEngine';
import { requireMachineScope } from '../middleware/machineAuth';

export const apiKeysRouter = Router({ mergeParams: true });
const engine = new DeveloperEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── POST /v1/projects/:projectId/api-keys — create API key ───────────────────
// Returns the plain key ONCE. It cannot be retrieved again.

const CreateKeySchema = z.object({
  name:             z.string().min(1).max(200),
  scopes:           z.array(z.enum(AVAILABLE_SCOPES)).min(1),
  developer_id:     z.string().min(1),
  expires_in_days:  z.number().int().min(1).max(365).optional(),
});

apiKeysRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = CreateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const key = await engine.createApiKey({
    project_id:      req.params.projectId!,
    developer_id:    parsed.data.developer_id,
    name:            parsed.data.name,
    scopes:          parsed.data.scopes,
    expires_in_days: parsed.data.expires_in_days,
  });
  res.status(201).json({
    success: true,
    data:    key,
    warning: 'Store your API key securely. It will not be shown again.',
  });
}));

// ── GET /v1/projects/:projectId/api-keys — list keys (no secrets) ────────────

apiKeysRouter.get('/', asyncHandler(async (req, res) => {
  const keys = await engine.listApiKeys(req.params.projectId!);
  res.json({ success: true, data: keys, meta: { total: keys.length } });
}));

// ── DELETE /v1/projects/:projectId/api-keys/:keyId — revoke key ──────────────

apiKeysRouter.delete(
  '/:keyId',
  requireMachineScope('developers:write'),
  asyncHandler(async (req, res) => {
    const { actor_id } = req.body;
    await engine.revokeApiKey(req.params.keyId!, actor_id ?? 'admin');
    res.json({ success: true, data: { message: 'API key revoked' } });
  }),
);
