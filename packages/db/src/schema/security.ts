// packages/db/src/schema/security.ts
// M4: Machine Identity + M8: Control Plane
// Drizzle representation of tables created in migrations 0004 and 0008.

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

// ── Machine Identities ────────────────────────────────────────────────────────
// Service-to-service authentication credentials.
// Each of the 19 ALIA services has a machine identity it uses to obtain JWTs.

export const machineIdentities = pgTable(
  'machine_identities',
  {
    id:               text('id').primaryKey(),
    serviceName:      text('service_name').notNull().unique(),
    displayName:      text('display_name').notNull(),
    clientSecretHash: text('client_secret_hash').notNull(),  // bcrypt hash
    allowedScopes:    jsonb('allowed_scopes').notNull().default([]),
    allowedServices:  jsonb('allowed_services').notNull().default([]),
    isActive:         boolean('is_active').notNull().default(true),
    environment:      text('environment').notNull().default('production'),

    // Rotation tracking
    secretRotatedAt:  timestamp('secret_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    lastAuthAt:       timestamp('last_auth_at', { withTimezone: true }),
    lastAuthIp:       text('last_auth_ip'),
    authCount:        bigint('auth_count', { mode: 'bigint' }).notNull().default(BigInt(0)),

    // Lifecycle
    revokedAt:        timestamp('revoked_at', { withTimezone: true }),
    revokedBy:        text('revoked_by'),
    revocationReason: text('revocation_reason'),

    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('mi_service_idx').on(t.serviceName),
    index('mi_active_idx').on(t.isActive),
    index('mi_environment_idx').on(t.environment),
  ],
);

// ── Machine JWT Audit Log ─────────────────────────────────────────────────────
// Every machine JWT issuance logged for anomaly detection and replay prevention.

export const machineJwtLog = pgTable(
  'machine_jwt_log',
  {
    id:           text('id').primaryKey(),
    machineId:    text('machine_id').notNull().references(() => machineIdentities.id),
    serviceName:  text('service_name').notNull(),
    issuedAt:     timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress:    text('ip_address'),
    revoked:      boolean('revoked').notNull().default(false),
    revokedAt:    timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    index('mjl_machine_idx').on(t.machineId),
    index('mjl_issued_idx').on(t.issuedAt),
    index('mjl_service_idx').on(t.serviceName),
    // For replay prevention: lookup by (machineId, issuedAt) window
    index('mjl_active_idx').on(t.machineId, t.issuedAt),
  ],
);

// ── Control Plane Events ──────────────────────────────────────────────────────
// Tracks every action taken through the control plane.
// Created in migration 0008. Required for compliance and incident response.

export const controlPlaneEvents = pgTable(
  'control_plane_events',
  {
    id:         text('id').primaryKey(),
    action:     text('action').notNull(),      // 'country.transition' | 'developer.approve' | 'developer.revoke'
    actorId:    text('actor_id').notNull(),
    actorType:  text('actor_type').notNull().default('machine'),
    targetType: text('target_type').notNull(), // 'country' | 'developer' | 'institution' | 'network'
    targetId:   text('target_id'),
    result:     text('result').notNull(),       // 'success' | 'failure'
    errorCode:  text('error_code'),
    requestId:  text('request_id'),
    metadata:   jsonb('metadata').notNull().default({}),
    createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cpe_action_idx').on(t.action),
    index('cpe_actor_idx').on(t.actorId),
    index('cpe_target_idx').on(t.targetType, t.targetId),
    index('cpe_result_idx').on(t.result),
    index('cpe_time_idx').on(t.createdAt),
  ],
);
