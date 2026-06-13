-- ALIA Platform — Migration 0006: Country Governance
-- Manages the lifecycle of countries on the ALIA network.
-- Status ladder: DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
-- No country activates automatically — every transition is admin-gated.
-- Apply with: psql $DATABASE_URL -f 0006_country_governance.sql

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE country_network_status AS ENUM (
    'DISABLED',       -- Not on network; aliases blocked
    'INTERNAL',       -- RALD-internal testing only
    'PRIVATE_BETA',   -- Invited partners only
    'PUBLIC_BETA',    -- Open to verified developers
    'GA'              -- General availability — fully live
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- COUNTRY GOVERNANCE
-- One row per ISO 3166-1 alpha-2 country code.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS country_governance (
  id                      TEXT                  PRIMARY KEY,
  country_code            TEXT                  NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2 (e.g. 'NG')
  country_name            TEXT                  NOT NULL,
  status                  country_network_status NOT NULL DEFAULT 'DISABLED',
  compliance_framework    TEXT                  NOT NULL DEFAULT 'NONE',  -- Primary framework: 'NDPR','GDPR','POPIA'…

  -- Alias policy for this jurisdiction
  max_aliases_per_user    INTEGER               NOT NULL DEFAULT 3,
  kyc_requirement_level   INTEGER               NOT NULL DEFAULT 1,       -- 1=basic, 2=standard, 3=enhanced
  allowed_alias_types     JSONB                 NOT NULL DEFAULT '[]',    -- subset of AliasType enum
  sanction_list_enabled   BOOLEAN               NOT NULL DEFAULT true,
  data_residency_required BOOLEAN               NOT NULL DEFAULT false,

  -- Transaction limits (minor units, local currency)
  daily_tx_limit_minor    BIGINT,
  single_tx_limit_minor   BIGINT,
  currency_code           TEXT                  NOT NULL DEFAULT 'USD',   -- ISO 4217

  -- Lifecycle
  activated_by            TEXT,                                           -- actor_id of first GA transition
  activated_at            TIMESTAMPTZ,
  updated_by              TEXT,
  notes                   TEXT,

  metadata                JSONB                 NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cg_status_idx ON country_governance(status);

-- ─────────────────────────────────────────────
-- COUNTRY GOVERNANCE EVENTS (audit trail)
-- Immutable log of every status transition and policy change.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS country_governance_events (
  id            TEXT        PRIMARY KEY,
  country_code  TEXT        NOT NULL,
  event_type    TEXT        NOT NULL,   -- 'status_changed','policy_updated','framework_changed'
  from_status   TEXT,
  to_status     TEXT,
  actor_id      TEXT,
  actor_type    TEXT        NOT NULL DEFAULT 'system',
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cge_country_idx ON country_governance_events(country_code);
CREATE INDEX IF NOT EXISTS cge_type_idx    ON country_governance_events(event_type);
CREATE INDEX IF NOT EXISTS cge_time_idx    ON country_governance_events(created_at);

-- ─────────────────────────────────────────────
-- GOVERNANCE POLICY VIOLATIONS
-- Recorded when a request fails a compliance check.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_violations (
  id              TEXT        PRIMARY KEY,
  country_code    TEXT        NOT NULL,
  policy_id       TEXT        NOT NULL,
  violation_type  TEXT        NOT NULL,
  actor_id        TEXT,
  actor_type      TEXT        NOT NULL DEFAULT 'system',
  request_id      TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  resolved        BOOLEAN     NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pv_country_idx  ON policy_violations(country_code);
CREATE INDEX IF NOT EXISTS pv_policy_idx   ON policy_violations(policy_id);
CREATE INDEX IF NOT EXISTS pv_resolved_idx ON policy_violations(resolved);
CREATE INDEX IF NOT EXISTS pv_time_idx     ON policy_violations(created_at);

-- ─────────────────────────────────────────────
-- ROUTING DECISIONS (governance layer)
-- Records routing decisions made by the compliance engine
-- so they can be audited and replayed.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routing_decisions (
  id                  TEXT        PRIMARY KEY,
  source_country      TEXT        NOT NULL,
  destination_country TEXT        NOT NULL,
  decision            TEXT        NOT NULL,   -- 'allowed','blocked','flagged'
  policy_id           TEXT,
  reason              TEXT,
  request_id          TEXT,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rd_source_idx      ON routing_decisions(source_country);
CREATE INDEX IF NOT EXISTS rd_destination_idx ON routing_decisions(destination_country);
CREATE INDEX IF NOT EXISTS rd_decision_idx    ON routing_decisions(decision);
CREATE INDEX IF NOT EXISTS rd_time_idx        ON routing_decisions(created_at);

-- ─────────────────────────────────────────────
-- DELETION SCHEDULES (data retention)
-- Tracks records scheduled for deletion per the retention
-- policy of the governing jurisdiction.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deletion_schedules (
  id              TEXT        PRIMARY KEY,
  country_code    TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,   -- 'alias','identity','consent','trust_score'
  entity_id       TEXT        NOT NULL,
  retention_class TEXT        NOT NULL,   -- 'transient','operational','regulatory','permanent'
  scheduled_at    TIMESTAMPTZ NOT NULL,
  executed_at     TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending',   -- 'pending','executed','cancelled'
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds_country_idx    ON deletion_schedules(country_code);
CREATE INDEX IF NOT EXISTS ds_status_idx     ON deletion_schedules(status);
CREATE INDEX IF NOT EXISTS ds_scheduled_idx  ON deletion_schedules(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ds_entity_idx     ON deletion_schedules(entity_type, entity_id);

-- ─────────────────────────────────────────────
-- SEED: Initial country governance records
-- Nigeria (NG) starts as INTERNAL — fully wired but invitation-only.
-- All other African markets start as DISABLED — not on network yet.
-- ─────────────────────────────────────────────

INSERT INTO country_governance
  (id, country_code, country_name, status, compliance_framework,
   max_aliases_per_user, kyc_requirement_level, allowed_alias_types,
   sanction_list_enabled, data_residency_required, currency_code,
   daily_tx_limit_minor, single_tx_limit_minor)
VALUES
  -- Live market (internal)
  ('cgov_ng', 'NG', 'Nigeria',       'INTERNAL', 'NDPR',    5, 2, '["phone","email","national_id","bvn"]',  true, true,  'NGN', 100000000, 10000000),
  -- Pipeline markets (disabled — flip to INTERNAL when regulatory approval lands)
  ('cgov_gh', 'GH', 'Ghana',         'DISABLED', 'DPA_GH',  3, 2, '["phone","email","national_id"]',        true, false, 'GHS', 50000000,  5000000),
  ('cgov_ke', 'KE', 'Kenya',         'DISABLED', 'DPA_KE',  3, 2, '["phone","email","national_id"]',        true, false, 'KES', 50000000,  5000000),
  ('cgov_za', 'ZA', 'South Africa',  'DISABLED', 'POPIA',   3, 3, '["phone","email","national_id"]',        true, true,  'ZAR', 50000000,  5000000),
  ('cgov_rw', 'RW', 'Rwanda',        'DISABLED', 'DPA_RW',  3, 1, '["phone","email"]',                      true, false, 'RWF', 30000000,  3000000),
  ('cgov_tz', 'TZ', 'Tanzania',      'DISABLED', 'NONE',    3, 1, '["phone","email"]',                      true, false, 'TZS', 30000000,  3000000),
  ('cgov_ug', 'UG', 'Uganda',        'DISABLED', 'NONE',    3, 1, '["phone","email"]',                      true, false, 'UGX', 30000000,  3000000),
  ('cgov_eg', 'EG', 'Egypt',         'DISABLED', 'NONE',    3, 2, '["phone","email","national_id"]',        true, true,  'EGP', 50000000,  5000000),
  ('cgov_sn', 'SN', 'Senegal',       'DISABLED', 'NONE',    3, 1, '["phone","email"]',                      true, false, 'XOF', 30000000,  3000000),
  ('cgov_ci', 'CI', 'Côte d''Ivoire','DISABLED', 'NONE',    3, 1, '["phone","email"]',                      true, false, 'XOF', 30000000,  3000000)
ON CONFLICT (country_code) DO NOTHING;

-- Seed opening events for NG INTERNAL status
INSERT INTO country_governance_events
  (id, country_code, event_type, from_status, to_status, actor_type, metadata)
VALUES
  ('cge_ng_seed', 'NG', 'status_changed', 'DISABLED', 'INTERNAL', 'system',
   '{"note": "Initial seed — Nigeria enters INTERNAL for RALD platform testing"}')
ON CONFLICT (id) DO NOTHING;
