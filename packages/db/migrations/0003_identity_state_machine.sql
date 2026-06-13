-- ALIA Platform — Migration 0003: Identity State Machine
-- Adds lifecycle columns to users and aliases tables.
-- Enforces: AVAILABLE → PENDING (TTL) → VERIFIED → ACTIVE → TRUSTED
--           ACTIVE/TRUSTED → SUSPENDED → ARCHIVED → AVAILABLE
-- Apply with: psql $DATABASE_URL -f 0003_identity_state_machine.sql

-- ─────────────────────────────────────────────
-- USERS TABLE — add lifecycle columns
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE identity_status AS ENUM (
    'available',
    'pending',
    'verified',
    'active',
    'trusted',
    'suspended',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill status from existing boolean columns before adding NOT NULL
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_status identity_status;

UPDATE users
SET identity_status =
  CASE
    WHEN is_active  = true  AND is_verified = true  THEN 'active'::identity_status
    WHEN is_active  = false AND is_verified = true   THEN 'suspended'::identity_status
    WHEN is_verified = true                          THEN 'verified'::identity_status
    ELSE 'pending'::identity_status
  END
WHERE identity_status IS NULL;

ALTER TABLE users ALTER COLUMN identity_status SET NOT NULL;
ALTER TABLE users ALTER COLUMN identity_status SET DEFAULT 'pending';

-- Pending claim expiry: username/email reservation expires at this time
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_expires_at  TIMESTAMPTZ;

-- When the claim was verified (OTP / email link confirmed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ;

-- When the identity became ACTIVE (first completed login / profile done)
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at        TIMESTAMPTZ;

-- When trust engine elevated to TRUSTED
ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_at          TIMESTAMPTZ;

-- Suspension lifecycle
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at        TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by        TEXT;

-- Archival lifecycle
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archive_reason      TEXT;

-- Username quarantine: after archived, username is held until this date
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_released_at TIMESTAMPTZ;

-- Backfill timestamps from existing data where we can
UPDATE users SET activated_at  = updated_at WHERE identity_status = 'active'    AND activated_at IS NULL;
UPDATE users SET verified_at   = created_at  WHERE identity_status IN ('verified','active','trusted') AND verified_at IS NULL;

-- ─────────────────────────────────────────────
-- ALIASES TABLE — add lifecycle columns
-- ─────────────────────────────────────────────

-- Pending alias claim expiry (username/phone/email reservation window)
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS verified_at        TIMESTAMPTZ;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS activated_at       TIMESTAMPTZ;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS suspension_reason  TEXT;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMPTZ;
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS quarantine_until   TIMESTAMPTZ;

-- ─────────────────────────────────────────────
-- INDEXES for background job efficiency
-- ─────────────────────────────────────────────

-- Job 1: find expired PENDING claims
CREATE INDEX IF NOT EXISTS users_pending_expires_idx
  ON users(pending_expires_at)
  WHERE identity_status = 'pending';

CREATE INDEX IF NOT EXISTS aliases_pending_expires_idx
  ON aliases(pending_expires_at)
  WHERE status = 'pending';

-- Job 2: find stale VERIFIED claims (> 7 days unactivated)
CREATE INDEX IF NOT EXISTS users_verified_idx
  ON users(verified_at)
  WHERE identity_status = 'verified';

-- Job 3: escalate SUSPENDED → ARCHIVED (suspended > 90 days)
CREATE INDEX IF NOT EXISTS users_suspended_at_idx
  ON users(suspended_at)
  WHERE identity_status = 'suspended';

-- Job 4: release ARCHIVED usernames (quarantine_until < NOW())
CREATE INDEX IF NOT EXISTS users_quarantine_idx
  ON users(username_released_at)
  WHERE identity_status = 'archived';

-- ─────────────────────────────────────────────
-- IDENTITY_TRANSITION_LOG
-- Permanent append-only record of every state transition.
-- Separate from audit_logs for performance (high-write path).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS identity_transitions (
  id             TEXT        PRIMARY KEY,
  entity_id      TEXT        NOT NULL,
  entity_type    TEXT        NOT NULL DEFAULT 'user',  -- 'user' | 'alias'
  from_status    TEXT,
  to_status      TEXT        NOT NULL,
  triggered_by   TEXT        NOT NULL,  -- 'user' | 'system' | 'admin' | 'job'
  actor_id       TEXT,
  reason         TEXT,
  metadata       JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS identity_transitions_entity_idx ON identity_transitions(entity_id);
CREATE INDEX IF NOT EXISTS identity_transitions_status_idx ON identity_transitions(to_status);
CREATE INDEX IF NOT EXISTS identity_transitions_time_idx   ON identity_transitions(created_at);
