# ALIA Registry Architecture

_Version 1.0 — June 2026_

## Purpose

The ALIA Registry is the canonical object system for the entire RALD network. Every entity — every person, business, merchant, institution, developer, device, and service — is registered here and assigned a globally unique `registry_id`. All future ALIA systems reference entities by their `registry_id`.

---

## Registry ID Format

```
rald_{type_prefix}_{12-char-uid}
```

| Entity Type | Prefix | Example |
|---|---|---|
| Person | `prs` | `rald_prs_a1b2c3d4e5f6` |
| Business | `biz` | `rald_biz_9k2m1n3p4q5r` |
| Merchant | `mrt` | `rald_mrt_x7y8z9a1b2c3` |
| Developer | `dev` | `rald_dev_d4e5f6g7h8i9` |
| Institution | `ins` | `rald_ins_j1k2l3m4n5o6` |
| Device | `dvc` | `rald_dvc_p7q8r9s1t2u3` |
| Service | `svc` | `rald_svc_v4w5x6y7z8a1` |

---

## Entity Status Model

Every registry record carries 6 independent status dimensions. Each dimension evolves independently and is updated by the owning service via Kafka events.

### 1. Identity Status
Controlled by: identity-service

| Status | Meaning |
|---|---|
| `pending` | Registration in progress |
| `verified` | Identity documents confirmed |
| `active` | Fully active ALIA participant |
| `trusted` | Elevated trust tier achieved |
| `suspended` | Temporarily restricted |
| `archived` | Permanently deactivated |

### 2. Verification Status
Controlled by: verification-service (KYC)

| Status | Tier | Meaning |
|---|---|---|
| `unverified` | 0 | No documents provided |
| `tier1` | 1 | Phone number confirmed |
| `tier2` | 2 | Government ID verified |
| `tier3` | 3 | Enhanced due diligence complete |

### 3. Trust Status
Controlled by: trust-service

| Status | Score Range | Meaning |
|---|---|---|
| `unscored` | — | No trust signals yet |
| `basic` | 0–39 | Minimal trust history |
| `standard` | 40–69 | Normal ALIA participant |
| `trusted` | 70–89 | High-trust entity |
| `elite` | 90–100 | Elite verified entity |

### 4. Consent Status
Controlled by: consent-service

| Status | Meaning |
|---|---|
| `none` | No consents recorded |
| `has_consents` | At least one active consent |
| `all_revoked` | All consents have been revoked |

### 5. Routing Status
Controlled by: resolution-engine

| Status | Meaning |
|---|---|
| `unlinked` | No bank account linked |
| `linked` | Bank account linked, not yet active |
| `active` | Fully routable |
| `suspended` | Routing suspended |

### 6. Compliance Status
Controlled by: governance-service

| Status | Meaning |
|---|---|
| `pending` | Compliance review not completed |
| `compliant` | All applicable requirements met |
| `review` | Under compliance review |
| `restricted` | Partial restrictions applied |
| `sanctioned` | Entity is on a sanctions list |

---

## Status Propagation

All ALIA services publish events to Kafka. The registry-service subscribes to these events and updates the corresponding dimension.

```
identity-service    → IDENTITY_VERIFIED, IDENTITY_ACTIVATED, IDENTITY_SUSPENDED
verification-service → KYC_TIER_UPGRADED
trust-service       → TRUST_SCORE_UPDATED
consent-service     → CONSENT_GRANTED, CONSENT_REVOKED
resolution-engine   → ROUTING_ACTIVATED, ROUTING_SUSPENDED
governance-service  → COMPLIANCE_STATUS_CHANGED, ENTITY_SANCTIONED
```

---

## API Surface

All registry operations go through registry-service.

```
POST   /v1/registry              — register a new entity
GET    /v1/registry              — list entities (filterable)
GET    /v1/registry/:registry_id — get entity by registry_id
GET    /v1/registry/entity/:id   — get entity by service entity_id
POST   /v1/registry/:id/transition — update a status dimension
GET    /v1/registry/:id/events   — get full transition history
GET    /v1/registry/stats        — aggregate counts by status
```

---

## Invariants

1. Every entity has exactly one registry record — `UNIQUE(entity_type, entity_id)` is enforced at the database level.
2. Registry records are never deleted — only archived.
3. Every status transition is logged in `registry_events` (immutable append-only).
4. The registry does not own any of the dimensions it tracks — it is a read-optimised projection updated by domain services.
5. `registry_id` is the canonical cross-service identifier. Services must not pass raw `user_id`, `merchant_id`, etc. across service boundaries when a registry lookup is available.
