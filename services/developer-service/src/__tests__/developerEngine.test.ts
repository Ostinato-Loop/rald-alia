// services/developer-service/src/__tests__/developerEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeveloperEngine } from '../services/developerEngine';

// ── Mock the repository layer ─────────────────────────────────────────────────
vi.mock('../repositories/developer.repository', () => {
  const mockRepo = {
    findDeveloperByEmail:   vi.fn(),
    insertDeveloper:        vi.fn(),
    findDeveloperById:      vi.fn(),
    listDevelopers:         vi.fn(),
    updateDeveloper:        vi.fn(),
    findProjectById:        vi.fn(),
    insertProject:          vi.fn(),
    listProjectsByDeveloper: vi.fn(),
    updateProject:          vi.fn(),
    insertApiKey:           vi.fn(),
    findApiKeyByHash:       vi.fn(),
    findApiKeyById:         vi.fn(),
    listApiKeysByProject:   vi.fn(),
    updateApiKey:           vi.fn(),
    revokeApiKey:           vi.fn(),
    touchApiKey:            vi.fn(),
    appendEvent:            vi.fn(),
    listEvents:             vi.fn(),
  };
  return { DeveloperRepository: vi.fn(() => mockRepo) };
});

import { DeveloperRepository } from '../repositories/developer.repository';

function makeDevRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:             'dev_001',
    registryId:     null,
    name:           'Amara Okafor',
    email:          'amara@test.ng',
    organizationId: null,
    status:         'applied',
    kycVerified:    false,
    country:        'NG',
    website:        null,
    notes:          null,
    approvedBy:     null,
    approvedAt:     null,
    suspendedAt:    null,
    suspensionReason: null,
    revokedAt:      null,
    revocationReason: null,
    metadata:       {},
    createdAt:      new Date('2026-01-01'),
    updatedAt:      new Date('2026-01-01'),
    ...overrides,
  };
}

function makeProjectRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                     'proj_001',
    developerId:            'dev_001',
    name:                   'My App',
    description:            null,
    environment:            'sandbox',
    status:                 'active',
    countryPermissions:     [],
    institutionPermissions: [],
    webhookUrl:             null,
    metadata:               {},
    archivedAt:             null,
    createdAt:              new Date('2026-01-01'),
    updatedAt:              new Date('2026-01-01'),
    ...overrides,
  };
}

describe('DeveloperEngine.registerDeveloper', () => {
  let engine: DeveloperEngine;
  let repo: ReturnType<typeof DeveloperRepository> & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DeveloperEngine();
    repo   = (DeveloperRepository as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  it('creates a developer with applied status', async () => {
    repo.findDeveloperByEmail.mockResolvedValue(null);
    repo.insertDeveloper.mockResolvedValue(makeDevRow());
    repo.appendEvent.mockResolvedValue(undefined);

    const dev = await engine.registerDeveloper({ name: 'Amara Okafor', email: 'amara@test.ng', country: 'NG' });
    expect(dev.status).toBe('applied');
    expect(dev.kyc_verified).toBe(false);
    expect(repo.insertDeveloper).toHaveBeenCalledWith(expect.objectContaining({ status: 'applied', kycVerified: false }));
    expect(repo.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'developer.applied' }));
  });

  it('throws 409 if email already exists', async () => {
    repo.findDeveloperByEmail.mockResolvedValue(makeDevRow());

    await expect(
      engine.registerDeveloper({ name: 'Dup', email: 'amara@test.ng', country: 'NG' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_CONFLICT' });
  });
});

describe('DeveloperEngine.transitionStatus', () => {
  let engine: DeveloperEngine;
  let repo: ReturnType<typeof DeveloperRepository> & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DeveloperEngine();
    repo   = (DeveloperRepository as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  it('applied → verified succeeds', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'applied' }));
    repo.updateDeveloper.mockResolvedValue(makeDevRow({ status: 'verified' }));
    repo.appendEvent.mockResolvedValue(undefined);

    const result = await engine.transitionStatus({ developer_id: 'dev_001', to_status: 'verified', actor_id: 'admin_1', actor_type: 'admin' });
    expect(result.status).toBe('verified');
    expect(repo.updateDeveloper).toHaveBeenCalledWith('dev_001', expect.objectContaining({ status: 'verified' }));
  });

  it('applied → active throws 422 (invalid transition)', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'applied' }));

    await expect(
      engine.transitionStatus({ developer_id: 'dev_001', to_status: 'active', actor_id: 'admin_1', actor_type: 'admin' }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_TRANSITION' });
  });

  it('revoked → active throws 422 (no way back)', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'revoked' }));

    await expect(
      engine.transitionStatus({ developer_id: 'dev_001', to_status: 'active', actor_id: 'admin_1', actor_type: 'admin' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('throws 404 if developer not found', async () => {
    repo.findDeveloperById.mockResolvedValue(null);

    await expect(
      engine.transitionStatus({ developer_id: 'dev_999', to_status: 'verified', actor_id: 'admin_1', actor_type: 'admin' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('DeveloperEngine.createProject', () => {
  let engine: DeveloperEngine;
  let repo: ReturnType<typeof DeveloperRepository> & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DeveloperEngine();
    repo   = (DeveloperRepository as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  it('creates sandbox project for any developer status', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'verified' }));
    repo.insertProject.mockResolvedValue(makeProjectRow());
    repo.appendEvent.mockResolvedValue(undefined);

    const project = await engine.createProject({ developer_id: 'dev_001', name: 'My App', environment: 'sandbox' });
    expect(project.environment).toBe('sandbox');
  });

  it('blocks production project if developer is not active', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'verified' }));

    await expect(
      engine.createProject({ developer_id: 'dev_001', name: 'Prod App', environment: 'production' }),
    ).rejects.toMatchObject({ status: 403, code: 'DEVELOPER_NOT_ACTIVE' });
  });

  it('allows production project if developer is active', async () => {
    repo.findDeveloperById.mockResolvedValue(makeDevRow({ status: 'active' }));
    repo.insertProject.mockResolvedValue(makeProjectRow({ environment: 'production' }));
    repo.appendEvent.mockResolvedValue(undefined);

    const project = await engine.createProject({ developer_id: 'dev_001', name: 'Prod App', environment: 'production' });
    expect(project.environment).toBe('production');
  });
});

describe('DeveloperEngine.createApiKey', () => {
  let engine: DeveloperEngine;
  let repo: ReturnType<typeof DeveloperRepository> & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DeveloperEngine();
    repo   = (DeveloperRepository as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  it('generates a key with the correct sandbox prefix', async () => {
    repo.findProjectById.mockResolvedValue(makeProjectRow({ environment: 'sandbox' }));
    repo.insertApiKey.mockImplementation(async (data: any) => ({ ...data, id: 'key_row_1', createdAt: new Date(), updatedAt: new Date() }));
    repo.appendEvent.mockResolvedValue(undefined);

    const key = await engine.createApiKey({ project_id: 'proj_001', developer_id: 'dev_001', name: 'Test Key', scopes: ['alias:resolve'] });
    expect(key.plain_key).toMatch(/^rald_key_test_/);
    expect(key.scopes).toContain('alias:resolve');
  });

  it('generates a key with the correct production prefix', async () => {
    repo.findProjectById.mockResolvedValue(makeProjectRow({ environment: 'production' }));
    repo.insertApiKey.mockImplementation(async (data: any) => ({ ...data, id: 'key_row_2', createdAt: new Date(), updatedAt: new Date() }));
    repo.appendEvent.mockResolvedValue(undefined);

    const key = await engine.createApiKey({ project_id: 'proj_001', developer_id: 'dev_001', name: 'Prod Key', scopes: ['routing:initiate'] });
    expect(key.plain_key).toMatch(/^rald_key_prod_/);
  });

  it('rejects invalid scopes', async () => {
    repo.findProjectById.mockResolvedValue(makeProjectRow());

    await expect(
      engine.createApiKey({ project_id: 'proj_001', developer_id: 'dev_001', name: 'Bad Key', scopes: ['invalid:scope'] }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_SCOPES' });
  });

  it('plain_key is not stored — only the hash is saved', async () => {
    repo.findProjectById.mockResolvedValue(makeProjectRow());
    let storedData: any = null;
    repo.insertApiKey.mockImplementation(async (data: any) => {
      storedData = data;
      return { ...data, id: 'key_row_3', createdAt: new Date(), updatedAt: new Date() };
    });
    repo.appendEvent.mockResolvedValue(undefined);

    const key = await engine.createApiKey({ project_id: 'proj_001', developer_id: 'dev_001', name: 'Key', scopes: ['alias:read'] });
    expect(storedData.keyHash).toBeDefined();
    expect(storedData.keyHash).not.toBe(key.plain_key);
    expect(storedData).not.toHaveProperty('plainKey');
  });
});

describe('DeveloperEngine.verifyApiKey', () => {
  let engine: DeveloperEngine;
  let repo: ReturnType<typeof DeveloperRepository> & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DeveloperEngine();
    repo   = (DeveloperRepository as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  it('returns valid=false for unknown key', async () => {
    repo.findApiKeyByHash.mockResolvedValue(null);
    const result = await engine.verifyApiKey('rald_key_test_unknown');
    expect(result.valid).toBe(false);
  });

  it('returns valid=true with scopes for a known active key', async () => {
    repo.findApiKeyByHash.mockResolvedValue({
      id:           'key_row_1',
      keyId:        'kid_abc',
      projectId:    'proj_001',
      developerId:  'dev_001',
      scopes:       ['alias:resolve'],
      environment:  'sandbox',
      rateLimitRpm: 60,
      rateLimitRpd: 10000,
      status:       'active',
      expiresAt:    null,
    });
    repo.touchApiKey.mockResolvedValue(undefined);

    const result = await engine.verifyApiKey('rald_key_test_some_valid_key');
    expect(result.valid).toBe(true);
    expect(result.scopes).toContain('alias:resolve');
    expect(result.project_id).toBe('proj_001');
  });

  it('returns valid=false for an expired key', async () => {
    repo.findApiKeyByHash.mockResolvedValue({
      id:        'key_row_2',
      status:    'active',
      expiresAt: new Date('2020-01-01'), // past date
    });
    repo.updateApiKey.mockResolvedValue(undefined);

    const result = await engine.verifyApiKey('rald_key_test_expired');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });
});
