# ALIA Ownership Model

_Version 1.0 — June 2026_

## Core Principle

ALIA is **permanent infrastructure**. It is not a product. It is the network every RALD product is built on.

Products consume ALIA. Products never reimplement ALIA.

---

## What ALIA Owns

ALIA owns the canonical implementation of every foundational network service. No RALD product may build a competing version of any item below.

### Identity
- Who someone is across the RALD network
- Username + alias claim lifecycle (AVAILABLE → PENDING → VERIFIED → ACTIVE → TRUSTED → SUSPENDED → ARCHIVED)
- BVN/NIN/Ghana Card/National ID binding
- Cross-product identity resolution
- **Owner:** identity-service

### Trust
- Trust score computation for every entity (person, business, merchant, institution)
- Signal weighting (verification, transactions, fraud events, disputes)
- Reputation profiles
- **Owner:** trust-service

### Consent
- Explicit consent grants and revocations
- Mandate lifecycle (payment mandates, data access grants)
- Consent audit trail
- **Owner:** consent-service

### Authorization
- Policy-based access control (governance policies)
- Rule evaluation with condition matching
- Scope-based machine authorization
- **Owner:** governance-service

### Routing
- Alias → bank account resolution
- Routing token issuance and verification
- Routing profile management
- **Owner:** resolution-engine

### Directory (Registry)
- Canonical object system: every entity has one `registry_id`
- 7-dimension status model per entity
- Cross-service status propagation via Kafka
- **Owner:** registry-service

### Resolution
- Public alias resolution endpoint
- Redis-cached routing metadata
- Account token management (never exposed to callers)
- **Owner:** resolution-engine

### Machine Identity
- Service-to-service JWT authentication
- Machine identity lifecycle
- Scope-based permission enforcement
- **Owner:** identity-service + shared/machineJwt

### Fraud Signals
- Fraud event ingestion and classification
- Risk level assignment
- Fraud score contribution to trust scores
- **Owner:** trust-service (fraud dimension)

### Risk Signals
- Behavioural anomaly detection
- Transaction pattern analysis
- Risk-weighted routing decisions
- **Owner:** trust-service + governance-service

### Audit Network
- Immutable event log for every ALIA action
- Policy violation log
- Identity transition log
- Consent audit trail
- Routing decision log
- **Owner:** Distributed across all services (append-only tables)

### Institution Registry
- Financial institution catalogue
- License verification
- Routing prefix management
- Settlement account management
- ALIA participation status
- **Owner:** institution-service

### Merchant Registry
- Merchant profiles and verification
- Collection management
- Merchant compliance status
- **Owner:** merchant-service

### Business Registry
- Business entity registration
- RC number binding
- Tax ID binding
- **Owner:** registry-service (business entity type)

### Developer Registry _(M7 — not yet built)_
- Developer accounts and projects
- API key lifecycle
- Rate limit enforcement
- Country and institution permission scopes
- **Owner:** developer-service (planned)

### Government Registry _(planned)_
- Government entity registration
- Regulatory body profiles
- Policy mandate binding
- **Owner:** governance-service (planned extension)

---

## What RALD Products Own

RALD products build on top of ALIA. They own their product-specific logic but must delegate all identity, routing, trust, and consent operations to ALIA.

| Product | What It Owns | What It Must Delegate to ALIA |
|---|---|---|
| **Loop** | Social graph, posts, messaging UX | Identity, alias resolution, trust score display |
| **Messenger** | Message threading, media delivery | Identity verification, consent for data access |
| **PayRald** | Payment UX, transaction history display | Alias resolution, routing, mandate management |
| **GitRald** | Code repository, pull requests, CI/CD | Developer identity, machine identity for CI runners |
| **Raldtics** | Analytics dashboards, data pipelines | Identity, consent for data processing |
| **TradeOS** | Trade order management, market data | Identity, KYC gate, fraud score |
| **DunaRald** | Savings products, interest calculation | Identity, routing, mandate management |
| **RALD Mail** | Email delivery, inbox management | Identity, alias resolution for @ addresses |
| **RALD TV** | Content streaming, creator monetization | Identity, consent for content access |

### Prohibited Actions (for all products)

Products **must not**:

- Create a competing username/alias system
- Implement their own KYC pipeline
- Implement their own trust score
- Implement their own routing or bank account resolution
- Implement their own consent storage
- Issue machine JWTs outside of ALIA's machine identity system
- Create a competing institution registry
- Hard-code bank routing logic

---

## Enforcement

All RALD product services must:

1. Authenticate via machine JWT issued by ALIA identity-service
2. Call ALIA's resolution-engine for all alias resolution
3. Store zero trust scores locally — read from trust-service
4. Record all consent operations through consent-service
5. Check country governance status before serving requests to a jurisdiction
6. Check institution status before routing to any institution

---

## Version Control

This ownership model is enforced at the architectural review stage of every new RALD product or feature. Any deviation requires a formal Architecture Decision Record (ADR) and sign-off from the RALD infrastructure team.
