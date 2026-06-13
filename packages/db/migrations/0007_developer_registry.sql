-- ALIA Platform — Migration 0007: Developer Registry
-- Developer accounts, projects, API keys, and audit trail.
-- Developer lifecycle: applied → verified → active → suspended → revoked
-- API keys: rald_key_{prod|test}_{48 hex chars} — only SHA-256 hash stored.
-- Rate limits: sandbox=60 rpm / 10k rpd, production=120 rpm / 50k rpd
-- Apply with: psql $DATABASE_URL -f 0007_developer_registry.sql

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE developer_status AS ENUM (
    'applied',    -- Application received — awaiting admin review
    'verified',   -- Identity + KYC confirmed — sandbox access granted
    'active',     -- Full access: sandbox + production
    'suspended',  -- Temporarily barred (policy violation, billing, etc.)
    'revoked'     -- Permanently removed — cannot be reinstated
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'active',
    'suspended',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE api_key_status AS ENUM (
    'active',
    'revoked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- DEVELOPERS
-- One row per human or team registered on the ALIA developer network.
-- Linked to a registry entity via registry_id for cross-service lookup.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developers (
  id                  TEXT              PRIMARY KEY,
  registry_id         TEXT,                                 -- FK to registry.id (populated after M2 sync)
  name                TEXT              NOT NULL,
  email               TEXT              NOT NULL UNIQUE,
  organization_id     TEXT,                                 -- optional link to organisations table
  status              developer_status  NOT NULL DEFAULT 'applied',
  kyc_verified        BOOLEAN           NOT NULL DEFAULT false,
  country             TEXT              NOT NULL,            -- ISO 3166-1 alpha-2
  website             TEXT,
  notes               TEXT,                                  -- internal admin notes

  -- Approval
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,

  -- Suspension
  suspended_at        TIMESTAMPTZ,
  suspension_reason   TEXT,

  -- Revocation
  revoked_at          TIMESTAMPTZ,
  revocation_reason   TEXT,

  metadata            JSONB             NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dev_status_idx   ON developers(status);
CREATE INDEX IF NOT EXISTS dev_country_idx  ON developers(country);
CREATE INDEX IF NOT EXISTS dev_registry_idx ON developers(registry_id) WHERE registry_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- DEVELOPER PROJECTS
-- Logical grouping of API keys under a developer account.
-- environment controls which ALIA infrastructure the keys hit.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_projects (
  id                      TEXT            PRIMARY KEY,
  developer_id            TEXT            NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  name                    TEXT            NOT NULL,
  description             TEXT,
  environment             TEXT            NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'production'
  status                  project_status  NOT NULL DEFAULT 'active',

  -- Scope restrictions for this project
  country_permissions     JSONB           NOT NULL DEFAULT '[]',   -- list of ISO alpha-2 codes, empty=all
  institution_permissions JSONB           NOT NULL DEFAULT '[]',   -- list of institution IDs, empty=all

  webhook_url             TEXT,
  archived_at             TIMESTAMPTZ,
  metadata                JSONB           NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dproj_developer_idx ON developer_projects(developer_id);
CREATE INDEX IF NOT EXISTS dproj_status_idx    ON developer_projects(status);
CREATE INDEX IF NOT EXISTS dproj_env_idx       ON developer_projects(environment);

-- ─────────────────────────────────────────────
-- DEVELOPER API KEYS
-- Credentials authenticating a project's requests to ALIA.
-- The plaintext key is returned ONCE at creation.
-- Only the SHA-256 hash (key_hash) is persisted here.
-- Lookup path: incoming key → SHA-256 → key_hash index → row.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_api_keys (
  id              TEXT            PRIMARY KEY,
  key_id          TEXT            NOT NULL UNIQUE,   -- public identifier sent in logs/errors (kid_*)
  key_hash        TEXT            NOT NULL UNIQUE,   -- SHA-256(plain_key) — used for verification
  project_id      TEXT            NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  developer_id    TEXT            NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  name            TEXT            NOT NULL,           -- human label e.g. "CI / CD key"

  scopes          JSONB           NOT NULL DEFAULT '[]',   -- subset of AVAILABLE_SCOPES

  -- Rate limits (inherited from environment at creation time, can be overridden)
  rate_limit_rpm  INTEGER         NOT NULL DEFAULT 60,
  rate_limit_rpd  INTEGER         NOT NULL DEFAULT 10000,

  environment     TEXT            NOT NULL DEFAULT 'sandbox',

  -- Expiry (NULL = never expires)
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,

  status          api_key_status  NOT NULL DEFAULT 'active',
  revoked_at      TIMESTAMPTZ,
  revoked_by      TEXT,                              -- actor_id of the admin who revoked it

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dak_project_idx   ON developer_api_keys(project_id);
CREATE INDEX IF NOT EXISTS dak_developer_idx ON developer_api_keys(developer_id);
CREATE INDEX IF NOT EXISTS dak_status_idx    ON developer_api_keys(status);
CREATE INDEX IF NOT EXISTS dak_expires_idx   ON developer_api_keys(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- DEVELOPER EVENTS (audit trail)
-- Immutable log of every developer lifecycle action.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_events (
  id            TEXT        PRIMARY KEY,
  developer_id  TEXT        NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,   -- 'developer.applied','developer.verified','api_key.created'…
  actor_id      TEXT,
  actor_type    TEXT        NOT NULL DEFAULT 'system',
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dev_events_developer_idx ON developer_events(developer_id);
CREATE INDEX IF NOT EXISTS dev_events_type_idx      ON developer_events(event_type);
CREATE INDEX IF NOT EXISTS dev_events_time_idx      ON developer_events(created_at);

-- ─────────────────────────────────────────────
-- MACHINE IDENTITY: developer-service
-- Add the developer-service machine identity so it can
-- authenticate to other ALIA services.
-- ─────────────────────────────────────────────

INSERT INTO machine_identities
  (id, service_name, display_name, client_secret_hash, allowed_scopes, allowed_services, environment)
VALUES
  ('mach_developer', 'developer-service', 'ALIA Developer Service',
   '$2b$12$PLACEHOLDER_DEVELOPER',
   '["developers:read","developers:write","api_key:verify"]',
   '["governance-service","registry-service","identity-service"]',
   'production')
ON CONFLICT (service_name) DO NOTHING;
