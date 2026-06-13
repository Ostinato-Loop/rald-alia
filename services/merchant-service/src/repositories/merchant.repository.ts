import { eq, and, desc } from 'drizzle-orm';
import { getDb, merchants } from '@rald-alia/db';

type MerchantRow = typeof merchants.$inferSelect;

export class MerchantRepository {
  private db = getDb();

  async insert(data: typeof merchants.$inferInsert): Promise<MerchantRow> {
    const [row] = await this.db.insert(merchants).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<MerchantRow | null> {
    const [row] = await this.db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
    return row ?? null;
  }

  async findByHandle(handle: string): Promise<MerchantRow | null> {
    const [row] = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.handle, handle))
      .limit(1);
    return row ?? null;
  }

  async handleExists(handle: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.handle, handle))
      .limit(1);
    return !!row;
  }

  async list(opts: {
    ownerId?:  string;
    category?: string;
    country?:  string;
    status?:   string;
    verified?: boolean;
    page:      number;
    limit:     number;
  }): Promise<{ data: MerchantRow[]; total: number }> {
    const conditions = [];
    if (opts.ownerId)             conditions.push(eq(merchants.ownerId, opts.ownerId));
    if (opts.category)            conditions.push(eq(merchants.category, opts.category));
    if (opts.country)             conditions.push(eq(merchants.country, opts.country));
    if (opts.status)              conditions.push(eq(merchants.status, opts.status));
    if (opts.verified !== undefined) conditions.push(eq(merchants.verified, opts.verified));

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(merchants)
      .where(where)
      .orderBy(desc(merchants.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);

    // Total count (simple approach — production would use COUNT(*))
    const all = await this.db.select({ id: merchants.id }).from(merchants).where(where);
    return { data: rows, total: all.length };
  }

  async update(id: string, data: Partial<typeof merchants.$inferInsert>): Promise<MerchantRow | null> {
    const [row] = await this.db
      .update(merchants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(merchants.id, id))
      .returning();
    return row ?? null;
  }
}
