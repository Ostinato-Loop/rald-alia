// services/developer-service/src/repositories/developer.repository.ts
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import {
  getDb,
  developers,
  developerProjects,
  developerApiKeys,
  developerEvents,
} from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

type DeveloperRow = typeof developers.$inferSelect;
type ProjectRow   = typeof developerProjects.$inferSelect;
type ApiKeyRow    = typeof developerApiKeys.$inferSelect;

export class DeveloperRepository {
  private db = getDb();

  // ── Developers ────────────────────────────────────────────────────────────

  async insertDeveloper(data: typeof developers.$inferInsert): Promise<DeveloperRow> {
    const [row] = await this.db.insert(developers).values(data).returning();
    return row!;
  }

  async findDeveloperById(id: string): Promise<DeveloperRow | null> {
    const [row] = await this.db.select().from(developers).where(eq(developers.id, id)).limit(1);
    return row ?? null;
  }

  async findDeveloperByEmail(email: string): Promise<DeveloperRow | null> {
    const [row] = await this.db.select().from(developers).where(eq(developers.email, email)).limit(1);
    return row ?? null;
  }

  async listDevelopers(opts: {
    status?:  string;
    country?: string;
    search?:  string;
    page:     number;
    limit:    number;
  }): Promise<{ data: DeveloperRow[]; total: number }> {
    const conditions: any[] = [];
    if (opts.status)  conditions.push(eq(developers.status, opts.status as any));
    if (opts.country) conditions.push(eq(developers.country, opts.country));
    if (opts.search)  conditions.push(or(ilike(developers.name, `%${opts.search}%`), ilike(developers.email, `%${opts.search}%`)));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, all] = await Promise.all([
      this.db.select().from(developers).where(where).orderBy(desc(developers.createdAt)).limit(opts.limit).offset((opts.page - 1) * opts.limit),
      this.db.select({ id: developers.id }).from(developers).where(where),
    ]);
    return { data: rows, total: all.length };
  }

  async updateDeveloper(id: string, data: Partial<typeof developers.$inferInsert>): Promise<DeveloperRow | null> {
    const [row] = await this.db.update(developers).set({ ...data, updatedAt: new Date() }).where(eq(developers.id, id)).returning();
    return row ?? null;
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async insertProject(data: typeof developerProjects.$inferInsert): Promise<ProjectRow> {
    const [row] = await this.db.insert(developerProjects).values(data).returning();
    return row!;
  }

  async findProjectById(id: string): Promise<ProjectRow | null> {
    const [row] = await this.db.select().from(developerProjects).where(eq(developerProjects.id, id)).limit(1);
    return row ?? null;
  }

  async listProjectsByDeveloper(developerId: string): Promise<ProjectRow[]> {
    return this.db
      .select()
      .from(developerProjects)
      .where(and(eq(developerProjects.developerId, developerId), eq(developerProjects.status, 'active')))
      .orderBy(desc(developerProjects.createdAt));
  }

  async updateProject(id: string, data: Partial<typeof developerProjects.$inferInsert>): Promise<ProjectRow | null> {
    const [row] = await this.db.update(developerProjects).set({ ...data, updatedAt: new Date() }).where(eq(developerProjects.id, id)).returning();
    return row ?? null;
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  async insertApiKey(data: typeof developerApiKeys.$inferInsert): Promise<ApiKeyRow> {
    const [row] = await this.db.insert(developerApiKeys).values(data).returning();
    return row!;
  }

  async findApiKeyByHash(keyHash: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(developerApiKeys)
      .where(and(eq(developerApiKeys.keyHash, keyHash), eq(developerApiKeys.status, 'active')))
      .limit(1);
    return row ?? null;
  }

  async findApiKeyById(id: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db.select().from(developerApiKeys).where(eq(developerApiKeys.id, id)).limit(1);
    return row ?? null;
  }

  async listApiKeysByProject(projectId: string): Promise<ApiKeyRow[]> {
    return this.db
      .select()
      .from(developerApiKeys)
      .where(and(eq(developerApiKeys.projectId, projectId), eq(developerApiKeys.status, 'active')))
      .orderBy(desc(developerApiKeys.createdAt));
  }

  async updateApiKey(id: string, data: Partial<typeof developerApiKeys.$inferInsert>): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .update(developerApiKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(developerApiKeys.id, id))
      .returning();
    return row ?? null;
  }

  async revokeApiKey(id: string, revokedBy: string): Promise<void> {
    await this.db
      .update(developerApiKeys)
      .set({ status: 'revoked', revokedAt: new Date(), revokedBy, updatedAt: new Date() })
      .where(eq(developerApiKeys.id, id));
  }

  async touchApiKey(id: string): Promise<void> {
    await this.db.update(developerApiKeys).set({ lastUsedAt: new Date() }).where(eq(developerApiKeys.id, id));
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async appendEvent(data: Omit<typeof developerEvents.$inferInsert, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(developerEvents).values({ id: uuidv4(), ...data });
  }

  async listEvents(developerId: string, limit = 50): Promise<typeof developerEvents.$inferSelect[]> {
    return this.db
      .select()
      .from(developerEvents)
      .where(eq(developerEvents.developerId, developerId))
      .orderBy(desc(developerEvents.createdAt))
      .limit(limit);
  }
}
