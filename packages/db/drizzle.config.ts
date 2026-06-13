// packages/db/drizzle.config.ts
// Drizzle Kit configuration for schema generation and migrations.
//
// Usage:
//   pnpm --filter @rald-alia/db run generate   # generate migration from schema changes
//   pnpm --filter @rald-alia/db run push       # push schema directly (dev only)
//   pnpm --filter @rald-alia/db run studio     # open Drizzle Studio
//
// Migrations are the source of truth — apply them in order on every environment:
//   for f in packages/db/migrations/000*.sql; do psql $DATABASE_URL -f "$f"; done

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default defineConfig({
  dialect:     'postgresql',
  schema:      './src/**/*.ts',
  out:         './migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
  migrations: {
    table:  '__drizzle_migrations',
    schema: 'public',
  },
  verbose: true,
  strict:  true,
});
