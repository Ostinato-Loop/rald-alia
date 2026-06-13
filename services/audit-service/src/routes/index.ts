import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';

export const router = Router();
const auditService = new AuditService();

router.get('/audit/logs', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query['page'] ?? '1'), 10);
  const limit = parseInt(String(req.query['limit'] ?? '50'), 10);
  const eventType = req.query['eventType'] as string | undefined;
  const actorId = req.query['actorId'] as string | undefined;
  const result = await auditService.listLogs({ page, limit, eventType, actorId });
  res.json(result);
});

router.get('/audit/logs/:id', async (req: Request, res: Response) => {
  const log = await auditService.getLog(req.params['id']!);
  res.json(log);
});

router.post('/audit/logs', async (req: Request, res: Response) => {
  const entry = await auditService.log(req.body);
  res.status(201).json(entry);
});
