// packages/db/src/schema/index.ts
// Central re-export of all Drizzle schema tables and enums.
// Each milestone adds its tables here.
//
// Note on top-level schema.engines.ts and schema.registry.ts:
// Those files are ALSO exported by packages/db/src/index.ts directly.
// Do NOT re-export them here to avoid duplicate export errors.

// ── M0: Core schema ───────────────────────────────────────────────────────────
// users, organizations, aliases, bankLinks, routingProfiles
// apiKeys, auditLogs, fraudEvents, webhooks, identityTransitions
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
  identityTransitions,
} from './core';

// ── M4: Machine Identity ──────────────────────────────────────────────────────
// machineIdentities, machineJwtLog, controlPlaneEvents
export {
  machineIdentities,
  machineJwtLog,
  controlPlaneEvents,
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
// country_governance, country_governance_events,
// governance_routing_decisions, policy_violations, deletion_schedules,
// alias_resolution_log (the detailed per-alias resolution audit table)
export {
  countryGovernance,
  countryGovernanceEvents,
  governanceRoutingDecisions,
  governancePolicyViolations,
  deletionSchedules,
  aliasResolutionLog,
} from './engines';

// ── M7: Developer Registry ────────────────────────────────────────────────────
export {
  developerStatusEnum,
  projectStatusEnum,
  apiKeyStatusEnum,
  developers,
  developerProjects,
  developerApiKeys,
  developerEvents,
} from './developers';

// ── M9: Developer Webhook Logs ────────────────────────────────────────────────
export {
  developerWebhookLogs,
} from './webhooks';
