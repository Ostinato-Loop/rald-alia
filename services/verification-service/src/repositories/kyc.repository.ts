import { eq, and, desc } from 'drizzle-orm';
import { getDb, kycSessions } from '@rald-alia/db';

type KycSessionRow = typeof kycSessions.$inferSelect;

export class KycRepository {
  private db = getDb();

  async insert(data: typeof kycSessions.$inferInsert): Promise<KycSessionRow> {
    const [row] = await this.db.insert(kycSessions).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<KycSessionRow | null> {
    const [row] = await this.db
      .select()
      .from(kycSessions)
      .where(eq(kycSessions.id, id))
      .limit(1);
    return row ?? null;
  }

  async findLatestByEntity(entityId: string, entityType: string): Promise<KycSessionRow | null> {
    const [row] = await this.db
      .select()
      .from(kycSessions)
      .where(and(eq(kycSessions.entityId, entityId), eq(kycSessions.entityType, entityType)))
      .orderBy(desc(kycSessions.createdAt))
      .limit(1);
    return row ?? null;
  }

  async listByEntity(entityId: string, entityType: string): Promise<KycSessionRow[]> {
    return this.db
      .select()
      .from(kycSessions)
      .where(and(eq(kycSessions.entityId, entityId), eq(kycSessions.entityType, entityType)))
      .orderBy(desc(kycSessions.createdAt));
  }

  async update(id: string, data: Partial<typeof kycSessions.$inferInsert>): Promise<KycSessionRow | null> {
    const [row] = await this.db
      .update(kycSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kycSessions.id, id))
      .returning();
    return row ?? null;
  }
}
