-- ALIA Platform — Migration 0001: Engine Tables
-- Adds persistence for consent, trust, merchant, governance, and verification services
-- Apply with: psql $DATABASE_URL -f 0001_add_alia_engines.sql

-- ─────────────────────────────────────────────
-- CONSENT SERVICE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consents (
  id                TEXT        PRIMARY KEY,
  subject_id        TEXT        NOT NULL,
  subject_type      TEXT        NOT NULL,
  grantee_id        TEXT        NOT NULL,
  grantee_type      TEXT        NOT NULL,
  scope             JSONB       NOT NULL DEFAULT '[]',
  purpose           TEXT        NOT NULL,
  data_classes      JSONB       NOT NULL DEFAULT '[]',
  status            TEXT        NOT NULL DEFAULT 'active',
  signature         TEXT        NOT NULL,
  version           INTEGER     NOT NULL DEFAULT 1,
  conditions        JSONB,
  ip_address        TEXT,
  user_agent        TEXT,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,
  revoked_by        TEXT
);
CREATE INDEX IF NOT EXISTS consents_subject_idx  ON consents(subject_id);
CREATE INDEX IF NOT EXISTS consents_grantee_idx  ON consents(grantee_id);
CREATE INDEX IF NOT EXISTS consents_status_idx   ON consents(status);

CREATE TABLE IF NOT EXISTS consent_audit_trail (
  id          TEXT        PRIMARY KEY,
  consent_id  TEXT        NOT NULL REFERENCES consents(id),
  event       TEXT        NOT NULL,
  actor_id    TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS consent_audit_consent_idx ON consent_audit_trail(consent_id);
CREATE INDEX IF NOT EXISTS consent_audit_created_idx ON consent_audit_trail(created_at);

CREATE TABLE IF NOT EXISTS mandates (
  id                   TEXT        PRIMARY KEY,
  subject_id           TEXT        NOT NULL,
  merchant_id          TEXT        NOT NULL,
  purpose              TEXT        NOT NULL,
  amount               NUMERIC,
  max_amount           NUMERIC,
  currency             TEXT        NOT NULL,
  frequency            TEXT        NOT NULL,
  custom_interval_days INTEGER,
  start_date           TIMESTAMPTZ NOT NULL,
  end_date             TIMESTAMPTZ,
  bank_account_alias   TEXT,
  status               TEXT        NOT NULL DEFAULT 'active',
  cancellation_reason  TEXT,
  cancelled_by         TEXT,
  cancelled_at         TIMESTAMPTZ,
  total_executions     INTEGER     NOT NULL DEFAULT 0,
  last_executed_at     TIMESTAMPTZ,
  next_execution_at    TIMESTAMPTZ,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mandates_subject_idx  ON mandates(subject_id);
CREATE INDEX IF NOT EXISTS mandates_merchant_idx ON mandates(merchant_id);
CREATE INDEX IF NOT EXISTS mandates_status_idx   ON mandates(status);

-- ─────────────────────────────────────────────
-- TRUST SERVICE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trust_scores (
  id                   TEXT        PRIMARY KEY,
  entity_id            TEXT        NOT NULL,
  entity_type          TEXT        NOT NULL,
  overall_score        INTEGER     NOT NULL DEFAULT 30,
  components           JSONB       NOT NULL DEFAULT '[]',
  tier                 TEXT        NOT NULL DEFAULT 'unverified',
  risk_level           TEXT        NOT NULL DEFAULT 'high',
  fraud_score          INTEGER     NOT NULL DEFAULT 70,
  signals_count        INTEGER     NOT NULL DEFAULT 0,
  last_recalculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS trust_scores_entity_idx ON trust_scores(entity_id, entity_type);

CREATE TABLE IF NOT EXISTS trust_signals (
  id          TEXT        PRIMARY KEY,
  entity_id   TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  signal_type TEXT        NOT NULL,
  value       NUMERIC     NOT NULL,
  source      TEXT        NOT NULL,
  metadata    JSONB,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trust_signals_entity_idx ON trust_signals(entity_id);
CREATE INDEX IF NOT EXISTS trust_signals_type_idx   ON trust_signals(signal_type);

CREATE TABLE IF NOT EXISTS trust_history (
  id          TEXT        PRIMARY KEY,
  entity_id   TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  score       INTEGER     NOT NULL,
  event       TEXT        NOT NULL,
  delta       INTEGER     NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trust_history_entity_idx ON trust_history(entity_id);
CREATE INDEX IF NOT EXISTS trust_history_time_idx   ON trust_history(recorded_at);

CREATE TABLE IF NOT EXISTS reputation_profiles (
  id                    TEXT        PRIMARY KEY,
  entity_id             TEXT        NOT NULL,
  entity_type           TEXT        NOT NULL,
  reputation_score      INTEGER     NOT NULL DEFAULT 50,
  flags                 JSONB       NOT NULL DEFAULT '[]',
  sanctions_match       BOOLEAN     NOT NULL DEFAULT false,
  pep_match             BOOLEAN     NOT NULL DEFAULT false,
  adverse_media         BOOLEAN     NOT NULL DEFAULT false,
  participation_history JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS reputation_entity_idx ON reputation_profiles(entity_id, entity_type);

-- ─────────────────────────────────────────────
-- MERCHANT SERVICE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchants (
  id                           TEXT        PRIMARY KEY,
  name                         TEXT        NOT NULL,
  handle                       TEXT        NOT NULL,
  owner_id                     TEXT        NOT NULL,
  owner_type                   TEXT        NOT NULL DEFAULT 'user',
  category                     TEXT        NOT NULL,
  country                      TEXT        NOT NULL,
  business_registration_number TEXT,
  tax_identification_number    TEXT,
  contact_email                TEXT        NOT NULL,
  contact_phone                TEXT        NOT NULL,
  website                      TEXT,
  description                  TEXT,
  bank_alias                   TEXT,
  status                       TEXT        NOT NULL DEFAULT 'pending',
  verified                     BOOLEAN     NOT NULL DEFAULT false,
  verified_at                  TIMESTAMPTZ,
  verified_by                  TEXT,
  verification_notes           TEXT,
  trust_score                  INTEGER     NOT NULL DEFAULT 30,
  suspension_reason            TEXT,
  suspended_at                 TIMESTAMPTZ,
  suspended_by                 TEXT,
  metadata                     JSONB,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS merchants_handle_idx  ON merchants(handle);
CREATE        INDEX IF NOT EXISTS merchants_owner_idx   ON merchants(owner_id);
CREATE        INDEX IF NOT EXISTS merchants_country_idx ON merchants(country);
CREATE        INDEX IF NOT EXISTS merchants_status_idx  ON merchants(status);

-- ─────────────────────────────────────────────
-- GOVERNANCE SERVICE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policies (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  description     TEXT,
  type            TEXT        NOT NULL,
  scope           TEXT        NOT NULL,
  country         TEXT,
  institution_id  TEXT,
  service         TEXT,
  rules           JSONB       NOT NULL DEFAULT '[]',
  active          BOOLEAN     NOT NULL DEFAULT true,
  effective_from  TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS policies_scope_idx    ON policies(scope);
CREATE INDEX IF NOT EXISTS policies_country_idx  ON policies(country);
CREATE INDEX IF NOT EXISTS policies_active_idx   ON policies(active);
CREATE INDEX IF NOT EXISTS policies_type_idx     ON policies(type);

-- ─────────────────────────────────────────────
-- VERIFICATION SERVICE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_sessions (
  id                     TEXT        PRIMARY KEY,
  entity_id              TEXT        NOT NULL,
  entity_type            TEXT        NOT NULL,
  country                TEXT        NOT NULL,
  tier                   TEXT        NOT NULL,
  documents              JSONB       NOT NULL DEFAULT '[]',
  provider               TEXT        NOT NULL DEFAULT 'internal',
  status                 TEXT        NOT NULL DEFAULT 'pending',
  rejection_reason       TEXT,
  review_notes           TEXT,
  reviewed_by            TEXT,
  reviewed_at            TIMESTAMPTZ,
  callback_url           TEXT,
  verification_reference TEXT        NOT NULL,
  expires_at             TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyc_sessions_entity_idx ON kyc_sessions(entity_id);
CREATE INDEX IF NOT EXISTS kyc_sessions_status_idx ON kyc_sessions(status);
CREATE INDEX IF NOT EXISTS kyc_sessions_country_idx ON kyc_sessions(country);
