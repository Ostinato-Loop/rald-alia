-- ALIA Platform — Migration 0009: Schema Fixes + Webhook Delivery Logs
-- Resolves schema/migration mismatches and adds missing tables.
--
-- Changes:
--   1. Rename routing_decisions → governance_routing_decisions (governance layer)
--   2. Create alias_resolution_log (detailed per-alias resolution audit)
--   3. Create developer_webhook_logs (webhook delivery tracking for M7/M9)
--   4. Add missing machine identity seeds for remaining ALIA services
--   5. Fix policy_violations schema to match design intent
--   6. Add missing index on institution_routing_prefixes (active filter)
--
-- Apply with: psql $DATABASE_URL -f 0009_fixes_and_webhook_logs.sql

-- ─────────────────────────────────────────────
-- 1. ROUTING DECISIONS — governance layer rename
--    The original routing_decisions table (from migration 0006) tracks
--    compliance routing decisions (source_country → destination_country → decision).
--    Rename to avoid confusion with alias resolution tracking.
-- ─────────────────────────────────────────────

ALTER TABLE IF EXISTS routing_decisions
  RENAME TO governance_routing_decisions;

-- Re-create indexes under new name (old ones dropped with table rename in PG)
CREATE INDEX IF NOT EXISTS grd_source_idx      ON governance_routing_decisions(source_country);
CREATE INDEX IF NOT EXISTS grd_dest_idx        ON governance_routing_decisions(destination_country);
CREATE INDEX IF NOT EXISTS grd_decision_idx    ON governance_routing_decisions(decision);
CREATE INDEX IF NOT EXISTS grd_time_idx        ON governance_routing_decisions(created_at);

-- Drop old index names if they persisted under the renamed table
DROP INDEX IF EXISTS rd_source_idx;
DROP INDEX IF EXISTS rd_destination_idx;
DROP INDEX IF EXISTS rd_decision_idx;
DROP INDEX IF EXISTS rd_time_idx;

-- ─────────────────────────────────────────────
-- 2. ALIAS RESOLUTION LOG
--    Detailed per-alias resolution audit record.
--    One row per resolution request — tracks latency, fraud score, outcome.
--    Previously confused with the governance routing_decisions table.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alias_resolution_log (
  id               TEXT        PRIMARY KEY,
  alias_id         TEXT        NOT NULL,
  request_id       TEXT        NOT NULL,
  initiator_id     TEXT        NOT NULL,
  initiator_type   TEXT        NOT NULL,   -- 'developer' | 'institution' | 'machine'
  resolved_token   TEXT,                   -- encrypted routing token (NULL if not resolved)
  destination_bank TEXT,
  routing_strategy TEXT        NOT NULL DEFAULT 'primary',
  latency_ms       INTEGER,
  fraud_score      INTEGER,
  fraud_action     TEXT,
  status           TEXT        NOT NULL DEFAULT 'completed',
  -- 'completed' | 'not_found' | 'blocked' | 'consent_required' | 'error'
  failure_reason   TEXT,
  country_code     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS arl_alias_idx      ON alias_resolution_log(alias_id);
CREATE INDEX IF NOT EXISTS arl_initiator_idx  ON alias_resolution_log(initiator_id);
CREATE INDEX IF NOT EXISTS arl_status_idx     ON alias_resolution_log(status);
CREATE INDEX IF NOT EXISTS arl_country_idx    ON alias_resolution_log(country_code);
CREATE INDEX IF NOT EXISTS arl_time_idx       ON alias_resolution_log(created_at);

-- ─────────────────────────────────────────────
-- 3. DEVELOPER WEBHOOK LOGS
--    Tracks every webhook delivery attempt for developer projects.
--    One row per attempt — multiple rows per event on retry.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_webhook_logs (
  id               TEXT        PRIMARY KEY,
  project_id       TEXT        NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  developer_id     TEXT        NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  event_type       TEXT        NOT NULL,   -- 'alias.created' | 'alias.resolved' | 'trust.updated' …
  event_id         TEXT        NOT NULL,   -- idempotency key — same across retries
  webhook_url      TEXT        NOT NULL,
  payload          JSONB       NOT NULL DEFAULT '{}',
  signature_header TEXT,                   -- HMAC-SHA256 X-RALD-Signature value

  -- Delivery outcome
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'delivered' | 'failed' | 'retrying'
  http_status      INTEGER,
  response_body    TEXT,                   -- first 2KB of response
  error_message    TEXT,
  latency_ms       INTEGER,

  -- Retry tracking
  attempt_number   INTEGER     NOT NULL DEFAULT 1,
  max_attempts     INTEGER     NOT NULL DEFAULT 5,
  next_retry_at    TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,

  environment      TEXT        NOT NULL DEFAULT 'sandbox',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dwl_project_idx     ON developer_webhook_logs(project_id);
CREATE INDEX IF NOT EXISTS dwl_developer_idx   ON developer_webhook_logs(developer_id);
CREATE INDEX IF NOT EXISTS dwl_event_type_idx  ON developer_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS dwl_event_id_idx    ON developer_webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS dwl_status_idx      ON developer_webhook_logs(status);
CREATE INDEX IF NOT EXISTS dwl_retry_idx       ON developer_webhook_logs(next_retry_at)
  WHERE status IN ('pending', 'retrying') AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS dwl_env_idx         ON developer_webhook_logs(environment);
CREATE INDEX IF NOT EXISTS dwl_time_idx        ON developer_webhook_logs(created_at);

-- ─────────────────────────────────────────────
-- 4. MISSING MACHINE IDENTITY SEEDS
--    Services that call other ALIA services need machine identities.
--    These were in seed.ts but missing from migration files.
-- ─────────────────────────────────────────────

INSERT INTO machine_identities
  (id, service_name, display_name, client_secret_hash, allowed_scopes, allowed_services, environment)
VALUES
  -- institution-service (was in seed.ts but no migration)
  ('mach_institution',  'institution-service', 'ALIA Institution Service',
   '$2b$12$PLACEHOLDER_INSTITUTION',
   '["institution:read","institution:write","registry:read"]',
   '["governance-service","registry-service"]',
   'production'),

  -- identity-service (calls registry, trust, verification, consent)
  ('mach_identity',     'identity-service', 'ALIA Identity Service',
   '$2b$12$PLACEHOLDER_IDENTITY',
   '["identity:read","identity:write","registry:read","registry:write","trust:read","kyc:read"]',
   '["registry-service","trust-service","verification-service","consent-service"]',
   'production'),

  -- alias-service (calls identity, resolution-engine)
  ('mach_alias',        'alias-service', 'ALIA Alias Service',
   '$2b$12$PLACEHOLDER_ALIAS',
   '["alias:read","alias:write","alias:resolve","registry:read"]',
   '["identity-service","resolution-engine","trust-service"]',
   'production'),

  -- routing-service (calls fraud, trust, consent — route validation)
  ('mach_routing',      'routing-service', 'ALIA Routing Service',
   '$2b$12$PLACEHOLDER_ROUTING',
   '["routing:read","routing:write","routing:token:issue","routing:token:verify","fraud:read","trust:read","consent:read"]',
   '["fraud-service","trust-service","consent-service","institution-service"]',
   'production'),

  -- audit-service (Kafka consumer — reads audit events, writes to DB)
  ('mach_audit',        'audit-service', 'ALIA Audit Service',
   '$2b$12$PLACEHOLDER_AUDIT',
   '["audit:read","audit:write"]',
   '[]',
   'production'),

  -- loop-voice (calls resolution-engine for voice-initiated alias lookup)
  ('mach_loop_voice',   'loop-voice', 'ALIA Loop Voice Service',
   '$2b$12$PLACEHOLDER_LOOP_VOICE',
   '["alias:resolve","trust:read","consent:read","routing:token:issue"]',
   '["resolution-engine","trust-service","consent-service"]',
   'production'),

  -- notification-service (Kafka consumer — sends SMS/email, reads templates)
  ('mach_notification', 'notification-service', 'ALIA Notification Service',
   '$2b$12$PLACEHOLDER_NOTIFICATION',
   '["notification:read","notification:write"]',
   '[]',
   'production')

ON CONFLICT (service_name) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. POLICY VIOLATIONS — align Drizzle schema with governance intent
--    The schema.engines.ts (top-level) policy_violations had different columns.
--    The canonical schema (migration 0006) is: country_code, policy_id, violation_type,
--    actor_id, actor_type, request_id, metadata, resolved, resolved_at.
--    This migration makes no column changes (0006 already created the correct table),
--    but adds a composite index for the governance service query pattern.
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS pv_actor_composite_idx
  ON policy_violations(actor_id, actor_type)
  WHERE resolved = false;

-- ─────────────────────────────────────────────
-- 6. INSTITUTION ROUTING PREFIXES — add missing active filter index
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS irp_active_idx
  ON institution_routing_prefixes(is_active)
  WHERE is_active = true;

-- ─────────────────────────────────────────────
-- 7. CORE TABLES (if running from a fresh DB)
--    These tables are referenced throughout but were never in a migration.
--    Idempotent — IF NOT EXISTS guards every statement.
-- ─────────────────────────────────────────────

-- Enums
DO $$ BEGIN CREATE TYPE alias_type AS ENUM ('phone','email','bank_account','national_id','passport','bvn','nin','merchant_id','username'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE alias_status AS ENUM ('available','pending','verified','active','suspended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE environment AS ENUM ('sandbox','production'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id                   TEXT         PRIMARY KEY,
  email                TEXT         NOT NULL UNIQUE,
  phone                TEXT,
  username             TEXT         UNIQUE,
  first_name           TEXT         NOT NULL,
  last_name            TEXT         NOT NULL,
  is_verified          BOOLEAN      NOT NULL DEFAULT false,
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  password_hash        TEXT,
  identity_status      TEXT         NOT NULL DEFAULT 'pending',
  pending_expires_at   TIMESTAMPTZ,
  verified_at          TIMESTAMPTZ,
  activated_at         TIMESTAMPTZ,
  trusted_at           TIMESTAMPTZ,
  suspended_at         TIMESTAMPTZ,
  suspension_reason    TEXT,
  suspended_by         TEXT,
  archived_at          TIMESTAMPTZ,
  archive_reason       TEXT,
  username_released_at TIMESTAMPTZ,
  metadata             JSONB        NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_identity_status_idx ON users(identity_status);
CREATE INDEX IF NOT EXISTS users_pending_expires_idx ON users(pending_expires_at) WHERE identity_status = 'pending';
CREATE INDEX IF NOT EXISTS users_verified_idx        ON users(verified_at) WHERE identity_status = 'verified';
CREATE INDEX IF NOT EXISTS users_suspended_at_idx    ON users(suspended_at) WHERE identity_status = 'suspended';
CREATE INDEX IF NOT EXISTS users_quarantine_idx      ON users(username_released_at) WHERE identity_status = 'archived';

CREATE TABLE IF NOT EXISTS organizations (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  country      TEXT        NOT NULL,
  rc_number    TEXT,
  tax_id       TEXT,
  is_verified  BOOLEAN     NOT NULL DEFAULT false,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  verified_at  TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aliases (
  id               TEXT         PRIMARY KEY,
  entity_id        TEXT         NOT NULL,
  entity_type      TEXT         NOT NULL,
  alias_type       alias_type   NOT NULL,
  alias_value      TEXT         NOT NULL,
  country_code     TEXT         NOT NULL,
  status           alias_status NOT NULL DEFAULT 'pending',
  is_primary       BOOLEAN      NOT NULL DEFAULT false,
  bank_link_id     TEXT,
  pending_expires_at TIMESTAMPTZ,
  verified_at      TIMESTAMPTZ,
  activated_at     TIMESTAMPTZ,
  suspended_at     TIMESTAMPTZ,
  suspension_reason TEXT,
  archived_at      TIMESTAMPTZ,
  quarantine_until TIMESTAMPTZ,
  metadata         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, alias_type, country_code)
);

CREATE INDEX IF NOT EXISTS aliases_value_idx          ON aliases(alias_value, country_code);
CREATE INDEX IF NOT EXISTS aliases_entity_idx         ON aliases(entity_id);
CREATE INDEX IF NOT EXISTS aliases_status_idx         ON aliases(status);
CREATE INDEX IF NOT EXISTS aliases_country_idx        ON aliases(country_code);
CREATE INDEX IF NOT EXISTS aliases_pending_expires_idx ON aliases(pending_expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS bank_links (
  id                  TEXT        PRIMARY KEY,
  entity_id           TEXT        NOT NULL,
  entity_type         TEXT        NOT NULL,
  alias_id            TEXT        NOT NULL REFERENCES aliases(id) ON DELETE CASCADE,
  institution_code    TEXT        NOT NULL,
  account_number      TEXT        NOT NULL,
  account_name        TEXT        NOT NULL,
  account_token       TEXT,
  is_primary          BOOLEAN     NOT NULL DEFAULT false,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  verification_status TEXT        NOT NULL DEFAULT 'unverified',
  verified_at         TIMESTAMPTZ,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bank_links_entity_idx      ON bank_links(entity_id);
CREATE INDEX IF NOT EXISTS bank_links_alias_idx       ON bank_links(alias_id);
CREATE INDEX IF NOT EXISTS bank_links_institution_idx ON bank_links(institution_code);

CREATE TABLE IF NOT EXISTS routing_profiles (
  id                  TEXT        PRIMARY KEY,
  entity_id           TEXT        NOT NULL,
  entity_type         TEXT        NOT NULL,
  primary_bank_link_id TEXT       REFERENCES bank_links(id),
  primary_institution TEXT,
  backup_institutions JSONB       NOT NULL DEFAULT '[]',
  routing_strategy    TEXT        NOT NULL DEFAULT 'primary',
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  last_routed_at      TIMESTAMPTZ,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, entity_type)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT        PRIMARY KEY,
  entity_id    TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  scopes       JSONB       NOT NULL DEFAULT '[]',
  environment  TEXT        NOT NULL DEFAULT 'sandbox',
  status       TEXT        NOT NULL DEFAULT 'active',
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  revoked_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_entity_idx ON api_keys(entity_id);
CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT        PRIMARY KEY,
  entity_id    TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL,
  action       TEXT        NOT NULL,
  actor_id     TEXT,
  actor_type   TEXT        NOT NULL DEFAULT 'system',
  service_name TEXT        NOT NULL,
  request_id   TEXT,
  ip_address   TEXT,
  old_data     JSONB,
  new_data     JSONB,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON audit_logs(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_time_idx    ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_service_idx ON audit_logs(service_name);

CREATE TABLE IF NOT EXISTS fraud_events (
  id          TEXT        PRIMARY KEY,
  entity_id   TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  risk_score  INTEGER     NOT NULL DEFAULT 0,
  risk_level  TEXT        NOT NULL DEFAULT 'low',
  action      TEXT        NOT NULL DEFAULT 'flag',
  signal_data JSONB       NOT NULL DEFAULT '{}',
  request_id  TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fraud_events_entity_idx ON fraud_events(entity_id);
CREATE INDEX IF NOT EXISTS fraud_events_type_idx   ON fraud_events(event_type);
CREATE INDEX IF NOT EXISTS fraud_events_risk_idx   ON fraud_events(risk_level);
CREATE INDEX IF NOT EXISTS fraud_events_time_idx   ON fraud_events(created_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT        PRIMARY KEY,
  entity_id   TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'pending',
  attempts    INTEGER     NOT NULL DEFAULT 0,
  last_error  TEXT,
  delivered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_entity_idx ON webhooks(entity_id);
CREATE INDEX IF NOT EXISTS webhooks_status_idx ON webhooks(status);
CREATE INDEX IF NOT EXISTS webhooks_time_idx   ON webhooks(created_at);

-- identity_transitions already created in migration 0003
-- (CREATE TABLE IF NOT EXISTS handles idempotency)
