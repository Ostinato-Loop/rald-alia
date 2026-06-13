// packages/db/src/client.ts
// Singleton Drizzle client for the ALIA platform.
//
// All services import getDb() from '@rald-alia/db' to get a shared, lazy-initialised
// connection pool.  The pool is created once per process and reused across requests.
//
// Environment:
//   DATABASE_URL  — PostgreSQL connection string (required)
//
// The connection pool is sized for microservices:
//   max: 10 connections per service process
//   idle_timeout: 30s  — release idle connections quickly in low-traffic periods
//   connect_timeout: 5s — fail fast on misconfigured DATABASE_URL
//
// Usage:
//   import { getDb } from '@rald-alia/db';
//   const db = getDb();
//   const rows = await db.select().from(users).where(eq(users.id, id));

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './index';

export type Db = ReturnType<typeof drizzle>;

let _client: ReturnType<typeof postgres> | null = null;
let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;

  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      '[rald-alia/db] DATABASE_URL is not set. ' +
      'Add it to your .env file or deployment environment.',
    );
  }

  _client = postgres(url, {
    max:             10,
    idle_timeout:    30,
    connect_timeout: 5,
    // Drizzle manages prepared statements — disable postgres.js's own cache
    // to avoid double-preparation conflicts across schema changes.
    prepare:         false,
  });

  _db = drizzle(_client, { schema, logger: process.env['DB_LOG'] === 'true' });
  return _db;
}

// Call on graceful shutdown to drain the pool.
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db     = null;
  }
}
