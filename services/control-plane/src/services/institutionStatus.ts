// services/control-plane/src/services/institutionStatus.ts
// Read-only admin view of institution onboarding pipeline.

import { eq, desc } from 'drizzle-orm';
import { getDb, financialInstitutions } from '@rald-alia/db';

export interface InstitutionOnboardingItem {
  id:             string;
  name:           string;
  short_code:     string;
  institution_type: string;
  country:        string;
  status:         string;
  swift_code?:    string;
  contact_email?: string;
  onboarded_at?:  string;
  created_at:     string;
  updated_at:     string;
}

export interface OnboardingPipelineSummary {
  total:      number;
  by_status:  Record<string, number>;
  by_country: Record<string, number>;
  by_type:    Record<string, number>;
}

export class InstitutionStatusService {
  private db = getDb();

  async listOnboarding(opts: {
    status?:  string;
    country?: string;
    page:     number;
    limit:    number;
  }): Promise<{ items: InstitutionOnboardingItem[]; total: number }> {
    const { status, country, page, limit } = opts;

    const conditions: any[] = [];
    if (status)  conditions.push(eq(financialInstitutions.status,  status  as any));
    if (country) conditions.push(eq(financialInstitutions.country, country));

    const { and } = await import('drizzle-orm');
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, all] = await Promise.all([
      this.db.select().from(financialInstitutions).where(where).orderBy(desc(financialInstitutions.createdAt)).limit(limit).offset((page - 1) * limit),
      this.db.select({ id: financialInstitutions.id }).from(financialInstitutions).where(where),
    ]);

    return {
      items: rows.map((r) => ({
        id:               r.id,
        name:             r.name,
        short_code:       r.shortCode,
        institution_type: r.institutionType,
        country:          r.country,
        status:           r.status,
        swift_code:       r.swiftCode ?? undefined,
        contact_email:    r.contactEmail ?? undefined,
        onboarded_at:     r.onboardedAt?.toISOString(),
        created_at:       r.createdAt.toISOString(),
        updated_at:       r.updatedAt.toISOString(),
      })),
      total: all.length,
    };
  }

  async getPipelineSummary(): Promise<OnboardingPipelineSummary> {
    const rows = await this.db
      .select({
        id:               financialInstitutions.id,
        status:           financialInstitutions.status,
        country:          financialInstitutions.country,
        institutionType:  financialInstitutions.institutionType,
      })
      .from(financialInstitutions);

    const byStatus:  Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byType:    Record<string, number> = {};

    for (const r of rows) {
      byStatus[r.status]           = (byStatus[r.status]           ?? 0) + 1;
      byCountry[r.country]         = (byCountry[r.country]         ?? 0) + 1;
      byType[r.institutionType]    = (byType[r.institutionType]    ?? 0) + 1;
    }

    return { total: rows.length, by_status: byStatus, by_country: byCountry, by_type: byType };
  }
}
