-- ALIA Platform — Migration 0008: Control Plane
-- Registers the control-plane service machine identity and its admin scopes.
-- The control plane is the only service authorised to:
--   • read network-wide health across all services
--   • approve/reject developer applications
--   • trigger country status transitions
--   • view institution onboarding pipeline
-- Apply with: psql $DATABASE_URL -f 0008_control_plane.sql

-- ─────────────────────────────────────────────
-- MACHINE IDENTITY: control-plane
-- Scopes follow the pattern control:<domain>:<action>
-- ─────────────────────────────────────────────

INSERT INTO machine_identities
  (id, service_name, display_name, client_secret_hash, allowed_scopes, allowed_services, environment)
VALUES
  ('mach_control_plane', 'control-plane', 'ALIA Control Plane',
   '$2b$12$PLACEHOLDER_CONTROL_PLANE',
   '[
     "control:health:read",
     "control:network:read",
     "control:countries:read",
     "control:countries:write",
     "control:developers:read",
     "control:developers:write",
     "control:institutions:read",
     "developers:write",
     "governance:countries:write",
     "governance:countries:read",
     "policy:read"
   ]',
   '[
     "identity-service",
     "trust-service",
     "consent-service",
     "merchant-service",
     "resolution-engine",
     "registry-service",
     "verification-service",
     "governance-service",
     "developer-service",
     "institution-service"
   ]',
   'production')
ON CONFLICT (service_name) DO NOTHING;

-- ─────────────────────────────────────────────
-- CONTROL PLANE AUDIT LOG
-- Tracks every action taken through the control plane
-- for compliance and incident response.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS control_plane_events (
  id            TEXT        PRIMARY KEY,
  action        TEXT        NOT NULL,   -- 'country.transition','developer.approve','developer.revoke'…
  actor_id      TEXT        NOT NULL,
  actor_type    TEXT        NOT NULL DEFAULT 'machine',
  target_type   TEXT        NOT NULL,   -- 'country','developer','institution','network'
  target_id     TEXT,                   -- the affected entity id (country_code, developer_id, etc.)
  result        TEXT        NOT NULL,   -- 'success','failure'
  error_code    TEXT,
  request_id    TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cpe_action_idx     ON control_plane_events(action);
CREATE INDEX IF NOT EXISTS cpe_actor_idx      ON control_plane_events(actor_id);
CREATE INDEX IF NOT EXISTS cpe_target_idx     ON control_plane_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS cpe_result_idx     ON control_plane_events(result);
CREATE INDEX IF NOT EXISTS cpe_time_idx       ON control_plane_events(created_at);

-- ─────────────────────────────────────────────
-- SANDBOX: Register control-plane for sandbox env
-- ─────────────────────────────────────────────

INSERT INTO machine_identities
  (id, service_name, display_name, client_secret_hash, allowed_scopes, allowed_services, environment)
VALUES
  ('mach_control_plane_sb', 'control-plane-sandbox', 'ALIA Control Plane (Sandbox)',
   '$2b$12$PLACEHOLDER_CONTROL_PLANE_SB',
   '[
     "control:health:read",
     "control:network:read",
     "control:countries:read",
     "control:countries:write",
     "control:developers:read",
     "control:developers:write",
     "control:institutions:read",
     "developers:write",
     "governance:countries:write",
     "governance:countries:read",
     "policy:read"
   ]',
   '[
     "identity-service","trust-service","consent-service","merchant-service",
     "resolution-engine","registry-service","verification-service",
     "governance-service","developer-service","institution-service"
   ]',
   'sandbox')
ON CONFLICT (service_name) DO NOTHING;
