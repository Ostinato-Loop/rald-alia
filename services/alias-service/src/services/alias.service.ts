import { eq, and, isNull, desc } from 'drizzle-orm';
import { getDb, aliases } from '@rald-alia/db';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import { generateId, normalizeAlias, AliasDuplicateError, AliasNotFoundError } from '@rald-alia/shared';

export class AliasService {
  private db = getDb();

  async createAlias(data: {
    userId?: string;
    organizationId?: string;
    type: 'email' | 'phone' | 'username' | 'business_handle';
    value: string;
    bankCode: string;
    accountToken: string;
    accountName: string;
    isPrimary?: boolean;
  }) {
    const normalizedValue = normalizeAlias(data.type, data.value);

    const existing = await this.db
      .select()
      .from(aliases)
      .where(and(eq(aliases.normalizedValue, normalizedValue), isNull(aliases.deletedAt)))
      .limit(1);

    if (existing.length > 0) throw new AliasDuplicateError(data.value);

    const id = generateId('ali');
    const [alias] = await this.db
      .insert(aliases)
      .values({ id, ...data, normalizedValue, status: 'active' })
      .returning();

    await publishEvent(KAFKA_TOPICS.ALIAS_CREATED, {
      eventType: KAFKA_TOPICS.ALIAS_CREATED,
      payload: {
        aliasId: id,
        userId: data.userId ?? data.organizationId ?? '',
        type: data.type,
        value: normalizedValue,
        bankCode: data.bankCode,
      },
    });

    return alias;
  }

  async listAliases(opts: { page: number; limit: number; userId?: string }) {
    const conditions = [isNull(aliases.deletedAt)];
    if (opts.userId) conditions.push(eq(aliases.userId, opts.userId));

    const rows = await this.db
      .select()
      .from(aliases)
      .where(and(...conditions))
      .orderBy(desc(aliases.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);

    return { data: rows, pagination: { page: opts.page, limit: opts.limit } };
  }

  async getAliasById(id: string) {
    const [alias] = await this.db.select().from(aliases).where(eq(aliases.id, id)).limit(1);
    if (!alias) throw new AliasNotFoundError(id);
    return alias;
  }

  async updateAlias(id: string, data: Partial<{ bankCode: string; accountToken: string; accountName: string; isPrimary: boolean }>) {
    const [alias] = await this.db
      .update(aliases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aliases.id, id))
      .returning();

    if (!alias) throw new AliasNotFoundError(id);

    await publishEvent(KAFKA_TOPICS.ALIAS_UPDATED, {
      eventType: KAFKA_TOPICS.ALIAS_UPDATED,
      payload: { aliasId: id, userId: alias.userId ?? '', changes: data },
    });

    return alias;
  }

  async deleteAlias(id: string) {
    const [alias] = await this.db
      .update(aliases)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(aliases.id, id))
      .returning();

    if (!alias) throw new AliasNotFoundError(id);

    await publishEvent(KAFKA_TOPICS.ALIAS_DELETED, {
      eventType: KAFKA_TOPICS.ALIAS_DELETED,
      payload: { aliasId: id, userId: alias.userId ?? '', value: alias.normalizedValue },
    });
  }
}
