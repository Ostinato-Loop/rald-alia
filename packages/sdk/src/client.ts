// packages/sdk/src/client.ts
// Base HTTP client — wraps fetch with auth, retries, rate-limit back-off, and typed errors.

import {
  AliaApiError,
  AliaAuthError,
  AliaCountryNotOperationalError,
  AliaForbiddenError,
  AliaNetworkError,
  AliaNotFoundError,
  AliaRateLimitError,
} from './errors';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path:    string;
  body?:   unknown;
  query?:  Record<string, string | number | boolean | undefined>;
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_BASE = 'https://api.alia.network';

export class AliaHttpClient {
  private readonly apiKey:     string;
  private readonly baseUrl:    string;
  private readonly timeoutMs:  number;
  private readonly maxRetries: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(opts: {
    apiKey:      string;
    baseUrl?:    string;
    timeoutMs?:  number;
    maxRetries?: number;
    headers?:    Record<string, string>;
  }) {
    this.apiKey       = opts.apiKey;
    this.baseUrl      = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.timeoutMs    = opts.timeoutMs  ?? 30_000;
    this.maxRetries   = opts.maxRetries ?? 2;
    this.extraHeaders = opts.headers    ?? {};
  }

  async request<T>(opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    let attempt = 0;

    while (true) {
      let res: Response;
      try {
        res = await this.fetch(url, opts);
      } catch (err) {
        throw new AliaNetworkError(`Network error: ${(err as Error).message}`, err);
      }

      if (res.ok) {
        const json = await res.json() as { success: true; data: T };
        return json.data;
      }

      // Rate limit — respect Retry-After header
      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get('Retry-After') ?? '1');
        const retryAfterMs  = retryAfterSec * 1000;
        const requestId     = res.headers.get('x-request-id') ?? undefined;
        if (attempt < this.maxRetries) {
          await sleep(retryAfterMs);
          attempt++;
          continue;
        }
        throw new AliaRateLimitError(retryAfterMs, requestId);
      }

      // 5xx — retry with exponential back-off
      if (RETRY_STATUS.has(res.status) && attempt < this.maxRetries) {
        await sleep(300 * Math.pow(2, attempt));
        attempt++;
        continue;
      }

      // Parse the error body and throw the appropriate typed error
      let errorBody: { success: false; error: { code: string; message: string } } | null = null;
      try { errorBody = await res.json() as any; } catch (_) {}

      const code       = errorBody?.error?.code    ?? 'UNKNOWN_ERROR';
      const message    = errorBody?.error?.message ?? res.statusText;
      const requestId  = res.headers.get('x-request-id') ?? undefined;

      if (res.status === 401) throw new AliaAuthError(message, requestId);
      if (res.status === 403) throw new AliaForbiddenError(message, requestId);
      if (res.status === 404) throw new AliaNotFoundError(message, requestId);
      if (res.status === 451) throw new AliaCountryNotOperationalError(message, requestId);

      throw new AliaApiError({ status: res.status, code, message, requestId });
    }
  }

  private fetch(url: string, opts: RequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    return fetch(url, {
      method:  opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    '@rald-alia/sdk/0.1.0',
        ...this.extraHeaders,
      },
      body:   opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const base = `${this.baseUrl}${path}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
