// M4 Security schema — machine_identities and machine_jwt_log
// Drizzle representation of tables created in migration 0004.

import {
  pgTable,
  text,
  boolean,
  bigint,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const machineIdentities = pgTable(
  'machine_identities',
  {
    id:               text('id').primaryKey(),
    serviceName:      text('service_name').notNull().unique(),
    displayName:      text('display_name').notNull(),
    clientSecretHash: text('client_secret_hash').notNull(),
    allowedScopes:    jsonb('allowed_scopes').notNull().default([]),
    allowedServices:  jsonb('allowed_services').notNull().default([]),
    isActive:         boolean('is_active').notNull().default(true),
    environment:      text('environment').notNull().default('production'),

    secretRotatedAt:  timestamp('secret_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    lastAuthAt:       timestamp('last_auth_at', { withTimezone: true }),
    lastAuthIp:       text('last_auth_ip'),
    authCount:        bigint('auth_count', { mode: 'bigint' }).notNull().default(BigInt(0)),

    revokedAt:        timestamp('revoked_at', { withTimezone: true }),
    revokedBy:        text('revoked_by'),
    revocationReason: text('revocation_reason'),

    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('mi_service_idx').on(t.serviceName),
    index('mi_active_idx').on(t.isActive),
  ],
);

export const machineJwtLog = pgTable(
  'machine_jwt_log',
  {
    id:          text('id').primaryKey(),
    machineId:   text('machine_id').notNull().references(() => machineIdentities.id),
    serviceName: text('service_name').notNull(),
    issuedAt:    timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt:   timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress:   text('ip_address'),
    revoked:     boolean('revoked').notNull().default(false),
    revokedAt:   timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    index('mjl_machine_idx').on(t.machineId),
    index('mjl_issued_idx').on(t.issuedAt),
    index('mjl_service_idx').on(t.serviceName),
  ],
);
