-- ALIA Platform — Migration 0004: Machine Identity + Security Hardening
-- Adds machine_identities table and moves password out of JSONB metadata.
-- Apply with: psql $DATABASE_URL -f 0004_machine_identity.sql

-- ─────────────────────────────────────────────
-- USERS — dedicated password_hash column
-- Previously stored in metadata JSONB as { passwordHash: '...' }
-- ─────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Migrate existing password hashes out of metadata JSONB
UPDATE users
SET password_hash = metadata->>'passwordHash'
WHERE metadata->>'passwordHash' IS NOT NULL
  AND password_hash IS NULL;

-- Remove password from JSONB metadata after migration
-- (Run this only after verifying password_hash is populated)
-- UPDATE users SET metadata = metadata - 'passwordHash' WHERE metadata ? 'passwordHash';
-- NOTE: The above cleanup line is commented out intentionally.
-- Run it as a separate step after confirming migration success.

-- ─────────────────────────────────────────────
-- MACHINE IDENTITIES
-- Service-to-service authentication credentials.
-- Each registered service gets a machine_id + client_secret (hashed).
-- They exchange these for a machine JWT (24h TTL, auto-rotating).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS machine_identities (
  id                  TEXT        PRIMARY KEY,
  service_name        TEXT        NOT NULL UNIQUE,   -- 'payrald-api', 'loop-api', 'registry-service'
  display_name        TEXT        NOT NULL,
  client_secret_hash  TEXT        NOT NULL,          -- bcrypt hash of client_secret
  allowed_scopes      JSONB       NOT NULL DEFAULT '[]',
  allowed_services    JSONB       NOT NULL DEFAULT '[]',  -- which other services may call
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  environment         TEXT        NOT NULL DEFAULT 'production',  -- 'sandbox' | 'production'

  -- Rotation tracking
  secret_rotated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_auth_at        TIMESTAMPTZ,
  last_auth_ip        TEXT,
  auth_count          BIGINT      NOT NULL DEFAULT 0,

  -- Lifecycle
  revoked_at          TIMESTAMPTZ,
  revoked_by          TEXT,
  revocation_reason   TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS machine_identities_service_idx ON machine_identities(service_name);
CREATE INDEX IF NOT EXISTS machine_identities_active_idx  ON machine_identities(is_active);

-- ─────────────────────────────────────────────
-- MACHINE JWT AUDIT LOG
-- Every machine JWT issuance logged for anomaly detection.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS machine_jwt_log (
  id             TEXT        PRIMARY KEY,
  machine_id     TEXT        NOT NULL REFERENCES machine_identities(id),
  service_name   TEXT        NOT NULL,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  ip_address     TEXT,
  revoked        BOOLEAN     NOT NULL DEFAULT false,
  revoked_at     TIMESTAMPTZ,
  revoke_reason  TEXT
);

CREATE INDEX IF NOT EXISTS machine_jwt_log_machine_idx  ON machine_jwt_log(machine_id);
CREATE INDEX IF NOT EXISTS machine_jwt_log_issued_idx   ON machine_jwt_log(issued_at);
CREATE INDEX IF NOT EXISTS machine_jwt_log_service_idx  ON machine_jwt_log(service_name);

-- ─────────────────────────────────────────────
-- SEED: Pre-register known RALD services
-- client_secret values are placeholders — rotate immediately after deploy.
-- Hashes below are bcrypt of 'REPLACE_ON_FIRST_BOOT' (cost 12).
-- ─────────────────────────────────────────────

INSERT INTO machine_identities (id, service_name, display_name, client_secret_hash, allowed_scopes, allowed_services, environment)
VALUES
  ('mach_registry',    'registry-service',   'ALIA Registry Service',     '$2b$12$PLACEHOLDER_REGISTRY',    '["registry:read","registry:write"]',                          '["identity-service","trust-service","consent-service"]', 'production'),
  ('mach_consent',     'consent-service',    'ALIA Consent Service',      '$2b$12$PLACEHOLDER_CONSENT',     '["consent:read","consent:write"]',                            '["identity-service","routing-service"]',                 'production'),
  ('mach_trust',       'trust-service',      'ALIA Trust Service',        '$2b$12$PLACEHOLDER_TRUST',       '["trust:read","trust:write","trust:signal"]',                 '["identity-service","fraud-service"]',                   'production'),
  ('mach_merchant',    'merchant-service',   'ALIA Merchant Service',     '$2b$12$PLACEHOLDER_MERCHANT',    '["merchant:read","merchant:write"]',                          '["identity-service","consent-service"]',                  'production'),
  ('mach_governance',  'governance-service', 'ALIA Governance Service',   '$2b$12$PLACEHOLDER_GOVERNANCE',  '["policy:read","policy:write","country:read"]',               '["resolution-engine","routing-service","identity-service"]','production'),
  ('mach_resolution',  'resolution-engine',  'ALIA Resolution Engine',    '$2b$12$PLACEHOLDER_RESOLUTION',  '["alias:resolve","routing:token:issue","routing:token:verify"]','["routing-service","alias-service"]',                   'production'),
  ('mach_verification','verification-service','ALIA Verification Service', '$2b$12$PLACEHOLDER_VERIFICATION','["kyc:read","kyc:write"]',                                   '["identity-service","trust-service"]',                   'production'),
  ('mach_fraud',       'fraud-service',      'ALIA Fraud Service',        '$2b$12$PLACEHOLDER_FRAUD',       '["fraud:read","fraud:write","fraud:signal"]',                 '["routing-service","resolution-engine","trust-service"]', 'production'),
  ('mach_payrald',     'payrald-api',        'PayRald Payment Gateway',   '$2b$12$PLACEHOLDER_PAYRALD',     '["alias:resolve","routing:resolve","trust:read","consent:mandate:execute","fraud:signal"]','[]', 'production')
ON CONFLICT (service_name) DO NOTHING;
