import { Router, Request, Response } from 'express';
import { RoutingService } from '../services/routing.service';
import { authenticate } from '../middleware/authenticate';

export const router = Router();
const routingService = new RoutingService();

/**
 * GET /v1/routing/:userId — get routing profile for a user
 */
router.get('/routing/:userId', authenticate, async (req: Request, res: Response) => {
  const profile = await routingService.getProfile(req.params['userId']!);
  res.json({ success: true, data: profile });
});

/**
 * POST /v1/routing/:userId — create or update routing profile
 */
router.post('/routing/:userId', authenticate, async (req: Request, res: Response) => {
  const profile = await routingService.upsertProfile(req.params['userId']!, req.body);
  res.json({ success: true, data: profile });
});

/**
 * POST /v1/routing/resolve — determine optimal route for a transaction
 */
router.post('/routing/resolve', authenticate, async (req: Request, res: Response) => {
  const { userId, amount } = req.body as { userId: string; amount: number };
  const route = await routingService.determineRoute(userId, amount);
  res.json({ success: true, data: route });
});
