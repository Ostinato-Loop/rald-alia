// services/developer-service/src/routes/developers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeveloperEngine } from '../services/developerEngine';
import { requireMachineScope } from '../middleware/machineAuth';

export const developersRouter = Router();
const engine = new DeveloperEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── POST /v1/developers — register a new developer ────────────────────────────

const RegisterSchema = z.object({
  name:            z.string().min(1).max(200),
  email:           z.string().email(),
  country:         z.string().length(2),
  website:         z.string().url().optional(),
  organization_id: z.string().optional(),
});

developersRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const dev = await engine.registerDeveloper(parsed.data);
  res.status(201).json({ success: true, data: dev });
}));

// ── GET /v1/developers — list developers (admin) ──────────────────────────────

developersRouter.get(
  '/',
  requireMachineScope('developers:read'),
  asyncHandler(async (req, res) => {
    const { status, country, search, page, limit } = req.query;
    const result = await engine.listDevelopers({
      status:  typeof status  === 'string' ? status  : undefined,
      country: typeof country === 'string' ? country : undefined,
      search:  typeof search  === 'string' ? search  : undefined,
      page:    page  ? Number(page)  : 1,
      limit:   limit ? Math.min(Number(limit), 200) : 50,
    });
    res.json({ success: true, data: result.developers, meta: { total: result.total } });
  }),
);

// ── GET /v1/developers/:id ────────────────────────────────────────────────────

developersRouter.get('/:id', asyncHandler(async (req, res) => {
  const dev = await engine.getDeveloper(req.params.id!);
  if (!dev) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Developer not found' } });
  }
  res.json({ success: true, data: dev });
}));

// ── POST /v1/developers/:id/status — transition developer status (admin) ──────

const TransitionSchema = z.object({
  to_status:  z.enum(['verified', 'active', 'suspended', 'revoked']),
  actor_id:   z.string().min(1),
  actor_type: z.string().default('admin'),
  reason:     z.string().optional(),
});

developersRouter.post(
  '/:id/status',
  requireMachineScope('developers:write'),
  asyncHandler(async (req, res) => {
    const parsed = TransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const updated = await engine.transitionStatus({ developer_id: req.params.id!, ...parsed.data });
    res.json({ success: true, data: updated });
  }),
);

// ── GET /v1/developers/:id/events ─────────────────────────────────────────────

developersRouter.get('/:id/events', asyncHandler(async (req, res) => {
  const events = await engine.getEvents(req.params.id!);
  res.json({ success: true, data: events });
}));
