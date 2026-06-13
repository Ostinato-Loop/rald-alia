// packages/sdk/src/__tests__/modules/routing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliaSDK } from '../../../AliaSDK';
import type { RoutingRequest } from '../../../types';

const ROUTING_FIXTURE: RoutingRequest = {
  id:                'route_001',
  source_alias:      '+2348012345678',
  destination_alias: '+2349087654321',
  amount_minor:      500_000,
  currency:          'NGN',
  status:            'initiated',
  reference:         'REF_001',
  narration:         'Invoice payment',
  initiated_at:      '2026-01-01T00:00:00.000Z',
};

function stubFetchWith(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:      true,
    status:  200,
    headers: { get: () => null },
    json:    () => Promise.resolve({ success: true, data }),
  }));
}

describe('RoutingClient', () => {
  let sdk: AliaSDK;

  beforeEach(() => {
    sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
  });

  it('initiate() posts to /v1/routing with all params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ success: true, data: ROUTING_FIXTURE }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sdk.routing.initiate({
      source_alias:      '+2348012345678',
      destination_alias: '+2349087654321',
      amount_minor:      500_000,
      currency:          'NGN',
      narration:         'Invoice payment',
      idempotency_key:   'idem_abc123',
    });

    expect(result.id).toBe('route_001');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url as string).toContain('/v1/routing');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.idempotency_key).toBe('idem_abc123');
    expect(body.amount_minor).toBe(500_000);
  });

  it('get() fetches /v1/routing/:id', async () => {
    stubFetchWith({ ...ROUTING_FIXTURE, status: 'settled' });
    const result = await sdk.routing.get('route_001');
    expect(result.status).toBe('settled');
    const [url] = (vi.mocked(fetch)).mock.calls[0];
    expect(url as string).toContain('/v1/routing/route_001');
  });
});
