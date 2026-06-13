# ALIA Phase 2 Roadmap

_Version 1.0 — June 2026_

## Phase 1 Summary (M0–M6) ✅

Phase 1 established the foundational infrastructure:

- **M0** — Core schema (users, aliases, bank links, routing profiles, audit logs)
- **M1** — ALIA Engines (trust, consent, merchant, KYC, governance policies)
- **M2** — ALIA Registry (canonical 7-dimension entity model, cross-service status propagation)
- **M3** — Identity State Machine (no orphaned reservations, automated cleanup jobs)
- **M4** — Machine Identity (service-to-service JWT authentication)
- **M5** — Institution Registry (financial institution catalogue, license management, routing prefixes)
- **M6** — Country Governance (DISABLED→INTERNAL→PRIVATE_BETA→PUBLIC_BETA→GA, compliance frameworks, data retention)

---

## Phase 2 Milestones

### M7 — Developer Registry (Q3 2026)

**Goal:** External developers and RALD products can integrate with ALIA via authenticated API keys.

**Deliverables:**
- `developer-service` with full CRUD
- API key lifecycle management
- Rate limiting per key (Redis-backed)
- Sandbox vs production environments
- Country and institution permission scopes
- Developer onboarding flow

**Success condition:** First external partner can call `alias:resolve` in sandbox.

---

### M8 — OpenAPI + SDK (Q3 2026)

**Goal:** ALIA has a versioned public API specification and developer SDKs.

**Deliverables:**
- OpenAPI 3.1 spec generated from all service routes
- TypeScript SDK for alias resolution
- Python SDK (basic) for resolution and identity
- Postman collection
- API changelog + versioning policy

**Success condition:** External developer can resolve an alias in < 10 lines of code.

---

### M9 — Test Coverage (Q4 2026)

**Goal:** Every ALIA engine has unit + integration tests. State machine transitions are fully covered.

**Deliverables:**
- Unit tests: PolicyEngine, TrustScoreEngine, CountryGovernanceEngine, ComplianceEngine, RetentionEngine
- Integration tests: All identity state machine transitions
- Integration tests: Registry status propagation via Kafka
- Load tests: resolution-engine (target: 1,000 resolutions/sec sustained)
- Contract tests: All service-to-service APIs

**Success condition:** CI/CD pipeline fails on any regression.

---

### M10 — ALIA Control Plane (Q4 2026)

**Goal:** RALD operators can manage the entire network from a single interface.

**Deliverables:**
- `control-plane-service` (BFF aggregating all ALIA service APIs)
- Admin UI: country governance, institution approval, entity management
- Emergency controls: country disable, entity suspend, key revoke
- Real-time audit feed
- Role-based access control (super-admin, country-admin, compliance-officer, read-only)
- Daily operational digest report

**Success condition:** Any country status change is executable from the UI in < 60 seconds.

---

### M11 — Infrastructure & Deployment (Q4 2026)

**Goal:** ALIA runs on production infrastructure with operational monitoring.

**Deliverables:**
- Docker images for all services
- Kubernetes manifests (or ECS task definitions)
- Terraform infrastructure for Postgres, Redis, Kafka
- Prometheus metrics + Grafana dashboards
- PagerDuty integration for SLA alerts
- Database migration strategy (Drizzle Kit)
- Secret management (Vault or AWS Secrets Manager)
- Multi-region setup for data residency (NG, ZA)

**Success condition:** P99 resolution latency < 200ms under 500 concurrent users.

---

### M12 — Nigeria GA Launch (Q1 2027)

**Goal:** ALIA is live in Nigeria (status: GA) with at least 3 institution partners.

**Deliverables:**
- At least 3 commercial banks onboarded (ACTIVE status)
- End-to-end alias resolution live in production
- CBN compliance report generated and submitted
- Tier 2 KYC flow live (BVN + NIN)
- NDPR data residency enforced
- STR reporting pipeline active (NFIU integration)
- Developer sandbox open to approved fintech partners

**Success condition:** 1,000 real aliases registered, 100 successful resolutions/day.

---

## Country Launch Sequence (Post-M12)

| Country | Target Status | Target Date | Prerequisite |
|---|---|---|---|
| Nigeria (NG) | GA | Q1 2027 | M12 |
| Ghana (GH) | PRIVATE_BETA | Q2 2027 | BoG regulatory engagement |
| Kenya (KE) | PRIVATE_BETA | Q3 2027 | CBK regulatory engagement |
| South Africa (ZA) | INTERNAL | Q4 2027 | SARB regulatory engagement |
| Rwanda (RW) | INTERNAL | Q1 2028 | BNR regulatory engagement |

---

## Architecture Evolution (Long-Term)

- **OPA/CEL policy evaluation** — replace the current simple condition evaluator with Open Policy Agent or Common Expression Language for complex governance rules
- **Event sourcing** — move from append-only log tables to a full event store (EventStoreDB or Kafka-backed)
- **CQRS for registry** — separate read models for high-traffic registry queries
- **GraphQL API gateway** — unified API surface for RALD products
- **Zero-trust networking** — mutual TLS between all ALIA services
