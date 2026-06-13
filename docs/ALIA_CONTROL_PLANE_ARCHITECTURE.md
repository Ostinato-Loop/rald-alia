# ALIA Control Plane Architecture

_Version 0.1 — June 2026 (M10 — Planned)_

## Purpose

The ALIA Control Plane is the operational interface for the entire network. It allows RALD infrastructure administrators to observe, govern, and operate every dimension of the ALIA network from a single system.

---

## Sections

### Identity
- View and manage user identity lifecycle
- Force transitions (suspend, archive, reinstate)
- View identity transition audit log
- Release stuck PENDING claims manually

### Routing
- View routing profiles per entity
- Inspect active routing tokens
- Trigger routing status changes
- View resolution cache hit rates

### Trust
- View trust scores per entity
- Manually adjust trust signal weights
- Flag or unflag entities for review
- View trust history and component breakdown

### Consent
- View active consents per entity
- Revoke consents (admin-initiated, requires legal basis)
- View consent audit trail

### Authorization
- Create, update, deactivate governance policies
- Test policy evaluation with context injection
- View policy violation log
- Manage machine identity scopes

### Registry
- View all registered entities by type, country, status
- Manually trigger dimension transitions
- View cross-dimension status summary per entity

### Institutions
- Approve, restrict, suspend, or revoke institutions
- View institution routing prefixes
- Manage settlement accounts
- View institution event history

### Merchants
- View and manage merchant profiles
- Approve or restrict merchants
- View merchant collections

### Businesses
- View registered business entities
- Verify RC/tax ID bindings

### Developers _(M7)_
- View developer accounts and projects
- Manage API keys and rate limits
- Assign country and institution permission scopes
- Revoke access

### Machine Identities
- View all machine identities by service
- Rotate machine JWT signing keys
- View JWT issuance log

### Fraud
- View fraud event feed
- Create or update fraud policies
- View risk score distribution

### Audit
- Full immutable event log across all services
- Cross-service audit trail per entity
- Compliance report export

### Country Governance
- View all jurisdictions and current status
- Transition country status (DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA)
- View country transition history
- Emergency disable any country

### Feature Governance
- Enable/disable features per country or institution
- A/B test configuration
- Rollout management

### API Governance
- View API key usage
- Set rate limits per key or tier
- Deprecate API versions

### Developer Governance _(M7)_
- Developer portal administration
- SDK version management
- Changelog and deprecation notices

---

## API Design

The Control Plane is not a single service — it is an admin API that aggregates calls to all individual ALIA services. It requires elevated machine identity scopes:

- `control_plane:read` — read access across all services
- `control_plane:write` — write access for status transitions
- `control_plane:emergency` — emergency disable operations (country, institution, entity)

All Control Plane actions are double-logged: once in the originating service's audit table, and once in a central `control_plane_events` table.

---

## Implementation Plan (M10)

1. Build `control-plane-service` as an aggregating Express/BFF service
2. Wire authenticated calls to all ALIA service APIs
3. Build the admin UI (Next.js or internal React app)
4. Implement emergency controls: country disable, entity suspend, key revoke
5. Connect real-time audit feed via WebSocket
6. Implement role-based access (super-admin, country-admin, compliance-officer, read-only)

---

## Access Control Model

| Role | Can Read | Can Transition | Can Emergency |
|---|---|---|---|
| super-admin | All | All | All |
| country-admin | Own country | Own country entities | Own country only |
| compliance-officer | All | Compliance dimensions | None |
| fraud-analyst | Fraud + Trust | Fraud flags | None |
| read-only | All | None | None |
