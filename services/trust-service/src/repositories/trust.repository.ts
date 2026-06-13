import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDb, trustScores, trustSignals, trustHistory, reputationProfiles } from '@rald-alia/db';
import { v4 as uuidv4 } from 'uuid';

type TrustScoreRow     = typeof trustScores.$inferSelect;
type TrustSignalRow    = typeof trustSignals.$inferSelect;
type TrustHistoryRow   = typeof trustHistory.$inferSelect;
type ReputationRow     = typeof reputationProfiles.$inferSelect;

export class TrustRepository {
  private db = getDb();

  // ── Trust Scores ──────────────────────────────────────────────────────────

  async upsertTrustScore(data: typeof trustScores.$inferInsert): Promise<TrustScoreRow> {
    const [row] = await this.db
      .insert(trustScores)
      .values(data)
      .onConflictDoUpdate({
        target: [trustScores.entityId, trustScores.entityType],
        set: {
          overallScore:       data.overallScore,
          components:         data.components,
          tier:               data.tier,
          riskLevel:          data.riskLevel,
          fraudScore:         data.fraudScore,
          signalsCount:       data.signalsCount,
          lastRecalculatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  async findTrustScore(entityId: string, entityType: string): Promise<TrustScoreRow | null> {
    const [row] = await this.db
      .select()
      .from(trustScores)
      .where(and(eq(trustScores.entityId, entityId), eq(trustScores.entityType, entityType)))
      .limit(1);
    return row ?? null;
  }

  async findTrustScoresByIds(pairs: { entityId: string; entityType: string }[]): Promise<TrustScoreRow[]> {
    if (!pairs.length) return [];
    // Fetch all and filter in JS for simplicity (batch lookup)
    const ids = pairs.map((p) => p.entityId);
    return this.db.select().from(trustScores).where(
      and(
        // entity_id IN (...)
        // drizzle inArray usage:
        eq(trustScores.entityType, pairs[0]!.entityType),
      )
    );
  }

  // ── Trust Signals ─────────────────────────────────────────────────────────

  async insertSignal(data: {
    entityId:   string;
    entityType: string;
    signalType: string;
    value:      number;
    source:     string;
    metadata?:  Record<string, unknown>;
  }): Promise<TrustSignalRow> {
    const [row] = await this.db
      .insert(trustSignals)
      .values({ id: uuidv4(), ...data, value: String(data.value) })
      .returning();
    return row!;
  }

  async getSignals(entityId: string): Promise<TrustSignalRow[]> {
    return this.db
      .select()
      .from(trustSignals)
      .where(eq(trustSignals.entityId, entityId))
      .orderBy(desc(trustSignals.appliedAt));
  }

  // ── Trust History ─────────────────────────────────────────────────────────

  async insertHistoryEntry(data: {
    entityId:   string;
    entityType: string;
    score:      number;
    event:      string;
    delta:      number;
  }): Promise<TrustHistoryRow> {
    const [row] = await this.db
      .insert(trustHistory)
      .values({ id: uuidv4(), ...data })
      .returning();
    return row!;
  }

  async getHistory(entityId: string, from?: string, to?: string): Promise<TrustHistoryRow[]> {
    const conditions = [eq(trustHistory.entityId, entityId)];
    if (from) conditions.push(gte(trustHistory.recordedAt, new Date(from)));
    if (to)   conditions.push(lte(trustHistory.recordedAt, new Date(to)));

    return this.db
      .select()
      .from(trustHistory)
      .where(and(...conditions))
      .orderBy(desc(trustHistory.recordedAt))
      .limit(100);
  }

  // ── Reputation Profiles ───────────────────────────────────────────────────

  async upsertReputation(data: typeof reputationProfiles.$inferInsert): Promise<ReputationRow> {
    const [row] = await this.db
      .insert(reputationProfiles)
      .values(data)
      .onConflictDoUpdate({
        target: [reputationProfiles.entityId, reputationProfiles.entityType],
        set: {
          reputationScore:      data.reputationScore,
          flags:                data.flags,
          sanctionsMatch:       data.sanctionsMatch,
          pepMatch:             data.pepMatch,
          adverseMedia:         data.adverseMedia,
          participationHistory: data.participationHistory,
          updatedAt:            new Date(),
        },
      })
      .returning();
    return row!;
  }

  async findReputation(entityId: string, entityType: string): Promise<ReputationRow | null> {
    const [row] = await this.db
      .select()
      .from(reputationProfiles)
      .where(and(eq(reputationProfiles.entityId, entityId), eq(reputationProfiles.entityType, entityType)))
      .limit(1);
    return row ?? null;
  }
}
