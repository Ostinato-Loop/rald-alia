// packages/sdk/src/__tests__/modules/alias.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliaSDK } from '../../../AliaSDK';
import type { Alias } from '../../../types';

const ALIAS_FIXTURE: Alias = {
  id:         'alias_001',
  alias:      '+2348012345678',
  type:       'phone',
  status:     'active',
  country:    'NG',
  routing:    { bank_code: '058', account_number: '0123456789' },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function stubFetchWith(data: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:      status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json:    () => Promise.resolve({ success: true, data }),
  }));
}

describe('AliasClient', () => {
  let sdk: AliaSDK;

  beforeEach(() => {
    sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
  });

  it('resolve() posts to /v1/aliases/resolve', async () => {
    stubFetchWith(ALIAS_FIXTURE);
    const result = await sdk.alias.resolve({ alias: '+2348012345678', country: 'NG' });
    expect(result.alias).toBe('+2348012345678');
    expect(result.type).toBe('phone');
  });

  it('resolve() sends the alias and country in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ success: true, data: ALIAS_FIXTURE }) });
    vi.stubGlobal('fetch', fetchMock);
    await sdk.alias.resolve({ alias: 'user@paystack', country: 'GH' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ alias: 'user@paystack', country: 'GH' });
  });

  it('create() posts to /v1/aliases', async () => {
    stubFetchWith({ ...ALIAS_FIXTURE, id: 'alias_new' });
    const result = await sdk.alias.create({
      alias:   'merchant@store',
      type:    'email',
      country: 'NG',
      routing: { bank_code: '058', account_number: '0987654321' },
    });
    expect(result.id).toBe('alias_new');
  });

  it('get() fetches /v1/aliases/:id', async () => {
    stubFetchWith(ALIAS_FIXTURE);
    const result = await sdk.alias.get('alias_001');
    expect(result.id).toBe('alias_001');
    const [url] = (vi.mocked(fetch)).mock.calls[0];
    expect(url as string).toContain('/v1/aliases/alias_001');
  });
});
