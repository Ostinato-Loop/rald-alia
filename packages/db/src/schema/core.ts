// packages/db/src/schema/core.ts
// M0–M3: Core ALIA tables — users, organizations, aliases, bank links, routing profiles,
//         legacy API keys, audit logs, fraud events, webhooks, identity transitions.
//
// Column names are reconciled against the live DB schema from SQL migrations and
// existing service code (resolution-engine, directory-service, routing-service, identity jobs).
// aliases/bankLinks/routingProfiles use TEXT columns, matching SQL CREATE TABLE statements.

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

// ── Shared Enums ──────────────────────────────────────────────────────────────

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
// Core identity record. M0 base columns + M3 lifecycle columns.

export const users = pgTable(
  'users',
  {
    id:           text('id').primaryKey(),
    email:        text('email').notNull().unique(),
    phone:        text('phone'),
    username:     text('username').unique(),
    firstName:    text('first_name').notNull(),
    lastName:     text('last_name').notNull(),

    // Legacy boolean flags kept for backward compat; identity_status is canonical (M3)
    isVerified:   boolean('is_verified').notNull().default(false),
    isActive:     boolean('is_active').notNull().default(true),

    // Password hash (added in M4 — previously stored in metadata)
    passwordHash: text('password_hash'),

    // M3: Identity state machine
    identityStatus:     text('identity_status').notNull().default('pending'),
    pendingExpiresAt:   timestamp('pending_expires_at',   { withTimezone: true }),
    verifiedAt:         timestamp('verified_at',          { withTimezone: true }),
    activatedAt:        timestamp('activated_at',         { withTimezone: true }),
    trustedAt:          timestamp('trusted_at',           { withTimezone: true }),
    suspendedAt:        timestamp('suspended_at',         { withTimezone: true }),
    suspensionReason:   text('suspension_reason'),
    suspendedBy:        text('suspended_by'),
    archivedAt:         timestamp('archived_at',          { withTimezone: true }),
    archiveReason:      text('archive_reason'),
    usernameReleasedAt: timestamp('username_released_at', { withTimezone: true }),

    metadata:     jsonb('metadata').notNull().default({}),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_identity_status_idx').on(t.identityStatus),
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
    verifiedAt:   timestamp('verified_at',  { withTimezone: true }),
    suspendedAt:  timestamp('suspended_at', { withTimezone: true }),
    metadata:     jsonb('metadata').notNull().default({}),
    createdAt:    timestamp('created_at',   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at',   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organizations_country_idx').on(t.country),
    index('organizations_verified_idx').on(t.isVerified),
  ],
);

// ── Aliases ───────────────────────────────────────────────────────────────────
// Human-readable identifiers (phone, email, BVN, NIN…) linked to a user's bank routing.
// Base table was created before migration 0001; lifecycle columns added in M3.
//
// DESIGN NOTE: aliases carry routing metadata directly (denormalized) so the
// resolution-engine can resolve in a single SELECT without a join.

export const aliases = pgTable(
  'aliases',
  {
    id:              text('id').primaryKey(),
    userId:          text('user_id').notNull(),

    // Alias identity
    type:            text('type').notNull(),             // 'phone'|'email'|'bvn'|'nin'|'username'|...
    value:           text('value').notNull(),             // raw alias value as entered
    normalizedValue: text('normalized_value').notNull(), // E.164 / lowercase for lookups

    countryCode:     text('country_code').notNull(),
    status:          text('status').notNull().default('active'),
    isPrimary:       boolean('is_primary').notNull().default(false),

    // Routing payload (cached from bank_links at alias creation / update)
    bankCode:        text('bank_code'),                  // NUBAN / institution routing code
    accountToken:    text('account_token'),              // encrypted routing credential
    accountName:     text('account_name'),               // beneficiary display name

    // Soft delete (aliases are never hard-deleted; quarantine window follows)
    deletedAt:       timestamp('deleted_at', { withTimezone: true }),

    // M3: Lifecycle columns
    pendingExpiresAt: timestamp('pending_expires_at', { withTimezone: true }),
    verifiedAt:       timestamp('verified_at',        { withTimezone: true }),
    activatedAt:      timestamp('activated_at',       { withTimezone: true }),
    suspendedAt:      timestamp('suspended_at',       { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    archivedAt:       timestamp('archived_at',        { withTimezone: true }),
    quarantineUntil:  timestamp('quarantine_until',   { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Each normalised alias value must be unique per country (no duplicates across borders)
    uniqueIndex('aliases_normalized_country_idx').on(t.normalizedValue, t.countryCode),
    index('aliases_user_idx').on(t.userId),
    index('aliases_status_idx').on(t.status),
    index('aliases_bank_code_idx').on(t.bankCode),
    index('aliases_country_idx').on(t.countryCode),
    // M3 background job indexes
    index('aliases_pending_expires_idx').on(t.pendingExpiresAt),
  ],
);

// ── Bank Links ────────────────────────────────────────────────────────────────
// Links a user to a verified bank account. One user may have multiple bank links.
// The resolution-engine joins on bank_links.account_token to get bank_name.

export const bankLinks = pgTable(
  'bank_links',
  {
    id:            text('id').primaryKey(),
    userId:        text('user_id').notNull(),
    aliasId:       text('alias_id'),          // optional FK to aliases.id
    bankCode:      text('bank_code').notNull(), // NUBAN routing code
    accountNumber: text('account_number'),
    bankName:      text('bank_name'),
    accountToken:  text('account_token'),     // encrypted routing token
    isActive:      boolean('is_active').notNull().default(true),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_links_user_idx').on(t.userId),
    index('bank_links_bank_code_idx').on(t.bankCode),
    index('bank_links_active_idx').on(t.isActive),
  ],
);

// ── Routing Profiles ──────────────────────────────────────────────────────────
// Pre-computed routing preferences per user (primary bank, fallback bank, rules).

export const routingProfiles = pgTable(
  'routing_profiles',
  {
    id:               text('id').primaryKey(),
    userId:           text('user_id').notNull().unique(),
    primaryBankCode:  text('primary_bank_code'),
    fallbackBankCode: text('fallback_bank_code'),
    routingRules:     jsonb('routing_rules').notNull().default({}),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('routing_profiles_user_idx').on(t.userId),
  ],
);

// ── Legacy API Keys ───────────────────────────────────────────────────────────
// Pre-developer-registry API keys (M0). Superseded by developer_api_keys (M7).

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
    expiresAt:   timestamp('expires_at',  { withTimezone: true }),
    lastUsedAt:  timestamp('last_used_at', { withTimezone: true }),
    revokedAt:   timestamp('revoked_at',  { withTimezone: true }),
    revokedBy:   text('revoked_by'),
    createdAt:   timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at',  { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('api_keys_entity_idx').on(t.entityId),
    index('api_keys_status_idx').on(t.status),
  ],
);

// ── Audit Logs ────────────────────────────────────────────────────────────────
// Tamper-evident audit trail — each entry carries a SHA-256 checksum over the payload.
// Columns match audit.service.ts which writes every record with: eventType, actorId,
// actorType, targetId, targetType, metadata, ipAddress, userAgent, checksum.

export const auditLogs = pgTable(
  'audit_logs',
  {
    id:         text('id').primaryKey(),
    eventType:  text('event_type').notNull(),
    actorId:    text('actor_id'),
    actorType:  text('actor_type'),
    targetId:   text('target_id'),
    targetType: text('target_type'),
    metadata:   jsonb('metadata').notNull().default({}),
    ipAddress:  text('ip_address'),
    userAgent:  text('user_agent'),
    checksum:   text('checksum'),              // SHA-256 of the serialised payload
    createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_event_idx').on(t.eventType),
    index('audit_logs_actor_idx').on(t.actorId),
    index('audit_logs_target_idx').on(t.targetId),
    index('audit_logs_time_idx').on(t.createdAt),
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
    action:      text('action').notNull().default('flag'),
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

export const webhooks = pgTable(
  'webhooks',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull(),
    eventType:   text('event_type').notNull(),
    url:         text('url').notNull(),
    payload:     jsonb('payload').notNull().default({}),
    status:      text('status').notNull().default('pending'),
    attempts:    integer('attempts').notNull().default(0),
    lastError:   text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt:   timestamp('created_at',   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at',   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhooks_entity_idx').on(t.entityId),
    index('webhooks_status_idx').on(t.status),
    index('webhooks_time_idx').on(t.createdAt),
  ],
);

// ── Identity Transitions ──────────────────────────────────────────────────────
// Append-only log of every user/alias state machine transition (M3).

export const identityTransitions = pgTable(
  'identity_transitions',
  {
    id:          text('id').primaryKey(),
    entityId:    text('entity_id').notNull(),
    entityType:  text('entity_type').notNull().default('user'),
    fromStatus:  text('from_status'),
    toStatus:    text('to_status').notNull(),
    triggeredBy: text('triggered_by').notNull(),
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
