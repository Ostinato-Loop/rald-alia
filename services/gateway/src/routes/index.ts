import { Router, Request, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { authenticate } from "../middleware/authenticate";
import { logger } from "../lib/logger";

const router = Router();

// ── Service URL helpers ───────────────────────────────────────────────────────
function svcUrl(envVar: string, fallback: string): string {
  const url = process.env[envVar];
  if (!url) {
    logger.warn(`${envVar} not set — falling back to ${fallback}`);
    return fallback;
  }
  return url;
}

const IDENTITY_URL    = svcUrl("IDENTITY_SERVICE_URL",    "http://localhost:4001");
const NOTIFICATION_URL= svcUrl("NOTIFICATION_SERVICE_URL","http://localhost:4002");
const ALIAS_URL       = svcUrl("ALIAS_SERVICE_URL",       "http://localhost:4003");
const ROUTING_URL     = svcUrl("ROUTING_SERVICE_URL",     "http://localhost:4004");
const TRUST_URL       = svcUrl("TRUST_SERVICE_URL",       "http://localhost:4005");
const FRAUD_URL       = svcUrl("FRAUD_SERVICE_URL",       "http://localhost:4006");
const CONSENT_URL     = svcUrl("CONSENT_SERVICE_URL",     "http://localhost:4007");
const VERIFICATION_URL= svcUrl("VERIFICATION_SERVICE_URL","http://localhost:4008");
const AUDIT_URL       = svcUrl("AUDIT_SERVICE_URL",       "http://localhost:4009");
const DIRECTORY_URL   = svcUrl("DIRECTORY_SERVICE_URL",   "http://localhost:4010");
const MERCHANT_URL    = svcUrl("MERCHANT_SERVICE_URL",    "http://localhost:4011");
const GOVERNANCE_URL  = svcUrl("GOVERNANCE_SERVICE_URL",  "http://localhost:4012");
const RESOLUTION_URL  = svcUrl("RESOLUTION_ENGINE_URL",   "http://localhost:4013");

// ── Proxy factory ─────────────────────────────────────────────────────────────
function proxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (err, _req, res) => {
        logger.error({ err, target }, "Proxy error");
        if (!res.headersSent) {
          (res as Response).status(502).json({
            error: { code: "BAD_GATEWAY", message: `Upstream service unavailable: ${target}` },
          });
        }
      },
      proxyReq: fixRequestBody,
    },
  });
}

// ── Health (no auth) ──────────────────────────────────────────────────────────
router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "alia-gateway", ts: new Date().toISOString() });
});

// ── Auth endpoints (public — no JWT required) ─────────────────────────────────
router.use("/v1/auth", proxy(IDENTITY_URL));

// ── Directory (public read) ────────────────────────────────────────────────────
router.use("/v1/directory", proxy(DIRECTORY_URL));

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require a valid Bearer JWT
// Gateway verifies token and injects x-user-id header downstream
// ─────────────────────────────────────────────────────────────────────────────

// ── Identity domain ───────────────────────────────────────────────────────────
router.use("/v1/users",         authenticate, proxy(IDENTITY_URL));
router.use("/v1/organizations", authenticate, proxy(IDENTITY_URL));
router.use("/v1/bank-links",    authenticate, proxy(IDENTITY_URL));

// ── Alias domain ─────────────────────────────────────────────────────────────
router.use("/v1/aliases", authenticate, proxy(ALIAS_URL));

// ── Resolution & Routing ──────────────────────────────────────────────────────
router.use("/v1/resolve",  authenticate, proxy(RESOLUTION_URL));
router.use("/v1/routing",  authenticate, proxy(ROUTING_URL));

// ── Consent & Mandates ────────────────────────────────────────────────────────
router.use("/v1/consents",    authenticate, proxy(CONSENT_URL));
router.use("/v1/mandates",    authenticate, proxy(CONSENT_URL));
router.use("/v1/permissions", authenticate, proxy(CONSENT_URL));

// ── Risk & Trust ──────────────────────────────────────────────────────────────
router.use("/v1/fraud", authenticate, proxy(FRAUD_URL));
router.use("/v1/trust", authenticate, proxy(TRUST_URL));

// ── Verification ──────────────────────────────────────────────────────────────
router.use("/v1/verification", authenticate, proxy(VERIFICATION_URL));

// ── Merchants ─────────────────────────────────────────────────────────────────
router.use("/v1/merchants", authenticate, proxy(MERCHANT_URL));

// ── Governance ────────────────────────────────────────────────────────────────
router.use("/v1/governance", authenticate, proxy(GOVERNANCE_URL));

// ── Audit ─────────────────────────────────────────────────────────────────────
router.use("/v1/audit", authenticate, proxy(AUDIT_URL));

// ── Notifications (internal, service-to-service only) ────────────────────────
router.use("/v1/notifications", authenticate, proxy(NOTIFICATION_URL));

export default router;
