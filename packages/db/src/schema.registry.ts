import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const entityTypeEnum = pgEnum('entity_type', [
  'person',
  'business',
  'merchant',
  'developer',
  'institution',
  'device',
  'service',
]);

export const registry = pgTable(
  'registry',
  {
    registryId:           text('registry_id').primaryKey(),
    entityType:           entityTypeEnum('entity_type').notNull(),
    entityId:             text('entity_id').notNull(),
    countryCode:          text('country_code').notNull(),

    // Status dimensions
    identityStatus:       text('identity_status').notNull().default('pending'),
    identityStatusAt:     timestamp('identity_status_at').notNull().defaultNow(),
    identityStatusBy:     text('identity_status_by'),

    verificationStatus:   text('verification_status').notNull().default('unverified'),
    verificationStatusAt: timestamp('verification_status_at').notNull().defaultNow(),
    verificationTier:     integer('verification_tier').notNull().default(0),

    trustStatus:          text('trust_status').notNull().default('unscored'),
    trustStatusAt:        timestamp('trust_status_at').notNull().defaultNow(),
    trustScore:           integer('trust_score'),

    consentStatus:        text('consent_status').notNull().default('none'),
    consentStatusAt:      timestamp('consent_status_at').notNull().defaultNow(),

    routingStatus:        text('routing_status').notNull().default('unlinked'),
    routingStatusAt:      timestamp('routing_status_at').notNull().defaultNow(),

    complianceStatus:     text('compliance_status').notNull().default('pending'),
    complianceStatusAt:   timestamp('compliance_status_at').notNull().defaultNow(),
    complianceFlags:      jsonb('compliance_flags').notNull().default([]),

    // Cached display fields
    displayName:          text('display_name'),
    avatarUrl:            text('avatar_url'),
    metadata:             jsonb('metadata').notNull().default({}),

    // Lifecycle
    activatedAt:          timestamp('activated_at'),
    suspendedAt:          timestamp('suspended_at'),
    archivedAt:           timestamp('archived_at'),
    suspensionReason:     text('suspension_reason'),
    archiveReason:        text('archive_reason'),

    createdAt:            timestamp('created_at').notNull().defaultNow(),
    updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('registry_entity_unique').on(t.entityType, t.entityId),
    index('registry_entity_id_idx').on(t.entityId),
    index('registry_entity_type_idx').on(t.entityType),
    index('registry_country_idx').on(t.countryCode),
    index('registry_identity_status_idx').on(t.identityStatus),
    index('registry_trust_status_idx').on(t.trustStatus),
    index('registry_compliance_status_idx').on(t.complianceStatus),
    index('registry_created_at_idx').on(t.createdAt),
  ],
);

export const registryEvents = pgTable(
  'registry_events',
  {
    id:         text('id').primaryKey(),
    registryId: text('registry_id').notNull().references(() => registry.registryId),
    dimension:  text('dimension').notNull(),
    fromStatus: text('from_status'),
    toStatus:   text('to_status').notNull(),
    actorId:    text('actor_id'),
    actorType:  text('actor_type'),
    reason:     text('reason'),
    metadata:   jsonb('metadata').notNull().default({}),
    createdAt:  timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('registry_events_registry_idx').on(t.registryId),
    index('registry_events_dimension_idx').on(t.dimension),
    index('registry_events_created_idx').on(t.createdAt),
  ],
);
