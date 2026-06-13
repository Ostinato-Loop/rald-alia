import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Consent Service ─────────────────────────────────────────────────────────

export const consents = pgTable(
  'consents',
  {
    id:               text('id').primaryKey(),
    subjectId:        text('subject_id').notNull(),
    subjectType:      text('subject_type').notNull(),
    granteeId:        text('grantee_id').notNull(),
    granteeType:      text('grantee_type').notNull(),
    scope:            jsonb('scope').notNull().default([]),
    purpose:          text('purpose').notNull(),
    dataClasses:      jsonb('data_classes').notNull().default([]),
    status:           text('status').notNull().default('active'),
    signature:        text('signature').notNull(),
    version:          integer('version').notNull().default(1),
    conditions:       jsonb('conditions'),
    ipAddress:        text('ip_address'),
    userAgent:        text('user_agent'),
    grantedAt:        timestamp('granted_at').notNull().defaultNow(),
    expiresAt:        timestamp('expires_at'),
    revokedAt:        timestamp('revoked_at'),
    revocationReason: text('revocation_reason'),
    revokedBy:        text('revoked_by'),
  },
  (t) => [
    index('consents_subject_idx').on(t.subjectId),
    index('consents_grantee_idx').on(t.granteeId),
    index('consents_status_idx').on(t.status),
  ],
);

export const consentAuditTrail = pgTable(
  'consent_audit_trail',
  {
    id:        text('id').primaryKey(),
    consentId: text('consent_id').notNull().references(() => consents.id),
    event:     text('event').notNull(),
    actorId:   text('actor_id'),
    metadata:  jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('consent_audit_consent_idx').on(t.consentId),
    index('consent_audit_created_idx').on(t.createdAt),
  ],
);

export const mandates = pgTable(
  'mandates',
  {
    id:                 text('id').primaryKey(),
    subjectId:          text('subject_id').notNull(),
    merchantId:         text('merchant_id').notNull(),
    purpose:            text('purpose').notNull(),
    amount:             numeric('amount'),
    maxAmount:          numeric('max_amount'),
    currency:           text('currency').notNull(),
    frequency:          text('frequency').notNull(),
    customIntervalDays: integer('custom_interval_days'),
    startDate:          timestamp('start_date').notNull(),
    endDate:            timestamp('end_date'),
    bankAccountAlias:   text('bank_account_alias'),
    status:             text('status').notNull().default('active'),
    cancellationReason: text('cancellation_reason'),
    cancelledBy:        text('cancelled_by'),
    cancelledAt:        timestamp('cancelled_at'),
    totalExecutions:    integer('total_executions').notNull().default(0),
    lastExecutedAt:     timestamp('last_executed_at'),
    nextExecutionAt:    timestamp('next_execution_at'),
    metadata:           jsonb('metadata'),
    createdAt:          timestamp('created_at').notNull().defaultNow(),
    updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('mandates_subject_idx').on(t.subjectId),
    index('mandates_merchant_idx').on(t.merchantId),
    index('mandates_status_idx').on(t.status),
  ],
);

// ─── Trust Service ────────────────────────────────────────────────────────────

export const trustScores = pgTable(
  'trust_scores',
  {
    id:                 text('id').primaryKey(),
    entityId:           text('entity_id').notNull(),
    entityType:         text('entity_type').notNull(),
    overallScore:       integer('overall_score').notNull().default(30),
    components:         jsonb('components').notNull().default([]),
    tier:               text('tier').notNull().default('unverified'),
    riskLevel:          text('risk_level').notNull().default('high'),
    fraudScore:         integer('fraud_score').notNull().default(70),
    signalsCount:       integer('signals_count').notNull().default(0),
    lastRecalculatedAt: timestamp('last_recalculated_at').notNull().defaultNow(),
    createdAt:          timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('trust_scores_entity_idx').on(t.entityId, t.entityType)],
);

export const trustSignals = pgTable(
  'trust_signals',
  {
    id:         text('id').primaryKey(),
    entityId:   text('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    signalType: text('signal_type').notNull(),
    value:      numeric('value').notNull(),
    source:     text('source').notNull(),
    metadata:   jsonb('metadata'),
    appliedAt:  timestamp('applied_at').notNull().defaultNow(),
  },
  (t) => [
    index('trust_signals_entity_idx').on(t.entityId),
    index('trust_signals_type_idx').on(t.signalType),
  ],
);

export const trustHistory = pgTable(
  'trust_history',
  {
    id:         text('id').primaryKey(),
    entityId:   text('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    score:      integer('score').notNull(),
    event:      text('event').notNull(),
    delta:      integer('delta').notNull(),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  },
  (t) => [
    index('trust_history_entity_idx').on(t.entityId),
    index('trust_history_time_idx').on(t.recordedAt),
  ],
);

export const reputationProfiles = pgTable(
  'reputation_profiles',
  {
    id:                   text('id').primaryKey(),
    entityId:             text('entity_id').notNull(),
    entityType:           text('entity_type').notNull(),
    reputationScore:      integer('reputation_score').notNull().default(50),
    flags:                jsonb('flags').notNull().default([]),
    sanctionsMatch:       boolean('sanctions_match').notNull().default(false),
    pepMatch:             boolean('pep_match').notNull().default(false),
    adverseMedia:         boolean('adverse_media').notNull().default(false),
    participationHistory: jsonb('participation_history').notNull().default({}),
    createdAt:            timestamp('created_at').notNull().defaultNow(),
    updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reputation_entity_idx').on(t.entityId, t.entityType)],
);

// ─── Merchant Service ─────────────────────────────────────────────────────────

export const merchants = pgTable(
  'merchants',
  {
    id:                         text('id').primaryKey(),
    name:                       text('name').notNull(),
    handle:                     text('handle').notNull(),
    ownerId:                    text('owner_id').notNull(),
    ownerType:                  text('owner_type').notNull().default('user'),
    category:                   text('category').notNull(),
    country:                    text('country').notNull(),
    businessRegistrationNumber: text('business_registration_number'),
    taxIdentificationNumber:    text('tax_identification_number'),
    contactEmail:               text('contact_email').notNull(),
    contactPhone:               text('contact_phone').notNull(),
    website:                    text('website'),
    description:                text('description'),
    bankAlias:                  text('bank_alias'),
    status:                     text('status').notNull().default('pending'),
    verified:                   boolean('verified').notNull().default(false),
    verifiedAt:                 timestamp('verified_at'),
    verifiedBy:                 text('verified_by'),
    verificationNotes:          text('verification_notes'),
    trustScore:                 integer('trust_score').notNull().default(30),
    suspensionReason:           text('suspension_reason'),
    suspendedAt:                timestamp('suspended_at'),
    suspendedBy:                text('suspended_by'),
    metadata:                   jsonb('metadata'),
    createdAt:                  timestamp('created_at').notNull().defaultNow(),
    updatedAt:                  timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('merchants_handle_idx').on(t.handle),
    index('merchants_owner_idx').on(t.ownerId),
    index('merchants_country_idx').on(t.country),
    index('merchants_status_idx').on(t.status),
  ],
);

// ─── Governance Service ───────────────────────────────────────────────────────

export const policies = pgTable(
  'policies',
  {
    id:             text('id').primaryKey(),
    name:           text('name').notNull(),
    description:    text('description'),
    type:           text('type').notNull(),
    scope:          text('scope').notNull(),
    country:        text('country'),
    institutionId:  text('institution_id'),
    service:        text('service'),
    rules:          jsonb('rules').notNull().default([]),
    active:         boolean('active').notNull().default(true),
    effectiveFrom:  timestamp('effective_from'),
    effectiveUntil: timestamp('effective_until'),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
    updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('policies_scope_idx').on(t.scope),
    index('policies_country_idx').on(t.country),
    index('policies_active_idx').on(t.active),
    index('policies_type_idx').on(t.type),
  ],
);

// ─── Verification Service ─────────────────────────────────────────────────────

export const kycSessions = pgTable(
  'kyc_sessions',
  {
    id:                    text('id').primaryKey(),
    entityId:              text('entity_id').notNull(),
    entityType:            text('entity_type').notNull(),
    country:               text('country').notNull(),
    tier:                  text('tier').notNull(),
    documents:             jsonb('documents').notNull().default([]),
    provider:              text('provider').notNull().default('internal'),
    status:                text('status').notNull().default('pending'),
    rejectionReason:       text('rejection_reason'),
    reviewNotes:           text('review_notes'),
    reviewedBy:            text('reviewed_by'),
    reviewedAt:            timestamp('reviewed_at'),
    callbackUrl:           text('callback_url'),
    verificationReference: text('verification_reference').notNull(),
    expiresAt:             timestamp('expires_at').notNull(),
    createdAt:             timestamp('created_at').notNull().defaultNow(),
    updatedAt:             timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('kyc_sessions_entity_idx').on(t.entityId),
    index('kyc_sessions_status_idx').on(t.status),
    index('kyc_sessions_country_idx').on(t.country),
  ],
);
