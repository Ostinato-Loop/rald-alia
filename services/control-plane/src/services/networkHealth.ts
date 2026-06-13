// services/control-plane/src/services/networkHealth.ts
// Aggregates /healthz checks from every ALIA service in parallel.
// Degrades gracefully — a service that doesn't respond is marked 'degraded'.

export interface ServiceHealth {
  service:      string;
  status:       'healthy' | 'degraded' | 'down';
  latency_ms:   number | null;
  version?:     string;
  checked_at:   string;
  error?:       string;
}

export interface NetworkStatus {
  overall:   'healthy' | 'degraded' | 'down';
  services:  ServiceHealth[];
  checked_at: string;
}

// All internal services and their base URLs (overridable via env).
const SERVICES: { name: string; envVar: string; defaultUrl: string }[] = [
  { name: 'identity-service',      envVar: 'IDENTITY_SERVICE_URL',      defaultUrl: 'http://identity-service:3001' },
  { name: 'trust-service',         envVar: 'TRUST_SERVICE_URL',         defaultUrl: 'http://trust-service:3002'    },
  { name: 'consent-service',       envVar: 'CONSENT_SERVICE_URL',       defaultUrl: 'http://consent-service:3003'  },
  { name: 'merchant-service',      envVar: 'MERCHANT_SERVICE_URL',      defaultUrl: 'http://merchant-service:3004' },
  { name: 'resolution-engine',     envVar: 'RESOLUTION_ENGINE_URL',     defaultUrl: 'http://resolution-engine:3005'},
  { name: 'registry-service',      envVar: 'REGISTRY_SERVICE_URL',      defaultUrl: 'http://registry-service:3006' },
  { name: 'verification-service',  envVar: 'VERIFICATION_SERVICE_URL',  defaultUrl: 'http://verification-service:3007' },
  { name: 'governance-service',    envVar: 'GOVERNANCE_SERVICE_URL',    defaultUrl: 'http://governance-service:3008' },
  { name: 'developer-service',     envVar: 'DEVELOPER_SERVICE_URL',     defaultUrl: 'http://developer-service:3009' },
  { name: 'institution-service',   envVar: 'INSTITUTION_SERVICE_URL',   defaultUrl: 'http://institution-service:3010' },
];

const HEALTH_TIMEOUT_MS = 5_000;

async function checkService(name: string, baseUrl: string): Promise<ServiceHealth> {
  const start = Date.now();
  const now   = new Date().toISOString();
  const url   = `${baseUrl}/healthz`;

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res        = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const latency_ms = Date.now() - start;

    if (!res.ok) {
      return { service: name, status: 'degraded', latency_ms, checked_at: now, error: `HTTP ${res.status}` };
    }

    const body = await res.json() as { version?: string };
    return { service: name, status: 'healthy', latency_ms, version: body.version, checked_at: now };
  } catch (err: any) {
    const latency_ms = Date.now() - start;
    const isTimeout  = err.name === 'AbortError';
    return {
      service:    name,
      status:     'down',
      latency_ms: isTimeout ? HEALTH_TIMEOUT_MS : latency_ms,
      checked_at: now,
      error:      isTimeout ? 'Timeout' : err.message,
    };
  }
}

export class NetworkHealthService {
  async check(): Promise<NetworkStatus> {
    const checks = SERVICES.map(({ name, envVar, defaultUrl }) => {
      const url = process.env[envVar] ?? defaultUrl;
      return checkService(name, url);
    });

    const services = await Promise.all(checks);
    const now      = new Date().toISOString();

    const downCount     = services.filter((s) => s.status === 'down').length;
    const degradedCount = services.filter((s) => s.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'down';
    if (downCount >= Math.ceil(services.length / 2)) overall = 'down';
    else if (downCount > 0 || degradedCount > 0)     overall = 'degraded';
    else                                             overall = 'healthy';

    return { overall, services, checked_at: now };
  }

  async checkService(serviceName: string): Promise<ServiceHealth | null> {
    const svc = SERVICES.find((s) => s.name === serviceName);
    if (!svc) return null;
    const url = process.env[svc.envVar] ?? svc.defaultUrl;
    return checkService(serviceName, url);
  }
}
