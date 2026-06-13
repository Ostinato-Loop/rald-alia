// ALIA Identity State Machine
// Single source of truth for all allowed identity status transitions.
// Import this in any service that needs to validate or perform transitions.

export type IdentityStatus =
  | 'available'
  | 'pending'
  | 'verified'
  | 'active'
  | 'trusted'
  | 'suspended'
  | 'archived';

export type AliasStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'deleted';

export type TransitionTrigger =
  | 'user'     // user-initiated action
  | 'system'   // automated system action (e.g. first login completion)
  | 'admin'    // platform admin override
  | 'job';     // background job (TTL expiry, escalation)

export interface TransitionResult<S extends string> {
  allowed:    true;
  from:       S;
  to:         S;
  trigger:    TransitionTrigger;
}

export interface TransitionError {
  allowed:    false;
  from:       string;
  to:         string;
  reason:     string;
}

// ─── User Identity Transition Matrix ────────────────────────────────────────
//
// Format: ALLOWED_TRANSITIONS[from][to] = allowed triggers
//
// TTLs (enforced by background jobs, not this matrix):
//   PENDING    → AVAILABLE : 30 min  (username reservation expired)
//   VERIFIED   → PENDING   : 7 days  (profile not completed — re-claim required)
//   SUSPENDED  → ARCHIVED  : 90 days (not reinstated in time)
//   ARCHIVED   → AVAILABLE : 30 days (quarantine period ends, username released)

const USER_TRANSITIONS: Record<IdentityStatus, Partial<Record<IdentityStatus, TransitionTrigger[]>>> = {
  available: {
    pending:  ['user', 'system'],      // user starts registration → claim username
  },
  pending: {
    available: ['job', 'user', 'admin'],    // claim expired or abandoned
    verified:  ['user', 'system'],          // OTP / email link verified
  },
  verified: {
    active:    ['user', 'system'],          // profile completed + first login
    pending:   ['job'],                     // verification window expired (7 days)
    available: ['admin'],                   // admin force-release
  },
  active: {
    trusted:   ['system'],                  // trust engine: score ≥ 75
    suspended: ['admin', 'system'],         // compliance action / fraud detection
    archived:  ['user', 'admin'],           // deletion request / admin archive
  },
  trusted: {
    active:    ['system', 'admin'],         // trust score dropped below threshold
    suspended: ['admin', 'system'],         // compliance action
    archived:  ['user', 'admin'],           // deletion request
  },
  suspended: {
    active:    ['admin'],                   // reinstated by admin
    archived:  ['job', 'admin'],            // escalated after 90 days / admin action
  },
  archived: {
    available: ['job', 'admin'],            // quarantine ended / admin force-release
  },
};

// ─── Alias Transition Matrix ─────────────────────────────────────────────────

const ALIAS_TRANSITIONS: Record<AliasStatus, Partial<Record<AliasStatus, TransitionTrigger[]>>> = {
  pending: {
    active:    ['user', 'system'],
    deleted:   ['user', 'job', 'admin'],   // claim abandoned or expired
  },
  active: {
    suspended: ['admin', 'system'],
    deleted:   ['user', 'admin'],
  },
  suspended: {
    active:    ['admin'],
    deleted:   ['admin'],
  },
  deleted: {
    // Terminal — no transitions out. Username enters quarantine period.
  },
};

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateUserTransition(
  from:    IdentityStatus,
  to:      IdentityStatus,
  trigger: TransitionTrigger,
): TransitionResult<IdentityStatus> | TransitionError {
  const allowed = USER_TRANSITIONS[from]?.[to];
  if (!allowed) {
    return {
      allowed: false,
      from,
      to,
      reason: `No transition defined from '${from}' to '${to}'`,
    };
  }
  if (!allowed.includes(trigger)) {
    return {
      allowed: false,
      from,
      to,
      reason: `Trigger '${trigger}' is not permitted for transition '${from}' → '${to}'. Allowed: [${allowed.join(', ')}]`,
    };
  }
  return { allowed: true, from, to, trigger };
}

export function validateAliasTransition(
  from:    AliasStatus,
  to:      AliasStatus,
  trigger: TransitionTrigger,
): TransitionResult<AliasStatus> | TransitionError {
  const allowed = ALIAS_TRANSITIONS[from]?.[to];
  if (!allowed) {
    return {
      allowed: false,
      from,
      to,
      reason: `No alias transition defined from '${from}' to '${to}'`,
    };
  }
  if (!allowed.includes(trigger)) {
    return {
      allowed: false,
      from,
      to,
      reason: `Trigger '${trigger}' not permitted for alias transition '${from}' → '${to}'. Allowed: [${allowed.join(', ')}]`,
    };
  }
  return { allowed: true, from, to, trigger };
}

// ─── TTL Configuration ───────────────────────────────────────────────────────

export const IDENTITY_TTL = {
  PENDING_CLAIM_MS:           30 * 60 * 1000,          // 30 minutes
  VERIFIED_WINDOW_DAYS:       7,                         // 7 days to complete profile
  SUSPENDED_ESCALATION_DAYS:  90,                        // 90 days suspended → archived
  ARCHIVED_QUARANTINE_DAYS:   30,                        // 30 days archived → username available
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function pendingExpiresAt(): Date {
  return new Date(Date.now() + IDENTITY_TTL.PENDING_CLAIM_MS);
}

export function verifiedWindowExpiresAt(): Date {
  return new Date(Date.now() + IDENTITY_TTL.VERIFIED_WINDOW_DAYS * 86_400_000);
}

export function suspendedEscalatesAt(suspendedAt: Date): Date {
  return new Date(suspendedAt.getTime() + IDENTITY_TTL.SUSPENDED_ESCALATION_DAYS * 86_400_000);
}

export function archivedQuarantineEndsAt(archivedAt: Date): Date {
  return new Date(archivedAt.getTime() + IDENTITY_TTL.ARCHIVED_QUARANTINE_DAYS * 86_400_000);
}

export function getNextStatuses(from: IdentityStatus): IdentityStatus[] {
  return Object.keys(USER_TRANSITIONS[from] ?? {}) as IdentityStatus[];
}
