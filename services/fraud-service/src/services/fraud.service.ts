import { eq, desc } from 'drizzle-orm';
import { getDb, fraudEvents } from '@rald-alia/db';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import { generateId } from '@rald-alia/shared';
import Redis from 'ioredis';

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
const VELOCITY_WINDOW = 60; // 1 minute

export class FraudService {
  private db = getDb();

  async scoreEntity(
    entityId: string,
    entityType: 'alias' | 'user' | 'organization',
    context?: Record<string, unknown>,
  ) {
    const flags: string[] = [];
    let score = 0;

    const velocityKey = `fraud:velocity:${entityId}`;
    const requestCount = await redis.incr(velocityKey);
    await redis.expire(velocityKey, VELOCITY_WINDOW);

    if (requestCount > 50) { flags.push('HIGH_VELOCITY'); score += 40; }
    else if (requestCount > 20) { flags.push('ELEVATED_VELOCITY'); score += 15; }

    if (context?.['newDevice']) { flags.push('NEW_DEVICE'); score += 10; }
    if (context?.['unusualHour']) { flags.push('UNUSUAL_HOUR'); score += 5; }
    if (context?.['foreignIp']) { flags.push('FOREIGN_IP'); score += 20; }

    const riskLevel = score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
    const recommendation = score >= 70 ? 'block' : score >= 40 ? 'review' : 'allow';

    if (score >= 40) {
      const id = generateId('frd');
      await this.db.insert(fraudEvents).values({
        id,
        entityId,
        entityType,
        riskScore: score,
        riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
        flags,
        action: recommendation,
        metadata: context ?? {},
      });

      if (recommendation === 'block') {
        await publishEvent(KAFKA_TOPICS.FRAUD_DETECTED, {
          eventType: KAFKA_TOPICS.FRAUD_DETECTED,
          payload: { fraudId: id, entityId, entityType, riskScore: score, riskLevel, flags, action: recommendation },
        });
      }
    }

    return { score, riskLevel, flags, recommendation };
  }

  async listEvents(opts: { page: number; limit: number }) {
    const rows = await this.db
      .select()
      .from(fraudEvents)
      .orderBy(desc(fraudEvents.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);

    return { data: rows, pagination: { page: opts.page, limit: opts.limit } };
  }

  async resolveEvent(id: string, resolvedBy: string) {
    await this.db
      .update(fraudEvents)
      .set({ resolvedAt: new Date(), resolvedBy })
      .where(eq(fraudEvents.id, id));
  }
}
