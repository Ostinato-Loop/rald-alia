import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegistryEngine } from '../services/registryEngine';

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

// ── POST /v1/registry — register a new entity ────────────────────────────────

const RegisterSchema = z.object({
  entity_type:   z.enum(['person', 'business', 'merchant', 'developer', 'institution', 'device', 'service']),
  entity_id:     z.string().min(1),
  country_code:  z.string().length(2),
  display_name:  z.string().optional(),
  avatar_url:    z.string().url().optional(),
  metadata:      z.record(z.unknown()).optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const data = validate(RegisterSchema, req.body);
  const record = await engine.registerEntity(data);
  res.status(201).json({ success: true, data: record });
}));

// ── GET /v1/registry — list registry records ─────────────────────────────────

const ListQuerySchema = z.object({
  entity_type:       z.enum(['person', 'business', 'merchant', 'developer', 'institution', 'device', 'service']).optional(),
  country_code:      z.string().length(2).optional(),
  identity_status:   z.string().optional(),
  trust_status:      z.string().optional(),
  compliance_status: z.string().optional(),
  page:              z.coerce.number().int().min(1).default(1),
  limit:             z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', asyncHandler(async (req, res) => {
  const query = validate(ListQuerySchema, req.query);
  const result = await engine.list(query);
  res.json({ success: true, ...result });
}));

// ── GET /v1/registry/stats ────────────────────────────────────────────────────

router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await engine.stats();
  res.json({ success: true, data: stats });
}));

// ── GET /v1/registry/:registryId — get by registry_id ────────────────────────

router.get('/:registryId', asyncHandler(async (req, res) => {
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
}));

// ── GET /v1/registry/:registryId/events — status change history ───────────────

router.get('/:registryId/events', asyncHandler(async (req, res) => {
  const { registryId } = req.params;
  const dimension = req.query['dimension'] as any;
  const events = await engine.getEvents(registryId!, dimension);
  res.json({ success: true, data: events, count: events.length });
}));

// ── PATCH /v1/registry/:registryId/status — transition a status dimension ────

const TransitionSchema = z.object({
  dimension: z.enum(['identity', 'verification', 'trust', 'consent', 'routing', 'compliance']),
  to_status: z.string().min(1),
  reason:    z.string().optional(),
  actor_id:  z.string().optional(),
  extra:     z.record(z.unknown()).optional(),
});

router.patch('/:registryId/status', asyncHandler(async (req, res) => {
  const { registryId } = req.params;
  const data = validate(TransitionSchema, req.body);

  const actor = data.actor_id
    ? { actorId: data.actor_id, actorType: 'api', reason: data.reason }
    : undefined;

  const record = await engine.transition(registryId!, data.dimension, data.to_status, actor, data.extra);
  res.json({ success: true, data: record });
}));

// ── GET /v1/registry/entity/:entityType/:entityId — lookup by source entity ───

router.get('/entity/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const record = await engine.getByEntityId(entityId!, entityType as any);
  if (!record) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: `No registry record for ${entityType}:${entityId}` });
    return;
  }
  res.json({ success: true, data: record });
}));

export { router as registryRouter };
