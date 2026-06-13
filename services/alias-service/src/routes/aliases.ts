import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AliasService } from '../services/alias.service';
import { validateBody } from '../middleware/validate';

export const aliasesRouter = Router();
const aliasService = new AliasService();

const CreateAliasSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  type: z.enum(['email', 'phone', 'username', 'business_handle']),
  value: z.string().min(1),
  bankCode: z.string().min(3),
  accountToken: z.string().min(1),
  accountName: z.string().min(1),
  isPrimary: z.boolean().optional().default(false),
});

const UpdateAliasSchema = z.object({
  bankCode: z.string().min(3).optional(),
  accountToken: z.string().optional(),
  accountName: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

aliasesRouter.post('/', validateBody(CreateAliasSchema), async (req: Request, res: Response) => {
  const alias = await aliasService.createAlias(req.body);
  res.status(201).json(alias);
});

aliasesRouter.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query['page'] ?? '1'), 10);
  const limit = parseInt(String(req.query['limit'] ?? '20'), 10);
  const userId = req.query['userId'] as string | undefined;
  const result = await aliasService.listAliases({ page, limit, userId });
  res.json(result);
});

aliasesRouter.get('/:id', async (req: Request, res: Response) => {
  const alias = await aliasService.getAliasById(req.params['id']!);
  res.json(alias);
});

aliasesRouter.patch('/:id', validateBody(UpdateAliasSchema), async (req: Request, res: Response) => {
  const alias = await aliasService.updateAlias(req.params['id']!, req.body);
  res.json(alias);
});

aliasesRouter.delete('/:id', async (req: Request, res: Response) => {
  await aliasService.deleteAlias(req.params['id']!);
  res.status(204).send();
});
