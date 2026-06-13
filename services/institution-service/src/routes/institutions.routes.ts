import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { InstitutionRepository } from '../repositories/institution.repository';
import { requireMachineScope } from '../middleware/machineAuth';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';

export const institutionsRouter = Router();
const repo = new InstitutionRepository();

// ── GET /v1/institutions ──────────────────────────────────────────────────────
// List institutions — filterable by country, type, status, ALIA participation.
// Public (read-only) endpoint — no auth required for listing active institutions.

institutionsRouter.get('/', async (req: Request, res: Response) => {
  const { country, type, status, participant, search, limit, offset } = req.query;

  const result = await repo.findAll({
    country:     typeof country  === 'string' ? country  : undefined,
    type:        typeof type     === 'string' ? type     : undefined,
    status:      typeof status   === 'string' ? status   : undefined,
    search:      typeof search   === 'string' ? search   : undefined,
    participant: participant === 'true' ? true : participant === 'false' ? false : undefined,
    limit:       limit  ? Math.min(Number(limit),  200) : 50,
    offset:      offset ? Number(offset)                : 0,
  });

  res.json({ success: true, data: result.data, meta: { total: result.total } });
});

// ── GET /v1/institutions/:id ──────────────────────────────────────────────────

institutionsRouter.get('/:id', async (req: Request, res: Response) => {
  const inst = await repo.findById(req.params.id!);
  if (!inst) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Institution not found' } });
  }
  res.json({ success: true, data: inst });
});

// ── GET /v1/institutions/code/:code ───────────────────────────────────────────

institutionsRouter.get('/code/:code', async (req: Request, res: Response) => {
  const inst = await repo.findByCode(req.params.code!);
  if (!inst) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Institution not found' } });
  }
  res.json({ success: true, data: inst });
});

// ── POST /v1/institutions — register new institution ──────────────────────────
// Requires machine JWT with scope: institution:write

const RegisterSchema = z.object({
  institutionCode: z.string().min(2).max(20),
  shortName:       z.string().min(1).max(20),
  fullName:        z.string().min(2),
  type:            z.enum(['commercial_bank','microfinance_bank','fintech','mobile_money',
                            'payment_service_bank','neobank','central_bank','cooperative',
                            'insurance','investment','other']),
  hqCountry:       z.string().length(2),
  swiftBic:        z.string().optional(),
  cbnLicenseCode:  z.string().optional(),
  website:         z.string().url().optional(),
  supportEmail:    z.string().email().optional(),
  logoUrl:         z.string().url().optional(),
  colorHex:        z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  metadata:        z.record(z.unknown()).optional(),
});

institutionsRouter.post(
  '/',
  requireMachineScope('institution:write'),
  async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', issues: parsed.error.issues },
      });
    }

    const existing = await repo.findByCode(parsed.data.institutionCode);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `Institution code '${parsed.data.institutionCode}' already exists` },
      });
    }

    const inst = await repo.create(parsed.data as any);

    await publishEvent(KAFKA_TOPICS.MERCHANT_CREATED, {    // reuse closest existing topic
      eventType: 'institution.registered' as any,
      payload:   { institutionId: inst.id, code: inst.institutionCode, country: inst.hqCountry },
    }).catch(() => {});

    res.status(201).json({ success: true, data: inst });
  },
);

// ── PATCH /v1/institutions/:id ────────────────────────────────────────────────

const UpdateSchema = z.object({
  fullName:      z.string().optional(),
  website:       z.string().url().optional(),
  supportEmail:  z.string().email().optional(),
  supportPhone:  z.string().optional(),
  logoUrl:       z.string().url().optional(),
  colorHex:      z.string().optional(),
  sandboxEnabled:    z.boolean().optional(),
  productionEnabled: z.boolean().optional(),
  metadata:      z.record(z.unknown()).optional(),
});

institutionsRouter.patch(
  '/:id',
  requireMachineScope('institution:write'),
  async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      });
    }

    const updated = await repo.update(req.params.id!, parsed.data as any);
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Institution not found' } });
    }
    res.json({ success: true, data: updated });
  },
);

// ── POST /v1/institutions/:id/suspend ────────────────────────────────────────

institutionsRouter.post(
  '/:id/suspend',
  requireMachineScope('institution:admin'),
  async (req: Request, res: Response) => {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const updated = await repo.suspend(req.params.id!, reason, req.machine?.service_name);
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Institution not found' } });
    }
    res.json({ success: true, data: updated });
  },
);

// ── POST /v1/institutions/:id/reinstate ───────────────────────────────────────

institutionsRouter.post(
  '/:id/reinstate',
  requireMachineScope('institution:admin'),
  async (req: Request, res: Response) => {
    const updated = await repo.reinstate(req.params.id!, req.machine?.service_name);
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Institution not found' } });
    }
    res.json({ success: true, data: updated });
  },
);

// ── GET /v1/institutions/:id/licenses ────────────────────────────────────────

institutionsRouter.get('/:id/licenses', async (req: Request, res: Response) => {
  const licenses = await repo.getLicenses(req.params.id!);
  res.json({ success: true, data: licenses });
});

// ── POST /v1/institutions/:id/licenses ───────────────────────────────────────

const LicenseSchema = z.object({
  countryCode:     z.string().length(2),
  licenseType:     z.string().min(1),
  licenseNumber:   z.string().min(1),
  issuingBody:     z.string().min(1),
  issuedAt:        z.string().datetime(),
  expiresAt:       z.string().datetime().optional(),
  permittedScopes: z.array(z.string()).default([]),
});

institutionsRouter.post(
  '/:id/licenses',
  requireMachineScope('institution:write'),
  async (req: Request, res: Response) => {
    const parsed = LicenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      });
    }

    const license = await repo.addLicense({
      institutionId:   req.params.id!,
      countryCode:     parsed.data.countryCode,
      licenseType:     parsed.data.licenseType,
      licenseNumber:   parsed.data.licenseNumber,
      issuingBody:     parsed.data.issuingBody,
      issuedAt:        new Date(parsed.data.issuedAt),
      expiresAt:       parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      permittedScopes: parsed.data.permittedScopes,
      metadata:        {},
    } as any);

    res.status(201).json({ success: true, data: license });
  },
);

// ── GET /v1/institutions/:id/routing-prefixes ─────────────────────────────────

institutionsRouter.get('/:id/routing-prefixes', async (req: Request, res: Response) => {
  const prefixes = await repo.getRoutingPrefixes(req.params.id!);
  res.json({ success: true, data: prefixes });
});

// ── GET /v1/institutions/routing/resolve?prefix=058&country=NG ───────────────
// Used by resolution-engine to look up which institution owns a routing prefix.

institutionsRouter.get('/routing/resolve', async (req: Request, res: Response) => {
  const prefix  = typeof req.query.prefix  === 'string' ? req.query.prefix  : null;
  const country = typeof req.query.country === 'string' ? req.query.country : null;

  if (!prefix || !country) {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'prefix and country query params required' },
    });
  }

  const result = await repo.resolveByPrefix(prefix, country);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { code: 'PREFIX_NOT_FOUND', message: `No institution found for prefix '${prefix}' in ${country}` },
    });
  }

  res.json({
    success: true,
    data: {
      institution:  result.institution,
      prefixRecord: result.prefixRecord,
    },
  });
});

// ── GET /v1/institutions/:id/settlement-accounts ──────────────────────────────

institutionsRouter.get('/:id/settlement-accounts', requireMachineScope('institution:read'), async (req: Request, res: Response) => {
  const env      = typeof req.query.env === 'string' ? req.query.env : 'production';
  const accounts = await repo.getSettlementAccounts(req.params.id!, env);
  res.json({ success: true, data: accounts });
});
