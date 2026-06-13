import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ResolutionService } from '../services/resolution.service';
import { authenticate } from '../middleware/authenticate';
import { requireMachineScope } from '../middleware/machineAuth';

export const router = Router();
const resolutionService = new ResolutionService();

const ResolveSchema = z.object({
  alias:          z.string().min(1),
  initiatingBank: z.string().min(3),
  transactionRef: z.string().min(1),
  amount:         z.number().positive().optional(),
  currency:       z.string().length(3).toUpperCase().optional(),
});

// ── POST /v1/resolve ─────────────────────────────────────────────────────────
// Returns a signed routing_token JWT (60s TTL).
// Does NOT return accountToken — never exposed to API callers.

router.post('/resolve', authenticate, async (req: Request, res: Response) => {
  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', issues: parsed.error.issues },
    });
  }

  const start  = Date.now();
  const result = await resolutionService.resolve({ ...parsed.data, ipAddress: req.ip });

  res.json({
    success: true,
    data: {
      routing_token:  result.routing_token,  // signed JWT — present to /verify
      routing:        result.routing,         // public metadata (no credentials)
      resolution_id:  result.resolution_id,
      resolved_at:    result.resolved_at,
      from_cache:     result.from_cache,
      token_expires_in_seconds: 60,
      latency_ms:     Date.now() - start,
    },
  });
});

// ── POST /v1/resolve/verify ───────────────────────────────────────────────────
// Institution-only. Exchanges routing_token for actual accountToken.
// Requires machine JWT with scope: routing:token:verify
// Single-use — token consumed on first verify call.

const VerifySchema = z.object({
  routing_token: z.string().min(1),
});

router.post(
  '/resolve/verify',
  requireMachineScope('routing:token:verify'),
  async (req: Request, res: Response) => {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'routing_token required' },
      });
    }

    const result = await resolutionService.verify(parsed.data.routing_token);

    res.json({
      success: true,
      data: {
        account_token:         result.account_token,
        account_name:          result.claims.account_name,
        destination_bank_code: result.claims.destination_bank_code,
        destination_bank_name: result.claims.destination_bank_name,
        transaction_ref:       result.claims.transaction_ref,
        resolution_id:         result.claims.resolution_id,
      },
    });
  },
);
