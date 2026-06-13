// services/governance-service/src/routes/resolution-log.routes.ts
// Query interface for alias_resolution_log — the per-alias resolution audit table.
// Provides list, stats, and single-record endpoints for compliance/governance teams.
//
// All endpoints require scope: governance:resolutions:read (machine auth).

import { Router, Request, Response, NextFunction } from 'express';
import { and, eq, gte, lte, desc, count, avg, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, aliasResolutionLog } from '@rald-alia/db';
import { requireMachineScope } from '../middleware/machineAuth';

export const resolutionLogRouter = Router();

const db = getDb();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── GET /v1/governance/resolutions ───────────────────────────────────────────
// List resolution log entries with optional filters.
//
// Query params:
//   alias_id      — filter to one alias's history
//   country_code  — filter by country (2-char ISO)
//   status        — completed | not_found | blocked | error
//   initiator_id  — filter by initiating institution / bank code
//   from          — ISO 8601 start of created_at range (inclusive)
//   to            — ISO 8601 end   of created_at range (inclusive)
//   page          — 1-based (default 1)
//   limit         — rows per page, max 200 (default 50)

const ListQuerySchema = z.object({
  alias_id:     z.string().min(1).optional(),
  country_code: z.string().length(2).toUpperCase().optional(),
  status:       z.enum(['completed', 'not_found', 'blocked', 'error']).optional(),
  initiator_id: z.string().min(1).optional(),
  from:         z.string().datetime({ offset: true }).optional(),
  to:           z.string().datetime({ offset: true }).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(200).default(50),
});

resolutionLogRouter.get(
  '/',
  requireMachineScope('governance:resolutions:read'),
  asyncHandler(async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      });
    }

    const { alias_id, country_code, status, initiator_id, from, to, page, limit } = parsed.data;

    const conditions = [];
    if (alias_id)     conditions.push(eq(aliasResolutionLog.aliasId,     alias_id));
    if (country_code) conditions.push(eq(aliasResolutionLog.countryCode, country_code));
    if (status)       conditions.push(eq(aliasResolutionLog.status,      status));
    if (initiator_id) conditions.push(eq(aliasResolutionLog.initiatorId, initiator_id));
    if (from)         conditions.push(gte(aliasResolutionLog.createdAt,  new Date(from)));
    if (to)           conditions.push(lte(aliasResolutionLog.createdAt,  new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(aliasResolutionLog)
        .where(where)
        .orderBy(desc(aliasResolutionLog.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: count() })
        .from(aliasResolutionLog)
        .where(where),
    ]);

    res.json({
      success: true,
      data:    rows,
      meta: {
        total:        totalRow?.total ?? 0,
        page,
        limit,
        total_pages:  Math.ceil((totalRow?.total ?? 0) / limit),
      },
    });
  }),
);

// ── GET /v1/governance/resolutions/stats ─────────────────────────────────────
// Aggregate metrics over a time window.
//
// Query params:
//   country_code  — scope to one country (optional)
//   initiator_id  — scope to one initiator (optional)
//   from          — ISO 8601 start (default: 24 h ago)
//   to            — ISO 8601 end   (default: now)

const StatsQuerySchema = z.object({
  country_code: z.string().length(2).toUpperCase().optional(),
  initiator_id: z.string().min(1).optional(),
  from:         z.string().datetime({ offset: true }).optional(),
  to:           z.string().datetime({ offset: true }).optional(),
});

resolutionLogRouter.get(
  '/stats',
  requireMachineScope('governance:resolutions:read'),
  asyncHandler(async (req, res) => {
    const parsed = StatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      });
    }

    const { country_code, initiator_id } = parsed.data;
    const fromDate = parsed.data.from
      ? new Date(parsed.data.from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24 h
    const toDate = parsed.data.to ? new Date(parsed.data.to) : new Date();

    const conditions = [
      gte(aliasResolutionLog.createdAt, fromDate),
      lte(aliasResolutionLog.createdAt, toDate),
    ];
    if (country_code) conditions.push(eq(aliasResolutionLog.countryCode, country_code));
    if (initiator_id) conditions.push(eq(aliasResolutionLog.initiatorId, initiator_id));

    const where = and(...conditions);

    // ── Summary counts + avg latency ─────────────────────────────────────────
    const [summary] = await db
      .select({
        total:       count(),
        avg_latency: avg(aliasResolutionLog.latencyMs),
      })
      .from(aliasResolutionLog)
      .where(where);

    // ── Count by status ───────────────────────────────────────────────────────
    const statusCounts = await db
      .select({
        status: aliasResolutionLog.status,
        total:  count(),
      })
      .from(aliasResolutionLog)
      .where(where)
      .groupBy(aliasResolutionLog.status);

    // ── P95 latency via PostgreSQL percentile_cont (raw SQL) ─────────────────
    const [p95Row] = await db.execute<{ p95: string | null }>(sql`
      SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
      FROM alias_resolution_log
      WHERE created_at >= ${fromDate}
        AND created_at <= ${toDate}
        ${country_code ? sql`AND country_code = ${country_code}` : sql``}
        ${initiator_id ? sql`AND initiator_id = ${initiator_id}` : sql``}
    `);

    // ── Count by country (top 10) ─────────────────────────────────────────────
    const byCountry = await db
      .select({
        country_code: aliasResolutionLog.countryCode,
        total:        count(),
      })
      .from(aliasResolutionLog)
      .where(where)
      .groupBy(aliasResolutionLog.countryCode)
      .orderBy(desc(count()))
      .limit(10);

    // ── Success rate ──────────────────────────────────────────────────────────
    const totalResolutions = Number(summary?.total ?? 0);
    const completed        = statusCounts.find((r) => r.status === 'completed');
    const successRate      = totalResolutions > 0
      ? ((Number(completed?.total ?? 0) / totalResolutions) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        window: { from: fromDate.toISOString(), to: toDate.toISOString() },
        summary: {
          total:        totalResolutions,
          success_rate: `${successRate}%`,
          avg_latency_ms: summary?.avg_latency
            ? Number(Number(summary.avg_latency).toFixed(1))
            : null,
          p95_latency_ms: p95Row?.p95 ? Number(Number(p95Row.p95).toFixed(0)) : null,
        },
        by_status: Object.fromEntries(
          statusCounts.map((r) => [r.status, Number(r.total)]),
        ),
        by_country: byCountry.map((r) => ({
          country_code: r.country_code,
          total:        Number(r.total),
        })),
      },
    });
  }),
);

// ── GET /v1/governance/resolutions/:id ───────────────────────────────────────
// Fetch a single resolution log entry by its ID.

resolutionLogRouter.get(
  '/:id',
  requireMachineScope('governance:resolutions:read'),
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(aliasResolutionLog)
      .where(eq(aliasResolutionLog.id, req.params.id!))
      .limit(1);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Resolution log entry '${req.params.id}' not found` },
      });
    }

    res.json({ success: true, data: row });
  }),
);
