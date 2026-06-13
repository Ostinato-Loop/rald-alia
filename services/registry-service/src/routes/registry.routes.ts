import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegistryEngine } from '../services/registryEngine';
import { requireMachineJwt, requireMachineScope } from '../middleware/machineAuth';

const router  = Router();
const engine  = new RegistryEngine();

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw Object.assign(new Error('Validation error'), { status: 400, details: result.error.flatten() });
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── POST /v1/registry — register a new entity ─────────────────────────────────
// Machine auth required: caller must hold registry:write scope.
// Only identity-service, institution-service, merchant-service, and
// governance-service are provisioned with that scope.

const RegisterSchema = z.object({
  entity_type:   z.enum(['person', 'business', 'merchant', 'developer', 'institution', 'device', 'service']),
  entity_id:     z.string().min(1),
  country_code:  z.string().length(2),
  display_name:  z.string().optional(),
  avatar_url:    z.string().url().optional(),
  metadata:      z.record(z.unknown()).optional(),
});

router.post(
  '/',
  requireMachineScope('registry:write'),
  asyncHandler(async (req, res) => {
    const data   = validate(RegisterSchema, req.body);
    const record = await engine.registerEntity(data);
    res.status(201).json({ success: true, data: record });
  })
);

// ── GET /v1/registry — list registry records ──────────────────────────────────
// Read-only: requires registry:read scope.

const ListQuerySchema = z.object({
  entity_type:       z.enum(['person', 'business', 'merchant', 'developer', 'institution', 'device', 'service']).optional(),
  country_code:      z.string().length(2).optional(),
  identity_status:   z.string().optional(),
  trust_status:      z.string().optional(),
  compliance_status: z.string().optional(),
  page:              z.coerce.number().int().min(1).default(1),
  limit:             z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/',
  requireMachineScope('registry:read'),
  asyncHandler(async (req, res) => {
    const query  = validate(ListQuerySchema, req.query);
    const result = await engine.list(query);
    res.json({ success: true, ...result });
  })
);

// ── GET /v1/registry/stats ────────────────────────────────────────────────────
// Internal telemetry — requires registry:read.

router.get(
  '/stats',
  requireMachineScope('registry:read'),
  asyncHandler(async (_req, res) => {
    const stats = await engine.stats();
    res.json({ success: true, data: stats });
  })
);

// ── GET /v1/registry/:registryId — get by registry_id ────────────────────────

router.get(
  '/:registryId',
  requireMachineScope('registry:read'),
  asyncHandler(async (req, res) => {
    const { registryId } = req.params;
    if (!registryId!.startsWith('rald_')) {
      res.status(400).json({ success: false, error: 'INVALID_REGISTRY_ID', message: 'registry_id must start with rald_' });
      return;
    }
    const record = await engine.getById(registryId!);
    if (!record) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: `No registry record for ${registryId}` });
      return;
    }
    res.json({ success: true, data: record });
  })
);

// ── GET /v1/registry/:registryId/events ──────────────────────────────────────

router.get(
  '/:registryId/events',
  requireMachineScope('registry:read'),
  asyncHandler(async (req, res) => {
    const { registryId } = req.params;
    const dimension = req.query['dimension'] as any;
    const events    = await engine.getEvents(registryId!, dimension);
    res.json({ success: true, data: events, count: events.length });
  })
);

// ── PATCH /v1/registry/:registryId/status — transition a status dimension ────
// Requires registry:write — governance-service and institution-service only.

const TransitionSchema = z.object({
  dimension: z.enum(['identity', 'verification', 'trust', 'consent', 'routing', 'compliance']),
  to_status: z.string().min(1),
  reason:    z.string().optional(),
  actor_id:  z.string().optional(),
  extra:     z.record(z.unknown()).optional(),
});

router.patch(
  '/:registryId/status',
  requireMachineScope('registry:write'),
  asyncHandler(async (req, res) => {
    const { registryId } = req.params;
    const data  = validate(TransitionSchema, req.body);
    const actor = data.actor_id
      ? { actorId: data.actor_id, actorType: 'api', reason: data.reason }
      : undefined;
    const record = await engine.transition(registryId!, data.dimension, data.to_status, actor, data.extra);
    res.json({ success: true, data: record });
  })
);

// ── GET /v1/registry/entity/:entityType/:entityId ────────────────────────────

router.get(
  '/entity/:entityType/:entityId',
  requireMachineScope('registry:read'),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const record = await engine.getByEntityId(entityId!, entityType as any);
    if (!record) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: `No registry record for ${entityType}:${entityId}` });
      return;
    }
    res.json({ success: true, data: record });
  })
);

export { router as registryRouter };
