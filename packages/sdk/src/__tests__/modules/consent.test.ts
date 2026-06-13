// packages/sdk/src/__tests__/modules/consent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliaSDK } from '../../../AliaSDK';
import type { Consent } from '../../../types';

const CONSENT_FIXTURE: Consent = {
  id:           'consent_001',
  subject_id:   'user_abc',
  requestor_id: 'app_xyz',
  scope:        ['alias:resolve', 'routing:initiate'],
  status:       'pending',
  created_at:   '2026-01-01T00:00:00.000Z',
};

function stubFetchWith(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:      true,
    status:  200,
    headers: { get: () => null },
    json:    () => Promise.resolve({ success: true, data }),
  }));
}

describe('ConsentClient', () => {
  let sdk: AliaSDK;

  beforeEach(() => {
    sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
  });

  it('grant() posts to /v1/consents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ success: true, data: CONSENT_FIXTURE }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sdk.consent.grant({
      subject_id:      'user_abc',
      requestor_id:    'app_xyz',
      scope:           ['alias:resolve'],
      expires_in_days: 90,
    });

    expect(result.id).toBe('consent_001');
    expect(result.status).toBe('pending');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.scope).toContain('alias:resolve');
    expect(body.expires_in_days).toBe(90);
  });

  it('get() fetches /v1/consents/:id', async () => {
    stubFetchWith({ ...CONSENT_FIXTURE, status: 'granted' });
    const result = await sdk.consent.get('consent_001');
    expect(result.status).toBe('granted');
    const [url] = (vi.mocked(fetch)).mock.calls[0];
    expect(url as string).toContain('/v1/consents/consent_001');
  });

  it('list() fetches /v1/consents/subject/:subjectId', async () => {
    stubFetchWith([CONSENT_FIXTURE]);
    const results = await sdk.consent.list('user_abc');
    expect(results).toHaveLength(1);
    const [url] = (vi.mocked(fetch)).mock.calls[0];
    expect(url as string).toContain('/v1/consents/subject/user_abc');
  });
});
