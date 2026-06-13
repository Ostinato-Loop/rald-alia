import { Router, Request, Response } from 'express';
import { DirectoryService } from '../services/directory.service';

export const router = Router();
const directoryService = new DirectoryService();

router.get('/directory/lookup', async (req: Request, res: Response) => {
  const alias = req.query['alias'] as string;
  if (!alias) {
    res.status(400).json({ error: { code: 'MISSING_PARAM', message: 'alias query param required' } });
    return;
  }
  const entry = await directoryService.lookup(alias);
  res.json(entry);
});

router.get('/directory/:token', async (req: Request, res: Response) => {
  const entry = await directoryService.lookupByToken(req.params['token']!);
  res.json(entry);
});

router.get('/directory/stats', async (_req: Request, res: Response) => {
  const stats = await directoryService.getStats();
  res.json(stats);
});
