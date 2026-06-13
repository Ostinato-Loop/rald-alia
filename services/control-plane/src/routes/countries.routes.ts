// services/control-plane/src/routes/countries.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CountryLifecycleService } from '../services/countryLifecycle';
import { requireMachineScope } from '../middleware/machineAuth';

export const countriesRouter = Router();
const svc = new CountryLifecycleService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /v1/countries — list all countries with lifecycle status
countriesRouter.get(
  '/',
  requireMachineScope('control:countries:read'),
  asyncHandler(async (_req, res) => {
    const countries = await svc.listCountries();
    res.json({ success: true, data: countries, meta: { total: countries.length } });
  }),
);

// GET /v1/countries/summary — lifecycle summary (count per status)
countriesRouter.get(
  '/summary',
  requireMachineScope('control:countries:read'),
  asyncHandler(async (_req, res) => {
    const summary = await svc.getLifecycleSummary();
    res.json({ success: true, data: summary });
  }),
);

// POST /v1/countries/:code/transition — advance a country to the next status
const TransitionSchema = z.object({
  to_status: z.enum(['INTERNAL', 'PRIVATE_BETA', 'PUBLIC_BETA', 'GA', 'DISABLED']),
  actor_id:  z.string().min(1),
  reason:    z.string().optional(),
});

countriesRouter.post(
  '/:code/transition',
  requireMachineScope('control:countries:write'),
  asyncHandler(async (req, res) => {
    const parsed = TransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const result = await svc.transition({
      country_code: req.params.code!.toUpperCase(),
      ...parsed.data,
    });
    res.json({ success: true, data: result });
  }),
);
