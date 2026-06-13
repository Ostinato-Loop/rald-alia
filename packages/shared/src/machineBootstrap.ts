// ALIA Machine Bootstrap
// Every ALIA service calls MachineBootstrap.init() on startup.
// Handles: initial JWT acquisition, in-memory caching, auto-rotation.
//
// Usage (in your service's index.ts):
//   import { MachineBootstrap } from '@rald-alia/shared/machineBootstrap';
//   await MachineBootstrap.init();
//   // ... start Express server ...
//
// Then in any outbound service-to-service call:
//   const token = MachineBootstrap.getToken();
//   fetch(url, { headers: { Authorization: `Bearer ${token}` } })

import { shouldRotate, type MachineJwtClaims } from './machineJwt';

const IDENTITY_SERVICE_URL = process.env['IDENTITY_SERVICE_URL'] ?? 'http://identity-service:3001';
const MACHINE_SERVICE_NAME = process.env['MACHINE_SERVICE_NAME'];
const MACHINE_CLIENT_SECRET = process.env['MACHINE_CLIENT_SECRET'];

// Retry config
const MAX_BOOT_RETRIES = 10;
const BOOT_RETRY_DELAY_MS = 3_000;

// Rotation check interval: every 10 minutes
const ROTATION_INTERVAL_MS = 10 * 60 * 1000;

interface MachineAuthResponse {
  success: boolean;
  data: {
    token:           string;
    expires_at:      string;
    expires_in:      number;
    service_name:    string;
    allowed_scopes:  string[];
    rotate_before:   string;
  };
}

class _MachineBootstrap {
  private token:   string | null = null;
  private claims:  MachineJwtClaims | null = null;
  private rotTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.assertEnv();
    await this.acquireWithRetry();

    // Schedule rotation checks every 10 minutes
    this.rotTimer = setInterval(() => {
      void this.maybeRotate();
    }, ROTATION_INTERVAL_MS);

    // Unref so the timer doesn't prevent process exit
    if (this.rotTimer.unref) this.rotTimer.unref();

    this.initialized = true;
    console.info(`[machine] ✓ ${MACHINE_SERVICE_NAME} authenticated — expires ${this.claims!.exp ? new Date(this.claims!.exp * 1000).toISOString() : 'unknown'}`);
  }

  /** Returns the current machine JWT. Throws if not initialised. */
  getToken(): string {
    if (!this.token) {
      throw new Error('[machine] MachineBootstrap.init() must be called before getToken()');
    }
    return this.token;
  }

  getClaims(): MachineJwtClaims {
    if (!this.claims) throw new Error('[machine] Not initialised');
    return this.claims;
  }

  private assertEnv(): void {
    const missing: string[] = [];
    if (!MACHINE_SERVICE_NAME)  missing.push('MACHINE_SERVICE_NAME');
    if (!MACHINE_CLIENT_SECRET) missing.push('MACHINE_CLIENT_SECRET');
    if (missing.length) {
      console.error(`[machine] FATAL: missing env vars: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  private async acquireWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_BOOT_RETRIES; attempt++) {
      try {
        await this.acquire();
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === MAX_BOOT_RETRIES) {
          console.error(`[machine] FATAL: failed to acquire machine JWT after ${MAX_BOOT_RETRIES} attempts: ${msg}`);
          process.exit(1);
        }
        console.warn(`[machine] attempt ${attempt}/${MAX_BOOT_RETRIES} failed: ${msg} — retrying in ${BOOT_RETRY_DELAY_MS}ms`);
        await sleep(BOOT_RETRY_DELAY_MS);
      }
    }
  }

  private async acquire(): Promise<void> {
    const res = await fetch(`${IDENTITY_SERVICE_URL}/v1/machine/auth`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        service_name:  MACHINE_SERVICE_NAME,
        client_secret: MACHINE_CLIENT_SECRET,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`identity-service responded ${res.status}: ${body.slice(0, 200)}`);
    }

    const { success, data } = (await res.json()) as MachineAuthResponse;
    if (!success || !data?.token) {
      throw new Error('identity-service returned success:false or missing token');
    }

    // Decode claims without verifying (we trust identity-service here;
    // actual cryptographic verification is done by the *receiving* service)
    const parts = data.token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token from identity-service');
    const decoded = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8')
    ) as MachineJwtClaims;

    this.token  = data.token;
    this.claims = decoded;
  }

  private async maybeRotate(): Promise<void> {
    if (!this.claims || !shouldRotate(this.claims)) return;
    console.info('[machine] rotating machine JWT (< 1h remaining)…');
    try {
      await this.acquireWithRetry();
      console.info('[machine] ✓ rotated successfully');
    } catch (err) {
      console.error('[machine] rotation failed:', err);
      // Non-fatal: will retry on the next interval tick
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const MachineBootstrap = new _MachineBootstrap();
