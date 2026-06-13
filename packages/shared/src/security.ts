// packages/shared/src/security.ts
// Shared security middleware factories for all ALIA services.
// Drop-in replacements for bare helmet()/cors()/rateLimit() calls.
//
// Usage in any service app.ts:
//   import { tightHelmet, internalCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
//   app.use(tightHelmet());
//   app.use(internalCors());                        // for internal services
//   app.use(createRateLimiter(RateTier.STANDARD));  // global limit

import helmet from 'helmet';
import cors, { type CorsOptions } from 'cors';
import { rateLimit, type Options as RateLimitOptions } from 'express-rate-limit';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ── Helmet — tightened for API services ──────────────────────────────────────
//
// APIs never serve HTML, so we disable browser-specific directives that add
// noise without benefit and enable the ones that matter for REST services.

export function tightHelmet(): RequestHandler {
  return helmet({
    // HSTS: 1 year, include subdomains, enable preload
    hsts: {
      maxAge:            31_536_000,
      includeSubDomains: true,
      preload:           true,
    },
    // No X-Powered-By (never expose framework info)
    hidePoweredBy:      true,
    // No MIME sniffing
    noSniff:            true,
    // Clickjacking protection (not that APIs are embedded, but defence-in-depth)
    frameguard:         { action: 'deny' },
    // XSS filter (legacy browsers)
    xXssProtection:     true,
    // DNS prefetch off — APIs don't serve pages
    dnsPrefetchControl: { allow: false },
    // Referrer policy — no origin leaked in outbound calls from API responses
    referrerPolicy:     { policy: 'no-referrer' },
    // CSP: API services return JSON, not HTML.
    // Allow no content at all — if something tries to render this as a page,
    // block everything. Prevents reflected XSS in edge cases.
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'none'"],
        scriptSrc:   ["'none'"],
        styleSrc:    ["'none'"],
        imgSrc:      ["'none'"],
        connectSrc:  ["'none'"],
        fontSrc:     ["'none'"],
        objectSrc:   ["'none'"],
        mediaSrc:    ["'none'"],
        frameSrc:    ["'none'"],
      },
    },
    // Permissions policy — explicitly deny all browser features
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}

// ── CORS — two flavours ───────────────────────────────────────────────────────

/** Internal services — only reachable within the ALIA VPC / service mesh.
 *  No browser clients ever hit these directly. Lock CORS to internal origins. */
export function internalCors(): RequestHandler {
  const allowed = new Set<string>(
    (process.env['CORS_INTERNAL_ORIGINS'] ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  );

  const opts: CorsOptions = {
    origin: (origin, cb) => {
      // Same-origin and no-origin (server-to-server) always allowed
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      // Reject everything else
      cb(Object.assign(new Error(`CORS: origin not allowed: ${origin}`), { status: 403 }));
    },
    credentials:      false,
    allowedHeaders:   ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Machine-Service'],
    exposedHeaders:   ['X-Request-Id'],
    methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge:           600,
    optionsSuccessStatus: 204,
  };
  return cors(opts);
}

/** Public/developer-facing services — gateway, developer-service, auth endpoints.
 *  Allow configurable origins; defaults to the RALD cloud domain. */
export function publicCors(extraOrigins: string[] = []): RequestHandler {
  const defaultOrigins = [
    'https://rald.cloud',
    'https://console.rald.cloud',
    'https://developers.rald.cloud',
    'https://app.rald.cloud',
  ];

  const envOrigins = (process.env['CORS_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const allowed = new Set<string>([...defaultOrigins, ...extraOrigins, ...envOrigins]);

  const opts: CorsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server
      if (process.env['NODE_ENV'] === 'development') return cb(null, true); // local dev
      if (allowed.has(origin)) return cb(null, true);
      cb(Object.assign(new Error(`CORS: origin not allowed: ${origin}`), { status: 403 }));
    },
    credentials:      true,
    allowedHeaders:   ['Content-Type', 'Authorization', 'X-Request-Id', 'X-API-Key'],
    exposedHeaders:   ['X-Request-Id', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge:           3600,
    optionsSuccessStatus: 204,
  };
  return cors(opts);
}

// ── Rate limiters ─────────────────────────────────────────────────────────────

export const RateTier = {
  /** Unauthenticated public endpoints: 30 req/min */
  PUBLIC:     { windowMs: 60_000, max: 30  },
  /** Standard authenticated endpoints: 120 req/min */
  STANDARD:   { windowMs: 60_000, max: 120 },
  /** High-traffic read endpoints: 300 req/min */
  HIGH:       { windowMs: 60_000, max: 300 },
  /** Sensitive write operations (e.g. alias create, KYC submit): 10 req/min */
  STRICT:     { windowMs: 60_000, max: 10  },
  /** Auth endpoints (login, OTP): 5 req/min */
  AUTH:       { windowMs: 60_000, max: 5   },
  /** Admin/internal machine-to-machine: 600 req/min */
  MACHINE:    { windowMs: 60_000, max: 600 },
} as const;

export type RateTierConfig = typeof RateTier[keyof typeof RateTier];

export function createRateLimiter(
  tier: RateTierConfig,
  overrides: Partial<RateLimitOptions> = {},
): RequestHandler {
  return rateLimit({
    windowMs:        tier.windowMs,
    max:             tier.max,
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
    message:         { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests — slow down' } },
    skipFailedRequests: false,
    keyGenerator: (req) => {
      // Prefer forwarded IP (behind ALB/proxy); fall back to socket address
      return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.socket?.remoteAddress ??
        'unknown'
      );
    },
    ...overrides,
  });
}

// ── No-cache for sensitive responses ─────────────────────────────────────────
/** Attach to routes returning PII or secrets (API key creation, KYC, trust scores) */
export function noCache(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma',        'no-cache');
    res.setHeader('Expires',       '0');
    next();
  };
}

// ── Security headers audit ────────────────────────────────────────────────────
/** Log a one-time warning if running without HTTPS in production */
export function assertHttps(): void {
  if (process.env['NODE_ENV'] === 'production' && process.env['TRUST_PROXY'] !== '1') {
    process.stderr.write(
      '[security] WARNING: NODE_ENV=production but TRUST_PROXY is not set. ' +
      'Set TRUST_PROXY=1 if behind an ALB/proxy so rate-limiting and IP detection work correctly.\n',
    );
  }
}
