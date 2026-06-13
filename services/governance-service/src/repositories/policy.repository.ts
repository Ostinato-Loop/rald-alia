import { eq, and, desc } from 'drizzle-orm';
import { getDb, policies } from '@rald-alia/db';

type PolicyRow = typeof policies.$inferSelect;

export class PolicyRepository {
  private db = getDb();

  async insert(data: typeof policies.$inferInsert): Promise<PolicyRow> {
    const [row] = await this.db.insert(policies).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<PolicyRow | null> {
    const [row] = await this.db.select().from(policies).where(eq(policies.id, id)).limit(1);
    return row ?? null;
  }

  async list(opts: {
    scope?:   string;
    country?: string;
    service?: string;
    active?:  boolean;
    page:     number;
    limit:    number;
  }): Promise<{ data: PolicyRow[]; total: number }> {
    const conditions = [];
    if (opts.scope)            conditions.push(eq(policies.scope, opts.scope));
    if (opts.country)          conditions.push(eq(policies.country, opts.country));
    if (opts.service)          conditions.push(eq(policies.service, opts.service));
    if (opts.active !== undefined) conditions.push(eq(policies.active, opts.active));

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(policies)
      .where(where)
      .orderBy(desc(policies.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);

    const all = await this.db.select({ id: policies.id }).from(policies).where(where);
    return { data: rows, total: all.length };
  }

  async listActive(opts: { country?: string; institutionId?: string; service?: string }): Promise<PolicyRow[]> {
    const conditions = [eq(policies.active, true)];
    if (opts.country)       conditions.push(eq(policies.country, opts.country));
    if (opts.institutionId) conditions.push(eq(policies.institutionId, opts.institutionId));
    if (opts.service)       conditions.push(eq(policies.service, opts.service));

    return this.db.select().from(policies).where(and(...conditions)).orderBy(desc(policies.createdAt));
  }

  async update(id: string, data: Partial<typeof policies.$inferInsert>): Promise<PolicyRow | null> {
    const [row] = await this.db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return row ?? null;
  }

  async deactivate(id: string): Promise<void> {
    await this.db
      .update(policies)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(policies.id, id));
  }
}
