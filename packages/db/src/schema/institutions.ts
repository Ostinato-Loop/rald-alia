import {
  pgTable,
  pgEnum,
  text,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const institutionTypeEnum = pgEnum('institution_type', [
  'commercial_bank',
  'microfinance_bank',
  'fintech',
  'mobile_money',
  'payment_service_bank',
  'neobank',
  'central_bank',
  'cooperative',
  'insurance',
  'investment',
  'other',
]);

export const institutionStatusEnum = pgEnum('institution_status', [
  'active',
  'pending_verification',
  'suspended',
  'revoked',
  'sandbox_only',
]);

export const licenseStatusEnum = pgEnum('license_status', [
  'active',
  'pending',
  'expired',
  'revoked',
  'suspended',
]);

export const prefixSchemeEnum = pgEnum('prefix_scheme', [
  'nuban',
  'iban',
  'mobile_msisdn',
  'internal',
  'swift_bic',
  'other',
]);

// ── Tables ────────────────────────────────────────────────────────────────────

export const financialInstitutions = pgTable(
  'financial_institutions',
  {
    id:                   text('id').primaryKey(),
    institutionCode:      text('institution_code').notNull().unique(),
    shortName:            text('short_name').notNull(),
    fullName:             text('full_name').notNull(),
    type:                 institutionTypeEnum('type').notNull(),
    status:               institutionStatusEnum('status').notNull().default('pending_verification'),

    website:              text('website'),
    supportEmail:         text('support_email'),
    supportPhone:         text('support_phone'),
    hqCountry:            text('hq_country').notNull(),

    swiftBic:             text('swift_bic'),
    cbnLicenseCode:       text('cbn_license_code'),
    rcNumber:             text('rc_number'),
    taxId:                text('tax_id'),

    isAliaParticipant:    boolean('is_alia_participant').notNull().default(false),
    isResolutionTarget:   boolean('is_resolution_target').notNull().default(true),
    isAliasIssuer:        boolean('is_alias_issuer').notNull().default(false),
    sandboxEnabled:       boolean('sandbox_enabled').notNull().default(false),
    productionEnabled:    boolean('production_enabled').notNull().default(false),

    machineId:            text('machine_id'),

    logoUrl:              text('logo_url'),
    colorHex:             text('color_hex'),
    metadata:             jsonb('metadata').notNull().default({}),

    verifiedAt:           timestamp('verified_at', { withTimezone: true }),
    verifiedBy:           text('verified_by'),
    suspendedAt:          timestamp('suspended_at', { withTimezone: true }),
    suspensionReason:     text('suspension_reason'),
    revokedAt:            timestamp('revoked_at', { withTimezone: true }),
    revocationReason:     text('revocation_reason'),

    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fi_type_idx').on(t.type),
    index('fi_status_idx').on(t.status),
    index('fi_country_idx').on(t.hqCountry),
    index('fi_participant_idx').on(t.isAliaParticipant),
  ],
);

export const institutionLicenses = pgTable(
  'institution_licenses',
  {
    id:              text('id').primaryKey(),
    institutionId:   text('institution_id').notNull().references(() => financialInstitutions.id, { onDelete: 'cascade' }),
    countryCode:     text('country_code').notNull(),
    licenseType:     text('license_type').notNull(),
    licenseNumber:   text('license_number').notNull(),
    issuingBody:     text('issuing_body').notNull(),
    status:          licenseStatusEnum('status').notNull().default('active'),

    issuedAt:        timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt:       timestamp('expires_at', { withTimezone: true }),
    renewedAt:       timestamp('renewed_at', { withTimezone: true }),
    revokedAt:       timestamp('revoked_at', { withTimezone: true }),
    revocationNote:  text('revocation_note'),

    permittedScopes: jsonb('permitted_scopes').notNull().default([]),
    metadata:        jsonb('metadata').notNull().default({}),

    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('il_unique').on(t.institutionId, t.countryCode, t.licenseType),
    index('il_institution_idx').on(t.institutionId),
    index('il_country_idx').on(t.countryCode),
    index('il_status_idx').on(t.status),
  ],
);

export const institutionRoutingPrefixes = pgTable(
  'institution_routing_prefixes',
  {
    id:            text('id').primaryKey(),
    institutionId: text('institution_id').notNull().references(() => financialInstitutions.id, { onDelete: 'cascade' }),
    countryCode:   text('country_code').notNull(),
    scheme:        prefixSchemeEnum('scheme').notNull(),
    prefix:        text('prefix').notNull(),
    description:   text('description'),
    isActive:      boolean('is_active').notNull().default(true),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('irp_unique').on(t.countryCode, t.scheme, t.prefix),
    index('irp_institution_idx').on(t.institutionId),
    index('irp_prefix_idx').on(t.prefix),
    index('irp_scheme_idx').on(t.scheme),
  ],
);

export const institutionSettlementAccounts = pgTable(
  'institution_settlement_accounts',
  {
    id:            text('id').primaryKey(),
    institutionId: text('institution_id').notNull().references(() => financialInstitutions.id, { onDelete: 'cascade' }),
    currency:      text('currency').notNull().default('NGN'),
    accountToken:  text('account_token').notNull(),
    accountName:   text('account_name').notNull(),
    bankCode:      text('bank_code').notNull(),
    isPrimary:     boolean('is_primary').notNull().default(false),
    isActive:      boolean('is_active').notNull().default(true),
    environment:   text('environment').notNull().default('production'),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('isa_institution_idx').on(t.institutionId),
    index('isa_currency_idx').on(t.currency),
  ],
);

export const institutionEvents = pgTable(
  'institution_events',
  {
    id:            text('id').primaryKey(),
    institutionId: text('institution_id').notNull(),
    eventType:     text('event_type').notNull(),
    actorId:       text('actor_id'),
    actorType:     text('actor_type').notNull().default('system'),
    payload:       jsonb('payload').notNull().default({}),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ie_institution_idx').on(t.institutionId),
    index('ie_type_idx').on(t.eventType),
    index('ie_time_idx').on(t.createdAt),
  ],
);
