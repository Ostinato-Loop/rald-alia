// packages/shared/src/utils.ts
// Shared utilities used across ALIA services.

import { ulid } from 'ulid';

// ── generateId ────────────────────────────────────────────────────────────────
// Creates a prefixed ULID. Prefix convention:
//   ali  — alias rows
//   al   — audit_log rows
//   pv   — policy_violation rows
//   res  — resolution rows
//   (any other prefix is accepted)
//
// Example: generateId('ali') → 'ali_01J9XKTM3BYEQZ3F2KG0VYVDKP'

export function generateId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}

// ── normalizeAlias ────────────────────────────────────────────────────────────
// Produces the canonical form of an alias value for duplicate detection and
// resolution lookups. Must be deterministic: same input → same output always.
//
// email          → lowercase, trimmed
// phone          → digits only (E.164 without leading +)
// username       → lowercase, trimmed
// business_handle → lowercase, trimmed

export function normalizeAlias(type: string, value: string): string {
  const v = value.trim();
  switch (type) {
    case 'email':
      return v.toLowerCase();
    case 'phone':
      // Strip all non-digit characters. Keeps international prefixes as digits.
      return v.replace(/\D/g, '');
    case 'username':
    case 'business_handle':
      return v.toLowerCase();
    default:
      return v.toLowerCase();
  }
}
