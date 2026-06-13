// packages/db/src/schema/developers.ts
// M7: Developer Registry — developers, projects, API keys, events.

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

export const developerStatusEnum = pgEnum('developer_status', [
  'applied',
  'verified',
  'active',
  'suspended',
  'revoked',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'suspended',
  'archived',
]);

export const apiKeyStatusEnum = pgEnum('api_key_status', [
  'active',
  'revoked',
  'expired',
]);

// ── Tables ────────────────────────────────────────────────────────────────────

// Developer account — one per human/team registered on the ALIA developer network.
export const developers = pgTable(
  'developers',
  {
    id:             text('id').primaryKey(),
    registryId:     text('registry_id'),
    name:           text('name').notNull(),
    email:          text('email').notNull().unique(),
    organizationId: text('organization_id'),
    status:         developerStatusEnum('status').notNull().default('applied'),
    kycVerified:    boolean('kyc_verified').notNull().default(false),
    country:        text('country').notNull(),
    website:        text('website'),
    notes:          text('notes'),
    approvedBy:     text('approved_by'),
    approvedAt:     timestamp('approved_at'),
    suspendedAt:    timestamp('suspended_at'),
    suspensionReason: text('suspension_reason'),
    revokedAt:      timestamp('revoked_at'),
    revocationReason: text('revocation_reason'),
    metadata:       jsonb('metadata').notNull().default({}),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
    updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('developers_status_idx').on(t.status),
    index('developers_country_idx').on(t.country),
    index('developers_registry_idx').on(t.registryId),
  ],
);

// Project — a logical grouping of API keys under a developer account.
export const developerProjects = pgTable(
  'developer_projects',
  {
    id:                     text('id').primaryKey(),
    developerId:            text('developer_id').notNull().references(() => developers.id),
    name:                   text('name').notNull(),
    description:            text('description'),
    environment:            text('environment').notNull().default('sandbox'),
    status:                 projectStatusEnum('status').notNull().default('active'),
    countryPermissions:     jsonb('country_permissions').notNull().default([]),
    institutionPermissions: jsonb('institution_permissions').notNull().default([]),
    webhookUrl:             text('webhook_url'),
    metadata:               jsonb('metadata').notNull().default({}),
    archivedAt:             timestamp('archived_at'),
    createdAt:              timestamp('created_at').notNull().defaultNow(),
    updatedAt:              timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('dev_projects_developer_idx').on(t.developerId),
    index('dev_projects_status_idx').on(t.status),
    index('dev_projects_env_idx').on(t.environment),
  ],
);

// API Key — credential authenticating a project's requests to ALIA.
// The plaintext key is returned once on creation; only the SHA-256 hash is stored.
export const developerApiKeys = pgTable(
  'developer_api_keys',
  {
    id:           text('id').primaryKey(),
    keyId:        text('key_id').notNull().unique(),
    keyHash:      text('key_hash').notNull(),
    projectId:    text('project_id').notNull().references(() => developerProjects.id),
    developerId:  text('developer_id').notNull().references(() => developers.id),
    name:         text('name').notNull(),
    scopes:       jsonb('scopes').notNull().default([]),
    rateLimitRpm: integer('rate_limit_rpm').notNull().default(60),
    rateLimitRpd: integer('rate_limit_rpd').notNull().default(10_000),
    environment:  text('environment').notNull().default('sandbox'),
    expiresAt:    timestamp('expires_at'),
    lastUsedAt:   timestamp('last_used_at'),
    status:       apiKeyStatusEnum('status').notNull().default('active'),
    revokedAt:    timestamp('revoked_at'),
    revokedBy:    text('revoked_by'),
    createdAt:    timestamp('created_at').notNull().defaultNow(),
    updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('dev_api_keys_key_hash_idx').on(t.keyHash),
    index('dev_api_keys_project_idx').on(t.projectId),
    index('dev_api_keys_developer_idx').on(t.developerId),
    index('dev_api_keys_status_idx').on(t.status),
  ],
);

// Developer Events — immutable audit trail for all developer lifecycle actions.
export const developerEvents = pgTable(
  'developer_events',
  {
    id:          text('id').primaryKey(),
    developerId: text('developer_id').notNull().references(() => developers.id),
    eventType:   text('event_type').notNull(),
    actorId:     text('actor_id'),
    actorType:   text('actor_type').notNull().default('system'),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('dev_events_developer_idx').on(t.developerId),
    index('dev_events_type_idx').on(t.eventType),
    index('dev_events_created_idx').on(t.createdAt),
  ],
);
