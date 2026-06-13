// services/developer-service/src/services/developerEngine.ts
// Core business logic for the Developer Registry.
// Handles developer lifecycle, project management, and API key issuance.

import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { DeveloperRepository } from '../repositories/developer.repository';

// Allowed status transitions for developer accounts.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  applied:   ['verified', 'revoked'],
  verified:  ['active', 'revoked'],
  active:    ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked:   [],
};

// Available API scopes that can be granted to developer projects.
export const AVAILABLE_SCOPES = [
  'alias:resolve',
  'alias:create',
  'alias:read',
  'identity:verify',
  'trust:read',
  'consent:grant',
  'consent:read',
  'routing:initiate',
  'registry:read',
] as const;

export type ApiScope = (typeof AVAILABLE_SCOPES)[number];

// Rate limit tiers per environment
const RATE_LIMITS = {
  sandbox:    { rpm: 60,  rpd: 10_000 },
  production: { rpm: 120, rpd: 50_000 },
};

export interface DeveloperRecord {
  id:              string;
  registry_id?:    string;
  name:            string;
  email:           string;
  organization_id?: string;
  status:          string;
  kyc_verified:    boolean;
  country:         string;
  website?:        string;
  notes?:          string;
  approved_by?:    string;
  approved_at?:    string;
  suspended_at?:   string;
  suspension_reason?: string;
  metadata:        Record<string, unknown>;
  created_at:      string;
  updated_at:      string;
}

export interface ProjectRecord {
  id:                      string;
  developer_id:            string;
  name:                    string;
  description?:            string;
  environment:             string;
  status:                  string;
  country_permissions:     string[];
  institution_permissions: string[];
  webhook_url?:            string;
  metadata:                Record<string, unknown>;
  created_at:              string;
  updated_at:              string;
}

export interface ApiKeyRecord {
  id:             string;
  key_id:         string;
  project_id:     string;
  developer_id:   string;
  name:           string;
  scopes:         string[];
  rate_limit_rpm: number;
  rate_limit_rpd: number;
  environment:    string;
  expires_at?:    string;
  last_used_at?:  string;
  status:         string;
  created_at:     string;
}

export interface CreatedApiKey extends ApiKeyRecord {
  plain_key: string;
}

export interface ApiKeyVerification {
  valid:        boolean;
  key_id?:      string;
  project_id?:  string;
  developer_id?: string;
  scopes?:      string[];
  environment?: string;
  rate_limit_rpm?: number;
  rate_limit_rpd?: number;
  error?:       string;
}

function hashKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

function generatePlainKey(env: string): { plainKey: string; keyId: string } {
  const prefix  = `rald_key_${env === 'production' ? 'prod' : 'test'}`;
  const secret  = randomBytes(24).toString('hex');
  const plainKey = `${prefix}_${secret}`;
  const keyId    = `kid_${randomBytes(8).toString('hex')}`;
  return { plainKey, keyId };
}

function rowToDeveloper(r: Record<string, any>): DeveloperRecord {
  return {
    id:              r.id,
    registry_id:     r.registryId ?? undefined,
    name:            r.name,
    email:           r.email,
    organization_id: r.organizationId ?? undefined,
    status:          r.status,
    kyc_verified:    r.kycVerified,
    country:         r.country,
    website:         r.website ?? undefined,
    notes:           r.notes ?? undefined,
    approved_by:     r.approvedBy ?? undefined,
    approved_at:     r.approvedAt?.toISOString(),
    suspended_at:    r.suspendedAt?.toISOString(),
    suspension_reason: r.suspensionReason ?? undefined,
    metadata:        r.metadata ?? {},
    created_at:      r.createdAt.toISOString(),
    updated_at:      r.updatedAt.toISOString(),
  };
}

function rowToProject(r: Record<string, any>): ProjectRecord {
  return {
    id:                      r.id,
    developer_id:            r.developerId,
    name:                    r.name,
    description:             r.description ?? undefined,
    environment:             r.environment,
    status:                  r.status,
    country_permissions:     (r.countryPermissions as string[]) ?? [],
    institution_permissions: (r.institutionPermissions as string[]) ?? [],
    webhook_url:             r.webhookUrl ?? undefined,
    metadata:                r.metadata ?? {},
    created_at:              r.createdAt.toISOString(),
    updated_at:              r.updatedAt.toISOString(),
  };
}

function rowToApiKey(r: Record<string, any>): ApiKeyRecord {
  return {
    id:             r.id,
    key_id:         r.keyId,
    project_id:     r.projectId,
    developer_id:   r.developerId,
    name:           r.name,
    scopes:         (r.scopes as string[]) ?? [],
    rate_limit_rpm: r.rateLimitRpm,
    rate_limit_rpd: r.rateLimitRpd,
    environment:    r.environment,
    expires_at:     r.expiresAt?.toISOString(),
    last_used_at:   r.lastUsedAt?.toISOString(),
    status:         r.status,
    created_at:     r.createdAt.toISOString(),
  };
}

export class DeveloperEngine {
  private repo = new DeveloperRepository();

  // ── Developer CRUD ────────────────────────────────────────────────────────

  async registerDeveloper(data: {
    name:            string;
    email:           string;
    country:         string;
    website?:        string;
    organization_id?: string;
  }): Promise<DeveloperRecord> {
    const existing = await this.repo.findDeveloperByEmail(data.email);
    if (existing) {
      throw Object.assign(new Error('A developer with this email is already registered'), { status: 409, code: 'EMAIL_CONFLICT' });
    }

    const row = await this.repo.insertDeveloper({
      id:             uuidv4(),
      name:           data.name,
      email:          data.email,
      country:        data.country,
      website:        data.website ?? null,
      organizationId: data.organization_id ?? null,
      status:         'applied',
      kycVerified:    false,
    });

    await this.repo.appendEvent({ developerId: row.id, eventType: 'developer.applied', actorType: 'developer' });
    logger.info({ id: row.id, email: row.email }, 'Developer registered');
    return rowToDeveloper(row as any);
  }

  async getDeveloper(id: string): Promise<DeveloperRecord | null> {
    const row = await this.repo.findDeveloperById(id);
    return row ? rowToDeveloper(row as any) : null;
  }

  async listDevelopers(opts: { status?: string; country?: string; search?: string; page?: number; limit?: number }) {
    const { data, total } = await this.repo.listDevelopers({
      status:  opts.status,
      country: opts.country,
      search:  opts.search,
      page:    opts.page  ?? 1,
      limit:   opts.limit ?? 50,
    });
    return { developers: data.map((r) => rowToDeveloper(r as any)), total };
  }

  async transitionStatus(params: {
    developer_id: string;
    to_status:    string;
    actor_id:     string;
    actor_type:   string;
    reason?:      string;
  }): Promise<DeveloperRecord> {
    const dev = await this.repo.findDeveloperById(params.developer_id);
    if (!dev) throw Object.assign(new Error('Developer not found'), { status: 404, code: 'NOT_FOUND' });

    const allowed = ALLOWED_TRANSITIONS[dev.status] ?? [];
    if (!allowed.includes(params.to_status)) {
      throw Object.assign(
        new Error(`Invalid transition: ${dev.status} → ${params.to_status}. Allowed: ${allowed.join(', ') || 'none'}`),
        { status: 422, code: 'INVALID_TRANSITION' },
      );
    }

    const now   = new Date();
    const patch: Record<string, any> = { status: params.to_status };

    if (params.to_status === 'active' || params.to_status === 'verified') {
      patch.approvedBy = params.actor_id;
      patch.approvedAt = now;
    }
    if (params.to_status === 'suspended') {
      patch.suspendedAt      = now;
      patch.suspensionReason = params.reason ?? null;
    }
    if (params.to_status === 'revoked') {
      patch.revokedAt          = now;
      patch.revocationReason   = params.reason ?? null;
    }

    const updated = await this.repo.updateDeveloper(params.developer_id, patch);
    await this.repo.appendEvent({
      developerId: params.developer_id,
      eventType:   `developer.${params.to_status}`,
      actorId:     params.actor_id,
      actorType:   params.actor_type,
      metadata:    { from: dev.status, to: params.to_status, reason: params.reason },
    });

    logger.info({ id: params.developer_id, from: dev.status, to: params.to_status }, 'Developer status transitioned');
    return rowToDeveloper(updated as any);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async createProject(params: {
    developer_id:            string;
    name:                    string;
    description?:            string;
    environment:             'sandbox' | 'production';
    country_permissions?:    string[];
    institution_permissions?: string[];
    webhook_url?:            string;
  }): Promise<ProjectRecord> {
    const dev = await this.repo.findDeveloperById(params.developer_id);
    if (!dev) throw Object.assign(new Error('Developer not found'), { status: 404 });

    if (params.environment === 'production' && dev.status !== 'active') {
      throw Object.assign(
        new Error('Production projects require the developer account to be ACTIVE'),
        { status: 403, code: 'DEVELOPER_NOT_ACTIVE' },
      );
    }

    const row = await this.repo.insertProject({
      id:                     uuidv4(),
      developerId:            params.developer_id,
      name:                   params.name,
      description:            params.description ?? null,
      environment:            params.environment,
      countryPermissions:     params.country_permissions ?? [],
      institutionPermissions: params.institution_permissions ?? [],
      webhookUrl:             params.webhook_url ?? null,
      status:                 'active',
    });

    await this.repo.appendEvent({ developerId: params.developer_id, eventType: 'project.created', actorType: 'developer', metadata: { projectId: row.id } });
    logger.info({ projectId: row.id, developerId: params.developer_id }, 'Project created');
    return rowToProject(row as any);
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const row = await this.repo.findProjectById(id);
    return row ? rowToProject(row as any) : null;
  }

  async listProjects(developerId: string): Promise<ProjectRecord[]> {
    const rows = await this.repo.listProjectsByDeveloper(developerId);
    return rows.map((r) => rowToProject(r as any));
  }

  async updateProject(id: string, data: { name?: string; description?: string; country_permissions?: string[]; institution_permissions?: string[]; webhook_url?: string }): Promise<ProjectRecord> {
    const patch: Record<string, any> = {};
    if (data.name                   !== undefined) patch.name                   = data.name;
    if (data.description            !== undefined) patch.description            = data.description;
    if (data.country_permissions    !== undefined) patch.countryPermissions     = data.country_permissions;
    if (data.institution_permissions !== undefined) patch.institutionPermissions = data.institution_permissions;
    if (data.webhook_url            !== undefined) patch.webhookUrl             = data.webhook_url;

    const updated = await this.repo.updateProject(id, patch);
    if (!updated) throw Object.assign(new Error('Project not found'), { status: 404 });
    return rowToProject(updated as any);
  }

  async archiveProject(id: string, actorId: string): Promise<void> {
    const project = await this.repo.findProjectById(id);
    if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
    await this.repo.updateProject(id, { status: 'archived', archivedAt: new Date() });
    await this.repo.appendEvent({ developerId: project.developerId, eventType: 'project.archived', actorId, actorType: 'developer', metadata: { projectId: id } });
    logger.info({ projectId: id }, 'Project archived');
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  async createApiKey(params: {
    project_id:  string;
    developer_id: string;
    name:        string;
    scopes:      string[];
    expires_in_days?: number;
  }): Promise<CreatedApiKey> {
    const project = await this.repo.findProjectById(params.project_id);
    if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
    if (project.status !== 'active') throw Object.assign(new Error('Project is not active'), { status: 403 });

    // Validate scopes
    const invalid = params.scopes.filter((s) => !(AVAILABLE_SCOPES as readonly string[]).includes(s));
    if (invalid.length) {
      throw Object.assign(new Error(`Invalid scopes: ${invalid.join(', ')}`), { status: 400, code: 'INVALID_SCOPES' });
    }

    const env              = project.environment as 'sandbox' | 'production';
    const limits           = RATE_LIMITS[env];
    const { plainKey, keyId } = generatePlainKey(env);
    const keyHash          = hashKey(plainKey);

    const expiresAt = params.expires_in_days
      ? new Date(Date.now() + params.expires_in_days * 86_400_000)
      : null;

    const row = await this.repo.insertApiKey({
      id:           uuidv4(),
      keyId,
      keyHash,
      projectId:    params.project_id,
      developerId:  params.developer_id,
      name:         params.name,
      scopes:       params.scopes,
      rateLimitRpm: limits.rpm,
      rateLimitRpd: limits.rpd,
      environment:  env,
      expiresAt,
      status:       'active',
    });

    await this.repo.appendEvent({ developerId: params.developer_id, eventType: 'api_key.created', actorType: 'developer', metadata: { keyId, projectId: params.project_id, scopes: params.scopes } });
    logger.info({ keyId, projectId: params.project_id, env }, 'API key created');

    return { ...rowToApiKey(row as any), plain_key: plainKey };
  }

  async listApiKeys(projectId: string): Promise<ApiKeyRecord[]> {
    const rows = await this.repo.listApiKeysByProject(projectId);
    return rows.map((r) => rowToApiKey(r as any));
  }

  async revokeApiKey(id: string, actorId: string): Promise<void> {
    const key = await this.repo.findApiKeyById(id);
    if (!key) throw Object.assign(new Error('API key not found'), { status: 404 });
    await this.repo.revokeApiKey(id, actorId);
    await this.repo.appendEvent({ developerId: key.developerId, eventType: 'api_key.revoked', actorId, actorType: 'admin', metadata: { keyId: key.keyId, projectId: key.projectId } });
    logger.info({ keyId: key.keyId }, 'API key revoked');
  }

  // ── API Key Verification ──────────────────────────────────────────────────
  // Called by other ALIA services (or an API gateway) to authenticate requests.

  async verifyApiKey(plainKey: string): Promise<ApiKeyVerification> {
    const keyHash = hashKey(plainKey);
    const key     = await this.repo.findApiKeyByHash(keyHash);

    if (!key) {
      return { valid: false, error: 'API key not found or revoked' };
    }

    if (key.status !== 'active') {
      return { valid: false, error: `API key is ${key.status}` };
    }

    if (key.expiresAt && new Date() > key.expiresAt) {
      await this.repo.updateApiKey(key.id, { status: 'expired' });
      return { valid: false, error: 'API key has expired' };
    }

    // Update lastUsedAt asynchronously (non-blocking)
    this.repo.touchApiKey(key.id).catch(() => {});

    return {
      valid:         true,
      key_id:        key.keyId,
      project_id:    key.projectId,
      developer_id:  key.developerId,
      scopes:        key.scopes as string[],
      environment:   key.environment,
      rate_limit_rpm: key.rateLimitRpm,
      rate_limit_rpd: key.rateLimitRpd,
    };
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(developerId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.repo.listEvents(developerId);
    return rows.map((r) => ({
      id:          r.id,
      developer_id: r.developerId,
      event_type:  r.eventType,
      actor_id:    r.actorId,
      actor_type:  r.actorType,
      metadata:    r.metadata,
      created_at:  r.createdAt.toISOString(),
    }));
  }
}
