// services/control-plane/src/routes/network.routes.ts
// Unified /v1/network/status endpoint — aggregates all cross-service metrics
// into a single admin dashboard payload.

import { Router, Request, Response, NextFunction } from 'express';
import { NetworkHealthService } from '../services/networkHealth';
import { DeveloperQueueService } from '../services/developerQueue';
import { CountryLifecycleService } from '../services/countryLifecycle';
import { InstitutionStatusService } from '../services/institutionStatus';
import { requireMachineScope } from '../middleware/machineAuth';

export const networkRouter = Router();

const health       = new NetworkHealthService();
const devQueue     = new DeveloperQueueService();
const countries    = new CountryLifecycleService();
const institutions = new InstitutionStatusService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /v1/network/status — full control-plane dashboard snapshot
networkRouter.get(
  '/status',
  requireMachineScope('control:network:read'),
  asyncHandler(async (_req, res) => {
    const [networkStatus, devStats, countrySummary, institutionSummary] = await Promise.allSettled([
      health.check(),
      devQueue.getStats(),
      countries.getLifecycleSummary(),
      institutions.getPipelineSummary(),
    ]);

    const result = {
      network: networkStatus.status  === 'fulfilled' ? networkStatus.value  : { error: (networkStatus as PromiseRejectedResult).reason?.message },
      developers: devStats.status    === 'fulfilled' ? devStats.value       : { error: (devStats as PromiseRejectedResult).reason?.message },
      countries:  countrySummary.status === 'fulfilled' ? countrySummary.value  : { error: (countrySummary as PromiseRejectedResult).reason?.message },
      institutions: institutionSummary.status === 'fulfilled' ? institutionSummary.value : { error: (institutionSummary as PromiseRejectedResult).reason?.message },
      generated_at: new Date().toISOString(),
    };

    res.json({ success: true, data: result });
  }),
);
