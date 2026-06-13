// packages/db/src/schema/core.ts
// M0: Core ALIA tables — users, organizations, aliases, bank links, routing profiles,
//     legacy API keys, audit logs, fraud events, and webhooks.
//
// All milestone tables reference these as foreign keys.
// Column set matches the live DB state after migrations 0001–0004.

import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const aliasTypeEnum = pgEnum('alias_type', [
  'phone',
  'email',
  'bank_account',
  'national_id',
  'passport',
  'bvn',
  'nin',
  'merchant_id',
  'username',
]);

export const aliasStatusEnum = pgEnum('alias_status', [
  'available',
  'pending',
  'verified',
  'active',
  'suspended',
  'archived',
]);

export const riskLevelEnum = pgEnum('risk_level', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const environmentEnum = pgEnum('environment', [
  'sandbox',
  'production',
]);

// ── Users ─────────────────────────────────────────────────────────────────────
// Core identity record for individuals using the ALIA platform.
// Columns include M0 base columns + lifecycle columns added in migrations 0003–0004.

export const users = pgTable(
  'users',
  {
    id:           text('id').primaryKey(),
    email:        text('email').notNull().unique(),
    phone:        text('phone'),
    username:     text('username').unique(),
    firstName:    text('first_name').notNull(),
    lastName:     text('last_name').notNull(),

    // Legacy boolean flags (kept for backward compat; identity_status is canonical)
    isVerified:   boolean('is_verified').notNull().default(false),
    isActive:     boolean('is_active').notNull().default(true),

    // Password (added in migration 0004 — previously in metadata JSONB)
    passwordHash: text('password_hash'),

    // Identity state machine (added in migration 0003)
    // Values: available | pending | verified | active | trusted | suspended | archived
    identityStatus: text('identity_status').notNull().default('pending'),

    // Lifecycle timestamps (added in migration 0003)
    pendingExpiresAt:   timestamp('pending_expires_at', { withTimezone: true }),
    verifiedAt:         timestamp('verified_at', { withTimezone: true }),
    activatedAt:        timestamp('activated_at', { withTimezone: true }),
    trustedAt:          timestamp('trusted_at', { withTimezone: true }),
    suspendedAt:        timestamp('suspended_at', { withTimezone: true }),
    suspensionReason:   text('suspension_reason'),
    suspendedBy:        text('suspended_by'),
    archivedAt:         timestamp('archived_at', { withTimezone: true }),
    archiveReason:      text('archive_reason'),
    usernameReleasedAt: timestamp('username_released_at', { withTimezone: true }),

    metadata:     jsonb('metadata').notNull().default({}),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_identity_status_idx').on(t.identityStatus),
    // Partial indexes for background jobs (match migration 0003)
    index('users_pending_expires_idx').on(t.pendingExpiresAt),
    index('users_verified_idx').on(t.verifiedAt),
    index('users_suspended_at_idx').on(t.suspendedAt),
    index('users_quarantine_idx').on(t.usernameReleasedAt),
  ],
);

// ── Organizations ─────────────────────────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id:           text('id').primaryKey(),
    name:         text('name').notNull(),
    slug:         text('slug').notNull().unique(),
    country:      text('country').notNull(),
    rcNumber:     text('rc_number'),
    taxId:        text('tax_id'),
    isVerified:   boolean('is_verified').notNull().default(false),
    isActive:     boolean('is_active').notNull().default(true),
    verifiedAt:   timestamp('verified_at', { withTimezone: true }),
    suspendedAt:  timestamp('suspended_at', { withTimezone: true }),
    metadata:     jsonb('metadata').notNull().default({}),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organizations_country_idx').on(t.country),
    index('organizations_verified_idx').on(t.isVerified),
  ],
);

// ── Aliases ───────────────────────────────────────────────────────────────────
// Human-readable identifiers owned by an entity.
// Lifecycle follows identity state machine (migration 0003).

export const aliases = pgTable(
  'aliases',
  {
    id:              text('id').primaryKey(),
    entityId:        text('entity_id').notNull(),
    entityType:      text('entity_type').notNull(), // 'user' | 'organization' | 'merchant'
    aliasType:       aliasTypeEnum('alias_type').notNull(),
    aliasValue:      text('alias_value').notNull(),
    countryCode:     text('country_code').notNull(),
    status:          aliasStatusEnum('status').notNull().default('pending'),
    isPrimary:       boolean('is_primary').notNull().default(false),
    bankLinkId:      text('bank_link_id'),             // nullable FK to bank_links.id

    // State machine lifecycle (migration 0003)
    pendingExpiresAt: timestamp('pending_expires_at', { withTimezone: true }),
    verifiedAt:       timestamp('verified_at', { withTimezone: true }),
    activatedAt:      timestamp('activated_at', { withTimezone: true }),
    suspendedAt:      timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    archivedAt:       timestamp('archived_at', { withTimezone: true }),
    quarantineUntil:  timestamp('quarantine_until', { withTimezone: true }),

    metadata:         jsonb('metadata').notNull().default({}),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Each entity may own only one active alias per type+country
    uniqueIndex('aliases_entity_type_active_idx').on(t.entityId, t.aliasType, t.countryCode),
    index('aliases_value_idx').on(t.aliasValue, t.countryCode),
    index('aliases_entity_idx').on(t.entityId),
    index('aliases_status_idx').on(t.status),
    index('aliases_pending_expires_idx').on(t.pendingExpiresAt),
    index('aliases_country_idx').on(t.countryCode),
  ],
);

// ── Bank Links ────────────────────────────────────────────────────────────────
// Links an alias to a specific bank account for routing.

export const bankLinks = pgTable(
  'bank_links',
  {
    id:                 text('id').primaryKey(),
    entityId:           text('entity_id').notNull(),
    entityType:         text('entity_type').notNull(),
    aliasId:            text('alias_id').notNull().references(() => aliases.id, { onDelete: 'cascade' }),
    institutionCode:    text('institution_code').notNull(),  // NUBAN/routing code
    accountNumber:      text('account_number').notNull(),
    accountName:        text('account_name').notNull(),
    accountToken:       text('account_token'),               // encrypted routing token
    isPrimary:          boolean('is_primary').notNull().default(false),
    isActive:           boolean('is_active').notNull().default(true),
    verificationStatus: text('verification_status').notNull().default('unverified'),
    verifiedAt:         timestamp('verified_at', { withTimezone: true }),
    metadata:           jsonb('metadata').notNull().default({}),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_links_entity_idx').on(t.entityId),
    index('bank_links_alias_idx').on(t.aliasId),
    index('bank_links_institution_idx').on(t.institutionCode),
  ],
);

// ── Routing Profiles ──────────────────────────────────────────────────────────
// Pre-computed routing metadata for an entity — cached at resolution time.

export const routingProfiles = pgTable(
  'routing_profiles',
  {
    id:                  text('id').primaryKey(),
    entityId:            text('entity_id').notNull(),
    entityType:          text('entity_type').notNull(),
    primaryBankLinkId:   text('primary_bank_link_id').references(() => bankLinks.id),
    primaryInstitution:  text('primary_institution'),
    backupInstitutions:  jsonb('backup_institutions').notNull().default([]),
    routingStrategy:     text('routing_strategy').notNull().default('primary'),
    isActive:            boolean('is_active').notNull().default(true),
    lastRoutedAt:        timestamp('last_routed_at', { withTimezone: true }),
    metadata:            jsonb('metadata').notNull().default({}),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('routing_profiles_entity_idx').on(t.entityId, t.entityType),
    index('routing_profiles_active_idx').on(t.isActive),
  ],
);

// ── Legacy API Keys ───────────────────────────────────────────────────────────
// Pre-developer-registry API keys (M0). Superseded by developer_api_keys (M7)
// but kept for backward compat with early API consumers.

export const apiKeys = pgTable(
  'api_keys',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull(),
    keyHash:     text('key_hash').notNull().unique(),
    name:        text('name').notNull(),
    scopes:      jsonb('scopes').notNull().default([]),
    environment: environmentEnum('environment').notNull().default('sandbox'),
    status:      text('status').notNull().default('active'),
    expiresAt:   timestamp('expires_at', { withTimezone: true }),
    lastUsedAt:  timestamp('last_used_at', { withTimezone: true }),
    revokedAt:   timestamp('revoked_at', { withTimezone: true }),
    revokedBy:   text('revoked_by'),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('api_keys_entity_idx').on(t.entityId),
    index('api_keys_status_idx').on(t.status),
  ],
);

// ── Audit Logs ────────────────────────────────────────────────────────────────
// High-level audit trail for all write operations across ALIA services.

export const auditLogs = pgTable(
  'audit_logs',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull(),
    action:      text('action').notNull(),
    actorId:     text('actor_id'),
    actorType:   text('actor_type').notNull().default('system'),
    serviceName: text('service_name').notNull(),
    requestId:   text('request_id'),
    ipAddress:   text('ip_address'),
    oldData:     jsonb('old_data'),
    newData:     jsonb('new_data'),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityId, t.entityType),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_time_idx').on(t.createdAt),
    index('audit_logs_service_idx').on(t.serviceName),
  ],
);

// ── Fraud Events ──────────────────────────────────────────────────────────────

export const fraudEvents = pgTable(
  'fraud_events',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull(),
    eventType:   text('event_type').notNull(),
    riskScore:   integer('risk_score').notNull().default(0),
    riskLevel:   riskLevelEnum('risk_level').notNull().default('low'),
    action:      text('action').notNull().default('flag'),   // 'allow' | 'flag' | 'block' | 'challenge'
    signalData:  jsonb('signal_data').notNull().default({}),
    requestId:   text('request_id'),
    resolvedAt:  timestamp('resolved_at', { withTimezone: true }),
    resolvedBy:  text('resolved_by'),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fraud_events_entity_idx').on(t.entityId),
    index('fraud_events_type_idx').on(t.eventType),
    index('fraud_events_risk_idx').on(t.riskLevel),
    index('fraud_events_time_idx').on(t.createdAt),
  ],
);

// ── Webhooks (legacy) ─────────────────────────────────────────────────────────
// Pre-developer-registry webhook delivery log.
// Superseded by developer_webhook_logs (M9) for developer-service events.

export const webhooks = pgTable(
  'webhooks',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull(),
    eventType:   text('event_type').notNull(),
    url:         text('url').notNull(),
    payload:     jsonb('payload').notNull().default({}),
    status:      text('status').notNull().default('pending'),  // 'pending'|'delivered'|'failed'
    attempts:    integer('attempts').notNull().default(0),
    lastError:   text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhooks_entity_idx').on(t.entityId),
    index('webhooks_status_idx').on(t.status),
    index('webhooks_time_idx').on(t.createdAt),
  ],
);

// ── Identity Transitions ──────────────────────────────────────────────────────
// Append-only log of every user/alias state machine transition (migration 0003).

export const identityTransitions = pgTable(
  'identity_transitions',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull().default('user'),
    fromStatus:  text('from_status'),
    toStatus:    text('to_status').notNull(),
    triggeredBy: text('triggered_by').notNull(),  // 'user' | 'system' | 'admin' | 'job'
    actorId:     text('actor_id'),
    reason:      text('reason'),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('identity_transitions_entity_idx').on(t.entityId),
    index('identity_transitions_status_idx').on(t.toStatus),
    index('identity_transitions_time_idx').on(t.createdAt),
  ],
);
