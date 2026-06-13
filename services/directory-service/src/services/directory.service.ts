import { eq, and, isNull, count } from 'drizzle-orm';
import { getDb, aliases } from '@rald-alia/db';
import { normalizeAlias, AliasNotFoundError, AliasSuspendedError } from '@rald-alia/shared';
import Redis from 'ioredis';

const CACHE_TTL = 300; // 5 minutes
const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

export class DirectoryService {
  private db = getDb();

  async lookup(rawAlias: string) {
    const cacheKey = `dir:lookup:${rawAlias.toLowerCase()}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const type = this.detectAliasType(rawAlias);
    const normalized = normalizeAlias(type, rawAlias);

    const [entry] = await this.db
      .select({
        aliasId: aliases.id,
        type: aliases.type,
        value: aliases.normalizedValue,
        status: aliases.status,
        bankCode: aliases.bankCode,
        accountToken: aliases.accountToken,
        accountName: aliases.accountName,
      })
      .from(aliases)
      .where(and(eq(aliases.normalizedValue, normalized), isNull(aliases.deletedAt)))
      .limit(1);

    if (!entry) throw new AliasNotFoundError(rawAlias);
    if (entry.status === 'suspended') throw new AliasSuspendedError(rawAlias);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(entry));
    return entry;
  }

  async lookupByToken(token: string) {
    const cacheKey = `dir:token:${token}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [entry] = await this.db
      .select()
      .from(aliases)
      .where(and(eq(aliases.accountToken, token), isNull(aliases.deletedAt)))
      .limit(1);

    if (!entry) throw new AliasNotFoundError(token);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(entry));
    return entry;
  }

  async getStats() {
    const [totalAliases] = await this.db.select({ count: count() }).from(aliases).where(isNull(aliases.deletedAt));
    const [activeAliases] = await this.db.select({ count: count() }).from(aliases).where(and(eq(aliases.status, 'active'), isNull(aliases.deletedAt)));
    return {
      total: totalAliases?.count ?? 0,
      active: activeAliases?.count ?? 0,
    };
  }

  private detectAliasType(alias: string): 'email' | 'phone' | 'username' | 'business_handle' {
    if (alias.includes('@') && alias.includes('.')) return 'email';
    if (/^[0-9+]+$/.test(alias)) return 'phone';
    if (alias.startsWith('@')) return 'username';
    return 'username';
  }
}
