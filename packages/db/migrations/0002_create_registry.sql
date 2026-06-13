-- ALIA Platform — Migration 0002: Global Entity Registry
-- Every entity across ALIA receives a permanent, portable registry_id.
-- Apply with: psql $DATABASE_URL -f 0002_create_registry.sql

-- ─────────────────────────────────────────────
-- ENTITY TYPE ENUM
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM (
    'person',
    'business',
    'merchant',
    'developer',
    'institution',
    'device',
    'service'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- REGISTRY TABLE
-- The canonical identity object. One row per entity, ever.
-- registry_id is the globally unique cross-service identifier.
-- Format: rald_prs_XXXXXXXX | rald_biz_XXXXXXXX | rald_mrt_XXXXXXXX …
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registry (
  -- Core identity
  registry_id           TEXT        PRIMARY KEY,
  entity_type           entity_type NOT NULL,
  entity_id             TEXT        NOT NULL,   -- FK to users.id / organizations.id / merchants.id / etc.
  country_code          TEXT        NOT NULL,

  -- Identity status dimension
  identity_status       TEXT        NOT NULL DEFAULT 'pending',
  -- Values: available | pending | verified | active | trusted | suspended | archived
  identity_status_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identity_status_by    TEXT,                   -- actor who last changed this dimension

  -- Verification (KYC) status dimension
  verification_status   TEXT        NOT NULL DEFAULT 'unverified',
  -- Values: unverified | tier1 | tier2 | tier3 | failed | expired
  verification_status_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_tier     INTEGER      NOT NULL DEFAULT 0,  -- 0–3

  -- Trust status dimension
  trust_status          TEXT        NOT NULL DEFAULT 'unscored',
  -- Values: unscored | unverified | basic | standard | trusted | elite | frozen
  trust_status_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trust_score           INTEGER,               -- cached from trust-service

  -- Consent status dimension
  consent_status        TEXT        NOT NULL DEFAULT 'none',
  -- Values: none | has_consents | revoked_all
  consent_status_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Routing status dimension
  routing_status        TEXT        NOT NULL DEFAULT 'unlinked',
  -- Values: unlinked | linked | active | suspended
  routing_status_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Compliance status dimension
  compliance_status     TEXT        NOT NULL DEFAULT 'pending',
  -- Values: pending | clear | flagged | sanctioned | archived
  compliance_status_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compliance_flags      JSONB       NOT NULL DEFAULT '[]',

  -- Metadata
  display_name          TEXT,                   -- cached from source entity for fast display
  avatar_url            TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}',

  -- Lifecycle
  activated_at          TIMESTAMPTZ,
  suspended_at          TIMESTAMPTZ,
  archived_at           TIMESTAMPTZ,
  suspension_reason     TEXT,
  archive_reason        TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each entity_id may only appear once per entity_type
  CONSTRAINT registry_entity_unique UNIQUE (entity_type, entity_id)
);

CREATE        INDEX IF NOT EXISTS registry_entity_id_idx         ON registry(entity_id);
CREATE        INDEX IF NOT EXISTS registry_entity_type_idx       ON registry(entity_type);
CREATE        INDEX IF NOT EXISTS registry_country_idx           ON registry(country_code);
CREATE        INDEX IF NOT EXISTS registry_identity_status_idx   ON registry(identity_status);
CREATE        INDEX IF NOT EXISTS registry_trust_status_idx      ON registry(trust_status);
CREATE        INDEX IF NOT EXISTS registry_compliance_status_idx ON registry(compliance_status);
CREATE        INDEX IF NOT EXISTS registry_created_at_idx        ON registry(created_at);

-- ─────────────────────────────────────────────
-- REGISTRY EVENT LOG
-- Append-only audit log for all registry_id status changes.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registry_events (
  id              TEXT        PRIMARY KEY,
  registry_id     TEXT        NOT NULL REFERENCES registry(registry_id),
  dimension       TEXT        NOT NULL, -- 'identity' | 'verification' | 'trust' | 'consent' | 'routing' | 'compliance'
  from_status     TEXT,
  to_status       TEXT        NOT NULL,
  actor_id        TEXT,
  actor_type      TEXT,                 -- 'user' | 'system' | 'admin' | 'kafka_consumer'
  reason          TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS registry_events_registry_idx ON registry_events(registry_id);
CREATE INDEX IF NOT EXISTS registry_events_dimension_idx ON registry_events(dimension);
CREATE INDEX IF NOT EXISTS registry_events_created_idx  ON registry_events(created_at);

-- ─────────────────────────────────────────────
-- SEED: Migrate existing users → registry
-- Run once after migration. Idempotent (ON CONFLICT DO NOTHING).
-- registry_id for existing users: rald_prs_ + first 8 chars of their id
-- ─────────────────────────────────────────────

INSERT INTO registry (
  registry_id, entity_type, entity_id, country_code,
  identity_status, verification_status, verification_tier,
  trust_status, consent_status, routing_status, compliance_status,
  display_name, created_at, updated_at
)
SELECT
  'rald_prs_' || SUBSTR(id, 1, 8)           AS registry_id,
  'person'::entity_type                      AS entity_type,
  id                                         AS entity_id,
  'NG'                                       AS country_code,  -- default; update per user later
  CASE WHEN is_verified AND is_active THEN 'active' WHEN is_verified THEN 'verified' ELSE 'pending' END AS identity_status,
  CASE WHEN is_verified THEN 'tier1' ELSE 'unverified' END AS verification_status,
  CASE WHEN is_verified THEN 1 ELSE 0 END    AS verification_tier,
  'unscored'                                 AS trust_status,
  'none'                                     AS consent_status,
  'unlinked'                                 AS routing_status,
  'pending'                                  AS compliance_status,
  first_name || ' ' || last_name            AS display_name,
  created_at, updated_at
FROM users
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Seed: organizations → registry
INSERT INTO registry (
  registry_id, entity_type, entity_id, country_code,
  identity_status, verification_status, verification_tier,
  trust_status, consent_status, routing_status, compliance_status,
  display_name, created_at, updated_at
)
SELECT
  'rald_biz_' || SUBSTR(id, 1, 8)           AS registry_id,
  'business'::entity_type                    AS entity_type,
  id                                         AS entity_id,
  'NG'                                       AS country_code,
  CASE WHEN is_verified AND is_active THEN 'active' WHEN is_verified THEN 'verified' ELSE 'pending' END AS identity_status,
  CASE WHEN is_verified THEN 'tier1' ELSE 'unverified' END AS verification_status,
  CASE WHEN is_verified THEN 1 ELSE 0 END    AS verification_tier,
  'unscored'                                 AS trust_status,
  'none'                                     AS consent_status,
  'unlinked'                                 AS routing_status,
  'pending'                                  AS compliance_status,
  name                                       AS display_name,
  created_at, updated_at
FROM organizations
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Seed: merchants → registry
INSERT INTO registry (
  registry_id, entity_type, entity_id, country_code,
  identity_status, verification_status, verification_tier,
  trust_status, consent_status, routing_status, compliance_status,
  display_name, created_at, updated_at
)
SELECT
  'rald_mrt_' || SUBSTR(id, 1, 8)           AS registry_id,
  'merchant'::entity_type                    AS entity_type,
  id                                         AS entity_id,
  country                                    AS country_code,
  CASE WHEN verified AND status = 'active' THEN 'active' WHEN verified THEN 'verified' ELSE 'pending' END AS identity_status,
  CASE WHEN verified THEN 'tier1' ELSE 'unverified' END AS verification_status,
  CASE WHEN verified THEN 1 ELSE 0 END       AS verification_tier,
  'unscored'                                 AS trust_status,
  'none'                                     AS consent_status,
  'unlinked'                                 AS routing_status,
  'pending'                                  AS compliance_status,
  name                                       AS display_name,
  created_at, updated_at
FROM merchants
ON CONFLICT (entity_type, entity_id) DO NOTHING;
