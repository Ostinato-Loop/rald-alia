// packages/sdk/src/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliaHttpClient } from '../../client';
import {
  AliaAuthError,
  AliaForbiddenError,
  AliaNotFoundError,
  AliaRateLimitError,
  AliaCountryNotOperationalError,
  AliaApiError,
  AliaNetworkError,
} from '../../errors';

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const headersMap = new Map(Object.entries(headers));
  return vi.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headersMap.get(k) ?? null },
    json:   () => Promise.resolve(body),
  });
}

describe('AliaHttpClient', () => {
  let client: AliaHttpClient;

  beforeEach(() => {
    client = new AliaHttpClient({ apiKey: 'rald_key_test_abc123', maxRetries: 1 });
  });

  it('sends Authorization header with the API key', async () => {
    const fetchMock = mockFetch(200, { success: true, data: { id: '1' } });
    vi.stubGlobal('fetch', fetchMock);

    await client.request({ path: '/v1/test' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer rald_key_test_abc123',
    });
  });

  it('returns data from a successful response', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { success: true, data: { alias: 'test' } }));
    const result = await client.request<{ alias: string }>({ path: '/v1/aliases/1' });
    expect(result).toEqual({ alias: 'test' });
  });

  it('throws AliaAuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'bad key' } }));
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaAuthError);
  });

  it('throws AliaForbiddenError on 403', async () => {
    vi.stubGlobal('fetch', mockFetch(403, { success: false, error: { code: 'FORBIDDEN', message: 'no scope' } }));
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaForbiddenError);
  });

  it('throws AliaNotFoundError on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { success: false, error: { code: 'NOT_FOUND', message: 'nope' } }));
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaNotFoundError);
  });

  it('throws AliaCountryNotOperationalError on 451', async () => {
    vi.stubGlobal('fetch', mockFetch(451, { success: false, error: { code: 'COUNTRY_NOT_OPERATIONAL', message: 'NG not live' } }));
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaCountryNotOperationalError);
  });

  it('throws AliaRateLimitError on 429 after exhausting retries', async () => {
    const fetchMock = mockFetch(429, { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } }, { 'Retry-After': '1' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaRateLimitError);
  });

  it('retries on 500 up to maxRetries and then throws AliaApiError', async () => {
    const fetchMock = mockFetch(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } });
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaApiError);
    // maxRetries=1 means 2 total attempts (initial + 1 retry)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AliaNetworkError on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(client.request({ path: '/v1/test' })).rejects.toBeInstanceOf(AliaNetworkError);
  });

  it('appends query parameters to the URL', async () => {
    const fetchMock = mockFetch(200, { success: true, data: [] });
    vi.stubGlobal('fetch', fetchMock);
    await client.request({ path: '/v1/trust', query: { tier: 'high', country: 'NG' } });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('tier=high');
    expect(url).toContain('country=NG');
  });

  it('sends POST with JSON body', async () => {
    const fetchMock = mockFetch(200, { success: true, data: { id: '1' } });
    vi.stubGlobal('fetch', fetchMock);
    await client.request({ method: 'POST', path: '/v1/aliases', body: { alias: 'test' } });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ alias: 'test' });
  });
});
