import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { RegistryRepository, type Dimension } from '../repositories/registry.repository';

export type EntityType = 'person' | 'business' | 'merchant' | 'developer' | 'institution' | 'device' | 'service';

const TYPE_PREFIX: Record<EntityType, string> = {
  person:      'prs',
  business:    'biz',
  merchant:    'mrt',
  developer:   'dev',
  institution: 'ins',
  device:      'dvc',
  service:     'svc',
};

function generateRegistryId(entityType: EntityType): string {
  const prefix = TYPE_PREFIX[entityType];
  const uid = uuidv4().replace(/-/g, '').slice(0, 12);
  return `rald_${prefix}_${uid}`;
}

export interface RegistryRecord {
  registry_id:          string;
  entity_type:          EntityType;
  entity_id:            string;
  country_code:         string;
  display_name?:        string;
  avatar_url?:          string;

  identity_status:      string;
  identity_status_at:   string;

  verification_status:  string;
  verification_tier:    number;
  verification_status_at: string;

  trust_status:         string;
  trust_score?:         number;
  trust_status_at:      string;

  consent_status:       string;
  consent_status_at:    string;

  routing_status:       string;
  routing_status_at:    string;

  compliance_status:    string;
  compliance_flags:     string[];
  compliance_status_at: string;

  activated_at?:        string;
  suspended_at?:        string;
  archived_at?:         string;
  suspension_reason?:   string;
  archive_reason?:      string;

  created_at:           string;
  updated_at:           string;
}

export interface RegistryEvent {
  id:           string;
  registry_id:  string;
  dimension:    string;
  from_status?: string;
  to_status:    string;
  actor_id?:    string;
  actor_type?:  string;
  reason?:      string;
  created_at:   string;
}

function rowToRecord(row: Record<string, unknown>): RegistryRecord {
  return {
    registry_id:           row['registryId'] as string,
    entity_type:           row['entityType'] as EntityType,
    entity_id:             row['entityId'] as string,
    country_code:          row['countryCode'] as string,
    display_name:          row['displayName'] as string | undefined,
    avatar_url:            row['avatarUrl'] as string | undefined,
    identity_status:       row['identityStatus'] as string,
    identity_status_at:    (row['identityStatusAt'] as Date).toISOString(),
    verification_status:   row['verificationStatus'] as string,
    verification_tier:     row['verificationTier'] as number,
    verification_status_at:(row['verificationStatusAt'] as Date).toISOString(),
    trust_status:          row['trustStatus'] as string,
    trust_score:           row['trustScore'] as number | undefined,
    trust_status_at:       (row['trustStatusAt'] as Date).toISOString(),
    consent_status:        row['consentStatus'] as string,
    consent_status_at:     (row['consentStatusAt'] as Date).toISOString(),
    routing_status:        row['routingStatus'] as string,
    routing_status_at:     (row['routingStatusAt'] as Date).toISOString(),
    compliance_status:     row['complianceStatus'] as string,
    compliance_flags:      row['complianceFlags'] as string[],
    compliance_status_at:  (row['complianceStatusAt'] as Date).toISOString(),
    activated_at:          row['activatedAt'] ? (row['activatedAt'] as Date).toISOString() : undefined,
    suspended_at:          row['suspendedAt'] ? (row['suspendedAt'] as Date).toISOString() : undefined,
    archived_at:           row['archivedAt']  ? (row['archivedAt']  as Date).toISOString() : undefined,
    suspension_reason:     row['suspensionReason'] as string | undefined,
    archive_reason:        row['archiveReason'] as string | undefined,
    created_at:            (row['createdAt'] as Date).toISOString(),
    updated_at:            (row['updatedAt'] as Date).toISOString(),
  };
}

export class RegistryEngine {
  private repo = new RegistryRepository();

  // ── Create / Upsert ───────────────────────────────────────────────────────

  async registerEntity(data: {
    entity_type:   EntityType;
    entity_id:     string;
    country_code:  string;
    display_name?: string;
    avatar_url?:   string;
    metadata?:     Record<string, unknown>;
  }): Promise<RegistryRecord> {
    // Check if already registered
    const existing = await this.repo.findByEntityId(data.entity_id, data.entity_type);
    if (existing) {
      logger.info('Registry: entity already registered', { registryId: existing.registryId, entityId: data.entity_id });
      return rowToRecord(existing as unknown as Record<string, unknown>);
    }

    const registryId = generateRegistryId(data.entity_type);
    const row = await this.repo.insert({
      registryId,
      entityType:   data.entity_type,
      entityId:     data.entity_id,
      countryCode:  data.country_code,
      displayName:  data.display_name ?? null,
      avatarUrl:    data.avatar_url ?? null,
      metadata:     data.metadata ?? {},
      identityStatus:      'pending',
      verificationStatus:  'unverified',
      verificationTier:    0,
      trustStatus:         'unscored',
      consentStatus:       'none',
      routingStatus:       'unlinked',
      complianceStatus:    'pending',
      complianceFlags:     [],
    });

    logger.info('Registry: entity registered', { registryId, entityType: data.entity_type, entityId: data.entity_id });
    return rowToRecord(row as unknown as Record<string, unknown>);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getById(registryId: string): Promise<RegistryRecord | null> {
    const row = await this.repo.findByRegistryId(registryId);
    return row ? rowToRecord(row as unknown as Record<string, unknown>) : null;
  }

  async getByEntityId(entityId: string, entityType: EntityType): Promise<RegistryRecord | null> {
    const row = await this.repo.findByEntityId(entityId, entityType);
    return row ? rowToRecord(row as unknown as Record<string, unknown>) : null;
  }

  async list(opts: {
    entity_type?:       string;
    country_code?:      string;
    identity_status?:   string;
    trust_status?:      string;
    compliance_status?: string;
    page?:              number;
    limit?:             number;
  }): Promise<{ records: RegistryRecord[]; total: number; page: number; limit: number }> {
    const page  = opts.page  ?? 1;
    const limit = opts.limit ?? 20;
    const { data, total } = await this.repo.list({
      entityType:       opts.entity_type,
      countryCode:      opts.country_code,
      identityStatus:   opts.identity_status,
      trustStatus:      opts.trust_status,
      complianceStatus: opts.compliance_status,
      page,
      limit,
    });
    return {
      records: data.map((r) => rowToRecord(r as unknown as Record<string, unknown>)),
      total,
      page,
      limit,
    };
  }

  // ── Status transitions ────────────────────────────────────────────────────

  async transition(
    registryId: string,
    dimension:  Dimension,
    toStatus:   string,
    actor?:     { actorId: string; actorType: string; reason?: string },
    extra?:     Record<string, unknown>,
  ): Promise<RegistryRecord> {
    const updated = await this.repo.updateDimension(registryId, dimension, toStatus, extra, actor);
    if (!updated) throw new Error(`registry_id not found: ${registryId}`);
    logger.info('Registry: dimension transitioned', { registryId, dimension, toStatus });
    return rowToRecord(updated as unknown as Record<string, unknown>);
  }

  // Convenience wrappers consumed by other services via Kafka events

  async onIdentityVerified(entityId: string, entityType: EntityType): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'identity', 'verified', {}, { actorId: 'system', actorType: 'kafka_consumer' });
    logger.info('Registry: identity verified', { registryId: rec.registryId });
  }

  async onIdentityActivated(entityId: string, entityType: EntityType): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'identity', 'active', {}, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onKycUpgraded(entityId: string, entityType: EntityType, tier: number): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    const tierLabel = ['unverified', 'tier1', 'tier2', 'tier3'][tier] ?? 'tier1';
    await this.repo.updateDimension(rec.registryId, 'verification', tierLabel, { tier }, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onTrustScoreChanged(entityId: string, entityType: EntityType, score: number, tier: string): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'trust', tier, { trustScore: score }, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onConsentGranted(entityId: string, entityType: EntityType): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec || rec.consentStatus === 'has_consents') return;
    await this.repo.updateDimension(rec.registryId, 'consent', 'has_consents', {}, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onRoutingLinked(entityId: string, entityType: EntityType): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'routing', 'linked', {}, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onRoutingActivated(entityId: string, entityType: EntityType): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'routing', 'active', {}, { actorId: 'system', actorType: 'kafka_consumer' });
  }

  async onSanctioned(entityId: string, entityType: EntityType, reason: string): Promise<void> {
    const rec = await this.repo.findByEntityId(entityId, entityType);
    if (!rec) return;
    await this.repo.updateDimension(rec.registryId, 'compliance', 'sanctioned', { flags: ['SANCTIONS_MATCH'] }, { actorId: 'system', actorType: 'kafka_consumer', reason });
    // Also suspend identity
    await this.repo.updateDimension(rec.registryId, 'identity', 'suspended', { reason }, { actorId: 'system', actorType: 'kafka_consumer', reason });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(registryId: string, dimension?: Dimension): Promise<RegistryEvent[]> {
    const rows = await this.repo.getEvents(registryId, dimension);
    return rows.map((r) => ({
      id:          r.id,
      registry_id: r.registryId,
      dimension:   r.dimension,
      from_status: r.fromStatus ?? undefined,
      to_status:   r.toStatus,
      actor_id:    r.actorId ?? undefined,
      actor_type:  r.actorType ?? undefined,
      reason:      r.reason ?? undefined,
      created_at:  r.createdAt.toISOString(),
    }));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats(): Promise<Record<string, number>> {
    return this.repo.stats();
  }
}
