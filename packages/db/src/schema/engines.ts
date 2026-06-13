// packages/db/src/schema/engines.ts
// M6: Governance engine tables — country governance, policy violations,
//     routing decisions, deletion schedules.

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// Re-export the core policies table under the canonical governance name.
// The `policies` table (schema.engines.ts) is the underlying storage;
// governance-service references it as governancePolicies.
export { policies as governancePolicies } from '../schema.engines';

// ── Country Governance ────────────────────────────────────────────────────────
// Central country status registry.
// Status progression: DISABLED → INTERNAL → PRIVATE_BETA → PUBLIC_BETA → GA
// No country becomes active without an explicit admin transition.

export const countryGovernance = pgTable(
  'country_governance',
  {
    countryCode:  text('country_code').primaryKey(),
    countryName:  text('country_name').notNull(),
    status:       text('status').notNull().default('DISABLED'),
    currency:     text('currency').notNull(),
    regulatoryBody: text('regulatory_body'),
    approvedBy:   text('approved_by'),
    approvedAt:   timestamp('approved_at'),
    notes:        text('notes'),
    metadata:     jsonb('metadata').notNull().default({}),
    createdAt:    timestamp('created_at').notNull().defaultNow(),
    updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('country_governance_status_idx').on(t.status),
  ],
);

export const countryGovernanceEvents = pgTable(
  'country_governance_events',
  {
    id:          text('id').primaryKey(),
    countryCode: text('country_code').notNull().references(() => countryGovernance.countryCode),
    fromStatus:  text('from_status'),
    toStatus:    text('to_status').notNull(),
    actorId:     text('actor_id'),
    actorType:   text('actor_type').notNull().default('admin'),
    notes:       text('notes'),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('country_governance_events_country_idx').on(t.countryCode),
    index('country_governance_events_created_at_idx').on(t.createdAt),
  ],
);

// ── Policy Violations ─────────────────────────────────────────────────────────
// Immutable audit log of every governance policy rule triggered.

export const policyViolations = pgTable(
  'policy_violations',
  {
    id:             text('id').primaryKey(),
    policyId:       text('policy_id').notNull(),
    actorId:        text('actor_id').notNull(),
    actorType:      text('actor_type').notNull(),
    resource:       text('resource').notNull(),
    action:         text('action').notNull(),
    ruleCondition:  text('rule_condition').notNull(),
    ruleAction:     text('rule_action').notNull(),
    country:        text('country'),
    institutionId:  text('institution_id'),
    context:        jsonb('context').notNull().default({}),
    resolvedAt:     timestamp('resolved_at'),
    resolvedBy:     text('resolved_by'),
    resolutionNote: text('resolution_note'),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('policy_violations_policy_id_idx').on(t.policyId),
    index('policy_violations_actor_id_idx').on(t.actorId),
    index('policy_violations_country_idx').on(t.country),
    index('policy_violations_created_at_idx').on(t.createdAt),
  ],
);

// ── Routing Decisions ─────────────────────────────────────────────────────────
// Persistent log of alias-resolution routing decisions for audit and analytics.

export const routingDecisions = pgTable(
  'routing_decisions',
  {
    id:              text('id').primaryKey(),
    aliasId:         text('alias_id').notNull(),
    requestId:       text('request_id').notNull(),
    initiatorId:     text('initiator_id').notNull(),
    initiatorType:   text('initiator_type').notNull(),
    resolvedToken:   text('resolved_token').notNull(),
    destinationBank: text('destination_bank').notNull(),
    routingStrategy: text('routing_strategy').notNull().default('primary'),
    latencyMs:       integer('latency_ms'),
    fraudScore:      integer('fraud_score'),
    fraudAction:     text('fraud_action'),
    status:          text('status').notNull().default('completed'),
    failureReason:   text('failure_reason'),
    country:         text('country'),
    createdAt:       timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('routing_decisions_alias_id_idx').on(t.aliasId),
    index('routing_decisions_initiator_id_idx').on(t.initiatorId),
    index('routing_decisions_country_idx').on(t.country),
    index('routing_decisions_created_at_idx').on(t.createdAt),
  ],
);

// ── Deletion Schedules ────────────────────────────────────────────────────────
// Tracks data deletion requests raised by NDPR / POPIA / DPA right-to-erasure
// obligations and account-closure workflows.

export const deletionSchedules = pgTable(
  'deletion_schedules',
  {
    id:            text('id').primaryKey(),
    entityId:      text('entity_id').notNull(),
    dataClass:     text('data_class').notNull(),
    reason:        text('reason').notNull(),
    requestedBy:   text('requested_by').notNull(),
    method:        text('method').notNull(),
    scheduledAt:   timestamp('scheduled_at').notNull().defaultNow(),
    executionDate: timestamp('execution_date').notNull(),
    status:        text('status').notNull().default('scheduled'),
    completedAt:   timestamp('completed_at'),
    createdAt:     timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('deletion_schedules_entity_id_idx').on(t.entityId),
    index('deletion_schedules_status_idx').on(t.status),
    index('deletion_schedules_execution_date_idx').on(t.executionDate),
  ],
);
