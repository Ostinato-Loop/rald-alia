// packages/db/src/schema/engines.ts
// M6: Country governance, routing decisions, policy violations, deletion schedules.
// Also contains alias_resolution_log — the per-alias resolution audit table.
//
// IMPORTANT: The tables here are the governance/operational layer.
//   - governance_routing_decisions — compliance routing outcomes (source/dest/decision)
//   - alias_resolution_log — detailed per-alias resolution tracking (latency, fraud, outcome)
// These were previously both mapped to 'routing_decisions' causing a schema conflict.
// Migration 0009 creates the new alias_resolution_log table.

import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Country Governance ────────────────────────────────────────────────────────
// Central country status registry — one row per ISO 3166-1 alpha-2 country.
// Status ladder: DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
// EVERY transition is admin-gated — no country activates automatically.
//
// Table name: country_governance (matches SQL migration 0006 exactly)

export const countryGovernance = pgTable(
  'country_governance',
  {
    // PK is a generated id; country_code is a unique natural key
    id:                   text('id').primaryKey(),
    countryCode:          text('country_code').notNull().unique(),
    countryName:          text('country_name').notNull(),
    status:               text('status').notNull().default('DISABLED'),
    complianceFramework:  text('compliance_framework').notNull().default('NONE'),

    // Alias policy for this jurisdiction
    maxAliasesPerUser:    integer('max_aliases_per_user').notNull().default(3),
    kycRequirementLevel:  integer('kyc_requirement_level').notNull().default(1),
    allowedAliasTypes:    jsonb('allowed_alias_types').notNull().default([]),
    sanctionListEnabled:  boolean('sanction_list_enabled').notNull().default(true),
    dataResidencyRequired: boolean('data_residency_required').notNull().default(false),

    // Transaction limits (in currency minor units)
    dailyTxLimitMinor:   bigint('daily_tx_limit_minor', { mode: 'bigint' }),
    singleTxLimitMinor:  bigint('single_tx_limit_minor', { mode: 'bigint' }),
    currencyCode:        text('currency_code').notNull().default('USD'),

    // Lifecycle
    activatedBy:         text('activated_by'),
    activatedAt:         timestamp('activated_at', { withTimezone: true }),
    updatedBy:           text('updated_by'),
    notes:               text('notes'),

    metadata:            jsonb('metadata').notNull().default({}),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cg_status_idx').on(t.status),
    index('cg_framework_idx').on(t.complianceFramework),
  ],
);

// ── Country Governance Events ─────────────────────────────────────────────────
// Immutable audit log of every status transition and policy change.

export const countryGovernanceEvents = pgTable(
  'country_governance_events',
  {
    id:          text('id').primaryKey(),
    countryCode: text('country_code').notNull().references(() => countryGovernance.countryCode),
    eventType:   text('event_type').notNull(),  // 'status_changed' | 'policy_updated' | 'framework_changed'
    fromStatus:  text('from_status'),
    toStatus:    text('to_status'),
    actorId:     text('actor_id'),
    actorType:   text('actor_type').notNull().default('system'),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cge_country_idx').on(t.countryCode),
    index('cge_type_idx').on(t.eventType),
    index('cge_time_idx').on(t.createdAt),
  ],
);

// ── Governance Routing Decisions ──────────────────────────────────────────────
// Compliance engine routing outcomes — records decisions about cross-border routing.
// Table: governance_routing_decisions
// (Distinct from alias_resolution_log which tracks per-alias resolution detail.)

export const governanceRoutingDecisions = pgTable(
  'governance_routing_decisions',
  {
    id:                 text('id').primaryKey(),
    sourceCountry:      text('source_country').notNull(),
    destinationCountry: text('destination_country').notNull(),
    decision:           text('decision').notNull(),  // 'allowed' | 'blocked' | 'flagged'
    policyId:           text('policy_id'),
    reason:             text('reason'),
    requestId:          text('request_id'),
    metadata:           jsonb('metadata').notNull().default({}),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('grd_source_idx').on(t.sourceCountry),
    index('grd_dest_idx').on(t.destinationCountry),
    index('grd_decision_idx').on(t.decision),
    index('grd_time_idx').on(t.createdAt),
  ],
);

// ── Governance Policy Violations ──────────────────────────────────────────────
// Recorded when a request fails a governance/compliance check.
// Table: policy_violations (matches SQL migration 0006)

export const governancePolicyViolations = pgTable(
  'policy_violations',
  {
    id:            text('id').primaryKey(),
    countryCode:   text('country_code').notNull(),
    policyId:      text('policy_id').notNull(),
    violationType: text('violation_type').notNull(),
    actorId:       text('actor_id'),
    actorType:     text('actor_type').notNull().default('system'),
    requestId:     text('request_id'),
    metadata:      jsonb('metadata').notNull().default({}),
    resolved:      boolean('resolved').notNull().default(false),
    resolvedAt:    timestamp('resolved_at', { withTimezone: true }),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pv_country_idx').on(t.countryCode),
    index('pv_policy_idx').on(t.policyId),
    index('pv_resolved_idx').on(t.resolved),
    index('pv_time_idx').on(t.createdAt),
  ],
);

// ── Deletion Schedules ────────────────────────────────────────────────────────
// Tracks records scheduled for deletion per jurisdiction retention policy.
// Covers NDPR, POPIA, GDPR, and other DPA right-to-erasure obligations.
// Table: deletion_schedules (matches SQL migration 0006)

export const deletionSchedules = pgTable(
  'deletion_schedules',
  {
    id:             text('id').primaryKey(),
    countryCode:    text('country_code').notNull(),
    entityType:     text('entity_type').notNull(),  // 'alias'|'identity'|'consent'|'trust_score'
    entityId:       text('entity_id').notNull(),
    retentionClass: text('retention_class').notNull(), // 'transient'|'operational'|'regulatory'|'permanent'
    scheduledAt:    timestamp('scheduled_at', { withTimezone: true }).notNull(),
    executedAt:     timestamp('executed_at', { withTimezone: true }),
    cancelledAt:    timestamp('cancelled_at', { withTimezone: true }),
    cancelReason:   text('cancel_reason'),
    status:         text('status').notNull().default('pending'),  // 'pending'|'executed'|'cancelled'
    metadata:       jsonb('metadata').notNull().default({}),
    createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ds_country_idx').on(t.countryCode),
    index('ds_status_idx').on(t.status),
    index('ds_scheduled_idx').on(t.scheduledAt),
    index('ds_entity_idx').on(t.entityType, t.entityId),
  ],
);

// ── Alias Resolution Log ──────────────────────────────────────────────────────
// Detailed per-alias resolution audit record — one row per resolution request.
// Tracks latency, fraud score, routing outcome, and failure reason.
// Table: alias_resolution_log (created in migration 0009)
// (Previously confused with governance_routing_decisions; now correctly separated.)

export const aliasResolutionLog = pgTable(
  'alias_resolution_log',
  {
    id:              text('id').primaryKey(),
    aliasId:         text('alias_id').notNull(),
    requestId:       text('request_id').notNull(),
    initiatorId:     text('initiator_id').notNull(),
    initiatorType:   text('initiator_type').notNull(),  // 'developer' | 'institution' | 'machine'
    resolvedToken:   text('resolved_token'),             // encrypted routing token (null if failed)
    destinationBank: text('destination_bank'),
    routingStrategy: text('routing_strategy').notNull().default('primary'),
    latencyMs:       integer('latency_ms'),
    fraudScore:      integer('fraud_score'),
    fraudAction:     text('fraud_action'),
    status:          text('status').notNull().default('completed'), // 'completed'|'not_found'|'blocked'|'error'
    failureReason:   text('failure_reason'),
    countryCode:     text('country_code'),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('arl_alias_idx').on(t.aliasId),
    index('arl_initiator_idx').on(t.initiatorId),
    index('arl_status_idx').on(t.status),
    index('arl_country_idx').on(t.countryCode),
    index('arl_time_idx').on(t.createdAt),
  ],
);
