// services/governance-service/src/services/retentionEngine.ts
// Data retention policy registry, scheduled deletion management, and execution.
//
// EXECUTION CONTRACT
// executeScheduledDeletions() processes all deletion_schedules rows where
// status = 'pending' AND scheduled_at <= now, in batches of up to batchSize.
//
// Per-row dispatch by entityType + metadata.method:
//
//   entityType = 'alias', method = 'hard_delete'
//     Soft-delete: aliases.deleted_at = NOW()  (idempotent if already deleted)
//
//   entityType = 'alias', method = 'anonymize'
//     PII scrub: value/normalizedValue → '[redacted]', accountName/accountToken → null
//
//   method = 'archive' (any entityType)
//     External archiving is out of scope — schedule is marked executed immediately.
//
//   Any other combination → skipped with reason in result.
//
// Every executed row gets an audit_logs entry (eventType: RETENTION_DELETION_EXECUTED).
// Failed rows get an audit_logs entry (eventType: RETENTION_DELETION_FAILED) and are
// left in 'pending' state so they can be retried on the next run.
//
// startRetentionJob(intervalMs) bootstraps an in-process setInterval. Call once
// from index.ts. The interval timer is unref'd so it won't block graceful shutdown.

import { eq, and, isNull, lte, desc } from 'drizzle-orm';
import { getDb, deletionSchedules, aliases, auditLogs } from '@rald-alia/db';
import { generateId } from '@rald-alia/shared';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetentionPolicy {
  data_class:                string;
  description:               string;
  retention_days:            number;
  legal_basis:               string;
  deletion_method:           'hard_delete' | 'anonymize' | 'archive';
  countries_with_extensions: Record<string, number>;
}

export interface ScheduledDeletion {
  id:              string;
  country_code:    string;
  entity_type:     string;
  entity_id:       string;
  retention_class: string;
  scheduled_at:    string;
  executed_at?:    string;
  cancelled_at?:   string;
  status:          string;
  metadata:        Record<string, unknown>;
  created_at:      string;
}

export interface ExecutionResult {
  processed: number;
  succeeded: number;
  failed:    number;
  skipped:   number;
  results:   Array<{
    id:        string;
    entity_id: string;
    method:    string;
    status:    'executed' | 'failed' | 'skipped';
    error?:    string;
  }>;
}

// ── Retention policy registry ─────────────────────────────────────────────────

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    data_class:    'identity',
    description:   'Personal identity data (PII, BVN hash, NIN hash)',
    retention_days: 2555,
    legal_basis:   'legal_obligation',
    deletion_method: 'anonymize',
    countries_with_extensions: { NG: 3650, ZA: 1825 },
  },
  {
    data_class:    'transaction_audit',
    description:   'Immutable transaction audit records',
    retention_days: 3650,
    legal_basis:   'legal_obligation',
    deletion_method: 'archive',
    countries_with_extensions: { NG: 5475 },
  },
  {
    data_class:    'alias',
    description:   'Alias registration and history',
    retention_days: 1825,
    legal_basis:   'contract',
    deletion_method: 'hard_delete',
    countries_with_extensions: {},
  },
  {
    data_class:    'fraud_signal',
    description:   'Fraud detection signals and risk scores',
    retention_days: 1095,
    legal_basis:   'legitimate_interest',
    deletion_method: 'anonymize',
    countries_with_extensions: {},
  },
  {
    data_class:    'consent',
    description:   'Consent and permission records',
    retention_days: 2555,
    legal_basis:   'legal_obligation',
    deletion_method: 'archive',
    countries_with_extensions: {},
  },
  {
    data_class:    'developer_logs',
    description:   'API access and developer activity logs',
    retention_days: 365,
    legal_basis:   'legitimate_interest',
    deletion_method: 'hard_delete',
    countries_with_extensions: {},
  },
  {
    data_class:    'routing_decisions',
    description:   'Alias resolution routing decisions',
    retention_days: 730,
    legal_basis:   'legal_obligation',
    deletion_method: 'archive',
    countries_with_extensions: { NG: 1095 },
  },
];

// ── RetentionEngine ───────────────────────────────────────────────────────────

export class RetentionEngine {
  private db = getDb();

  getPolicies(): RetentionPolicy[] {
    return RETENTION_POLICIES;
  }

  getPolicyForClass(dataClass: string): RetentionPolicy | null {
    return RETENTION_POLICIES.find((p) => p.data_class === dataClass) ?? null;
  }

  getEffectiveDays(dataClass: string, country?: string): number {
    const policy = this.getPolicyForClass(dataClass);
    if (!policy) return 365;
    if (country && policy.countries_with_extensions[country.toUpperCase()]) {
      return policy.countries_with_extensions[country.toUpperCase()]!;
    }
    return policy.retention_days;
  }

  async scheduleDeletion(params: {
    entity_id:    string;
    entity_type:  string;
    country_code: string;
    data_class:   string;
    reason:       'user_request' | 'retention_policy' | 'legal_hold_lifted' | 'account_closure';
    requested_by: string;
  }): Promise<ScheduledDeletion> {
    const policy      = this.getPolicyForClass(params.data_class);
    const now         = new Date();
    const scheduledAt = new Date(now);

    if (params.reason === 'user_request') {
      scheduledAt.setDate(scheduledAt.getDate() + 30);
    } else if (policy) {
      scheduledAt.setDate(scheduledAt.getDate() + policy.retention_days);
    }

    const id  = uuidv4();
    const meta = {
      data_class:   params.data_class,
      reason:       params.reason,
      requested_by: params.requested_by,
      method:       policy?.deletion_method ?? 'hard_delete',
    };

    await this.db.insert(deletionSchedules).values({
      id,
      countryCode:    params.country_code,
      entityType:     params.entity_type,
      entityId:       params.entity_id,
      retentionClass: params.data_class,
      scheduledAt,
      status:         'pending',
      metadata:       meta,
    });

    return {
      id,
      country_code:    params.country_code,
      entity_type:     params.entity_type,
      entity_id:       params.entity_id,
      retention_class: params.data_class,
      scheduled_at:    scheduledAt.toISOString(),
      status:          'pending',
      metadata:        meta,
      created_at:      now.toISOString(),
    };
  }

  async listScheduled(params: {
    status?: string;
    page:    number;
    limit:   number;
  }): Promise<{ data: ScheduledDeletion[]; total: number }> {
    const where = params.status ? eq(deletionSchedules.status, params.status) : undefined;

    const rows = await this.db
      .select()
      .from(deletionSchedules)
      .where(where)
      .orderBy(desc(deletionSchedules.scheduledAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const all = await this.db
      .select({ id: deletionSchedules.id })
      .from(deletionSchedules)
      .where(where);

    return {
      data: rows.map((r) => ({
        id:              r.id,
        country_code:    r.countryCode,
        entity_type:     r.entityType,
        entity_id:       r.entityId,
        retention_class: r.retentionClass,
        scheduled_at:    r.scheduledAt.toISOString(),
        executed_at:     r.executedAt?.toISOString(),
        cancelled_at:    r.cancelledAt?.toISOString(),
        status:          r.status,
        metadata:        (r.metadata as Record<string, unknown>) ?? {},
        created_at:      r.createdAt.toISOString(),
      })),
      total: all.length,
    };
  }

  async markComplete(id: string): Promise<void> {
    await this.db
      .update(deletionSchedules)
      .set({ status: 'executed', executedAt: new Date() })
      .where(eq(deletionSchedules.id, id));
  }

  async cancel(id: string): Promise<void> {
    await this.db
      .update(deletionSchedules)
      .set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: 'admin_cancelled' })
      .where(eq(deletionSchedules.id, id));
  }

  // ── executeScheduledDeletions ──────────────────────────────────────────────
  // Processes all due pending schedules in batches.
  // Returns a structured summary of what happened.

  async executeScheduledDeletions(batchSize = 50): Promise<ExecutionResult> {
    const now = new Date();

    // Fetch all pending schedules that are due
    const due = await this.db
      .select()
      .from(deletionSchedules)
      .where(
        and(
          eq(deletionSchedules.status, 'pending'),
          lte(deletionSchedules.scheduledAt, now),
        ),
      )
      .orderBy(deletionSchedules.scheduledAt)
      .limit(batchSize);

    const result: ExecutionResult = {
      processed: due.length,
      succeeded: 0,
      failed:    0,
      skipped:   0,
      results:   [],
    };

    for (const schedule of due) {
      const meta     = (schedule.metadata as Record<string, unknown>) ?? {};
      const method   = (meta['method'] as string) ?? 'hard_delete';
      const entityId = schedule.entityId;
      const entType  = schedule.entityType;

      try {
        if (method === 'archive') {
          // Physical archiving is handled by an external data pipeline.
          // Mark as executed and move on — the schedule acts as the archive trigger record.
          await this._markExecuted(schedule.id, now);
          await this._writeAudit({
            eventType: 'RETENTION_DELETION_EXECUTED',
            targetId:   entityId,
            targetType: entType,
            scheduleId: schedule.id,
            method,
            countryCode: schedule.countryCode,
            note: 'archive — external pipeline trigger',
          });
          result.succeeded++;
          result.results.push({ id: schedule.id, entity_id: entityId, method, status: 'executed' });
          continue;
        }

        if (entType === 'alias') {
          if (method === 'hard_delete') {
            // Soft-delete: set deleted_at (idempotent — skips if already deleted)
            await this.db
              .update(aliases)
              .set({ deletedAt: now })
              .where(and(eq(aliases.id, entityId), isNull(aliases.deletedAt)));
          } else if (method === 'anonymize') {
            // PII scrub: replace identifying fields with sentinel values.
            // Structural columns (userId, type, countryCode, bankCode) are retained
            // for audit continuity; value content is zeroed.
            await this.db
              .update(aliases)
              .set({
                value:           '[redacted]',
                normalizedValue: '[redacted]',
                accountName:     null,
                accountToken:    null,
              })
              .where(eq(aliases.id, entityId));
          } else {
            // Unknown method for alias — skip safely
            result.skipped++;
            result.results.push({
              id: schedule.id, entity_id: entityId, method, status: 'skipped',
              error: `Unknown deletion method '${method}' for entityType 'alias'`,
            });
            continue;
          }
        } else {
          // Unsupported entityType for direct deletion (identity, consent, trust_score, etc.)
          // are managed by their owning services. Governance just marks the schedule executed
          // and the owning service must subscribe to the audit event.
          await this._markExecuted(schedule.id, now);
          await this._writeAudit({
            eventType:  'RETENTION_DELETION_EXECUTED',
            targetId:    entityId,
            targetType:  entType,
            scheduleId:  schedule.id,
            method,
            countryCode: schedule.countryCode,
            note: `entityType '${entType}' — delegated to owning service`,
          });
          result.skipped++;
          result.results.push({ id: schedule.id, entity_id: entityId, method, status: 'skipped',
            error: `entityType '${entType}' deletion is delegated to the owning service` });
          continue;
        }

        // Mark the schedule executed
        await this._markExecuted(schedule.id, now);
        await this._writeAudit({
          eventType:  'RETENTION_DELETION_EXECUTED',
          targetId:    entityId,
          targetType:  entType,
          scheduleId:  schedule.id,
          method,
          countryCode: schedule.countryCode,
        });

        result.succeeded++;
        result.results.push({ id: schedule.id, entity_id: entityId, method, status: 'executed' });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // Failed rows stay 'pending' so the next run retries them.
        await this._writeAudit({
          eventType:  'RETENTION_DELETION_FAILED',
          targetId:    entityId,
          targetType:  entType,
          scheduleId:  schedule.id,
          method,
          countryCode: schedule.countryCode,
          note:        message,
        }).catch(() => {});   // don't let audit failure mask the original error

        result.failed++;
        result.results.push({ id: schedule.id, entity_id: entityId, method, status: 'failed', error: message });
      }
    }

    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _markExecuted(id: string, at: Date): Promise<void> {
    await this.db
      .update(deletionSchedules)
      .set({ status: 'executed', executedAt: at })
      .where(eq(deletionSchedules.id, id));
  }

  private async _writeAudit(params: {
    eventType:   string;
    targetId:    string;
    targetType:  string;
    scheduleId:  string;
    method:      string;
    countryCode: string;
    note?:       string;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      id:         generateId('al'),
      eventType:  params.eventType,
      actorId:    'governance-service',
      actorType:  'system',
      targetId:   params.targetId,
      targetType: params.targetType,
      metadata: {
        scheduleId:  params.scheduleId,
        method:      params.method,
        countryCode: params.countryCode,
        ...(params.note ? { note: params.note } : {}),
      },
    });
  }
}

// ── Standalone job runner ─────────────────────────────────────────────────────
// Call once from index.ts. Runs immediately on start (catches overdue records),
// then on intervalMs cadence. Timer is unref'd to allow graceful shutdown.

export function startRetentionJob(
  intervalMs: number = 60 * 60 * 1_000,  // default: 1 hour
  batchSize:  number = 50,
): void {
  const engine = new RetentionEngine();

  const run = () =>
    engine.executeScheduledDeletions(batchSize).then((r) => {
      if (r.processed > 0) {
        console.info(
          { processed: r.processed, succeeded: r.succeeded, failed: r.failed, skipped: r.skipped },
          'retention-job: batch complete',
        );
      }
    }).catch((err: unknown) => {
      console.error({ err }, 'retention-job: batch failed');
    });

  // Run immediately so overdue records aren't held until the first interval tick
  void run();

  setInterval(run, intervalMs).unref();
}
