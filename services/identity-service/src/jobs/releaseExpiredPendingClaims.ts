// Job 1: Release expired PENDING identity claims
// Schedule: every 5 minutes
// Finds users stuck in PENDING whose pending_expires_at has passed,
// transitions them back to AVAILABLE, and releases their username reservation.

import { v4 as uuidv4 } from 'uuid';
import { lt, eq, and, isNotNull, sql } from 'drizzle-orm';
import { getDb, users, aliases } from '@rald-alia/db';
import { logger } from '../index';

export async function releaseExpiredPendingClaims(): Promise<{ users: number; aliases: number }> {
  const db  = getDb();
  const now = new Date();

  // ── 1. Expired PENDING users ──────────────────────────────────────────────
  const expiredUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.identityStatus as any, 'pending'),
        isNotNull(users.pendingExpiresAt as any),
        lt(users.pendingExpiresAt as any, now),
      ),
    );

  let userCount = 0;
  for (const user of expiredUsers) {
    try {
      await db
        .update(users)
        .set({
          identityStatus:  'available' as any,
          pendingExpiresAt: null as any,
          updatedAt:        now,
        })
        .where(eq(users.id, user.id));

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
        VALUES
          (${uuidv4()}, ${user.id}, 'user', 'pending', 'available', 'job',
           'Pending claim TTL expired (30 min)')
      `);

      userCount++;
      logger.info({ userId: user.id }, 'Released expired pending user claim');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to release pending user claim');
    }
  }

  // ── 2. Expired PENDING aliases ────────────────────────────────────────────
  const expiredAliases = await db
    .select({ id: aliases.id, normalizedValue: aliases.normalizedValue })
    .from(aliases)
    .where(
      and(
        eq(aliases.status, 'pending'),
        isNotNull(aliases.pendingExpiresAt as any),
        lt(aliases.pendingExpiresAt as any, now),
      ),
    );

  let aliasCount = 0;
  for (const alias of expiredAliases) {
    try {
      await db
        .update(aliases)
        .set({
          status:           'deleted',
          deletedAt:        now,
          archivedAt:       now as any,
          quarantineUntil:  new Date(now.getTime() + 30 * 86_400_000) as any, // 30-day quarantine
          updatedAt:        now,
        })
        .where(eq(aliases.id, alias.id));

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
        VALUES
          (${uuidv4()}, ${alias.id}, 'alias', 'pending', 'deleted', 'job',
           'Alias claim TTL expired')
      `);

      aliasCount++;
      logger.info({ aliasId: alias.id, value: alias.normalizedValue }, 'Released expired pending alias claim');
    } catch (err) {
      logger.error({ err, aliasId: alias.id }, 'Failed to release pending alias claim');
    }
  }

  if (userCount + aliasCount > 0) {
    logger.info({ userCount, aliasCount }, 'releaseExpiredPendingClaims complete');
  }

  return { users: userCount, aliases: aliasCount };
}
