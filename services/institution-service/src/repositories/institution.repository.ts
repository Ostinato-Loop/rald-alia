import { eq, and, ilike, sql, count, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@rald-alia/db';
import {
  financialInstitutions,
  institutionLicenses,
  institutionRoutingPrefixes,
  institutionSettlementAccounts,
  institutionEvents,
} from '@rald-alia/db';
import { generateId } from '@rald-alia/shared';
import { logger } from '../index';

type Institution       = typeof financialInstitutions.$inferSelect;
type NewInstitution    = typeof financialInstitutions.$inferInsert;
type License           = typeof institutionLicenses.$inferSelect;
type NewLicense        = typeof institutionLicenses.$inferInsert;
type RoutingPrefix     = typeof institutionRoutingPrefixes.$inferSelect;
type NewRoutingPrefix  = typeof institutionRoutingPrefixes.$inferInsert;
type SettlementAccount = typeof institutionSettlementAccounts.$inferSelect;
type NewSettlementAccount = typeof institutionSettlementAccounts.$inferInsert;

export class InstitutionRepository {
  private db = getDb();

  // ── Institutions ────────────────────────────────────────────────────────────

  async findAll(filters: {
    country?:     string;
    type?:        string;
    status?:      string;
    participant?: boolean;
    search?:      string;
    limit?:       number;
    offset?:      number;
  } = {}): Promise<{ data: Institution[]; total: number }> {
    const conditions: any[] = [];

    if (filters.country)     conditions.push(eq(financialInstitutions.hqCountry, filters.country));
    if (filters.type)        conditions.push(eq(financialInstitutions.type, filters.type as any));
    if (filters.status)      conditions.push(eq(financialInstitutions.status, filters.status as any));
    if (filters.participant !== undefined) {
      conditions.push(eq(financialInstitutions.isAliaParticipant, filters.participant));
    }
    if (filters.search) {
      conditions.push(
        sql`(${financialInstitutions.fullName} ILIKE ${'%' + filters.search + '%'} OR ${financialInstitutions.shortName} ILIKE ${'%' + filters.search + '%'})`,
      );
    }

    const where  = conditions.length > 0 ? and(...conditions) : undefined;
    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;

    const [data, [{ value: total }]] = await Promise.all([
      this.db.select().from(financialInstitutions).where(where).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(financialInstitutions).where(where),
    ]);

    return { data, total: Number(total) };
  }

  async findById(id: string): Promise<Institution | null> {
    const [row] = await this.db
      .select()
      .from(financialInstitutions)
      .where(eq(financialInstitutions.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByCode(code: string): Promise<Institution | null> {
    const [row] = await this.db
      .select()
      .from(financialInstitutions)
      .where(eq(financialInstitutions.institutionCode, code))
      .limit(1);
    return row ?? null;
  }

  async create(data: Omit<NewInstitution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Institution> {
    const id = generateId('fi');
    const [row] = await this.db
      .insert(financialInstitutions)
      .values({ id, ...data } as NewInstitution)
      .returning();

    await this.logEvent(id!, 'registered', 'system', { institutionCode: data.institutionCode });
    logger.info({ id, code: data.institutionCode }, 'Institution registered');
    return row!;
  }

  async update(id: string, data: Partial<Institution>): Promise<Institution | null> {
    const [row] = await this.db
      .update(financialInstitutions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(financialInstitutions.id, id))
      .returning();

    if (row) await this.logEvent(id, 'updated', 'system', data);
    return row ?? null;
  }

  async suspend(id: string, reason: string, actorId?: string): Promise<Institution | null> {
    const [row] = await this.db
      .update(financialInstitutions)
      .set({ status: 'suspended', suspendedAt: new Date(), suspensionReason: reason, updatedAt: new Date() } as any)
      .where(eq(financialInstitutions.id, id))
      .returning();

    if (row) await this.logEvent(id, 'suspended', actorId ?? 'system', { reason });
    return row ?? null;
  }

  async reinstate(id: string, actorId?: string): Promise<Institution | null> {
    const [row] = await this.db
      .update(financialInstitutions)
      .set({ status: 'active', suspendedAt: null, suspensionReason: null, updatedAt: new Date() } as any)
      .where(eq(financialInstitutions.id, id))
      .returning();

    if (row) await this.logEvent(id, 'reinstated', actorId ?? 'system', {});
    return row ?? null;
  }

  // ── Licenses ────────────────────────────────────────────────────────────────

  async getLicenses(institutionId: string): Promise<License[]> {
    return this.db
      .select()
      .from(institutionLicenses)
      .where(eq(institutionLicenses.institutionId, institutionId));
  }

  async addLicense(data: Omit<NewLicense, 'id' | 'createdAt' | 'updatedAt'>): Promise<License> {
    const id = uuidv4();
    const [row] = await this.db
      .insert(institutionLicenses)
      .values({ id, ...data } as NewLicense)
      .returning();

    await this.logEvent(data.institutionId, 'license_added', 'system', {
      country: data.countryCode,
      type:    data.licenseType,
      number:  data.licenseNumber,
    });
    return row!;
  }

  async revokeLicense(licenseId: string, reason: string, actorId?: string): Promise<License | null> {
    const [row] = await this.db
      .update(institutionLicenses)
      .set({ status: 'revoked', revokedAt: new Date(), revocationNote: reason, updatedAt: new Date() } as any)
      .where(eq(institutionLicenses.id, licenseId))
      .returning();

    if (row) {
      await this.logEvent(row.institutionId, 'license_revoked', actorId ?? 'system', { licenseId, reason });
    }
    return row ?? null;
  }

  // ── Routing Prefixes ─────────────────────────────────────────────────────────

  async getRoutingPrefixes(institutionId: string): Promise<RoutingPrefix[]> {
    return this.db
      .select()
      .from(institutionRoutingPrefixes)
      .where(eq(institutionRoutingPrefixes.institutionId, institutionId));
  }

  async resolveByPrefix(prefix: string, countryCode: string): Promise<{
    institution: Institution;
    prefixRecord: RoutingPrefix;
  } | null> {
    // Exact match first, then prefix-of match (for NUBAN codes)
    const [prefixRecord] = await this.db
      .select()
      .from(institutionRoutingPrefixes)
      .where(
        and(
          eq(institutionRoutingPrefixes.prefix, prefix),
          eq(institutionRoutingPrefixes.countryCode, countryCode),
          eq(institutionRoutingPrefixes.isActive, true),
        ),
      )
      .limit(1);

    if (!prefixRecord) return null;

    const institution = await this.findById(prefixRecord.institutionId);
    if (!institution) return null;

    return { institution, prefixRecord };
  }

  async addRoutingPrefix(data: Omit<NewRoutingPrefix, 'id' | 'createdAt'>): Promise<RoutingPrefix> {
    const id = uuidv4();
    const [row] = await this.db
      .insert(institutionRoutingPrefixes)
      .values({ id, ...data } as NewRoutingPrefix)
      .returning();

    await this.logEvent(data.institutionId, 'routing_prefix_added', 'system', {
      scheme: data.scheme,
      prefix: data.prefix,
    });
    return row!;
  }

  // ── Settlement Accounts ──────────────────────────────────────────────────────

  async getSettlementAccounts(institutionId: string, env = 'production'): Promise<SettlementAccount[]> {
    return this.db
      .select()
      .from(institutionSettlementAccounts)
      .where(
        and(
          eq(institutionSettlementAccounts.institutionId, institutionId),
          eq(institutionSettlementAccounts.isActive, true),
          eq(institutionSettlementAccounts.environment, env),
        ),
      );
  }

  async getPrimarySettlementAccount(
    institutionId: string,
    currency = 'NGN',
    env = 'production',
  ): Promise<SettlementAccount | null> {
    const [row] = await this.db
      .select()
      .from(institutionSettlementAccounts)
      .where(
        and(
          eq(institutionSettlementAccounts.institutionId, institutionId),
          eq(institutionSettlementAccounts.currency, currency),
          eq(institutionSettlementAccounts.isPrimary, true),
          eq(institutionSettlementAccounts.isActive, true),
          eq(institutionSettlementAccounts.environment, env),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async addSettlementAccount(data: Omit<NewSettlementAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<SettlementAccount> {
    const id = uuidv4();
    const [row] = await this.db
      .insert(institutionSettlementAccounts)
      .values({ id, ...data } as NewSettlementAccount)
      .returning();
    return row!;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async logEvent(
    institutionId: string,
    eventType:     string,
    actorType:     string,
    payload:       Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(institutionEvents).values({
      id:            uuidv4(),
      institutionId,
      eventType,
      actorType,
      payload,
    }).catch((err) => logger.error({ err, institutionId, eventType }, 'Failed to log institution event'));
  }
}
