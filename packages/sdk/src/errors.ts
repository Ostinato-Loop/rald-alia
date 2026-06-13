// packages/sdk/src/errors.ts
// Typed error hierarchy for the ALIA SDK.

/** Base error class for all ALIA SDK errors. */
export class AliaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AliaError';
  }
}

/** The API returned a non-2xx response. Includes the parsed error body. */
export class AliaApiError extends AliaError {
  public readonly status:    number;
  public readonly code:      string;
  public readonly requestId: string | undefined;

  constructor(opts: { status: number; code: string; message: string; requestId?: string }) {
    super(opts.message);
    this.name      = 'AliaApiError';
    this.status    = opts.status;
    this.code      = opts.code;
    this.requestId = opts.requestId;
  }
}

/** The provided API key is invalid or has been revoked. */
export class AliaAuthError extends AliaApiError {
  constructor(message = 'Invalid or revoked API key', requestId?: string) {
    super({ status: 401, code: 'UNAUTHORIZED', message, requestId });
    this.name = 'AliaAuthError';
  }
}

/** The API key does not have the required scope for this operation. */
export class AliaForbiddenError extends AliaApiError {
  constructor(message = 'Insufficient scope for this operation', requestId?: string) {
    super({ status: 403, code: 'FORBIDDEN', message, requestId });
    this.name = 'AliaForbiddenError';
  }
}

/** The requested resource was not found. */
export class AliaNotFoundError extends AliaApiError {
  constructor(message = 'Resource not found', requestId?: string) {
    super({ status: 404, code: 'NOT_FOUND', message, requestId });
    this.name = 'AliaNotFoundError';
  }
}

/** The country is not yet operational on the ALIA network. */
export class AliaCountryNotOperationalError extends AliaApiError {
  constructor(country: string, requestId?: string) {
    super({ status: 451, code: 'COUNTRY_NOT_OPERATIONAL', message: `Country '${country}' is not yet operational on the ALIA network`, requestId });
    this.name = 'AliaCountryNotOperationalError';
  }
}

/** The API rate limit has been exceeded. */
export class AliaRateLimitError extends AliaApiError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number, requestId?: string) {
    super({ status: 429, code: 'RATE_LIMIT_EXCEEDED', message: `Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s`, requestId });
    this.name         = 'AliaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Network or fetch-level failure. */
export class AliaNetworkError extends AliaError {
  public readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name  = 'AliaNetworkError';
    this.cause = cause;
  }
}
