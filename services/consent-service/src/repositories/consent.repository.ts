import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb, consents, consentAuditTrail, mandates } from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

type ConsentRow = typeof consents.$inferSelect;
type MandateRow = typeof mandates.$inferSelect;
type AuditRow   = typeof consentAuditTrail.$inferSelect;

export class ConsentRepository {
  private db = getDb();

  // ── Consents ──────────────────────────────────────────────────────────────

  async insertConsent(data: typeof consents.$inferInsert): Promise<ConsentRow> {
    const [row] = await this.db.insert(consents).values(data).returning();
    return row!;
  }

  async findConsentById(id: string): Promise<ConsentRow | null> {
    const [row] = await this.db.select().from(consents).where(eq(consents.id, id)).limit(1);
    return row ?? null;
  }

  async findActiveConsent(subjectId: string, granteeId: string, scope: string[]): Promise<ConsentRow | null> {
    const rows = await this.db
      .select()
      .from(consents)
      .where(and(eq(consents.subjectId, subjectId), eq(consents.granteeId, granteeId), eq(consents.status, 'active')));
    const sortedScope = JSON.stringify([...scope].sort());
    return rows.find((r) => JSON.stringify([...(r.scope as string[])].sort()) === sortedScope) ?? null;
  }

  async listConsents(opts: {
    subjectId?: string;
    granteeId?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<ConsentRow[]> {
    const conditions = [];
    if (opts.subjectId) conditions.push(eq(consents.subjectId, opts.subjectId));
    if (opts.granteeId) conditions.push(eq(consents.granteeId, opts.granteeId));
    if (opts.status)    conditions.push(eq(consents.status, opts.status));

    return this.db
      .select()
      .from(consents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(consents.grantedAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);
  }

  async updateConsent(id: string, data: Partial<typeof consents.$inferInsert>): Promise<ConsentRow | null> {
    const [row] = await this.db.update(consents).set(data).where(eq(consents.id, id)).returning();
    return row ?? null;
  }

  async expireConsents(): Promise<void> {
    await this.db
      .update(consents)
      .set({ status: 'expired' })
      .where(and(eq(consents.status, 'active')));
    // Note: full expiry uses a raw SQL condition; for now the service layer checks expiresAt
  }

  // ── Audit Trail ───────────────────────────────────────────────────────────

  async insertAuditEntry(data: {
    consentId: string;
    event: string;
    actorId?: string;
    metadata: Record<string, unknown>;
  }): Promise<AuditRow> {
    const [row] = await this.db
      .insert(consentAuditTrail)
      .values({ id: uuidv4(), ...data })
      .returning();
    return row!;
  }

  async getAuditTrail(consentId: string): Promise<AuditRow[]> {
    return this.db
      .select()
      .from(consentAuditTrail)
      .where(eq(consentAuditTrail.consentId, consentId))
      .orderBy(desc(consentAuditTrail.createdAt));
  }

  // ── Mandates ──────────────────────────────────────────────────────────────

  async insertMandate(data: typeof mandates.$inferInsert): Promise<MandateRow> {
    const [row] = await this.db.insert(mandates).values(data).returning();
    return row!;
  }

  async findMandateById(id: string): Promise<MandateRow | null> {
    const [row] = await this.db.select().from(mandates).where(eq(mandates.id, id)).limit(1);
    return row ?? null;
  }

  async listMandates(opts: {
    subjectId?: string;
    merchantId?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<MandateRow[]> {
    const conditions = [];
    if (opts.subjectId)  conditions.push(eq(mandates.subjectId, opts.subjectId));
    if (opts.merchantId) conditions.push(eq(mandates.merchantId, opts.merchantId));
    if (opts.status)     conditions.push(eq(mandates.status, opts.status));

    return this.db
      .select()
      .from(mandates)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(mandates.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);
  }

  async updateMandate(id: string, data: Partial<typeof mandates.$inferInsert>): Promise<MandateRow | null> {
    const [row] = await this.db
      .update(mandates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mandates.id, id))
      .returning();
    return row ?? null;
  }
}
