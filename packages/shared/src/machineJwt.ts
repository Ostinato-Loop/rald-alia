// ALIA Machine Identity JWT
// Service-to-service authentication. Replaces X-Internal-Secret shared secret.
//
// Flow:
//   1. Service starts → calls POST /v1/machine/auth with { service_name, client_secret }
//   2. identity-service validates, issues machineJwt (24h TTL)
//   3. Service includes: Authorization: Bearer <machineJwt> on all internal API calls
//   4. Receiving service verifies machineJwt via verifyMachineJwt()
//   5. At 24h - 1h: service rotates automatically
//
// Machine JWT payload is distinguishable from user JWT by { type: 'machine' }.

import jwt from 'jsonwebtoken';

const MACHINE_JWT_SECRET = process.env['MACHINE_JWT_SECRET'];
const MACHINE_JWT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface MachineJwtPayload {
  sub:              string;    // machine_id
  type:             'machine';
  service_name:     string;
  allowed_scopes:   string[];
  allowed_services: string[];
  environment:      string;
}

export interface MachineJwtClaims extends MachineJwtPayload {
  iat: number;
  exp: number;
  iss: string;
}

export function requireMachineJwtSecret(): string {
  if (!MACHINE_JWT_SECRET) {
    console.error('[ALIA] FATAL: MACHINE_JWT_SECRET is not set. Cannot issue machine tokens.');
    process.exit(1);
  }
  return MACHINE_JWT_SECRET;
}

export function signMachineJwt(payload: MachineJwtPayload): string {
  const secret = requireMachineJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: MACHINE_JWT_TTL_SECONDS,
    issuer:    'alia-identity-service',
    algorithm: 'HS256',
  });
}

export function verifyMachineJwt(token: string): MachineJwtClaims {
  const secret = requireMachineJwtSecret();
  try {
    const claims = jwt.verify(token, secret, {
      issuer:    'alia-identity-service',
      algorithms: ['HS256'],
    }) as MachineJwtClaims;

    if (claims.type !== 'machine') {
      throw Object.assign(new Error('Token is not a machine JWT'), { code: 'NOT_MACHINE_TOKEN' });
    }
    return claims;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'NOT_MACHINE_TOKEN') throw err;
    const message = err instanceof jwt.TokenExpiredError
      ? 'Machine JWT expired — service must rotate credentials'
      : 'Invalid machine JWT';
    throw Object.assign(new Error(message), {
      status: 401,
      code:   err instanceof jwt.TokenExpiredError ? 'MACHINE_TOKEN_EXPIRED' : 'MACHINE_TOKEN_INVALID',
    });
  }
}

export function machineJwtExpiresInMs(claims: MachineJwtClaims): number {
  return claims.exp * 1000 - Date.now();
}

export function shouldRotate(claims: MachineJwtClaims): boolean {
  // Rotate when < 1 hour remaining
  return machineJwtExpiresInMs(claims) < 60 * 60 * 1000;
}
