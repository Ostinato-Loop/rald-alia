# RALD ALIA — Threat Model

**Classification:** Internal  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-13  
**Version:** 1.0 (Phase 1 baseline)

---

## System overview

RALD ALIA is a financial identity infrastructure layer for African markets. It maps human-readable aliases (phone numbers, bank accounts, national IDs) to routing metadata used by financial institutions to initiate transfers.

**Critical assets:**
- Alias→routing mappings (the core resolution database)
- Machine identity credentials (19 service-to-service JWTs)
- Developer API keys (`rald_key_prod_*`)
- KYC/identity documents and verification state
- Trust scores and consent mandates
- Institution routing prefixes

**Trust boundaries:**
1. Public internet → ALB / RALD Routing (Cloudflare Worker)
2. ALB → ECS services (VPC-internal)
3. ECS service → ECS service (machine JWT required)
4. ALIA services → RDS / ElastiCache / MSK (VPC-internal)
5. Developers → Gateway via API key

---

## STRIDE threat analysis

### S — Spoofing

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Forged machine JWT | Inter-service calls | HMAC-SHA256 with per-service `MACHINE_JWT_SECRET`; short-lived tokens (15 min) | Low — requires key compromise |
| Stolen developer API key | Gateway/resolution APIs | SHA-256 hash stored; key shown once; `last_used_at` tracked for anomaly detection | Medium — no hardware binding |
| Replay of valid machine JWT | Any internal service | `iat`/`exp` claims enforced; 15-min window limits replay utility | Low |
| Fake institution routing prefix | Resolution engine | `requireMachineScope('registry:write')` on all prefix write routes | Low |

**Recommended actions:**
- [ ] Add `jti` (JWT ID) claim to machine tokens and maintain a short-lived revocation list in Redis
- [ ] Add anomaly alerting when `last_used_at` changes IP range for developer API keys

---

### T — Tampering

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Alias record modification | Resolution DB | Machine JWT scope `alias:write` required; all writes emit Kafka events to audit-service | Low |
| Trust score manipulation | Trust service | `requireMachineScope('trust:write')`; score changes emit immutable events | Low |
| Consent mandate forgery | Consent service | Consent creation requires dual JWT (user + machine); stored with immutable `created_at` | Low |
| DB injection via alias input | RDS | Drizzle ORM parameterised queries; Zod type coercion on all inputs | Low |
| Webhook payload tampering | Developer callbacks | HMAC-SHA256 `X-RALD-Signature` on every delivery | Low |
| Terraform state manipulation | AWS infrastructure | S3 state bucket with versioning + DynamoDB lock; no direct state access | Medium — requires AWS cred compromise |

**Recommended actions:**
- [ ] Enable RDS audit logging (pgaudit) for all write operations
- [ ] Add row-level checksums to the `aliases` table for tamper-evidence

---

### R — Repudiation

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Operator denies alias resolution | Audit trail | Every resolution written to `audit_service` via Kafka `alia.audit.resolution` | Low |
| Developer denies API key usage | Developer audit | `developer_events` table immutable; `last_used_at` updated per request | Low |
| Machine service denies action | Machine JWT log | `machine_jwt_log` table in RDS with `machine_id`, `issued_at`, `ip_address` | Low |
| Webhook delivery disputed | Webhook delivery log | `developer_webhook_logs` with attempt count, response codes, timestamps | Low |

**Recommended actions:**
- [ ] Implement WORM (Object Lock) on S3 audit log exports for long-term evidence
- [ ] Export `developer_events` to CloudWatch Logs Insights for cross-service correlation

---

### I — Information Disclosure

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Internal service URLs in error responses | API consumers | 5xx errors return generic message; `logger.error` only, not `res.json(err)` | Low |
| Alias owner identity from resolution response | Third parties | Resolution returns routing metadata only — not the alias owner's name/ID | Low |
| Plaintext secrets in logs | CloudWatch Logs | Pino serialisers strip `Authorization` and `x-api-key` headers | Medium — relies on discipline |
| Database schema disclosure via error | Attackers | Drizzle errors caught and normalised; stack traces never sent to client | Low |
| API key in URL query string | Access logs | API keys sent in `Authorization: Bearer` header, not query params | Low |
| OTEL traces containing PII | OTEL collector | `X-Forwarded-For` only; alias values hashed before recording in span attributes | Medium |

**Recommended actions:**
- [ ] Add a Pino redact config for `*.password`, `*.secret`, `*.key`, `*.token` log fields
- [ ] Implement alias value hashing in OTEL span attributes (never log raw alias values)
- [ ] Enable CloudWatch Logs data protection policies for automatic PII masking

---

### D — Denial of Service

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Resolution endpoint flood | Resolution engine | `createRateLimiter(RateTier.STANDARD)` — 120 rpm per IP at gateway | Medium — IP spoofing possible |
| Large body injection | All services | `express.json({ limit: '1-2mb' })` body size cap | Low |
| Kafka consumer starvation | Audit/notification consumers | MSK auto-scaling; consumer group lag alerted via OTEL `alia.kafka.consumer.lag` | Medium |
| Slow webhook delivery blocking threads | Developer service | Webhook delivery is fire-and-forget; timeout 10s per attempt | Low |
| OTEL collector overload | Observability | `memory_limiter` processor + probabilistic sampling (20%) | Low |
| Database connection exhaustion | All services with DB | Drizzle connection pooling; `rds_connections` CloudWatch alarm at 100 | Medium |

**Recommended actions:**
- [ ] Add AWS WAF to the ALB with rate-based rules (1000 req/5min per IP)
- [ ] Implement Redis-backed rate limiting keyed by API key (not just IP) for developer endpoints
- [ ] Add MSK auto-scaling policy for consumer group lag

---

### E — Elevation of Privilege

| Threat | Target | Mitigation | Residual risk |
|--------|--------|------------|---------------|
| Developer API key scope escalation | Gateway/resolution | Scopes validated at `POST /v1/auth/verify-key`; no scope can be self-granted | Low |
| Machine service requests beyond its allowed scopes | Internal services | `requireMachineScope()` validates JWT `scopes` claim per route | Low |
| `applied` developer accessing production API | Developer service | `createProject(env: 'production')` blocked unless `developer.status === 'active'` | Low |
| Container escape → host access | ECS task | Fargate — no shared kernel with other tenants; no privileged containers | Low |
| Terraform role escalation | AWS | Least-privilege IAM per Terraform module; no `*` resource policies | Medium — IAM policies need review |

**Recommended actions:**
- [ ] Implement AWS IAM Access Analyzer to surface overly-permissive policies
- [ ] Add periodic review workflow for machine identity scope lists
- [ ] Enable ECS task definition `readonlyRootFilesystem: true` for all services

---

## Risk register

| ID | Threat | Severity | Likelihood | Priority | Owner |
|----|--------|----------|------------|----------|-------|
| R-01 | Machine JWT `jti` replay (no revocation) | High | Low | P2 | Infra |
| R-02 | PII in OTEL traces | Medium | Medium | P2 | Platform |
| R-03 | ALB lacks WAF rate-based rules | Medium | Medium | P1 | Infra |
| R-04 | IAM policies not reviewed by Access Analyzer | Medium | Low | P2 | Infra |
| R-05 | DB connections exhausted under load | Medium | Medium | P1 | Backend |
| R-06 | Secrets in pino log fields (discipline reliance) | Low | Low | P3 | Platform |
| R-07 | Alias values in OTEL span attrs | Medium | Medium | P2 | Platform |

**Priority definitions:** P1 = before GA, P2 = within 90 days, P3 = backlog

---

## Out of scope (Phase 1)

- End-user session management (handled by `rald-auth`, not ALIA)
- Physical infrastructure security (AWS responsibility)
- Supply-chain attacks on npm packages (mitigated by Dependabot + `npm audit`)
- Side-channel attacks on cryptographic operations
