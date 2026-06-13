// packages/db/src/schema/webhooks.ts
// M9: Developer Webhook Logs
// Tracks all developer webhook delivery attempts for the developer portal.

import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { developerProjects } from './developers';

// ── Developer Webhook Logs ────────────────────────────────────────────────────
// One row per delivery attempt.  Multiple rows per event (on retry).
// Linked to developer_projects via project_id for scoped access in the portal.

export const developerWebhookLogs = pgTable(
  'developer_webhook_logs',
  {
    id:              text('id').primaryKey(),
    projectId:       text('project_id').notNull().references(() => developerProjects.id, { onDelete: 'cascade' }),
    developerId:     text('developer_id').notNull(),
    eventType:       text('event_type').notNull(),    // 'alias.created' | 'alias.resolved' | ...
    eventId:         text('event_id').notNull(),       // idempotency key — same across retries
    webhookUrl:      text('webhook_url').notNull(),
    payload:         jsonb('payload').notNull().default({}),
    signatureHeader: text('signature_header'),         // HMAC-SHA256 of payload

    // Delivery outcome
    status:          text('status').notNull().default('pending'),  // 'pending'|'delivered'|'failed'|'retrying'
    httpStatus:      integer('http_status'),                        // response code from target
    responseBody:    text('response_body'),                         // first 2KB of response
    errorMessage:    text('error_message'),
    latencyMs:       integer('latency_ms'),

    // Retry tracking
    attemptNumber:   integer('attempt_number').notNull().default(1),
    maxAttempts:     integer('max_attempts').notNull().default(5),
    nextRetryAt:     timestamp('next_retry_at', { withTimezone: true }),
    deliveredAt:     timestamp('delivered_at', { withTimezone: true }),

    // Environment
    environment:     text('environment').notNull().default('sandbox'),

    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dwl_project_idx').on(t.projectId),
    index('dwl_developer_idx').on(t.developerId),
    index('dwl_event_type_idx').on(t.eventType),
    index('dwl_event_id_idx').on(t.eventId),         // lookup all attempts for an event
    index('dwl_status_idx').on(t.status),
    index('dwl_retry_idx').on(t.nextRetryAt),         // retry scheduler queries this
    index('dwl_environment_idx').on(t.environment),
    index('dwl_time_idx').on(t.createdAt),
  ],
);
