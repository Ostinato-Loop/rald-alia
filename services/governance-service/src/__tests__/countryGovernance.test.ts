// services/governance-service/src/__tests__/countryGovernance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CountryGovernanceEngine } from '../services/countryGovernance';

// ── Mock the DB ───────────────────────────────────────────────────────────────
vi.mock('@rald-alia/db', () => ({
  getDb: vi.fn(),
  countryGovernance: {},
  countryGovernanceEvents: {},
}));

import { getDb } from '@rald-alia/db';

function makeCountryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                   'cgov_001',
    countryCode:          'NG',
    countryName:          'Nigeria',
    status:               'INTERNAL',
    complianceFramework:  'NDPR',
    maxAliasesPerUser:    5,
    kycRequirementLevel:  2,
    allowedAliasTypes:    ['phone', 'email'],
    sanctionListEnabled:  true,
    dataResidencyRequired: true,
    notes:                null,
    activatedBy:          null,
    activatedAt:          null,
    updatedBy:            null,
    metadata:             {},
    createdAt:            new Date('2026-01-01'),
    updatedAt:            new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMockDb(countryRow: ReturnType<typeof makeCountryRow> | null = makeCountryRow()) {
  const selectResult = countryRow ? [countryRow] : [];
  const db: any = {
    select:  vi.fn().mockReturnThis(),
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockReturnThis(),
    limit:   vi.fn().mockResolvedValue(selectResult),
    insert:  vi.fn().mockReturnThis(),
    values:  vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
    update:  vi.fn().mockReturnThis(),
    set:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ ...countryRow, status: 'PRIVATE_BETA' }]),
    orderBy: vi.fn().mockResolvedValue(selectResult),
  };
  return db;
}

describe('CountryGovernanceEngine.isOperational', () => {
  it('returns false for DISABLED status', () => {
    const engine = new CountryGovernanceEngine();
    expect(engine.isOperational('DISABLED')).toBe(false);
  });

  it('returns false for INTERNAL status', () => {
    const engine = new CountryGovernanceEngine();
    expect(engine.isOperational('INTERNAL')).toBe(false);
  });

  it('returns true for PUBLIC_BETA status', () => {
    const engine = new CountryGovernanceEngine();
    expect(engine.isOperational('PUBLIC_BETA')).toBe(true);
  });

  it('returns true for GA status', () => {
    const engine = new CountryGovernanceEngine();
    expect(engine.isOperational('GA')).toBe(true);
  });

  it('returns false for PRIVATE_BETA status', () => {
    const engine = new CountryGovernanceEngine();
    expect(engine.isOperational('PRIVATE_BETA')).toBe(false);
  });
});

describe('CountryGovernanceEngine.getCountry', () => {
  let engine: CountryGovernanceEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CountryGovernanceEngine();
  });

  it('returns null when country not found', async () => {
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(makeMockDb(null));
    const result = await engine.getCountry('ZZ');
    expect(result).toBeNull();
  });

  it('returns a formatted country record', async () => {
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(makeMockDb());
    const result = await engine.getCountry('NG');
    expect(result).not.toBeNull();
    expect(result!.country_code).toBe('NG');
    expect(result!.status).toBe('INTERNAL');
  });
});

describe('CountryGovernanceEngine.transitionStatus', () => {
  let engine: CountryGovernanceEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CountryGovernanceEngine();
  });

  it('INTERNAL → PRIVATE_BETA is a valid transition', async () => {
    const db = makeMockDb(makeCountryRow({ status: 'INTERNAL' }));
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

    const result = await engine.transitionStatus({ country_code: 'NG', to_status: 'PRIVATE_BETA', actor_id: 'admin_1', actor_type: 'admin' });
    expect(result.status).toBe('PRIVATE_BETA');
  });

  it('throws 404 if country not found', async () => {
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(makeMockDb(null));

    await expect(
      engine.transitionStatus({ country_code: 'ZZ', to_status: 'GA', actor_id: 'admin_1', actor_type: 'admin' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 422 on DISABLED → GA (skip-step transition)', async () => {
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(makeMockDb(makeCountryRow({ status: 'DISABLED' })));

    await expect(
      engine.transitionStatus({ country_code: 'GH', to_status: 'GA', actor_id: 'admin_1', actor_type: 'admin' }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
