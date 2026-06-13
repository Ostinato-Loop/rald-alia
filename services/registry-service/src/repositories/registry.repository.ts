import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb, registry, registryEvents } from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

type RegistryRow      = typeof registry.$inferSelect;
type RegistryEventRow = typeof registryEvents.$inferSelect;

export type Dimension =
  | 'identity'
  | 'verification'
  | 'trust'
  | 'consent'
  | 'routing'
  | 'compliance';

export class RegistryRepository {
  private db = getDb();

  // ── Read ──────────────────────────────────────────────────────────────────

  async findByRegistryId(registryId: string): Promise<RegistryRow | null> {
    const [row] = await this.db
      .select()
      .from(registry)
      .where(eq(registry.registryId, registryId))
      .limit(1);
    return row ?? null;
  }

  async findByEntityId(entityId: string, entityType: string): Promise<RegistryRow | null> {
    const [row] = await this.db
      .select()
      .from(registry)
      .where(and(eq(registry.entityId, entityId), eq(registry.entityType, entityType as any)))
      .limit(1);
    return row ?? null;
  }

  async list(opts: {
    entityType?:        string;
    countryCode?:       string;
    identityStatus?:    string;
    trustStatus?:       string;
    complianceStatus?:  string;
    page:               number;
    limit:              number;
  }): Promise<{ data: RegistryRow[]; total: number }> {
    const conditions: any[] = [];
    if (opts.entityType)       conditions.push(eq(registry.entityType, opts.entityType as any));
    if (opts.countryCode)      conditions.push(eq(registry.countryCode, opts.countryCode));
    if (opts.identityStatus)   conditions.push(eq(registry.identityStatus, opts.identityStatus));
    if (opts.trustStatus)      conditions.push(eq(registry.trustStatus, opts.trustStatus));
    if (opts.complianceStatus) conditions.push(eq(registry.complianceStatus, opts.complianceStatus));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(registry)
        .where(where)
        .orderBy(desc(registry.createdAt))
        .limit(opts.limit)
        .offset((opts.page - 1) * opts.limit),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(registry)
        .where(where),
    ]);

    return { data: rows, total: Number(countResult[0]?.count ?? 0) };
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async insert(data: typeof registry.$inferInsert): Promise<RegistryRow> {
    const [row] = await this.db.insert(registry).values(data).returning();
    return row!;
  }

  async upsert(data: typeof registry.$inferInsert): Promise<RegistryRow> {
    const [row] = await this.db
      .insert(registry)
      .values(data)
      .onConflictDoUpdate({
        target: [registry.entityType, registry.entityId],
        set: {
          displayName: data.displayName,
          metadata:    data.metadata,
          updatedAt:   new Date(),
        },
      })
      .returning();
    return row!;
  }

  async updateDimension(
    registryId: string,
    dimension:  Dimension,
    toStatus:   string,
    extra?:     Record<string, unknown>,
    actor?:     { actorId: string; actorType: string; reason?: string },
  ): Promise<RegistryRow | null> {
    const current = await this.findByRegistryId(registryId);
    if (!current) return null;

    const now = new Date();
    const dimensionStatusField     = `${dimension}Status`     as keyof typeof registry.$inferInsert;
    const dimensionStatusAtField   = `${dimension}StatusAt`   as keyof typeof registry.$inferInsert;

    const updatePayload: Partial<typeof registry.$inferInsert> = {
      [dimensionStatusField]:   toStatus,
      [dimensionStatusAtField]: now,
      updatedAt:                now,
    };

    // Handle lifecycle timestamps
    if (dimension === 'identity') {
      if (toStatus === 'active')   updatePayload.activatedAt  = now;
      if (toStatus === 'suspended') updatePayload.suspendedAt = now;
      if (toStatus === 'archived')  updatePayload.archivedAt  = now;
      if (toStatus === 'suspended' && extra?.reason) updatePayload.suspensionReason = extra.reason as string;
      if (toStatus === 'archived'  && extra?.reason) updatePayload.archiveReason    = extra.reason as string;
      if (actor?.actorId) updatePayload.identityStatusBy = actor.actorId;
    }

    if (dimension === 'trust' && extra?.trustScore !== undefined) {
      updatePayload.trustScore = extra.trustScore as number;
    }

    if (dimension === 'compliance' && extra?.flags) {
      updatePayload.complianceFlags = extra.flags;
    }

    if (dimension === 'verification' && extra?.tier !== undefined) {
      updatePayload.verificationTier = extra.tier as number;
    }

    const [updated] = await this.db
      .update(registry)
      .set(updatePayload)
      .where(eq(registry.registryId, registryId))
      .returning();

    // Append event
    const fromStatus = (current as any)[dimensionStatusField] as string;
    await this.db.insert(registryEvents).values({
      id:         uuidv4(),
      registryId,
      dimension,
      fromStatus,
      toStatus,
      actorId:    actor?.actorId ?? null,
      actorType:  actor?.actorType ?? 'system',
      reason:     actor?.reason ?? null,
      metadata:   extra ? (extra as any) : {},
    });

    return updated ?? null;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(registryId: string, dimension?: Dimension): Promise<RegistryEventRow[]> {
    const conditions = [eq(registryEvents.registryId, registryId)];
    if (dimension) conditions.push(eq(registryEvents.dimension, dimension));

    return this.db
      .select()
      .from(registryEvents)
      .where(and(...conditions))
      .orderBy(desc(registryEvents.createdAt))
      .limit(200);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        entityType: registry.entityType,
        count:      sql<number>`COUNT(*)`,
      })
      .from(registry)
      .groupBy(registry.entityType);

    return Object.fromEntries(rows.map((r) => [r.entityType, Number(r.count)]));
  }
}
