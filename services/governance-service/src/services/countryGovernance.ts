// services/governance-service/src/services/countryGovernance.ts
// Country Governance Engine — manages the DISABLED → INTERNAL → PRIVATE_BETA
// → PUBLIC_BETA → GA lifecycle for every ALIA jurisdiction.
//
// Rules:
//   • No country activates automatically.
//   • Every status transition requires an explicit admin action.
//   • Any country can be DISABLED from any state (emergency brake).
//   • Forward transitions follow the defined progression only.

import { eq, desc } from 'drizzle-orm';
import { getDb, countryGovernance, countryGovernanceEvents } from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

export type CountryStatus =
  | 'DISABLED'
  | 'INTERNAL'
  | 'PRIVATE_BETA'
  | 'PUBLIC_BETA'
  | 'GA';

export interface CountryRecord {
  country_code:   string;
  country_name:   string;
  status:         CountryStatus;
  currency:       string;
  regulatory_body?: string;
  approved_by?:   string;
  approved_at?:   string;
  notes?:         string;
  metadata:       Record<string, unknown>;
  created_at:     string;
  updated_at:     string;
}

export interface CountryTransitionEvent {
  id:           string;
  country_code: string;
  from_status?: string;
  to_status:    string;
  actor_id?:    string;
  actor_type:   string;
  notes?:       string;
  created_at:   string;
}

// Allowed forward transitions — DISABLED is always reachable (emergency brake)
const ALLOWED_TRANSITIONS: Record<string, CountryStatus[]> = {
  DISABLED:     ['INTERNAL'],
  INTERNAL:     ['PRIVATE_BETA', 'DISABLED'],
  PRIVATE_BETA: ['PUBLIC_BETA', 'DISABLED'],
  PUBLIC_BETA:  ['GA', 'DISABLED'],
  GA:           ['DISABLED'],
};

// Seed data — initial country records inserted on first boot if missing
const SEED_COUNTRIES = [
  { code: 'NG', name: 'Nigeria',      currency: 'NGN', regulatory_body: 'Central Bank of Nigeria (CBN)',      status: 'INTERNAL' as CountryStatus },
  { code: 'GH', name: 'Ghana',        currency: 'GHS', regulatory_body: 'Bank of Ghana (BoG)',                status: 'DISABLED' as CountryStatus },
  { code: 'KE', name: 'Kenya',        currency: 'KES', regulatory_body: 'Central Bank of Kenya (CBK)',        status: 'DISABLED' as CountryStatus },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', regulatory_body: 'South African Reserve Bank (SARB)', status: 'DISABLED' as CountryStatus },
  { code: 'RW', name: 'Rwanda',       currency: 'RWF', regulatory_body: 'National Bank of Rwanda (BNR)',      status: 'DISABLED' as CountryStatus },
];

function rowToRecord(row: typeof countryGovernance.$inferSelect): CountryRecord {
  return {
    country_code:    row.countryCode,
    country_name:    row.countryName,
    status:          row.status as CountryStatus,
    currency:        row.currency,
    regulatory_body: row.regulatoryBody ?? undefined,
    approved_by:     row.approvedBy ?? undefined,
    approved_at:     row.approvedAt?.toISOString(),
    notes:           row.notes ?? undefined,
    metadata:        (row.metadata as Record<string, unknown>) ?? {},
    created_at:      row.createdAt.toISOString(),
    updated_at:      row.updatedAt.toISOString(),
  };
}

function eventRowToEvent(row: typeof countryGovernanceEvents.$inferSelect): CountryTransitionEvent {
  return {
    id:           row.id,
    country_code: row.countryCode,
    from_status:  row.fromStatus ?? undefined,
    to_status:    row.toStatus,
    actor_id:     row.actorId ?? undefined,
    actor_type:   row.actorType,
    notes:        row.notes ?? undefined,
    created_at:   row.createdAt.toISOString(),
  };
}

export class CountryGovernanceEngine {
  private db = getDb();

  // ── Seed ─────────────────────────────────────────────────────────────────

  async seed(): Promise<void> {
    for (const c of SEED_COUNTRIES) {
      const existing = await this.db
        .select({ countryCode: countryGovernance.countryCode })
        .from(countryGovernance)
        .where(eq(countryGovernance.countryCode, c.code))
        .limit(1);

      if (existing.length === 0) {
        await this.db.insert(countryGovernance).values({
          countryCode:    c.code,
          countryName:    c.name,
          status:         c.status,
          currency:       c.currency,
          regulatoryBody: c.regulatory_body,
        });
      }
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(): Promise<CountryRecord[]> {
    const rows = await this.db
      .select()
      .from(countryGovernance)
      .orderBy(countryGovernance.countryCode);
    return rows.map(rowToRecord);
  }

  async get(code: string): Promise<CountryRecord | null> {
    const [row] = await this.db
      .select()
      .from(countryGovernance)
      .where(eq(countryGovernance.countryCode, code.toUpperCase()))
      .limit(1);
    return row ? rowToRecord(row) : null;
  }

  // ── Status check (consumed by other services as a gateway) ────────────────

  async isOperational(code: string): Promise<{ allowed: boolean; status: CountryStatus; reason?: string }> {
    const rec = await this.get(code);
    if (!rec) {
      return { allowed: false, status: 'DISABLED', reason: `Country ${code} is not a registered ALIA jurisdiction` };
    }
    if (rec.status === 'DISABLED') {
      return { allowed: false, status: 'DISABLED', reason: `Country ${code} has been administratively disabled` };
    }
    return { allowed: true, status: rec.status };
  }

  // ── Status transition (admin-only) ────────────────────────────────────────

  async transition(params: {
    country_code: string;
    to_status:    CountryStatus;
    actor_id:     string;
    actor_type:   string;
    notes?:       string;
  }): Promise<CountryRecord> {
    const code = params.country_code.toUpperCase();
    const rec  = await this.get(code);

    if (!rec) {
      throw Object.assign(new Error(`Country ${code} not found`), { status: 404, code: 'COUNTRY_NOT_FOUND' });
    }

    const allowed = ALLOWED_TRANSITIONS[rec.status];
    if (!allowed || !allowed.includes(params.to_status)) {
      throw Object.assign(
        new Error(
          `Invalid country status transition: ${rec.status} → ${params.to_status}. ` +
          `Allowed from ${rec.status}: ${allowed?.join(', ') ?? 'none'}.`,
        ),
        { status: 422, code: 'INVALID_TRANSITION' },
      );
    }

    const now = new Date();
    const [updated] = await this.db
      .update(countryGovernance)
      .set({
        status:     params.to_status,
        approvedBy: params.actor_id,
        approvedAt: now,
        notes:      params.notes ?? null,
        updatedAt:  now,
      })
      .where(eq(countryGovernance.countryCode, code))
      .returning();

    // Append transition event
    await this.db.insert(countryGovernanceEvents).values({
      id:          uuidv4(),
      countryCode: code,
      fromStatus:  rec.status,
      toStatus:    params.to_status,
      actorId:     params.actor_id,
      actorType:   params.actor_type,
      notes:       params.notes ?? null,
    });

    return rowToRecord(updated!);
  }

  // ── Transition history ────────────────────────────────────────────────────

  async getEvents(code: string): Promise<CountryTransitionEvent[]> {
    const rows = await this.db
      .select()
      .from(countryGovernanceEvents)
      .where(eq(countryGovernanceEvents.countryCode, code.toUpperCase()))
      .orderBy(desc(countryGovernanceEvents.createdAt));
    return rows.map(eventRowToEvent);
  }

  // ── Eligibility summary ───────────────────────────────────────────────────

  async eligibilitySummary(): Promise<{
    total:       number;
    by_status:   Record<string, number>;
    operational: string[];
  }> {
    const all     = await this.list();
    const byStatus: Record<string, number> = {};
    const operational: string[]            = [];

    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status !== 'DISABLED') operational.push(r.country_code);
    }

    return { total: all.length, by_status: byStatus, operational };
  }
}
