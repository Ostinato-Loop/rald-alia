import { Router, Request, Response } from 'express';
import { FraudService } from '../services/fraud.service';

export const router = Router();
const fraudService = new FraudService();

router.post('/fraud/score', async (req: Request, res: Response) => {
  const { entityId, entityType, context } = req.body as {
    entityId: string;
    entityType: 'alias' | 'user' | 'organization';
    context?: Record<string, unknown>;
  };
  const score = await fraudService.scoreEntity(entityId, entityType, context);
  res.json(score);
});

router.get('/fraud/events', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query['page'] ?? '1'), 10);
  const limit = parseInt(String(req.query['limit'] ?? '20'), 10);
  const events = await fraudService.listEvents({ page, limit });
  res.json(events);
});

router.post('/fraud/events/:id/resolve', async (req: Request, res: Response) => {
  const { resolvedBy } = req.body as { resolvedBy: string };
  await fraudService.resolveEvent(req.params['id']!, resolvedBy);
  res.json({ success: true });
});
