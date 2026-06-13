# ALIA Implementation Status

_Generated: June 2026_

## Service Readiness Matrix

| Service | Documentation % | Code % | Schema % | API % | Deployment % | Production Readiness % |
|---|---|---|---|---|---|---|
| Identity | 60 | 90 | 95 | 70 | 30 | 65 |
| Trust | 40 | 85 | 90 | 50 | 20 | 55 |
| Consent | 40 | 85 | 90 | 50 | 20 | 55 |
| Authorization | 30 | 60 | 70 | 40 | 20 | 40 |
| Routing | 50 | 80 | 85 | 60 | 20 | 55 |
| Directory (Registry) | 60 | 90 | 95 | 70 | 20 | 65 |
| Resolution | 50 | 85 | 80 | 60 | 20 | 55 |
| Fraud | 30 | 60 | 70 | 30 | 10 | 35 |
| Audit | 30 | 40 | 60 | 30 | 10 | 30 |
| Machine Identity | 60 | 90 | 90 | 70 | 30 | 65 |
| Developer Cloud | 0 | 0 | 0 | 0 | 0 | 0 |
| Institution Registry | 60 | 85 | 90 | 65 | 20 | 60 |
| Merchant Registry | 40 | 70 | 80 | 40 | 10 | 45 |

---

## Milestone Completion

### M0 — Core Schema ✅ Complete
- `users`, `organizations`, `aliases`, `bankLinks`, `routingProfiles`, `apiKeys`, `auditLogs`, `fraudEvents`, `webhooks`
- Full Drizzle ORM schema with indexes
- Enum types: aliasType, aliasStatus, riskLevel, environment

### M1 — ALIA Engines ✅ Complete
- TrustScoreEngine: weighted signal model, reputation engine, 5-tier classification
- ConsentEngine: mandate lifecycle (grant/revoke/expire), audit trail
- MerchantEngine: merchant profiles, collections
- KYCEngine: country-aware tier requirements (NG/GH/KE/ZA/RW), verification credentials
- PolicyEngine: DB-backed policy CRUD, condition evaluator, `validateRequest()` method
- Schema: `trustScores`, `trustSignals`, `consentMandates`, `consentEvents`, `merchantProfiles`, `merchantCollections`, `verificationCredentials`, `kycRequests`, `policies`

### M2 — ALIA Registry ✅ Complete
- Full 7-dimension entity model: identity, verification, trust, consent, routing, compliance
- Entity types: person, business, merchant, developer, institution, device, service
- `registry_id` generation with typed prefixes (`rald_prs_`, `rald_biz_`, etc.)
- Kafka consumer hooks: `onIdentityVerified`, `onKycUpgraded`, `onTrustScoreChanged`, `onSanctioned`
- Full transition event audit trail (`registryEvents`)

### M3 — Identity State Machine ✅ Complete
- Full lifecycle: AVAILABLE → PENDING → VERIFIED → ACTIVE → TRUSTED → SUSPENDED → ARCHIVED
- Alias lifecycle: AVAILABLE → PENDING → ACTIVE → SUSPENDED → DELETED (with 30-day quarantine)
- 4 background cleanup jobs with deterministic scheduling:
  - `releaseExpiredPendingClaims` — every 5 min
  - `releaseExpiredVerifiedClaims` — daily 02:00
  - `escalateSuspendedToArchived` — daily 03:00
  - `releaseArchivedUsernames` — daily 04:00
- Transition log in `identity_transitions` table

### M4 — Machine Identity ✅ Complete
- `machineIdentities` table + `machineJwtLog`
- JWT signing/verification in `@rald-alia/shared/machineJwt`
- `requireMachineJwt` + `requireMachineScope` middleware across all services
- `machine.routes.ts` for machine identity lifecycle

### M5 — Institution Registry ✅ Complete
- `financialInstitutions` (types: commercial_bank, microfinance_bank, fintech, mobile_money, payment_service_bank, neobank, central_bank, cooperative, insurance, investment, other)
- `institutionLicenses`, `institutionRoutingPrefixes`, `institutionSettlementAccounts`, `institutionEvents`
- institution-service: full CRUD + Kafka consumers
- Status: active, pending_verification, suspended, revoked, sandbox_only

### M6 — Country Governance ✅ Complete (this release)
- Country status lifecycle: DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
- Admin-gated transitions with full audit trail
- `countryGovernance` + `countryGovernanceEvents` tables
- Seed data: NG=INTERNAL, GH/KE/ZA/RW=DISABLED
- CountryRulesEngine: 5 jurisdictions, KYC tiers, transaction limits, compliance frameworks
- ComplianceEngine: 14 compliance frameworks, alias creation gate, report generation
- RetentionEngine: 7 retention classes aligned with NDPR/POPIA/DPA/BNR
- governance-service: full Express app with 4 route groups (country, policy, compliance, retention)

### M7 — Developer Registry ❌ Not Started
- Developer accounts, projects, API keys, machine identities, rate limits
- Country/institution permission scopes
- SDK access governance

### M8 — SDK Extraction ❌ Not Started
- JavaScript/TypeScript SDK for alias resolution
- OpenAPI spec generation
- Developer documentation site

### M9 — Test Coverage ❌ Not Started
- Unit tests for all engines
- Integration tests for state machine transitions
- Load tests for resolution engine

### M10 — Control Plane ❌ Not Started
- Admin console for the full ALIA network
- Country governance UI
- Institution approval workflow
- Real-time audit dashboard

---

## Critical Gaps

1. **No deployed infrastructure** — all services exist as code but have no deployment manifests (Docker, K8s, ECS)
2. **No API gateway** — services communicate internally but there is no public-facing API gateway
3. **No monitoring** — no Prometheus metrics, no health check aggregator, no alerting
4. **Developer Cloud (M7) is zero** — needed before any external integrations can begin
5. **No migration strategy** — schema exists in Drizzle but no migration scripts run against a real database
6. **Resolution engine requires Redis** — Redis dependency not provisioned
7. **Kafka dependency** — event publishing is wired but Kafka cluster is not provisioned

---

## Next Priority

1. Provision infrastructure (Postgres, Redis, Kafka)
2. Build Developer Registry (M7)
3. Generate OpenAPI spec from existing routes
4. Deploy institution-service + governance-service to internal environment
