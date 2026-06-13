// packages/db/src/seed.ts
// Idempotent seed script for the ALIA platform.
// Runs every section in dependency order — safe to re-run against an existing DB.
//
// Usage:
//   ts-node packages/db/src/seed.ts
//   pnpm --filter @rald-alia/db run seed
//
// Requires: DATABASE_URL env var (or .env file in packages/db/)

import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb } from './client';

// ── Logger ─────────────────────────────────────────────────────────────────────

const log = {
  section: (title: string) => console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`),
  ok:      (msg: string)    => console.log(`  ✓  ${msg}`),
  skip:    (msg: string)    => console.log(`  –  ${msg} (already exists)`),
  warn:    (msg: string)    => console.log(`  ⚠  ${msg}`),
  key:     (msg: string)    => console.log(`\n  🔑  ${msg}\n`),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateTestKey(env: 'sandbox' | 'production'): { plainKey: string; keyHash: string; keyId: string } {
  const prefix   = env === 'production' ? 'rald_key_prod' : 'rald_key_test';
  const secret   = randomBytes(24).toString('hex');
  const plainKey = `${prefix}_${secret}`;
  const keyId    = `kid_seed_${randomBytes(6).toString('hex')}`;
  return { plainKey, keyHash: sha256(plainKey), keyId };
}

// Inserts a row only if it doesn't exist yet; returns whether it was inserted.
async function insertIfNew(db: ReturnType<typeof getDb>, table: string, id: string, values: Record<string, unknown>): Promise<boolean> {
  const cols = Object.keys(values);
  const vals = Object.values(values);
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const setClause    = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

  // Use INSERT … ON CONFLICT (id) DO NOTHING — idempotent
  const result = await db.execute(sql.raw(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING RETURNING id`,
    vals,
  ));

  return (result as any).rowCount > 0;
}

// ── Section 1: Country Governance ─────────────────────────────────────────────

async function seedCountries(db: ReturnType<typeof getDb>): Promise<void> {
  log.section('1 / 4  Country Governance');

  const countries = [
    // Live market
    { id: 'cgov_ng', country_code: 'NG', country_name: 'Nigeria',        status: 'INTERNAL', compliance_framework: 'NDPR',   max_aliases_per_user: 5, kyc_requirement_level: 2, allowed_alias_types: JSON.stringify(['phone','email','national_id','bvn']), sanction_list_enabled: true,  data_residency_required: true,  currency_code: 'NGN', daily_tx_limit_minor: 100_000_000, single_tx_limit_minor: 10_000_000 },
    // Pipeline markets
    { id: 'cgov_gh', country_code: 'GH', country_name: 'Ghana',          status: 'DISABLED', compliance_framework: 'DPA_GH', max_aliases_per_user: 3, kyc_requirement_level: 2, allowed_alias_types: JSON.stringify(['phone','email','national_id']),        sanction_list_enabled: true,  data_residency_required: false, currency_code: 'GHS', daily_tx_limit_minor: 50_000_000,  single_tx_limit_minor: 5_000_000  },
    { id: 'cgov_ke', country_code: 'KE', country_name: 'Kenya',          status: 'DISABLED', compliance_framework: 'DPA_KE', max_aliases_per_user: 3, kyc_requirement_level: 2, allowed_alias_types: JSON.stringify(['phone','email','national_id']),        sanction_list_enabled: true,  data_residency_required: false, currency_code: 'KES', daily_tx_limit_minor: 50_000_000,  single_tx_limit_minor: 5_000_000  },
    { id: 'cgov_za', country_code: 'ZA', country_name: 'South Africa',   status: 'DISABLED', compliance_framework: 'POPIA',  max_aliases_per_user: 3, kyc_requirement_level: 3, allowed_alias_types: JSON.stringify(['phone','email','national_id']),        sanction_list_enabled: true,  data_residency_required: true,  currency_code: 'ZAR', daily_tx_limit_minor: 50_000_000,  single_tx_limit_minor: 5_000_000  },
    { id: 'cgov_rw', country_code: 'RW', country_name: 'Rwanda',         status: 'DISABLED', compliance_framework: 'DPA_RW', max_aliases_per_user: 3, kyc_requirement_level: 1, allowed_alias_types: JSON.stringify(['phone','email']),                      sanction_list_enabled: true,  data_residency_required: false, currency_code: 'RWF', daily_tx_limit_minor: 30_000_000,  single_tx_limit_minor: 3_000_000  },
    { id: 'cgov_tz', country_code: 'TZ', country_name: 'Tanzania',       status: 'DISABLED', compliance_framework: 'NONE',   max_aliases_per_user: 3, kyc_requirement_level: 1, allowed_alias_types: JSON.stringify(['phone','email']),                      sanction_list_enabled: true,  data_residency_required: false, currency_code: 'TZS', daily_tx_limit_minor: 30_000_000,  single_tx_limit_minor: 3_000_000  },
    { id: 'cgov_ug', country_code: 'UG', country_name: 'Uganda',         status: 'DISABLED', compliance_framework: 'NONE',   max_aliases_per_user: 3, kyc_requirement_level: 1, allowed_alias_types: JSON.stringify(['phone','email']),                      sanction_list_enabled: true,  data_residency_required: false, currency_code: 'UGX', daily_tx_limit_minor: 30_000_000,  single_tx_limit_minor: 3_000_000  },
    { id: 'cgov_eg', country_code: 'EG', country_name: 'Egypt',          status: 'DISABLED', compliance_framework: 'NONE',   max_aliases_per_user: 3, kyc_requirement_level: 2, allowed_alias_types: JSON.stringify(['phone','email','national_id']),        sanction_list_enabled: true,  data_residency_required: true,  currency_code: 'EGP', daily_tx_limit_minor: 50_000_000,  single_tx_limit_minor: 5_000_000  },
    { id: 'cgov_sn', country_code: 'SN', country_name: 'Senegal',        status: 'DISABLED', compliance_framework: 'NONE',   max_aliases_per_user: 3, kyc_requirement_level: 1, allowed_alias_types: JSON.stringify(['phone','email']),                      sanction_list_enabled: true,  data_residency_required: false, currency_code: 'XOF', daily_tx_limit_minor: 30_000_000,  single_tx_limit_minor: 3_000_000  },
    { id: 'cgov_ci', country_code: 'CI', country_name: "Côte d'Ivoire",  status: 'DISABLED', compliance_framework: 'NONE',   max_aliases_per_user: 3, kyc_requirement_level: 1, allowed_alias_types: JSON.stringify(['phone','email']),                      sanction_list_enabled: true,  data_residency_required: false, currency_code: 'XOF', daily_tx_limit_minor: 30_000_000,  single_tx_limit_minor: 3_000_000  },
  ];

  for (const c of countries) {
    const inserted = await insertIfNew(db, 'country_governance', c.id, {
      id: c.id, country_code: c.country_code, country_name: c.country_name,
      status: c.status, compliance_framework: c.compliance_framework,
      max_aliases_per_user: c.max_aliases_per_user,
      kyc_requirement_level: c.kyc_requirement_level,
      allowed_alias_types: c.allowed_alias_types,
      sanction_list_enabled: c.sanction_list_enabled,
      data_residency_required: c.data_residency_required,
      currency_code: c.currency_code,
      daily_tx_limit_minor: c.daily_tx_limit_minor,
      single_tx_limit_minor: c.single_tx_limit_minor,
    });
    if (inserted) log.ok(`${c.country_code}  ${c.country_name}  [${c.status}]`);
    else          log.skip(`${c.country_code}  ${c.country_name}`);
  }

  // Opening audit event for NG
  await insertIfNew(db, 'country_governance_events', 'cge_ng_seed', {
    id: 'cge_ng_seed', country_code: 'NG',
    event_type: 'status_changed', from_status: 'DISABLED', to_status: 'INTERNAL',
    actor_type: 'system',
    metadata: JSON.stringify({ note: 'Initial seed — Nigeria enters INTERNAL for RALD platform testing' }),
  });
}

// ── Section 2: Machine Identities ─────────────────────────────────────────────

async function seedMachineIdentities(db: ReturnType<typeof getDb>): Promise<void> {
  log.section('2 / 4  Machine Identities');

  // placeholder hash — ops team rotates secrets on first boot
  const PH = (svc: string) => `$2b$12$PLACEHOLDER_${svc.toUpperCase().replace(/-/g, '_')}`;

  const identities = [
    { id: 'mach_registry',       service_name: 'registry-service',       display_name: 'ALIA Registry Service',      scopes: ['registry:read','registry:write'],                                                services: ['identity-service','trust-service','consent-service'] },
    { id: 'mach_consent',        service_name: 'consent-service',        display_name: 'ALIA Consent Service',        scopes: ['consent:read','consent:write'],                                                  services: ['identity-service','routing-service'] },
    { id: 'mach_trust',          service_name: 'trust-service',          display_name: 'ALIA Trust Service',          scopes: ['trust:read','trust:write','trust:signal'],                                       services: ['identity-service','fraud-service'] },
    { id: 'mach_merchant',       service_name: 'merchant-service',       display_name: 'ALIA Merchant Service',       scopes: ['merchant:read','merchant:write'],                                                services: ['identity-service','consent-service'] },
    { id: 'mach_governance',     service_name: 'governance-service',     display_name: 'ALIA Governance Service',     scopes: ['policy:read','policy:write','country:read','governance:countries:write'],        services: ['resolution-engine','routing-service','identity-service'] },
    { id: 'mach_resolution',     service_name: 'resolution-engine',      display_name: 'ALIA Resolution Engine',      scopes: ['alias:resolve','routing:token:issue','routing:token:verify'],                    services: ['routing-service','alias-service'] },
    { id: 'mach_verification',   service_name: 'verification-service',   display_name: 'ALIA Verification Service',   scopes: ['kyc:read','kyc:write'],                                                          services: ['identity-service','trust-service'] },
    { id: 'mach_fraud',          service_name: 'fraud-service',          display_name: 'ALIA Fraud Service',          scopes: ['fraud:read','fraud:write','fraud:signal'],                                       services: ['routing-service','resolution-engine','trust-service'] },
    { id: 'mach_developer',      service_name: 'developer-service',      display_name: 'ALIA Developer Service',      scopes: ['developers:read','developers:write','api_key:verify'],                           services: ['governance-service','registry-service','identity-service'] },
    { id: 'mach_institution',    service_name: 'institution-service',    display_name: 'ALIA Institution Service',    scopes: ['institution:read','institution:write'],                                          services: ['governance-service','registry-service'] },
    { id: 'mach_control_plane',  service_name: 'control-plane',          display_name: 'ALIA Control Plane',          scopes: ['control:health:read','control:network:read','control:countries:read','control:countries:write','control:developers:read','control:developers:write','control:institutions:read','developers:write','governance:countries:write','governance:countries:read','policy:read'], services: ['identity-service','trust-service','consent-service','merchant-service','resolution-engine','registry-service','verification-service','governance-service','developer-service','institution-service'] },
    { id: 'mach_payrald',        service_name: 'payrald-api',            display_name: 'PayRald Payment Gateway',     scopes: ['alias:resolve','routing:resolve','trust:read','consent:mandate:execute','fraud:signal'], services: [] },
  ];

  for (const m of identities) {
    const inserted = await insertIfNew(db, 'machine_identities', m.id, {
      id: m.id,
      service_name: m.service_name,
      display_name: m.display_name,
      client_secret_hash: PH(m.service_name),
      allowed_scopes: JSON.stringify(m.scopes),
      allowed_services: JSON.stringify(m.services),
      is_active: true,
      environment: 'production',
    });
    if (inserted) log.ok(`${m.service_name}`);
    else          log.skip(m.service_name);
  }

  // Sandbox variant for control-plane
  const inserted = await insertIfNew(db, 'machine_identities', 'mach_control_plane_sb', {
    id: 'mach_control_plane_sb',
    service_name: 'control-plane-sandbox',
    display_name: 'ALIA Control Plane (Sandbox)',
    client_secret_hash: PH('control-plane-sandbox'),
    allowed_scopes: JSON.stringify(['control:health:read','control:network:read','control:countries:read','control:countries:write','control:developers:read','control:developers:write','control:institutions:read','developers:write','governance:countries:write']),
    allowed_services: JSON.stringify(['identity-service','trust-service','consent-service','governance-service','developer-service','institution-service']),
    is_active: true,
    environment: 'sandbox',
  });
  if (inserted) log.ok('control-plane-sandbox');
  else          log.skip('control-plane-sandbox');

  log.warn('All client_secret_hash values are placeholders — rotate via machine-identity service before going live.');
}

// ── Section 3: Demo Developer Account ─────────────────────────────────────────

async function seedDeveloperDemo(db: ReturnType<typeof getDb>): Promise<void> {
  log.section('3 / 4  Demo Developer Account');

  const DEV_ID  = 'dev_demo_001';
  const PROJ_ID = 'proj_demo_001';

  // Developer
  const devInserted = await insertIfNew(db, 'developers', DEV_ID, {
    id:           DEV_ID,
    name:         'ALIA Demo Developer',
    email:        'demo@alia.dev',
    country:      'NG',
    status:       'active',
    kyc_verified: true,
    website:      'https://alia.dev',
    notes:        'Seed demo account — used for local development and CI testing',
    approved_by:  'system_seed',
    approved_at:  new Date().toISOString(),
  });
  if (devInserted) log.ok('Developer: demo@alia.dev  [active]');
  else             log.skip('Developer: demo@alia.dev');

  // Project
  const projInserted = await insertIfNew(db, 'developer_projects', PROJ_ID, {
    id:                     PROJ_ID,
    developer_id:           DEV_ID,
    name:                   'ALIA Demo App',
    description:            'Sandbox project auto-created by seed script',
    environment:            'sandbox',
    status:                 'active',
    country_permissions:    JSON.stringify(['NG']),
    institution_permissions: JSON.stringify([]),
    webhook_url:            null,
  });
  if (projInserted) log.ok('Project: "ALIA Demo App"  [sandbox]');
  else              log.skip('Project: "ALIA Demo App"');

  // API Key — generate a real key (plaintext shown once, hash stored)
  const KEY_ROW_ID = 'dak_demo_001';

  const existing = await db.execute(
    sql`SELECT id FROM developer_api_keys WHERE id = ${KEY_ROW_ID}`,
  );

  if ((existing as any).rowCount === 0) {
    const { plainKey, keyHash, keyId } = generateTestKey('sandbox');

    await db.execute(sql`
      INSERT INTO developer_api_keys
        (id, key_id, key_hash, project_id, developer_id, name, scopes,
         rate_limit_rpm, rate_limit_rpd, environment, status)
      VALUES
        (${KEY_ROW_ID}, ${keyId}, ${keyHash}, ${PROJ_ID}, ${DEV_ID},
         ${'Demo Sandbox Key'},
         ${JSON.stringify(['alias:resolve','alias:create','alias:read','identity:verify','trust:read','consent:grant','consent:read','routing:initiate','registry:read'])},
         ${60}, ${10000}, ${'sandbox'}, ${'active'})
    `);

    log.ok(`API key created for project demo:  key_id = ${keyId}`);
    log.key(`DEMO SANDBOX KEY (shown once — not stored in plaintext):\n\n      ${plainKey}\n`);
  } else {
    log.skip('Demo sandbox API key');
  }

  // Audit event
  if (devInserted) {
    await db.execute(sql`
      INSERT INTO developer_events (id, developer_id, event_type, actor_type, metadata)
      VALUES ('devt_demo_seed', ${DEV_ID}, 'developer.applied', 'system',
              ${{ note: 'Created by seed script' } as any}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

// ── Section 4: Verify schema integrity ────────────────────────────────────────

async function verifySchema(db: ReturnType<typeof getDb>): Promise<void> {
  log.section('4 / 4  Schema Integrity Check');

  const tables = [
    'country_governance', 'country_governance_events',
    'policy_violations', 'governance_routing_decisions', 'alias_resolution_log',
    'deletion_schedules', 'developer_webhook_logs',
    'machine_identities', 'machine_jwt_log',
    'financial_institutions', 'institution_licenses',
    'institution_routing_prefixes', 'institution_settlement_accounts', 'institution_events',
    'developers', 'developer_projects', 'developer_api_keys', 'developer_events',
    'control_plane_events',
  ];

  let allGood = true;
  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
      const n   = (res as any).rows?.[0]?.n ?? '?';
      log.ok(`${t.padEnd(40)} ${String(n).padStart(4)} rows`);
    } catch (err: any) {
      log.warn(`${t} — MISSING or error: ${err.message}`);
      allGood = false;
    }
  }

  if (!allGood) {
    console.log('\n  ⚠  Some tables are missing — run the migrations first:');
    console.log('     for f in packages/db/migrations/000*.sql; do psql $DATABASE_URL -f "$f"; done\n');
    process.exit(1);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         ALIA Platform — Database Seed Script                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Database: ${(process.env['DATABASE_URL'] ?? '(not set)').replace(/:\/\/.*@/, '://***@')}`);

  const db = getDb();

  try {
    await seedCountries(db);
    await seedMachineIdentities(db);
    await seedDeveloperDemo(db);
    await verifySchema(db);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✓  Seed complete — ALIA platform is ready for development  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n✗  Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
