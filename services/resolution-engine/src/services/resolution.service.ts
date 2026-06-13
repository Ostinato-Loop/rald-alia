import { eq, and, isNull } from 'drizzle-orm';
import { getDb, aliases, bankLinks } from '@rald-alia/db';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import { generateId, normalizeAlias, ResolutionFailedError, getBankName } from '@rald-alia/shared';
import { signRoutingToken, verifyRoutingToken, type RoutingTokenClaims } from '@rald-alia/shared/routingToken';
import Redis from 'ioredis';

const CACHE_TTL_SECONDS = 60;

// Redis client — fail hard if REDIS_URL not set
const REDIS_URL = process.env['REDIS_URL'];
if (!REDIS_URL) {
  console.error('[resolution-engine] FATAL: REDIS_URL is not set');
  process.exit(1);
}
const redis = new Redis(REDIS_URL);

// Cached resolution — stores ONLY routing metadata (no account_token)
type CachedResolution = {
  destinationBankCode: string;
  destinationBankName: string;
  accountName:         string;
  resolvedAt:          string;
};

// account_token never leaves this service.
// It is stored in Redis keyed by resolution_id (60s TTL).
// The /verify endpoint retrieves it and returns it ONLY to verified institutions.
const ACCOUNT_TOKEN_PREFIX = 'acct_token:';

export class ResolutionService {
  private db = getDb();

  async resolve(data: {
    alias:          string;
    initiatingBank: string;
    transactionRef: string;
    ipAddress?:     string;
  }): Promise<{
    routing_token:  string;            // signed JWT — caller presents this to /verify
    routing:        CachedResolution;  // public routing metadata (no credentials)
    resolution_id:  string;
    resolved_at:    string;
    from_cache:     boolean;
  }> {
    const resolutionId = generateId('res');
    const type         = this.detectType(data.alias);
    const normalized   = normalizeAlias(type, data.alias);
    const cacheKey     = `resolve:${normalized}`;

    // Publish intent (async, non-blocking)
    publishEvent(KAFKA_TOPICS.RESOLUTION_REQUESTED, {
      eventType: KAFKA_TOPICS.RESOLUTION_REQUESTED,
      payload: {
        resolutionId,
        alias:              normalized,
        aliasType:          type,
        initiatingBankCode: data.initiatingBank,
        transactionRef:     data.transactionRef,
        ipAddress:          data.ipAddress,
      },
    }).catch(() => {});

    let routing: CachedResolution;
    let accountToken: string;
    let fromCache = false;

    // ── Cache path ────────────────────────────────────────────────────────────
    const cachedRouting = await redis.get(cacheKey);
    if (cachedRouting) {
      routing   = JSON.parse(cachedRouting) as CachedResolution;
      fromCache = true;
      // account_token is never cached — always fetched fresh on cache hit
      accountToken = await this.fetchAccountToken(normalized);
    } else {
      // ── DB path ─────────────────────────────────────────────────────────────
      const [entry] = await this.db
        .select()
        .from(aliases)
        .where(
          and(
            eq(aliases.normalizedValue, normalized),
            eq(aliases.status, 'active'),
            isNull(aliases.deletedAt),
          ),
        )
        .limit(1);

      if (!entry) throw new ResolutionFailedError(data.alias);

      accountToken = entry.accountToken;

      let destinationBankName = getBankName(entry.bankCode);
      const [bankLink] = await this.db
        .select({ bankName: bankLinks.bankName })
        .from(bankLinks)
        .where(and(eq(bankLinks.accountToken, entry.accountToken), eq(bankLinks.isActive, true)))
        .limit(1);
      if (bankLink?.bankName) destinationBankName = bankLink.bankName;

      routing = {
        destinationBankCode: entry.bankCode,
        destinationBankName,
        accountName:         entry.accountName,
        resolvedAt:          new Date().toISOString(),
      };

      // Cache only public routing metadata — never the accountToken
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(routing));
    }

    // Store accountToken separately, keyed by resolutionId (60s TTL = same as routing JWT)
    await redis.setex(`${ACCOUNT_TOKEN_PREFIX}${resolutionId}`, CACHE_TTL_SECONDS, accountToken);

    // Issue routing JWT — safe to return to caller
    const routingJwt = signRoutingToken({
      resolution_id:         resolutionId,
      transaction_ref:       data.transactionRef,
      destination_bank_code: routing.destinationBankCode,
      destination_bank_name: routing.destinationBankName,
      account_name:          routing.accountName,
      initiating_bank:       data.initiatingBank,
      resolution_cache_key:  cacheKey,
      resolved_at:           routing.resolvedAt,
    });

    publishEvent(KAFKA_TOPICS.RESOLUTION_COMPLETED, {
      eventType: KAFKA_TOPICS.RESOLUTION_COMPLETED,
      payload: {
        resolutionId,
        alias:               normalized,
        destinationBankCode: routing.destinationBankCode,
        success:             true,
        fromCache,
      },
    }).catch(() => {});

    return {
      routing_token: routingJwt,
      routing,
      resolution_id: resolutionId,
      resolved_at:   routing.resolvedAt,
      from_cache:    fromCache,
    };
  }

  // Called by /verify — institution presents routing_token, gets accountToken
  async verify(routingToken: string): Promise<{
    claims:        RoutingTokenClaims;
    account_token: string;
  }> {
    // Will throw with ROUTING_TOKEN_EXPIRED or ROUTING_TOKEN_INVALID if invalid
    const claims = verifyRoutingToken(routingToken);

    const accountToken = await redis.get(`${ACCOUNT_TOKEN_PREFIX}${claims.resolution_id}`);
    if (!accountToken) {
      throw Object.assign(
        new Error('Routing token has expired or was already consumed. Re-resolve the alias.'),
        { status: 410, code: 'ROUTING_TOKEN_CONSUMED' },
      );
    }

    // Single-use: delete after successful verify
    await redis.del(`${ACCOUNT_TOKEN_PREFIX}${claims.resolution_id}`);

    return { claims, account_token: accountToken };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async fetchAccountToken(normalized: string): Promise<string> {
    const [entry] = await this.db
      .select({ accountToken: aliases.accountToken })
      .from(aliases)
      .where(and(eq(aliases.normalizedValue, normalized), eq(aliases.status, 'active'), isNull(aliases.deletedAt)))
      .limit(1);
    if (!entry) throw new ResolutionFailedError(normalized);
    return entry.accountToken;
  }

  private detectType(alias: string): 'email' | 'phone' | 'username' | 'business_handle' {
    if (alias.includes('@') && alias.includes('.')) return 'email';
    if (/^[0-9+]+$/.test(alias))                    return 'phone';
    if (alias.startsWith('@'))                        return 'username';
    return 'username';
  }
}
