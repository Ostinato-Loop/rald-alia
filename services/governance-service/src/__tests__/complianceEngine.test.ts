// services/governance-service/src/__tests__/complianceEngine.test.ts
import { describe, it, expect } from 'vitest';
import { ComplianceEngine } from '../services/complianceEngine';

describe('ComplianceEngine.getFrameworks', () => {
  const engine = new ComplianceEngine();

  it('returns NG frameworks', () => {
    const frameworks = engine.getFrameworks('NG');
    expect(frameworks.length).toBeGreaterThan(0);
    const codes = frameworks.map((f: any) => f.code);
    expect(codes).toContain('NDPR');
    expect(codes).toContain('CBN_KYC');
  });

  it('returns GH frameworks', () => {
    const frameworks = engine.getFrameworks('GH');
    const codes = frameworks.map((f: any) => f.code);
    expect(codes).toContain('DPA_GH');
  });

  it('returns empty array for unknown country', () => {
    const frameworks = engine.getFrameworks('ZZ');
    expect(frameworks).toHaveLength(0);
  });
});

describe('ComplianceEngine.checkAliasCreation', () => {
  const engine = new ComplianceEngine();

  it('blocks alias creation in a non-operational country', async () => {
    const result = await engine.checkAliasCreation({ country_code: 'NG', country_status: 'DISABLED', alias_type: 'phone', user_kyc_level: 2 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/operational/i);
  });

  it('allows alias creation when country is PUBLIC_BETA and KYC is sufficient', async () => {
    const result = await engine.checkAliasCreation({ country_code: 'NG', country_status: 'PUBLIC_BETA', alias_type: 'phone', user_kyc_level: 2 });
    expect(result.allowed).toBe(true);
  });

  it('blocks alias creation when KYC level is insufficient', async () => {
    const result = await engine.checkAliasCreation({ country_code: 'NG', country_status: 'PUBLIC_BETA', alias_type: 'phone', user_kyc_level: 0 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/kyc/i);
  });
});
