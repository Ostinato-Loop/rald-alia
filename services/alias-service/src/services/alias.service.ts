// services/alias-service/src/services/alias.service.ts
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getDb, aliases } from '@rald-alia/db';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import {
  generateId,
  normalizeAlias,
  AliasDuplicateError,
  AliasNotFoundError,
  ComplianceGateError,
  ComplianceGateUnavailableError,
} from '@rald-alia/shared';

// ── Governance compliance gate ────────────────────────────────────────────────
// Calls governance-service POST /v1/governance/compliance/alias-gate before
// every alias creation.
//
// Configuration:
//   GOVERNANCE_SERVICE_URL — base URL of the governance-service.
//                            If unset, the gate is SKIPPED with a warning.
//                            In production (ECS) this must always be set.
//
// Behaviour:
//   HTTP 200          → allowed, proceed with creation
//   HTTP 422          → ComplianceGateError thrown (violations forwarded to caller)
//   Timeout / network → ComplianceGateUnavailableError (fails CLOSED — no creation)
//   Other 4xx/5xx     → ComplianceGateUnavailableError (fails CLOSED)

async function checkComplianceGate(params: {
  userId:     string;
  country:    string;
  aliasType:  string;
  isVerified: boolean;
}): Promise<void> {
  const baseUrl = process.env['GOVERNANCE_SERVICE_URL'];
  if (!baseUrl) {
    // Only acceptable in local dev — governance-service may not be running.
    // Production deployments MUST set GOVERNANCE_SERVICE_URL.
    console.warn(
      '[alias-service] GOVERNANCE_SERVICE_URL not configured — compliance gate skipped. ' +
      'Set this env var in production.',
    );
    return;
  }

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/v1/governance/compliance/alias-gate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_id:     params.userId,
        country:     params.country,
        alias_type:  params.aliasType,
        is_verified: params.isVerified,
      }),
      signal: AbortSignal.timeout(5_000), // 5 s hard cap — governance must respond quickly
    });
  } catch (err: unknown) {
    // Network error or timeout — fail CLOSED
    const detail = err instanceof Error ? err.message : String(err);
    throw new ComplianceGateUnavailableError(detail);
  }

  if (resp.status === 422) {
    const body = await resp.json() as { data?: { violations?: string[] } };
    throw new ComplianceGateError(
      body.data?.violations?.length
        ? body.data.violations
        : ['Compliance gate rejected alias creation'],
    );
  }

  if (!resp.ok) {
    throw new ComplianceGateUnavailableError(`HTTP ${resp.status} from governance-service`);
  }
}

// ── AliasService ──────────────────────────────────────────────────────────────

export class AliasService {
  private db = getDb();

  async createAlias(data: {
    userId?:        string;
    organizationId?: string;
    type:           'email' | 'phone' | 'username' | 'business_handle';
    value:          string;
    countryCode:    string;   // ISO 3166-1 alpha-2 — required for compliance gate + retention
    bankCode:       string;
    accountToken:   string;
    accountName:    string;
    isPrimary?:     boolean;
    isVerified?:    boolean;  // KYC status — forwarded to compliance gate
  }) {
    const normalizedValue = normalizeAlias(data.type, data.value);
    const actorId         = data.userId ?? data.organizationId ?? '';

    // ── 1. Compliance gate — must pass before any DB write ─────────────────
    await checkComplianceGate({
      userId:     actorId,
      country:    data.countryCode,
      aliasType:  data.type,
      isVerified: data.isVerified ?? false,
    });

    // ── 2. Duplicate check ─────────────────────────────────────────────────
    const existing = await this.db
      .select()
      .from(aliases)
      .where(and(eq(aliases.normalizedValue, normalizedValue), isNull(aliases.deletedAt)))
      .limit(1);

    if (existing.length > 0) throw new AliasDuplicateError(data.value);

    // ── 3. Insert ──────────────────────────────────────────────────────────
    const id = generateId('ali');
    const { isVerified: _iv, ...insertData } = data; // isVerified is not a DB column
    const [alias] = await this.db
      .insert(aliases)
      .values({ id, ...insertData, normalizedValue, status: 'active' })
      .returning();

    // ── 4. Publish ALIAS_CREATED ───────────────────────────────────────────
    await publishEvent(KAFKA_TOPICS.ALIAS_CREATED, {
      eventType: KAFKA_TOPICS.ALIAS_CREATED,
      payload: {
        aliasId:  id,
        userId:   actorId,
        type:     data.type,
        value:    normalizedValue,
        bankCode: data.bankCode,
        countryCode: data.countryCode,
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

  async updateAlias(
    id:   string,
    data: Partial<{ bankCode: string; accountToken: string; accountName: string; isPrimary: boolean }>,
  ) {
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
