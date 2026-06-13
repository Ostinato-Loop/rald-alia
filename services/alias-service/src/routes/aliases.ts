// services/alias-service/src/routes/aliases.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AliasService } from '../services/alias.service';
import { validateBody } from '../middleware/validate';

export const aliasesRouter = Router();
const aliasService = new AliasService();

// Wraps async handlers so unhandled promise rejections reach the error middleware.
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateAliasSchema = z.object({
  userId:         z.string().optional(),
  organizationId: z.string().optional(),
  type:           z.enum(['email', 'phone', 'username', 'business_handle']),
  value:          z.string().min(1),
  // countryCode was missing in the previous version — its absence caused a DB
  // NOT NULL violation on every alias creation. Now required and validated.
  countryCode:    z.string().length(2).toUpperCase(),
  bankCode:       z.string().min(3),
  accountToken:   z.string().min(1),
  accountName:    z.string().min(1),
  isPrimary:      z.boolean().optional().default(false),
  // isVerified is forwarded to the compliance gate for KYC enforcement.
  // Omitting it defaults to false — gate will enforce KYC if the country requires it.
  isVerified:     z.boolean().optional().default(false),
});

const UpdateAliasSchema = z.object({
  bankCode:     z.string().min(3).optional(),
  accountToken: z.string().optional(),
  accountName:  z.string().optional(),
  isPrimary:    z.boolean().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

aliasesRouter.post(
  '/',
  validateBody(CreateAliasSchema),
  asyncHandler(async (req, res) => {
    const alias = await aliasService.createAlias(req.body);
    res.status(201).json({ success: true, data: alias });
  }),
);

aliasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page   = parseInt(String(req.query['page']  ?? '1'),  10);
    const limit  = parseInt(String(req.query['limit'] ?? '20'), 10);
    const userId = req.query['userId'] as string | undefined;
    const result = await aliasService.listAliases({ page, limit, userId });
    res.json({ success: true, ...result });
  }),
);

aliasesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const alias = await aliasService.getAliasById(req.params['id']!);
    res.json({ success: true, data: alias });
  }),
);

aliasesRouter.patch(
  '/:id',
  validateBody(UpdateAliasSchema),
  asyncHandler(async (req, res) => {
    const alias = await aliasService.updateAlias(req.params['id']!, req.body);
    res.json({ success: true, data: alias });
  }),
);

aliasesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await aliasService.deleteAlias(req.params['id']!);
    res.status(204).send();
  }),
);
