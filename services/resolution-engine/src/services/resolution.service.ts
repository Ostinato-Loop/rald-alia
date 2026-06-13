import { eq, and, isNull } from 'drizzle-orm';
import { getDb, aliases, bankLinks, aliasResolutionLog } from '@rald-alia/db';
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

// Cached resolution — stores routing metadata (no account_token, which is never cached)
type CachedResolution = {
  aliasId:             string;   // aliases.id — needed for audit log on cache hits
  countryCode:         string;   // needed for audit log
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
    routing:        Omit<CachedResolution, 'aliasId' | 'countryCode'>; // public metadata only
    resolution_id:  string;
    resolved_at:    string;
    from_cache:     boolean;
  }> {
    const resolutionId = generateId('res');
    const startTime    = Date.now();
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

    let cachedResolution: CachedResolution;
    let accountToken: string;
    let fromCache = false;

    try {
      // ── Cache path ──────────────────────────────────────────────────────────
      const rawCached = await redis.get(cacheKey);
      if (rawCached) {
        cachedResolution = JSON.parse(rawCached) as CachedResolution;
        fromCache        = true;
        // account_token is never cached — always fetched fresh on cache hit
        accountToken = await this.fetchAccountToken(normalized);
      } else {
        // ── DB path ─────────────────────────────────────────────────────────
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

        if (!entry) {
          // Log the not-found outcome before throwing
          this.writeAuditLog({
            aliasId:         'unknown',
            requestId:       resolutionId,
            initiatorId:     data.initiatingBank,
            destinationBank: null,
            routingStrategy: 'primary',
            latencyMs:       Date.now() - startTime,
            status:          'not_found',
            failureReason:   `Alias not found: ${data.alias}`,
            countryCode:     null,
          });
          throw new ResolutionFailedError(data.alias);
        }

        accountToken = entry.accountToken;

        let destinationBankName = getBankName(entry.bankCode);
        const [bankLink] = await this.db
          .select({ bankName: bankLinks.bankName })
          .from(bankLinks)
          .where(and(eq(bankLinks.accountToken, entry.accountToken), eq(bankLinks.isActive, true)))
          .limit(1);
        if (bankLink?.bankName) destinationBankName = bankLink.bankName;

        cachedResolution = {
          aliasId:             entry.id,
          countryCode:         entry.countryCode,
          destinationBankCode: entry.bankCode,
          destinationBankName,
          accountName:         entry.accountName,
          resolvedAt:          new Date().toISOString(),
        };

        // Cache only routing metadata — never the accountToken, aliasId is safe
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(cachedResolution));
      }

      // Store accountToken separately, keyed by resolutionId (60s TTL = same as routing JWT)
      await redis.setex(
        `${ACCOUNT_TOKEN_PREFIX}${resolutionId}`,
        CACHE_TTL_SECONDS,
        accountToken,
      );

      // Issue routing JWT — safe to return to caller
      const routingJwt = signRoutingToken({
        resolution_id:         resolutionId,
        transaction_ref:       data.transactionRef,
        destination_bank_code: cachedResolution.destinationBankCode,
        destination_bank_name: cachedResolution.destinationBankName,
        account_name:          cachedResolution.accountName,
        initiating_bank:       data.initiatingBank,
        resolution_cache_key:  cacheKey,
        resolved_at:           cachedResolution.resolvedAt,
      });

      // ── Audit log + Kafka — fire and forget ──────────────────────────────────
      const latencyMs = Date.now() - startTime;

      this.writeAuditLog({
        aliasId:         cachedResolution.aliasId,
        requestId:       resolutionId,
        initiatorId:     data.initiatingBank,
        destinationBank: cachedResolution.destinationBankCode,
        routingStrategy: fromCache ? 'cache' : 'primary',
        latencyMs,
        status:          'completed',
        failureReason:   null,
        countryCode:     cachedResolution.countryCode,
      });

      publishEvent(KAFKA_TOPICS.RESOLUTION_COMPLETED, {
        eventType: KAFKA_TOPICS.RESOLUTION_COMPLETED,
        payload: {
          resolutionId,
          alias:               normalized,
          destinationBankCode: cachedResolution.destinationBankCode,
          latencyMs,
          success:             true,
          fromCache,
        },
      }).catch(() => {});

      const { aliasId: _a, countryCode: _c, ...publicRouting } = cachedResolution;
      return {
        routing_token: routingJwt,
        routing:       publicRouting,
        resolution_id: resolutionId,
        resolved_at:   cachedResolution.resolvedAt,
        from_cache:    fromCache,
      };

    } catch (err: any) {
      // Re-throw errors already handled (ResolutionFailedError already logged above)
      if (err?.code === 'ALIAS_NOT_FOUND' || err?.name === 'ResolutionFailedError') throw err;

      // Unexpected error — log and re-throw
      this.writeAuditLog({
        aliasId:         'unknown',
        requestId:       resolutionId,
        initiatorId:     data.initiatingBank,
        destinationBank: null,
        routingStrategy: 'primary',
        latencyMs:       Date.now() - startTime,
        status:          'error',
        failureReason:   err?.message ?? 'Internal error',
        countryCode:     null,
      });
      throw err;
    }
  }

  // Called by /verify — institution presents routing_token, gets accountToken
  async verify(routingToken: string): Promise<{
    claims:        RoutingTokenClaims;
    account_token: string;
  }> {
    // Will throw with ROUTING_TOKEN_EXPIRED or ROUTING_TOKEN_INVALID if invalid
    const claims = verifyRoutingToken(routingToken);

    const accountToken = await redis.get(
      `${ACCOUNT_TOKEN_PREFIX}${claims.resolution_id}`,
    );
    if (!accountToken) {
      throw Object.assign(
        new Error(
          'Routing token has expired or was already consumed. Re-resolve the alias.',
        ),
        { status: 410, code: 'ROUTING_TOKEN_CONSUMED' },
      );
    }

    // Single-use: delete after successful verify
    await redis.del(`${ACCOUNT_TOKEN_PREFIX}${claims.resolution_id}`);

    return { claims, account_token: accountToken };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchAccountToken(normalized: string): Promise<string> {
    const [entry] = await this.db
      .select({ accountToken: aliases.accountToken })
      .from(aliases)
      .where(
        and(
          eq(aliases.normalizedValue, normalized),
          eq(aliases.status, 'active'),
          isNull(aliases.deletedAt),
        ),
      )
      .limit(1);
    if (!entry) throw new ResolutionFailedError(normalized);
    return entry.accountToken;
  }

  /**
   * Write one row to alias_resolution_log.
   * Fire-and-forget — never throws; errors are logged to console only.
   * We do NOT store the accountToken here — that credential stays in Redis only.
   */
  private writeAuditLog(params: {
    aliasId:         string;
    requestId:       string;
    initiatorId:     string;
    destinationBank: string | null;
    routingStrategy: string;
    latencyMs:       number;
    status:          'completed' | 'not_found' | 'blocked' | 'error';
    failureReason:   string | null;
    countryCode:     string | null;
  }): void {
    this.db
      .insert(aliasResolutionLog)
      .values({
        id:              generateId('arl'),
        aliasId:         params.aliasId,
        requestId:       params.requestId,
        initiatorId:     params.initiatorId,
        initiatorType:   'institution',
        resolvedToken:   null,       // security: account_token never persisted to DB
        destinationBank: params.destinationBank ?? undefined,
        routingStrategy: params.routingStrategy,
        latencyMs:       params.latencyMs,
        fraudScore:      null,
        fraudAction:     null,
        status:          params.status,
        failureReason:   params.failureReason ?? undefined,
        countryCode:     params.countryCode ?? undefined,
      })
      .then(() => {})
      .catch((err: unknown) => {
        console.error('[resolution-engine] Failed to write audit log row:', err);
      });
  }

  private detectType(alias: string): 'email' | 'phone' | 'username' | 'business_handle' {
    if (alias.includes('@') && alias.includes('.')) return 'email';
    if (/^[0-9+]+$/.test(alias))                    return 'phone';
    if (alias.startsWith('@'))                        return 'username';
    return 'username';
  }
}
