-- ALIA Platform — Migration 0005: Institution Registry
-- Financial institutions: banks, MFBs, fintechs, PSPs, telcos — across Africa.
-- Tracks licensing per country, routing prefixes (NUBAN/IBAN/mobile), and
-- settlement accounts used by the routing engine.
-- Apply with: psql $DATABASE_URL -f 0005_institution_registry.sql

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE institution_type AS ENUM (
    'commercial_bank',      -- Licensed commercial / deposit bank
    'microfinance_bank',    -- MFB / Community bank
    'fintech',              -- Licensed fintech / e-money issuer
    'mobile_money',         -- Mobile money operator (MTN MoMo, Airtel Money, M-Pesa…)
    'payment_service_bank', -- PSB (Nigerian CBN category)
    'neobank',              -- Digital-only bank
    'central_bank',         -- Regulatory central bank / NCA node
    'cooperative',          -- SACCO / co-operative
    'insurance',            -- Insurance company
    'investment',           -- Investment / securities firm
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE institution_status AS ENUM (
    'active',
    'pending_verification',  -- Registered but regulatory check pending
    'suspended',             -- Temporarily barred from network
    'revoked',               -- License revoked / permanently removed
    'sandbox_only'           -- Test environment only
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_status AS ENUM (
    'active',
    'pending',
    'expired',
    'revoked',
    'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prefix_scheme AS ENUM (
    'nuban',          -- Nigeria: 10-digit NUBAN (3-digit bank code prefix)
    'iban',           -- International IBAN
    'mobile_msisdn',  -- Mobile money MSISDN-based
    'internal',       -- ALIA internal routing code
    'swift_bic',      -- SWIFT/BIC code
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- FINANCIAL INSTITUTIONS
-- One row per institution, globally unique.
-- institution_code is the ALIA-assigned routing code (e.g. '058' for GTBank).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_institutions (
  id                TEXT               PRIMARY KEY,
  institution_code  TEXT               NOT NULL UNIQUE,  -- ALIA canonical code
  short_name        TEXT               NOT NULL,         -- 'GTB', 'UBA', 'MTN_MoMo'
  full_name         TEXT               NOT NULL,
  type              institution_type   NOT NULL,
  status            institution_status NOT NULL DEFAULT 'pending_verification',

  -- Contact & identity
  website           TEXT,
  support_email     TEXT,
  support_phone     TEXT,
  hq_country        TEXT               NOT NULL,   -- ISO 3166-1 alpha-2

  -- Regulatory identifiers
  swift_bic         TEXT,
  cbn_license_code  TEXT,     -- Nigeria CBN license number
  rc_number         TEXT,     -- Companies registry number
  tax_id            TEXT,

  -- Network participation
  is_alia_participant   BOOLEAN NOT NULL DEFAULT false,   -- Connected to ALIA routing
  is_resolution_target  BOOLEAN NOT NULL DEFAULT true,    -- Can receive resolved payments
  is_alias_issuer       BOOLEAN NOT NULL DEFAULT false,   -- Can issue ALIA aliases
  sandbox_enabled       BOOLEAN NOT NULL DEFAULT false,
  production_enabled    BOOLEAN NOT NULL DEFAULT false,

  -- ALIA API credentials (machine identity)
  machine_id        TEXT,     -- FK to machine_identities.id

  -- Metadata
  logo_url          TEXT,
  color_hex         TEXT,
  metadata          JSONB    NOT NULL DEFAULT '{}',

  -- Lifecycle
  verified_at       TIMESTAMPTZ,
  verified_by       TEXT,
  suspended_at      TIMESTAMPTZ,
  suspension_reason TEXT,
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fi_type_idx        ON financial_institutions(type);
CREATE INDEX IF NOT EXISTS fi_status_idx      ON financial_institutions(status);
CREATE INDEX IF NOT EXISTS fi_country_idx     ON financial_institutions(hq_country);
CREATE INDEX IF NOT EXISTS fi_participant_idx ON financial_institutions(is_alia_participant);
CREATE INDEX IF NOT EXISTS fi_swift_idx       ON financial_institutions(swift_bic) WHERE swift_bic IS NOT NULL;

-- ─────────────────────────────────────────────
-- INSTITUTION LICENSES
-- One row per (institution × country × license_type).
-- Tracks multi-country regulatory presence.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_licenses (
  id               TEXT          PRIMARY KEY,
  institution_id   TEXT          NOT NULL REFERENCES financial_institutions(id) ON DELETE CASCADE,
  country_code     TEXT          NOT NULL,    -- ISO 3166-1 alpha-2
  license_type     TEXT          NOT NULL,    -- 'commercial_banking', 'e-money', 'payment_service', 'mobile_money'
  license_number   TEXT          NOT NULL,
  issuing_body     TEXT          NOT NULL,    -- 'CBN', 'Bank of Ghana', 'RBZ', etc.
  status           license_status NOT NULL DEFAULT 'active',

  issued_at        TIMESTAMPTZ   NOT NULL,
  expires_at       TIMESTAMPTZ,
  renewed_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revocation_note  TEXT,

  -- Scopes this license covers in this jurisdiction
  permitted_scopes JSONB         NOT NULL DEFAULT '[]',  -- ['deposits','transfers','fx','e-money']

  metadata         JSONB         NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE(institution_id, country_code, license_type)
);

CREATE INDEX IF NOT EXISTS il_institution_idx  ON institution_licenses(institution_id);
CREATE INDEX IF NOT EXISTS il_country_idx      ON institution_licenses(country_code);
CREATE INDEX IF NOT EXISTS il_status_idx       ON institution_licenses(status);
CREATE INDEX IF NOT EXISTS il_expires_idx      ON institution_licenses(expires_at) WHERE status = 'active';

-- ─────────────────────────────────────────────
-- INSTITUTION ROUTING PREFIXES
-- Maps account number prefixes / scheme identifiers to institutions.
-- Used by resolution-engine to route payments to the correct institution.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_routing_prefixes (
  id              TEXT          PRIMARY KEY,
  institution_id  TEXT          NOT NULL REFERENCES financial_institutions(id) ON DELETE CASCADE,
  country_code    TEXT          NOT NULL,
  scheme          prefix_scheme NOT NULL,
  prefix          TEXT          NOT NULL,    -- e.g. '058' (GTBank NUBAN), 'NG33...' (IBAN prefix), '+234802' (MSISDN)
  description     TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE(country_code, scheme, prefix)
);

CREATE INDEX IF NOT EXISTS irp_institution_idx ON institution_routing_prefixes(institution_id);
CREATE INDEX IF NOT EXISTS irp_prefix_idx      ON institution_routing_prefixes(prefix);
CREATE INDEX IF NOT EXISTS irp_scheme_idx      ON institution_routing_prefixes(scheme);
CREATE INDEX IF NOT EXISTS irp_active_idx      ON institution_routing_prefixes(is_active);

-- ─────────────────────────────────────────────
-- INSTITUTION SETTLEMENT ACCOUNTS
-- Where money lands when routed to this institution.
-- Multiple accounts per institution (e.g. per currency, per product).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_settlement_accounts (
  id               TEXT    PRIMARY KEY,
  institution_id   TEXT    NOT NULL REFERENCES financial_institutions(id) ON DELETE CASCADE,
  currency         TEXT    NOT NULL DEFAULT 'NGN',   -- ISO 4217
  account_token    TEXT    NOT NULL,                  -- encrypted routing reference
  account_name     TEXT    NOT NULL,
  bank_code        TEXT    NOT NULL,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  environment      TEXT    NOT NULL DEFAULT 'production',   -- 'sandbox' | 'production'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS isa_institution_idx ON institution_settlement_accounts(institution_id);
CREATE INDEX IF NOT EXISTS isa_currency_idx    ON institution_settlement_accounts(currency);
CREATE INDEX IF NOT EXISTS isa_active_idx      ON institution_settlement_accounts(is_active);

-- ─────────────────────────────────────────────
-- INSTITUTION EVENTS (audit trail)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_events (
  id              TEXT        PRIMARY KEY,
  institution_id  TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,    -- 'registered', 'verified', 'suspended', 'license_added', etc.
  actor_id        TEXT,
  actor_type      TEXT        NOT NULL DEFAULT 'system',
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ie_institution_idx ON institution_events(institution_id);
CREATE INDEX IF NOT EXISTS ie_type_idx        ON institution_events(event_type);
CREATE INDEX IF NOT EXISTS ie_time_idx        ON institution_events(created_at);

-- ─────────────────────────────────────────────
-- SEED: Major African financial institutions
-- These are the initial routing table entries.
-- ─────────────────────────────────────────────

INSERT INTO financial_institutions
  (id, institution_code, short_name, full_name, type, status, hq_country,
   swift_bic, is_alia_participant, is_resolution_target, is_alias_issuer,
   sandbox_enabled, production_enabled)
VALUES
-- Nigeria (CBN-regulated)
  ('fi_gtb',   '058', 'GTB',        'Guaranty Trust Bank',             'commercial_bank',      'active', 'NG', 'GTBINGLA', true,  true,  true,  true, false),
  ('fi_uba',   '033', 'UBA',        'United Bank for Africa',          'commercial_bank',      'active', 'NG', 'UNAFNGLA', true,  true,  true,  true, false),
  ('fi_access','044', 'ACCESS',     'Access Bank',                     'commercial_bank',      'active', 'NG', 'ABNGNGLA', true,  true,  true,  true, false),
  ('fi_zenith','057', 'ZENITH',     'Zenith Bank',                     'commercial_bank',      'active', 'NG', 'ZEIBNGLA', true,  true,  true,  true, false),
  ('fi_fbn',   '011', 'FBN',        'First Bank of Nigeria',           'commercial_bank',      'active', 'NG', 'FBNINGLA', true,  true,  true,  true, false),
  ('fi_kuda',  '090267','KUDA',     'Kuda Microfinance Bank',          'microfinance_bank',    'active', 'NG', NULL,       true,  true,  true,  true, false),
  ('fi_opay',  '999992','OPAY',     'OPay Digital Services',           'payment_service_bank', 'active', 'NG', NULL,       true,  true,  true,  true, false),
  ('fi_momo_ng','120003','MTN_MOMO_NG','MTN MoMo PSB Nigeria',         'payment_service_bank', 'active', 'NG', NULL,       false, true,  false, true, false),
-- Kenya
  ('fi_equity_ke','63880','EQUITY_KE','Equity Bank Kenya',             'commercial_bank',      'active', 'KE', 'EQBLKENA', false, true,  false, true, false),
  ('fi_mpesa',   'MPESA',  'MPESA',   'Safaricom M-Pesa',              'mobile_money',         'active', 'KE', NULL,       false, true,  false, true, false),
  ('fi_kcb',     '01234',  'KCB',     'Kenya Commercial Bank',         'commercial_bank',      'active', 'KE', 'KCBLKENA', false, true,  false, true, false),
-- Ghana
  ('fi_gcb',   'GCB',  'GCB',   'Ghana Commercial Bank',              'commercial_bank',      'active', 'GH', 'GHCBGHAC', false, true,  false, true, false),
  ('fi_mtn_gh','MTN_GH','MTN_MoMo_GH','MTN Mobile Money Ghana',       'mobile_money',         'active', 'GH', NULL,       false, true,  false, true, false),
-- South Africa
  ('fi_fnb',   'FNB',  'FNB',   'First National Bank',                'commercial_bank',      'active', 'ZA', 'FIRNZAJJ', false, true,  false, true, false),
  ('fi_capitec','CAP', 'CAPITEC','Capitec Bank',                       'commercial_bank',      'active', 'ZA', 'CABLZAJJ', false, true,  false, true, false),
-- Tanzania
  ('fi_crdb',  'CRDB', 'CRDB',  'CRDB Bank',                          'commercial_bank',      'active', 'TZ', 'CORUTZTZ', false, true,  false, true, false),
  ('fi_mpesa_tz','MPESA_TZ','MPESA_TZ','Vodacom M-Pesa Tanzania',      'mobile_money',         'active', 'TZ', NULL,       false, true,  false, true, false)
ON CONFLICT (institution_code) DO NOTHING;

-- Nigeria NUBAN routing prefixes for seeded institutions
INSERT INTO institution_routing_prefixes
  (id, institution_id, country_code, scheme, prefix, description)
VALUES
  ('irp_gtb',    'fi_gtb',    'NG', 'nuban', '058', 'GTBank NUBAN prefix'),
  ('irp_uba',    'fi_uba',    'NG', 'nuban', '033', 'UBA NUBAN prefix'),
  ('irp_access', 'fi_access', 'NG', 'nuban', '044', 'Access Bank NUBAN prefix'),
  ('irp_zenith', 'fi_zenith', 'NG', 'nuban', '057', 'Zenith Bank NUBAN prefix'),
  ('irp_fbn',    'fi_fbn',    'NG', 'nuban', '011', 'First Bank NUBAN prefix'),
  ('irp_kuda',   'fi_kuda',   'NG', 'nuban', '090267', 'Kuda MFB NUBAN prefix'),
  ('irp_opay',   'fi_opay',   'NG', 'nuban', '999992', 'OPay NUBAN prefix')
ON CONFLICT (country_code, scheme, prefix) DO NOTHING;
