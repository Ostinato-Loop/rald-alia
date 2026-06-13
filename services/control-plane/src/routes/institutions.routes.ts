// services/control-plane/src/routes/institutions.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { InstitutionStatusService } from '../services/institutionStatus';
import { requireMachineScope } from '../middleware/machineAuth';

export const institutionsRouter = Router();
const svc = new InstitutionStatusService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /v1/institutions — list institutions with onboarding status
institutionsRouter.get(
  '/',
  requireMachineScope('control:institutions:read'),
  asyncHandler(async (req, res) => {
    const { status, country, page, limit } = req.query;
    const result = await svc.listOnboarding({
      status:  typeof status  === 'string' ? status  : undefined,
      country: typeof country === 'string' ? country : undefined,
      page:    page  ? Number(page)  : 1,
      limit:   limit ? Math.min(Number(limit), 200) : 50,
    });
    res.json({ success: true, data: result.items, meta: { total: result.total } });
  }),
);

// GET /v1/institutions/pipeline — aggregated onboarding pipeline summary
institutionsRouter.get(
  '/pipeline',
  requireMachineScope('control:institutions:read'),
  asyncHandler(async (_req, res) => {
    const summary = await svc.getPipelineSummary();
    res.json({ success: true, data: summary });
  }),
);
