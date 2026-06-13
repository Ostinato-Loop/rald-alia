#!/usr/bin/env tsx
// RALD ALIA — Provision Machine Identities
// Creates a machine_identities DB record for every ALIA service.
// Run ONCE per environment after first deploy:
//   pnpm --filter @rald-alia/db exec tsx scripts/provision-machine-identities.ts
//
// Output: prints a .env.machine-secrets file with the plaintext secrets.
// Store those secrets in AWS Secrets Manager, then discard the output.

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@rald-alia/db';
import { machineIdentities } from '@rald-alia/db';
import { eq } from 'drizzle-orm';

const ENVIRONMENT = process.env['NODE_ENV'] === 'production' ? 'production'
  : process.env['NODE_ENV'] === 'staging' ? 'staging'
  : 'development';

// ── Service definitions ────────────────────────────────────────────────────────

interface ServiceDef {
  service_name:     string;
  allowed_scopes:   string[];
  allowed_services: string[];
}

const SERVICES: ServiceDef[] = [
  {
    service_name:     'identity-service',
    allowed_scopes:   ['machine:read', 'machine:write', 'identity:read', 'identity:write', 'audit:write'],
    allowed_services: ['*'],
  },
  {
    service_name:     'alias-service',
    allowed_scopes:   ['machine:read', 'alias:read', 'alias:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['resolution-engine', 'directory-service', 'gateway', 'identity-service'],
  },
  {
    service_name:     'directory-service',
    allowed_scopes:   ['machine:read', 'directory:read', 'alias:read'],
    allowed_services: ['resolution-engine', 'gateway', 'rald-routing'],
  },
  {
    service_name:     'resolution-engine',
    allowed_scopes:   ['machine:read', 'resolution:resolve', 'trust:read', 'consent:read', 'routing:read', 'audit:write', 'kafka:publish'],
    allowed_services: ['gateway', 'rald-routing', 'institution-service'],
  },
  {
    service_name:     'routing-service',
    allowed_scopes:   ['machine:read', 'routing:read', 'routing:write', 'audit:write'],
    allowed_services: ['resolution-engine', 'gateway', 'institution-service'],
  },
  {
    service_name:     'fraud-service',
    allowed_scopes:   ['machine:read', 'fraud:read', 'fraud:write', 'trust:read', 'kafka:publish', 'audit:write'],
    allowed_services: ['resolution-engine', 'identity-service', 'governance-service'],
  },
  {
    service_name:     'audit-service',
    allowed_scopes:   ['machine:read', 'audit:read', 'audit:write'],
    allowed_services: ['*'],
  },
  {
    service_name:     'notification-service',
    allowed_scopes:   ['machine:read', 'notification:send', 'kafka:consume'],
    allowed_services: ['identity-service', 'verification-service', 'consent-service'],
  },
  {
    service_name:     'governance-service',
    allowed_scopes:   ['machine:read', 'governance:read', 'governance:write', 'compliance:check', 'audit:write', 'kafka:publish'],
    allowed_services: ['*'],
  },
  {
    service_name:     'consent-service',
    allowed_scopes:   ['machine:read', 'consent:read', 'consent:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['resolution-engine', 'gateway', 'rald-routing', 'identity-service'],
  },
  {
    service_name:     'trust-service',
    allowed_scopes:   ['machine:read', 'trust:read', 'trust:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['resolution-engine', 'fraud-service', 'governance-service', 'identity-service'],
  },
  {
    service_name:     'merchant-service',
    allowed_scopes:   ['machine:read', 'merchant:read', 'merchant:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['gateway', 'identity-service', 'registry-service'],
  },
  {
    service_name:     'verification-service',
    allowed_scopes:   ['machine:read', 'verification:read', 'verification:write', 'trust:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['identity-service', 'governance-service', 'trust-service'],
  },
  {
    service_name:     'institution-service',
    allowed_scopes:   ['machine:read', 'institution:read', 'institution:write', 'routing:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['resolution-engine', 'registry-service', 'governance-service'],
  },
  {
    service_name:     'registry-service',
    allowed_scopes:   ['machine:read', 'registry:read', 'registry:write', 'audit:write', 'kafka:publish'],
    allowed_services: ['identity-service', 'institution-service', 'merchant-service', 'governance-service'],
  },
  {
    service_name:     'gateway',
    allowed_scopes:   ['machine:read', 'gateway:proxy'],
    allowed_services: ['*'],
  },
  {
    service_name:     'developer-service',
    allowed_scopes:   ['machine:read', 'developer:read', 'developer:write', 'audit:write'],
    allowed_services: ['gateway', 'identity-service', 'registry-service'],
  },
  {
    service_name:     'control-plane',
    allowed_scopes:   ['machine:read', 'machine:write', 'control:read', 'control:write', 'audit:write'],
    allowed_services: ['*'],
  },
  // Edge services (non-Node.js — get a token for manual/Cloudflare setup)
  {
    service_name:     'rald-routing',
    allowed_scopes:   ['machine:read', 'resolution:resolve', 'directory:read', 'consent:read'],
    allowed_services: ['resolution-engine', 'directory-service', 'consent-service'],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = getDb();
  const secrets: Record<string, string> = {};
  const results: Array<{ service: string; id: string; status: 'created' | 'skipped' }> = [];

  console.log(`\nProvisioning ${SERVICES.length} machine identities for environment: ${ENVIRONMENT}\n`);

  for (const svc of SERVICES) {
    // Check if already provisioned
    const [existing] = await db
      .select({ id: machineIdentities.id })
      .from(machineIdentities)
      .where(eq(machineIdentities.serviceName, svc.service_name))
      .limit(1);

    if (existing) {
      console.log(`  SKIP  ${svc.service_name} (already provisioned: ${existing.id})`);
      results.push({ service: svc.service_name, id: existing.id, status: 'skipped' });
      continue;
    }

    // Generate a 32-byte random client secret
    const clientSecret = randomBytes(32).toString('hex');
    const clientSecretHash = await bcrypt.hash(clientSecret, 12);
    const id = uuidv4();

    await db.insert(machineIdentities).values({
      id,
      serviceName:      svc.service_name,
      clientSecretHash,
      allowedScopes:    svc.allowed_scopes,
      allowedServices:  svc.allowed_services,
      environment:      ENVIRONMENT,
      isActive:         true,
      authCount:        BigInt(0),
      createdAt:        new Date(),
      updatedAt:        new Date(),
    });

    secrets[svc.service_name] = clientSecret;
    results.push({ service: svc.service_name, id, status: 'created' });
    console.log(`  ✓     ${svc.service_name} (${id})`);
  }

  // Write secrets file
  const envLines = [
    `# ALIA Machine Identity Secrets — ${ENVIRONMENT}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Store each secret in AWS Secrets Manager at alia-${ENVIRONMENT}/<service-name>/machine-client-secret`,
    `# NEVER commit this file. Delete it after storing secrets.`,
    ``,
    ...Object.entries(secrets).map(([svc, secret]) =>
      `MACHINE_CLIENT_SECRET_${svc.toUpperCase().replace(/-/g, '_')}=${secret}`
    ),
  ].join('\n');

  const outFile = `.env.machine-secrets.${ENVIRONMENT}`;
  fs.writeFileSync(outFile, envLines, 'utf8');

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Done: ${created} created, ${skipped} skipped`);
  console.log(`Secrets written to: ${outFile}`);
  console.log(``);
  console.log(`Next steps:`);
  console.log(`  1. For each service, store its secret in AWS Secrets Manager:`);
  console.log(`     aws secretsmanager put-secret-value \\`);
  console.log(`       --secret-id alia-${ENVIRONMENT}/identity-service/machine-client-secret \\`);
  console.log(`       --secret-string "<secret from ${outFile}>"`);
  console.log(``);
  console.log(`  2. Add to each service's ECS task definition env vars:`);
  console.log(`     MACHINE_SERVICE_NAME  = <service-name>`);
  console.log(`     MACHINE_CLIENT_SECRET = <from Secrets Manager>`);
  console.log(``);
  console.log(`  3. Delete ${outFile} — it has served its purpose.`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Provision failed:', err);
  process.exit(1);
});
