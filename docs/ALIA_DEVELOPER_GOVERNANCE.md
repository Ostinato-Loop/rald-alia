# ALIA Developer Governance

_Version 0.1 — June 2026 (M7 — Planned)_

## Purpose

The Developer Registry and Developer Governance system controls how external developers and RALD products integrate with ALIA. It is the gateway between ALIA's internal infrastructure and the outside world.

---

## Developer Registry Entities

### Developer Account
A human developer or team registered to build on ALIA.

| Field | Description |
|---|---|
| `developer_id` | Unique identifier (registry_id pattern: `rald_dev_...`) |
| `name` | Developer or team name |
| `email` | Verified email |
| `organization_id` | Optional org link |
| `status` | active / suspended / revoked |
| `country` | Primary operating country |
| `kyc_verified` | Whether developer identity is verified |
| `created_at` | Registration date |

### Project
A logical grouping of API keys under a developer account.

| Field | Description |
|---|---|
| `project_id` | Unique identifier |
| `developer_id` | Owning developer |
| `name` | Project name |
| `description` | What the project does |
| `country_permissions` | Countries this project can operate in |
| `institution_permissions` | Institutions this project can route to |
| `environment` | sandbox / production |
| `status` | active / suspended |

### API Key
A credential that authenticates a project's API calls.

| Field | Description |
|---|---|
| `key_id` | Public key identifier |
| `key_hash` | Hashed secret (never stored in plain text) |
| `project_id` | Owning project |
| `scopes` | Allowed ALIA scopes |
| `rate_limit_rpm` | Requests per minute |
| `rate_limit_rpd` | Requests per day |
| `environment` | sandbox / production |
| `expires_at` | Optional expiry |
| `last_used_at` | Last API call timestamp |
| `status` | active / revoked / expired |

### Machine Identity (Developer)
For developer services that need service-to-service authentication. Extends ALIA's existing machine identity system.

---

## Permission Scopes

### Core Scopes

| Scope | Purpose |
|---|---|
| `alias:resolve` | Resolve aliases (core routing) |
| `alias:create` | Register aliases (requires KYC check) |
| `alias:read` | Read alias metadata |
| `identity:verify` | Submit KYC documents |
| `trust:read` | Read trust scores |
| `consent:grant` | Request consent from users |
| `consent:read` | Read active consents |
| `routing:initiate` | Initiate payment routing |
| `registry:read` | Read registry records |

### Admin Scopes (not available to external developers)

| Scope | Purpose |
|---|---|
| `governance:countries:write` | Manage country status |
| `governance:policies:write` | Manage governance policies |
| `governance:retention:write` | Manage data deletion |
| `institutions:write` | Manage institution records |
| `control_plane:*` | Control plane access |

---

## Rate Limits

| Tier | Requests/Min | Requests/Day | Description |
|---|---|---|---|
| Sandbox | 60 | 10,000 | For development and testing |
| Starter | 120 | 50,000 | Early-stage production |
| Growth | 500 | 500,000 | Scaling production |
| Enterprise | Custom | Custom | Direct agreement with RALD |

---

## Country Permissions

Each developer project must declare the countries it will operate in. ALIA will reject requests from a project if:

1. The requested country is not in the project's `country_permissions` list, OR
2. The country's governance status is `DISABLED`

---

## Institution Permissions

For routing operations, a project must be explicitly permitted to route to specific institutions. This is configurable per project and per institution.

---

## Developer Lifecycle

```
APPLIED → VERIFIED → ACTIVE
                        │
                   SUSPENDED
                        │
                    REVOKED
```

- **APPLIED**: Developer has submitted registration (email not verified)
- **VERIFIED**: Email verified, identity confirmed
- **ACTIVE**: Developer can create projects and API keys
- **SUSPENDED**: Temporary suspension (abuse, non-payment, investigation)
- **REVOKED**: Permanent removal from ALIA developer network

---

## Sandbox Environment

All developers start in sandbox mode. Sandbox:

- Uses isolated test data
- Does not route real transactions
- Provides synthetic alias resolution responses
- Has a fixed set of test institutions
- Has a fixed set of test users with known trust scores

Production access requires:
- Completed developer identity verification (KYC)
- At least one project with a stated purpose
- Country permission approval (for relevant jurisdiction)
- Acceptance of ALIA Developer Agreement

---

## Implementation Plan (M7)

1. Create `developer-service` following the institution-service pattern
2. Schema: `developers`, `developerProjects`, `apiKeys`, `developerEvents`
3. Routes: full CRUD for all entities
4. Middleware: API key authentication + rate limiting (Redis-backed)
5. Machine identity integration for developer machine accounts
6. Developer portal (admin UI for approvals)
