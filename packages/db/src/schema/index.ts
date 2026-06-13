// packages/db/src/schema/index.ts
// Central re-export of all Drizzle schema tables and enums.
// Add new schema files here as milestones land.

// ── M0: Core schema ───────────────────────────────────────────────────────────
export {
  aliasTypeEnum,
  aliasStatusEnum,
  riskLevelEnum,
  environmentEnum,
  users,
  organizations,
  aliases,
  bankLinks,
  routingProfiles,
  apiKeys,
  auditLogs,
  fraudEvents,
  webhooks,
} from './core';

// ── M1: ALIA Engines ──────────────────────────────────────────────────────────
export {
  trustScores,
  trustSignals,
  consentMandates,
  consentEvents,
  merchantProfiles,
  merchantCollections,
  verificationCredentials,
  kycRequests,
  governancePolicies,
  policyViolations,
  routingDecisions,
} from './engines';

// ── M2: Registry ──────────────────────────────────────────────────────────────
export {
  registry,
  registryEvents,
} from './registry';

// ── M3: Identity State Machine ────────────────────────────────────────────────
// Columns added via migration 0003 — identity_transitions table
// The users table now has: identityStatus, pendingExpiresAt, verifiedAt,
//   activatedAt, trustedAt, suspendedAt, archived_at, etc.
// The aliases table now has: pendingExpiresAt, quarantineUntil, etc.

// ── M4: Machine Identity ──────────────────────────────────────────────────────
export {
  machineIdentities,
  machineJwtLog,
} from './security';

// ── M5: Institution Registry ──────────────────────────────────────────────────
export {
  institutionTypeEnum,
  institutionStatusEnum,
  licenseStatusEnum,
  prefixSchemeEnum,
  financialInstitutions,
  institutionLicenses,
  institutionRoutingPrefixes,
  institutionSettlementAccounts,
  institutionEvents,
} from './institutions';

// ── M6: Country Governance ────────────────────────────────────────────────────
// Country status lifecycle: DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
// Admin-gated — no country activates automatically.
export {
  countryGovernance,
  countryGovernanceEvents,
  deletionSchedules,
} from './engines';

// ── M7: Developer Registry ────────────────────────────────────────────────────
// Developer lifecycle: applied → verified → active → suspended → revoked
// API keys: rald_key_{prod|test}_{48hex} — SHA-256 hash stored, returned once.
// Rate limits: sandbox=60rpm/10k-rpd, production=120rpm/50k-rpd
export {
  developerStatusEnum,
  projectStatusEnum,
  apiKeyStatusEnum,
  developers,
  developerProjects,
  developerApiKeys,
  developerEvents,
} from './developers';
