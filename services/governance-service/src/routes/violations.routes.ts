// services/governance-service/src/routes/violations.routes.ts
// Policy violations query and resolution interface.
//
// Violations are written by the governance Kafka consumer when SLA thresholds
// are breached (RESOLUTION_FAILURE_RATE, RESOLUTION_LATENCY_BREACH) and by any
// future compliance engine that detects policy infractions.
//
// Endpoints:
//   GET  /v1/governance/violations         — paginated list with filters
//   GET  /v1/governance/violations/stats   — aggregate counts by policy / type
//   GET  /v1/governance/violations/:id     — single record
//   PATCH /v1/governance/violations/:id/resolve — mark resolved

import { Router, Request, Response, NextFunction } from 'express';
import { and, eq, gte, lte, desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, governancePolicyViolations } from '@rald-alia/db';
import { requireMachineScope } from '../middleware/machineAuth';

export const violationsRouter = Router();
const db = getDb();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── GET /v1/governance/violations ────────────────────────────────────────────
// Paginated list of policy violations.
//
// Query params:
//   policy_id      — RESOLUTION_FAILURE_RATE | RESOLUTION_LATENCY_BREACH | …
//   violation_type — sla_breach | latency_breach | compliance_failure | …
//   country_code   — 2-char ISO (or 'XX' for bank-scope violations)
//   actor_id       — bank code / institution ID that triggered the violation
//   resolved       — true | false
//   from / to      — ISO 8601 created_at range
//   page / limit   — pagination (max 200)

const ListQuerySchema = z.object({
  policy_id:      z.string().min(1).optional(),
  violation_type: z.string().min(1).optional(),
  country_code:   z.string().min(2).max(2).toUpperCase().optional(),
  actor_id:       z.string().min(1).optional(),
  resolved:       z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  from:           z.string().datetime({ offset: true }).optional(),
  to:             z.string().datetime({ offset: true }).optional(),
  page:           z.coerce.number().int().min(1).default(1),
  limit:          z.coerce.number().int().min(1).max(200).default(50),
});

violationsRouter.get(
  '/',
  requireMachineScope('governance:violations:read'),
  asyncHandler(async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      });
    }

    const { policy_id, violation_type, country_code, actor_id, resolved, from, to, page, limit } = parsed.data;

    const conditions = [];
    if (policy_id)      conditions.push(eq(governancePolicyViolations.policyId,      policy_id));
    if (violation_type) conditions.push(eq(governancePolicyViolations.violationType,  violation_type));
    if (country_code)   conditions.push(eq(governancePolicyViolations.countryCode,    country_code));
    if (actor_id)       conditions.push(eq(governancePolicyViolations.actorId,        actor_id));
    if (resolved !== undefined) conditions.push(eq(governancePolicyViolations.resolved, resolved));
    if (from)           conditions.push(gte(governancePolicyViolations.createdAt, new Date(from)));
    if (to)             conditions.push(lte(governancePolicyViolations.createdAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(governancePolicyViolations)
        .where(where)
        .orderBy(desc(governancePolicyViolations.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: count() })
        .from(governancePolicyViolations)
        .where(where),
    ]);

    res.json({
      success: true,
      data:    rows,
      meta: {
        total:       totalRow?.total ?? 0,
        page,
        limit,
        total_pages: Math.ceil((totalRow?.total ?? 0) / limit),
      },
    });
  }),
);

// ── GET /v1/governance/violations/stats ──────────────────────────────────────
// Aggregate counts over a configurable time window (default: last 7 days).

const StatsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to:   z.string().datetime({ offset: true }).optional(),
});

violationsRouter.get(
  '/stats',
  requireMachineScope('governance:violations:read'),
  asyncHandler(async (req, res) => {
    const parsed = StatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      });
    }

    const fromDate = parsed.data.from
      ? new Date(parsed.data.from)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000); // default: last 7 days
    const toDate = parsed.data.to ? new Date(parsed.data.to) : new Date();

    const where = and(
      gte(governancePolicyViolations.createdAt, fromDate),
      lte(governancePolicyViolations.createdAt, toDate),
    );

    const [byPolicy, byType, byResolved, [summary]] = await Promise.all([
      // Count by policy_id
      db
        .select({ policy_id: governancePolicyViolations.policyId, total: count() })
        .from(governancePolicyViolations)
        .where(where)
        .groupBy(governancePolicyViolations.policyId)
        .orderBy(desc(count())),

      // Count by violation_type
      db
        .select({ violation_type: governancePolicyViolations.violationType, total: count() })
        .from(governancePolicyViolations)
        .where(where)
        .groupBy(governancePolicyViolations.violationType)
        .orderBy(desc(count())),

      // Count resolved vs unresolved
      db
        .select({ resolved: governancePolicyViolations.resolved, total: count() })
        .from(governancePolicyViolations)
        .where(where)
        .groupBy(governancePolicyViolations.resolved),

      // Total
      db
        .select({ total: count() })
        .from(governancePolicyViolations)
        .where(where),
    ]);

    const resolvedCount   = byResolved.find((r) => r.resolved  === true)?.total  ?? 0;
    const unresolvedCount = byResolved.find((r) => r.resolved  === false)?.total ?? 0;
    const total           = Number(summary?.total ?? 0);

    res.json({
      success: true,
      data: {
        window: { from: fromDate.toISOString(), to: toDate.toISOString() },
        summary: {
          total,
          resolved:         Number(resolvedCount),
          unresolved:       Number(unresolvedCount),
          resolution_rate:  total > 0
            ? `${((Number(resolvedCount) / total) * 100).toFixed(1)}%`
            : '0.0%',
        },
        by_policy:         byPolicy.map((r)  => ({ policy_id:      r.policy_id,      total: Number(r.total) })),
        by_violation_type: byType.map((r)    => ({ violation_type: r.violation_type, total: Number(r.total) })),
      },
    });
  }),
);

// ── GET /v1/governance/violations/:id ────────────────────────────────────────

violationsRouter.get(
  '/:id',
  requireMachineScope('governance:violations:read'),
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(governancePolicyViolations)
      .where(eq(governancePolicyViolations.id, req.params.id!))
      .limit(1);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Violation '${req.params.id}' not found` },
      });
    }

    res.json({ success: true, data: row });
  }),
);

// ── PATCH /v1/governance/violations/:id/resolve ──────────────────────────────
// Mark a violation as resolved (idempotent — resolving an already-resolved
// violation returns 200 with the current state).

const ResolveSchema = z.object({
  resolution_note: z.string().min(1).max(500).optional(),
});

violationsRouter.patch(
  '/:id/resolve',
  requireMachineScope('governance:violations:write'),
  asyncHandler(async (req, res) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      });
    }

    const [existing] = await db
      .select()
      .from(governancePolicyViolations)
      .where(eq(governancePolicyViolations.id, req.params.id!))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Violation '${req.params.id}' not found` },
      });
    }

    if (existing.resolved) {
      // Idempotent — already resolved
      return res.json({ success: true, data: existing });
    }

    const now = new Date();
    const metadata = {
      ...(typeof existing.metadata === 'object' && existing.metadata !== null
        ? existing.metadata
        : {}),
      ...(parsed.data.resolution_note
        ? { resolution_note: parsed.data.resolution_note, resolved_by_api: true }
        : { resolved_by_api: true }),
      resolved_at_utc: now.toISOString(),
    };

    const [updated] = await db
      .update(governancePolicyViolations)
      .set({ resolved: true, resolvedAt: now, metadata })
      .where(eq(governancePolicyViolations.id, req.params.id!))
      .returning();

    res.json({ success: true, data: updated });
  }),
);
