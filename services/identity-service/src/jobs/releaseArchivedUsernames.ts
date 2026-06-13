// Job 4: Release archived usernames back to the pool
// Schedule: daily at 04:00
// After 30-day quarantine, archived users' usernames/emails become AVAILABLE.
// This is the final step of the identity lifecycle: ARCHIVED → AVAILABLE.
// The actual user record remains archived (soft-deleted), only the claim is released.

import { v4 as uuidv4 } from 'uuid';
import { lt, eq, and, isNotNull, sql } from 'drizzle-orm';
import { getDb, users, aliases } from '@rald-alia/db';
import { logger } from '../index';

export async function releaseArchivedUsernames(): Promise<{ usersReleased: number; aliasesReleased: number }> {
  const db  = getDb();
  const now = new Date();

  // ── 1. Release archived user email/phone reservations ────────────────────
  // username_released_at < now means quarantine is over
  const readyToRelease = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.identityStatus as any, 'archived'),
        isNotNull(users.usernameReleasedAt as any),
        lt(users.usernameReleasedAt as any, now),
      ),
    );

  let usersReleased = 0;
  for (const user of readyToRelease) {
    try {
      // Anonymise the user record — remove PII so email/phone are free
      // In production: full GDPR erasure job runs separately; this just clears the claim.
      await db
        .update(users)
        .set({
          identityStatus:    'available' as any,
          usernameReleasedAt: null as any,
          // Nullify email/phone so they can be claimed by a new registration
          // NOTE: the user row stays for audit trail; PII cleared by erasure job
          email:             `deleted-${user.id}@rald.invalid` as any,
          updatedAt:         now,
        })
        .where(eq(users.id, user.id));

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
        VALUES
          (${uuidv4()}, ${user.id}, 'user', 'archived', 'available', 'job',
           '30-day quarantine complete — identity claim released to pool')
      `);

      usersReleased++;
      logger.info({ userId: user.id }, 'Archived user identity released to available pool');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to release archived user identity');
    }
  }

  // ── 2. Release quarantined alias values ───────────────────────────────────
  // After quarantine_until < now, the alias normalizedValue can be claimed again
  const quarantinedAliases = await db
    .select({ id: aliases.id, normalizedValue: aliases.normalizedValue })
    .from(aliases)
    .where(
      and(
        eq(aliases.status, 'deleted'),
        isNotNull(aliases.quarantineUntil as any),
        lt(aliases.quarantineUntil as any, now),
      ),
    );

  let aliasesReleased = 0;
  for (const alias of quarantinedAliases) {
    try {
      // Clear the quarantine marker — the row stays for audit but the value is freed
      await db
        .update(aliases)
        .set({
          quarantineUntil:  null as any,
          normalizedValue:  `released-${alias.id}` as any, // free up the unique constraint
          updatedAt:        now,
        })
        .where(eq(aliases.id, alias.id));

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
        VALUES
          (${uuidv4()}, ${alias.id}, 'alias', 'deleted', 'deleted', 'job',
           'Alias quarantine complete — value available for re-registration')
      `);

      aliasesReleased++;
      logger.info({ aliasId: alias.id, value: alias.normalizedValue }, 'Alias quarantine lifted — value pool-ready');
    } catch (err) {
      logger.error({ err, aliasId: alias.id }, 'Failed to release quarantined alias');
    }
  }

  if (usersReleased + aliasesReleased > 0) {
    logger.info({ usersReleased, aliasesReleased }, 'releaseArchivedUsernames complete');
  }

  return { usersReleased, aliasesReleased };
}
