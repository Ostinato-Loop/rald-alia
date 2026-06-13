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
  id:             string;
  entity_id:      string;
  data_class:     string;
  reason:         string;
  requested_by:   string;
  method:         string;
  scheduled_at:   string;
  execution_date: string;
  status:         string;
  completed_at?:  string;
  created_at:     string;
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
    data_class:  string;
    reason:      'user_request' | 'retention_policy' | 'legal_hold_lifted' | 'account_closure';
    requested_by: string;
  }): Promise<ScheduledDeletion> {
    const policy       = this.getPolicyForClass(params.data_class);
    const scheduledAt  = new Date();
    const executionDate = new Date(scheduledAt);

    if (params.reason === 'user_request') {
      executionDate.setDate(executionDate.getDate() + 30);
    } else if (policy) {
      executionDate.setDate(executionDate.getDate() + policy.retention_days);
    }

    const method = policy?.deletion_method ?? 'hard_delete';
    const id     = uuidv4();

    await this.db.insert(deletionSchedules).values({
      id,
      entityId:      params.entity_id,
      dataClass:     params.data_class,
      reason:        params.reason,
      requestedBy:   params.requested_by,
      method,
      scheduledAt,
      executionDate,
      status:        'scheduled',
    });

    return {
      id,
      entity_id:      params.entity_id,
      data_class:     params.data_class,
      reason:         params.reason,
      requested_by:   params.requested_by,
      method,
      scheduled_at:   scheduledAt.toISOString(),
      execution_date: executionDate.toISOString(),
      status:         'scheduled',
      created_at:     scheduledAt.toISOString(),
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
      .orderBy(desc(deletionSchedules.executionDate))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const all = await this.db
      .select({ id: deletionSchedules.id })
      .from(deletionSchedules)
      .where(where);

    return {
      data: rows.map((r) => ({
        id:             r.id,
        entity_id:      r.entityId,
        data_class:     r.dataClass,
        reason:         r.reason,
        requested_by:   r.requestedBy,
        method:         r.method,
        scheduled_at:   r.scheduledAt.toISOString(),
        execution_date: r.executionDate.toISOString(),
        status:         r.status,
        completed_at:   r.completedAt?.toISOString(),
        created_at:     r.createdAt.toISOString(),
      })),
      total: all.length,
    };
  }

  async markComplete(id: string): Promise<void> {
    await this.db
      .update(deletionSchedules)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(deletionSchedules.id, id));
  }

  async cancel(id: string): Promise<void> {
    await this.db
      .update(deletionSchedules)
      .set({ status: 'cancelled' })
      .where(eq(deletionSchedules.id, id));
  }
}
