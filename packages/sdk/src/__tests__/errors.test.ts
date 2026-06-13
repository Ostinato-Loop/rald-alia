// packages/sdk/src/__tests__/errors.test.ts
import { describe, it, expect } from 'vitest';
import {
  AliaError,
  AliaApiError,
  AliaAuthError,
  AliaForbiddenError,
  AliaNotFoundError,
  AliaCountryNotOperationalError,
  AliaRateLimitError,
  AliaNetworkError,
} from '../../errors';

describe('AliaError', () => {
  it('is an instance of Error', () => {
    const err = new AliaError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AliaError');
    expect(err.message).toBe('test');
  });
});

describe('AliaApiError', () => {
  it('stores status, code, and requestId', () => {
    const err = new AliaApiError({ status: 400, code: 'BAD_REQUEST', message: 'oops', requestId: 'req_123' });
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.requestId).toBe('req_123');
    expect(err.name).toBe('AliaApiError');
  });

  it('requestId is optional', () => {
    const err = new AliaApiError({ status: 400, code: 'X', message: 'y' });
    expect(err.requestId).toBeUndefined();
  });
});

describe('AliaAuthError', () => {
  it('has status 401 and code UNAUTHORIZED', () => {
    const err = new AliaAuthError();
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.name).toBe('AliaAuthError');
    expect(err).toBeInstanceOf(AliaApiError);
  });

  it('accepts custom message and requestId', () => {
    const err = new AliaAuthError('custom msg', 'req_abc');
    expect(err.message).toBe('custom msg');
    expect(err.requestId).toBe('req_abc');
  });
});

describe('AliaForbiddenError', () => {
  it('has status 403 and code FORBIDDEN', () => {
    const err = new AliaForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('AliaNotFoundError', () => {
  it('has status 404 and code NOT_FOUND', () => {
    const err = new AliaNotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('AliaCountryNotOperationalError', () => {
  it('embeds the country name in the message', () => {
    const err = new AliaCountryNotOperationalError('NG');
    expect(err.status).toBe(451);
    expect(err.code).toBe('COUNTRY_NOT_OPERATIONAL');
    expect(err.message).toContain('NG');
  });
});

describe('AliaRateLimitError', () => {
  it('stores retryAfterMs and has status 429', () => {
    const err = new AliaRateLimitError(5000);
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfterMs).toBe(5000);
    expect(err.message).toContain('5s');
  });
});

describe('AliaNetworkError', () => {
  it('stores the original cause', () => {
    const cause = new TypeError('Failed to fetch');
    const err   = new AliaNetworkError('Network error: Failed to fetch', cause);
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('AliaNetworkError');
    expect(err).toBeInstanceOf(AliaError);
  });
});
