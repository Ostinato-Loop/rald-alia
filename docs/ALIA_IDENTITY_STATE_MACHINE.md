# ALIA Identity State Machine

_Version 1.0 — June 2026_

## The Problem This Solves

Without a formal state machine, usernames can become permanently reserved before registration succeeds. A user who begins registration and abandons it would lock the username indefinitely — creating ghost identities and a broken UX.

ALIA's identity state machine makes every transition explicit, reversible (within rules), and time-bounded.

---

## User Identity Lifecycle

```
AVAILABLE
    │  (registration begins)
    ▼
PENDING ──── TTL: 15 minutes ──── expires → AVAILABLE
    │  (verification complete)
    ▼
VERIFIED ──── TTL: 7 days ──── expires → PENDING
    │  (profile complete, account activated)
    ▼
ACTIVE
    │  (trust signals accumulated)
    ▼
TRUSTED
    │  (admin action or policy trigger)
    ▼
SUSPENDED ──── 90 days ──── auto-escalates → ARCHIVED
    │  (or explicit admin archive)
    ▼
ARCHIVED
    │  (30-day quarantine on username)
    ▼
AVAILABLE  (username released back to pool)
```

### State Definitions

| Status | Meaning | TTL / Auto-transition |
|---|---|---|
| `available` | Username is unclaimed and available for registration | None |
| `pending` | Registration in progress — username temporarily held | 15 minutes → AVAILABLE |
| `verified` | Identity documents accepted — waiting for profile completion | 7 days → PENDING |
| `active` | Fully active ALIA account | None |
| `trusted` | Elevated trust tier — additional privileges unlocked | None |
| `suspended` | Account temporarily restricted | 90 days → ARCHIVED |
| `archived` | Account permanently deactivated | Username quarantine: 30 days → AVAILABLE |

---

## Alias Lifecycle

Aliases (payment handles) follow a simpler lifecycle:

```
AVAILABLE → PENDING → ACTIVE → SUSPENDED → DELETED
                                              │ (30-day quarantine)
                                              ▼
                                           AVAILABLE
```

---

## Transition Rules

The `@rald-alia/shared` package contains `validateUserTransition(from, to, trigger)` which enforces all allowed transitions.

### Allowed User Transitions

| From | To | Trigger | Who |
|---|---|---|---|
| available | pending | user_registration | user |
| pending | verified | verification_complete | verification-service |
| pending | available | registration_expired | background job |
| verified | active | profile_complete | user |
| verified | pending | verification_window_expired | background job |
| active | trusted | trust_threshold_met | trust-service |
| active | suspended | admin_action / fraud_detected | admin / fraud system |
| trusted | suspended | admin_action / fraud_detected | admin / fraud system |
| suspended | active | admin_action | admin |
| suspended | archived | suspension_expired | background job |
| any | archived | admin_action | admin |
| archived | available | username_released | background job |

---

## Background Jobs

Four cleanup jobs run inside the identity-service process:

| Job | Schedule | Purpose |
|---|---|---|
| `releaseExpiredPendingClaims` | Every 5 minutes | Releases PENDING usernames past their 15-min TTL back to AVAILABLE |
| `releaseExpiredVerifiedClaims` | Daily 02:00 | Downgrades VERIFIED claims past their 7-day window back to PENDING |
| `escalateSuspendedToArchived` | Daily 03:00 | Archives users who have been SUSPENDED for > 90 days |
| `releaseArchivedUsernames` | Daily 04:00 | Releases quarantined usernames/aliases after 30-day hold |

---

## Transition Log

Every transition is appended to the `identity_transitions` table:

```sql
CREATE TABLE identity_transitions (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,  -- 'user' | 'alias'
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  actor_id    TEXT,
  reason      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

This table is append-only and is the source of truth for identity audit trails.

---

## Guarantees

1. **No orphaned reservations** — pending claims always expire automatically.
2. **No permanent locks** — every state has a defined exit path.
3. **No silent transitions** — every transition is logged with the trigger and actor.
4. **No username collisions** — UNIQUE constraint on (status ≠ archived) prevents same username in two ACTIVE accounts simultaneously.
5. **30-day alias quarantine** — deleted aliases cannot be immediately re-claimed, preventing impersonation attacks.
