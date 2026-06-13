# ALIA Institution Governance

_Version 1.0 — June 2026_

## Principle

Institutions (banks, fintechs, processors, mobile money operators, government entities) must be **explicitly approved** before they can participate in ALIA routing. No institution can receive or initiate routed payments without ACTIVE status.

---

## Institution Lifecycle

```
PENDING → VERIFIED → ACTIVE → RESTRICTED → SUSPENDED → REVOKED
                        ↑                      │
                        └──────────────────────┘
                            (admin reinstatement)
```

### Status Definitions

| Status | Meaning | Can Route? |
|---|---|---|
| `pending_verification` | Application submitted, under review | ❌ |
| `verified` | Documents and license confirmed | ❌ |
| `active` | Full ALIA participant, routing enabled | ✅ |
| `restricted` | Partial restrictions applied (e.g. send-only) | Partial |
| `suspended` | Temporarily suspended, routing halted | ❌ |
| `revoked` | ALIA participation permanently revoked | ❌ |

---

## Institution Types

| Type | Description |
|---|---|
| `commercial_bank` | Licensed commercial bank |
| `microfinance_bank` | Microfinance institution |
| `fintech` | Fintech company with payment license |
| `mobile_money` | Mobile money operator |
| `payment_service_bank` | PSB (Nigeria-specific) |
| `neobank` | Digital-only bank |
| `central_bank` | Central bank (special permissions) |
| `cooperative` | Cooperative financial institution |
| `insurance` | Insurance company |
| `investment` | Investment firm |
| `other` | Other licensed financial entity |

---

## Approval Requirements

Before an institution can become `ACTIVE`, the following must be verified:

1. **License verification** — regulatory license confirmed with the relevant authority (CBN, BoG, CBK, SARB, BNR)
2. **Routing prefix assignment** — at least one routing prefix registered (NUBAN, IBAN, MSISDN, SWIFT/BIC)
3. **Settlement account** — at least one settlement account configured for net settlement
4. **Institution code** — unique ALIA institution code assigned
5. **ALIA participation flag** — `is_alia_participant = true`

---

## License Management

Each institution can hold multiple licenses:

- `active` — valid and in good standing
- `pending` — submitted, awaiting regulator confirmation
- `expired` — lapsed, institution cannot be ACTIVE until renewed
- `revoked` — license revoked by regulator (triggers institution suspension)
- `suspended` — license suspended pending investigation

If any institution's license transitions to `revoked` or `expired`:
- Institution status automatically moves to `suspended`
- All alias routing for that institution is halted
- A `INSTITUTION_ROUTING_SUSPENDED` Kafka event is published

---

## Routing Prefix Schemes

| Scheme | Countries | Format |
|---|---|---|
| `nuban` | NG | 10-digit account number |
| `iban` | ZA, GH, RW | ISO 13616 IBAN |
| `mobile_msisdn` | KE, GH, RW | International phone format |
| `swift_bic` | All | 8 or 11 character BIC |
| `internal` | All | ALIA internal routing code |

---

## Institution API (institution-service)

```
POST   /v1/institutions                      — register institution (admin)
GET    /v1/institutions                      — list institutions (public read)
GET    /v1/institutions/:id                  — get institution
GET    /v1/institutions/code/:code           — get by institution code
PATCH  /v1/institutions/:id                  — update institution (admin)
POST   /v1/institutions/:id/status           — transition status (admin)

POST   /v1/institutions/:id/licenses         — add license
PATCH  /v1/institutions/:id/licenses/:lid    — update license

POST   /v1/institutions/:id/routing-prefixes — add routing prefix
POST   /v1/institutions/:id/settlement-accounts — add settlement account
```

---

## Institution Governance in Routing

The resolution-engine checks institution status before completing any resolution:

```
resolve(alias) →
  lookup alias in DB →
  check institution status:
    if status != 'active' → throw INSTITUTION_UNAVAILABLE
  generate routing token →
  return routing metadata
```

This ensures that a suspended institution cannot receive funds even if its aliases are still registered.

---

## Compliance Checks

Before routing to any institution, the resolution-engine must verify:

1. Institution status is `active`
2. Institution's `is_resolution_target` flag is `true`
3. The country is at least `INTERNAL` status in country governance
4. No active sanctions match on the institution

If any check fails, resolution returns a structured error with the specific reason, so the initiating bank can display an appropriate message to the user.
