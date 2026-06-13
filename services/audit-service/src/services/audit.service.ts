import { eq, and, desc } from 'drizzle-orm';
import { getDb, auditLogs } from '@rald-alia/db';
import { generateId } from '@rald-alia/shared';
import crypto from 'crypto';

export class AuditService {
  private db = getDb();

  async log(data: {
    eventType: string;
    actorId?: string;
    actorType?: string;
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const id = generateId('aud');
    const payload = JSON.stringify({
      id,
      eventType: data.eventType,
      actorId: data.actorId,
      targetId: data.targetId,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
    });

    const checksum = crypto.createHash('sha256').update(payload).digest('hex');

    const [entry] = await this.db
      .insert(auditLogs)
      .values({
        id,
        eventType: data.eventType,
        actorId: data.actorId,
        actorType: data.actorType,
        targetId: data.targetId,
        targetType: data.targetType,
        metadata: data.metadata ?? {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        checksum,
      })
      .returning();

    return entry;
  }

  async listLogs(opts: {
    page: number;
    limit: number;
    eventType?: string;
    actorId?: string;
  }) {
    const conditions = [];
    if (opts.eventType) conditions.push(eq(auditLogs.eventType, opts.eventType));
    if (opts.actorId) conditions.push(eq(auditLogs.actorId, opts.actorId));

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);

    return { data: rows, pagination: { page: opts.page, limit: opts.limit } };
  }

  async getLog(id: string) {
    const [log] = await this.db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
    return log ?? null;
  }
}
