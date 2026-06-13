// ALIA Routing Token
// Replaces raw account_token in resolution responses.
//
// Flow:
//   1. POST /v1/resolve → returns signed routingJwt (60s TTL)
//      Payload: { destinationBankCode, destinationBankName, accountName, transactionRef, resolvedAt }
//      Does NOT contain accountToken — that stays server-side.
//
//   2. Institution calls POST /v1/resolve/verify with routingJwt
//      Response: { accountToken, accountName, destinationBankCode }
//      Only valid for 60s. Only callable with a valid machine JWT (institution scope).
//
// This prevents accountToken from ever appearing in a public API response.

import jwt from 'jsonwebtoken';

const ROUTING_JWT_SECRET = process.env['ROUTING_JWT_SECRET'];
const ROUTING_TOKEN_TTL_SECONDS = 60;

export interface RoutingTokenPayload {
  // Resolution context
  resolution_id:        string;
  transaction_ref:      string;
  // Destination (safe to expose — no account credentials)
  destination_bank_code: string;
  destination_bank_name: string;
  account_name:          string;
  // Initiator context
  initiating_bank:      string;
  // Server-side reference (used to retrieve accountToken on verify)
  resolution_cache_key: string;
  resolved_at:          string;
}

export interface RoutingTokenClaims extends RoutingTokenPayload {
  iat: number;
  exp: number;
  iss: string;
}

export function requireRoutingJwtSecret(): string {
  if (!ROUTING_JWT_SECRET) {
    console.error('[ALIA] FATAL: ROUTING_JWT_SECRET is not set. Cannot issue routing tokens.');
    process.exit(1);
  }
  return ROUTING_JWT_SECRET;
}

export function signRoutingToken(payload: RoutingTokenPayload): string {
  const secret = requireRoutingJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: ROUTING_TOKEN_TTL_SECONDS,
    issuer:    'alia-resolution-engine',
    algorithm: 'HS256',
  });
}

export function verifyRoutingToken(token: string): RoutingTokenClaims {
  const secret = requireRoutingJwtSecret();
  try {
    return jwt.verify(token, secret, {
      issuer:    'alia-resolution-engine',
      algorithms: ['HS256'],
    }) as RoutingTokenClaims;
  } catch (err: unknown) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Routing token expired — tokens are valid for 60 seconds only'
      : 'Invalid routing token';
    throw Object.assign(new Error(message), {
      status: 401,
      code:   err instanceof jwt.TokenExpiredError ? 'ROUTING_TOKEN_EXPIRED' : 'ROUTING_TOKEN_INVALID',
    });
  }
}
