# ALIA Network Operations

_Version 0.1 — June 2026_

## Overview

This document defines how the ALIA network is operated day-to-day, including monitoring, incident response, country activation procedures, institution onboarding, and compliance reporting.

---

## Service Inventory

| Service | Port | Depends On | Health Check |
|---|---|---|---|
| identity-service | 3001 | Postgres, Kafka | `GET /healthz` |
| trust-service | 3002 | Postgres, Kafka | `GET /healthz` |
| consent-service | 3003 | Postgres, Kafka | `GET /healthz` |
| governance-service | 3008 | Postgres | `GET /healthz` |
| resolution-engine | 3005 | Postgres, Redis, Kafka | `GET /healthz` |
| registry-service | 3006 | Postgres, Kafka | `GET /healthz` |
| institution-service | 3010 | Postgres, Kafka | `GET /healthz` |
| verification-service | 3007 | Postgres, Kafka | `GET /healthz` |
| merchant-service | 3004 | Postgres, Kafka | `GET /healthz` |

---

## Startup Sequence

Services must start in this order to avoid dependency failures:

1. Postgres
2. Redis
3. Kafka
4. governance-service (seeds country governance records)
5. registry-service
6. identity-service
7. institution-service
8. verification-service
9. trust-service
10. consent-service
11. merchant-service
12. resolution-engine

---

## Country Activation Procedure

When a country is ready to move to a new status:

1. **Pre-flight check** — confirm all applicable compliance frameworks are loaded in governance-service
2. **Institution check** — at least one institution with ACTIVE status exists for the country
3. **Infrastructure check** — data residency requirements are met (if applicable)
4. **Admin action** — authorized admin calls `POST /v1/governance/countries/:code/status` with `to_status`
5. **Verification** — call `GET /v1/governance/countries/:code` to confirm new status
6. **Notification** — internal Slack/notification sent to relevant stakeholders
7. **Log** — action is recorded in `country_governance_events`

**Emergency disable**: Any authorized admin can call the status endpoint with `to_status: DISABLED` at any time. This immediately blocks all new alias registrations and routing for that country.

---

## Institution Onboarding Procedure

1. Institution submits application via institution-service (`POST /v1/institutions`)
2. ALIA compliance team reviews license documentation
3. Routing prefixes are configured (`POST /v1/institutions/:id/routing-prefixes`)
4. Settlement account is linked (`POST /v1/institutions/:id/settlement-accounts`)
5. Status is transitioned: `pending_verification` → `verified` → `active`
6. Sandbox credentials are issued to institution's technical team
7. Production routing is enabled after sandbox testing

**SLA:** Institution onboarding target: 5 business days from application to ACTIVE.

---

## Monitoring (Target State — M11)

### Key Metrics

| Metric | SLO | Alert Threshold |
|---|---|---|
| Alias resolution P50 latency | < 50ms | > 100ms |
| Alias resolution P99 latency | < 200ms | > 500ms |
| Resolution success rate | > 99.5% | < 99% |
| Identity service uptime | > 99.9% | Any downtime |
| Governance-service uptime | > 99.9% | Any downtime |
| Policy validation P99 | < 100ms | > 200ms |

### Dashboards

- **Resolution Health** — success rate, latency percentiles, cache hit rate, Redis status
- **Identity Lifecycle** — active PENDING claims, expired claims released, suspended users
- **Country Governance** — status per country, recent transitions
- **Institution Health** — ACTIVE institutions per country, routing prefix count
- **Trust Network** — trust score distribution, fraud flag rate
- **Compliance** — policy violations per day, alias limit rejections

---

## Incident Response

### Severity Levels

| Severity | Example | Response Time | Resolution Target |
|---|---|---|---|
| P1 — Critical | Resolution service down | 5 min | 30 min |
| P2 — High | Country accidentally enabled/disabled | 15 min | 2 hours |
| P3 — Medium | Elevated policy violation rate | 1 hour | 8 hours |
| P4 — Low | Slow identity cleanup job | Next business day | 48 hours |

### P1 Runbook (Resolution Service Down)

1. Check resolution-engine health: `GET /healthz`
2. Check Redis connectivity: `redis-cli ping`
3. Check Postgres connectivity: `psql -c "SELECT 1"`
4. Restart resolution-engine pod/container
5. Verify resolution success rate returns to > 99%
6. Post incident summary to #alia-ops

---

## Compliance Reporting

### Automated Reports

| Report | Frequency | Recipients |
|---|---|---|
| STR (Suspicious Transaction Report) | Real-time trigger | Compliance team → NFIU/regulator |
| Daily Transaction Volume | Daily | Risk team |
| Active Entity Count | Weekly | RALD leadership |
| Country Compliance Status | Monthly | Legal team |

### Manual Reports

- NDPR annual compliance report (Nigeria)
- POPIA compliance review (South Africa)
- CBN quarterly return
- BoG quarterly return

All reports use data from governance-service `/v1/governance/compliance/report`.

---

## Data Retention Enforcement

The RetentionEngine in governance-service manages all deletion schedules. The scheduled deletion worker (to be built in M11) runs nightly and executes all `deletion_schedules` records with `execution_date <= NOW()`.

**Deletion methods:**
- `hard_delete` — row permanently removed from database
- `anonymize` — PII columns replaced with hashed values; record retained for audit
- `archive` — record moved to cold storage (S3 Glacier or equivalent)

**Right-to-erasure (user-initiated):** When a user requests deletion:
- Alias records: immediate soft-delete + 30-day quarantine
- Identity data: scheduled for anonymization in 30 days (per NDPR cooling-off)
- Audit records: retained for statutory period (no erasure)
- Consent records: retained for statutory period (proof of prior consent)
