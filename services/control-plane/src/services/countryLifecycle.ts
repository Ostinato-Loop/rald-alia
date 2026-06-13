// services/control-plane/src/services/countryLifecycle.ts
// Admin view and transition proxy for country governance lifecycle.
// Reads DB directly for listing; proxies transitions to governance-service.

import { desc } from 'drizzle-orm';
import { getDb, countryGovernance } from '@rald-alia/db';
import { logger } from '../index';

export interface CountryOverview {
  id:           string;
  country_code: string;
  country_name: string;
  status:       string;
  kyc_level:    number;
  compliance_framework: string;
  is_operational: boolean;
  activated_at?:  string;
  created_at:   string;
  updated_at:   string;
}

const OPERATIONAL_STATUSES = new Set(['PUBLIC_BETA', 'GA']);
const GOVERNANCE_SERVICE_URL = () => process.env['GOVERNANCE_SERVICE_URL'] ?? 'http://governance-service:3008';
const MACHINE_TOKEN          = () => process.env['CONTROL_PLANE_MACHINE_TOKEN'] ?? '';

export class CountryLifecycleService {
  private db = getDb();

  async listCountries(): Promise<CountryOverview[]> {
    const rows = await this.db.select().from(countryGovernance).orderBy(desc(countryGovernance.updatedAt));
    return rows.map((r) => ({
      id:                   r.id,
      country_code:         r.countryCode,
      country_name:         r.countryName,
      status:               r.status,
      kyc_level:            r.kycRequirementLevel,
      compliance_framework: r.complianceFramework,
      is_operational:       OPERATIONAL_STATUSES.has(r.status),
      activated_at:         r.activatedAt?.toISOString(),
      created_at:           r.createdAt.toISOString(),
      updated_at:           r.updatedAt.toISOString(),
    }));
  }

  async transition(params: {
    country_code: string;
    to_status:    string;
    actor_id:     string;
    reason?:      string;
  }): Promise<{ success: boolean; status: string }> {
    const url = `${GOVERNANCE_SERVICE_URL()}/v1/countries/${params.country_code}/status`;
    logger.info({ country: params.country_code, toStatus: params.to_status }, 'Control-plane transitioning country status');

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${MACHINE_TOKEN()}`,
      },
      body: JSON.stringify({
        to_status:  params.to_status,
        actor_id:   params.actor_id,
        actor_type: 'control_plane',
        reason:     params.reason,
      }),
    });

    const body = await res.json() as { success: boolean; data?: { status: string }; error?: any };
    if (!res.ok || !body.success) {
      throw Object.assign(
        new Error(body.error?.message ?? 'Governance service error'),
        { status: res.status, code: body.error?.code ?? 'UPSTREAM_ERROR' },
      );
    }

    return { success: true, status: body.data!.status };
  }

  async getLifecycleSummary(): Promise<Record<string, number>> {
    const rows = await this.db.select({ status: countryGovernance.status }).from(countryGovernance);
    const counts: Record<string, number> = {
      DISABLED:     0,
      INTERNAL:     0,
      PRIVATE_BETA: 0,
      PUBLIC_BETA:  0,
      GA:           0,
    };
    for (const r of rows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }
}
