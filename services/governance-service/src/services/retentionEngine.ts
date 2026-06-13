// services/governance-service/src/services/retentionEngine.ts
// Data retention policy registry and scheduled deletion management.
// Retention windows are aligned with NDPR (NG), POPIA (ZA), DPA (GH/KE), and BNR (RW).

import { eq, desc } from 'drizzle-orm';
import { getDb, deletionSchedules } from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

export interface RetentionPolicy {
  data_class:                  string;
  description:                 string;
  retention_days:              number;
  legal_basis:                 string;
  deletion_method:             'hard_delete' | 'anonymize' | 'archive';
  countries_with_extensions:   Record<string, number>;
}

export interface ScheduledDeletion {
  id:              string;
  country_code:    string;
  entity_type:     string;
  entity_id:       string;
  retention_class: string;
  scheduled_at:    string;   // future date when deletion is planned
  executed_at?:    string;
  cancelled_at?:   string;
  status:          string;
  metadata:        Record<string, unknown>;
  created_at:      string;
}

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
    entity_id:   string;
    entity_type: string;
    country_code: string;
    data_class:  string;
    reason:      'user_request' | 'retention_policy' | 'legal_hold_lifted' | 'account_closure';
    requested_by: string;
  }): Promise<ScheduledDeletion> {
    const policy       = this.getPolicyForClass(params.data_class);
    const now          = new Date();
    const scheduledAt  = new Date(now);  // future deletion date

    if (params.reason === 'user_request') {
      scheduledAt.setDate(scheduledAt.getDate() + 30);
    } else if (policy) {
      scheduledAt.setDate(scheduledAt.getDate() + policy.retention_days);
    }

    const id = uuidv4();
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
}
