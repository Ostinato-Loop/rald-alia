# ALIA Country Governance

_Version 1.0 — June 2026_

## Principle

ALIA must operate under **explicit approval** in every jurisdiction. No country activates automatically. No services become available automatically. Every country transition requires an admin action.

---

## Country Status Lifecycle

```
DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
    ↑___________↑____________↑_______________↑______↑
    (DISABLED is reachable from any state — emergency brake)
```

### Status Definitions

| Status | Meaning | Who Can Access |
|---|---|---|
| `DISABLED` | Country is administratively off | No one |
| `INTERNAL` | RALD internal teams only | RALD engineers and testers |
| `PRIVATE_BETA` | Invited partners and institutions | Approved partners only |
| `PUBLIC_BETA` | Open to all users, limited support | All users, with caveats disclosed |
| `GA` | General Availability — full production | All users, full SLA |

---

## Initial Country Status

| Country | Currency | Regulatory Body | Initial Status |
|---|---|---|---|
| Nigeria (NG) | NGN | Central Bank of Nigeria (CBN) | **INTERNAL** |
| Ghana (GH) | GHS | Bank of Ghana (BoG) | DISABLED |
| Kenya (KE) | KES | Central Bank of Kenya (CBK) | DISABLED |
| South Africa (ZA) | ZAR | South African Reserve Bank (SARB) | DISABLED |
| Rwanda (RW) | RWF | National Bank of Rwanda (BNR) | DISABLED |

---

## Transition Rules

| From | Allowed Transitions |
|---|---|
| `DISABLED` | → `INTERNAL` |
| `INTERNAL` | → `PRIVATE_BETA`, → `DISABLED` |
| `PRIVATE_BETA` | → `PUBLIC_BETA`, → `DISABLED` |
| `PUBLIC_BETA` | → `GA`, → `DISABLED` |
| `GA` | → `DISABLED` |

**All transitions require:**
- Authenticated admin request (machine JWT with scope `governance:countries:write`)
- `actor_id` and `actor_type` recorded
- Optional `notes` explaining the reason
- Transition logged in `country_governance_events` (immutable)

---

## Compliance Frameworks by Country

### Nigeria (NG)
- CBN Open Banking Framework v1.0 (2023)
- Nigeria Data Protection Regulation (NDPR) — 2019
- NFIU Regulations — 2022

**Key rules:**
- BVN verification required for alias registration
- NIN verification required for alias registration
- Maximum 10 aliases per user
- STR reporting threshold: NGN 5,000,000
- Data residency: required in Nigeria

### Ghana (GH)
- Bank of Ghana Open Banking Guidelines v1.0 (2022)
- Ghana Data Protection Act 2012
- BoG AML/CFT Directive — 2022

**Key rules:**
- Ghana Card verification required
- Maximum 5 aliases per user
- STR reporting threshold: GHS 10,000
- Data residency: required in Ghana

### Kenya (KE)
- CBK Prudential Guidelines — 2022
- Kenya Data Protection Act 2019

**Key rules:**
- National ID verification required
- KRA PIN verification required
- Maximum 5 aliases per user
- STR reporting threshold: KES 150,000

### South Africa (ZA)
- FAIS, FICA, POPIA, NCA

**Key rules:**
- South African ID verification required
- Maximum 5 aliases per user
- STR reporting threshold: ZAR 25,000

### Rwanda (RW)
- BNR AML/CFT Guidelines — 2021
- Rwanda Data Protection Law — 2021

**Key rules:**
- Rwanda National ID verification required
- Maximum 5 aliases per user
- STR reporting threshold: RWF 1,000,000
- Data residency: required in Rwanda

---

## Country Governance API

```
GET    /v1/governance/countries              — list all countries + status
GET    /v1/governance/countries/summary      — eligibility summary by status
GET    /v1/governance/countries/:code        — get specific country
GET    /v1/governance/countries/:code/profile — full profile + rules + frameworks
GET    /v1/governance/countries/:code/events — transition history
POST   /v1/governance/countries/:code/status — transition status (admin-only)
POST   /v1/governance/countries/:code/check  — eligibility gate
```

---

## Effect on Other Services

When a country is DISABLED:
- resolution-engine must reject all alias resolution requests for that country
- identity-service must reject alias registration for that country
- governance-service `/check` returns `{ allowed: false }`

When a country is INTERNAL or above:
- Services can process requests from that jurisdiction
- Compliance frameworks apply immediately

---

## Data Retention Requirements

| Country | Identity Data | Transaction Audit | Alias Data |
|---|---|---|---|
| NG | 10 years (NFIU) | 15 years | 5 years |
| GH | 7 years | 10 years | 5 years |
| KE | 7 years | 10 years | 5 years |
| ZA | 5 years (POPIA) | 10 years (FICA) | 5 years |
| RW | 7 years | 10 years | 5 years |

All deletion schedules are enforced through the RetentionEngine in governance-service.
