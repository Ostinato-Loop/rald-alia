// Job 2: Release stale VERIFIED claims
// Schedule: daily at 02:00
// Finds users who verified their email/OTP but never completed their profile
// (never transitioned to ACTIVE). After 7 days in VERIFIED, the claim is released.
// The username becomes AVAILABLE after 30-day quarantine.

import { v4 as uuidv4 } from 'uuid';
import { lt, eq, and, isNotNull, sql } from 'drizzle-orm';
import { getDb, users } from '@rald-alia/db';
import { logger } from '../index';

export async function releaseExpiredVerifiedClaims(): Promise<{ count: number }> {
  const db  = getDb();
  const now = new Date();

  // Users in VERIFIED status whose 7-day window has passed
  // (pending_expires_at was set to verified_at + 7 days during transition)
  const staleVerified = await db
    .select({ id: users.id, email: users.email, verifiedAt: users.verifiedAt as any })
    .from(users)
    .where(
      and(
        eq(users.identityStatus as any, 'verified'),
        isNotNull(users.pendingExpiresAt as any),
        lt(users.pendingExpiresAt as any, now),
      ),
    );

  let count = 0;
  for (const user of staleVerified) {
    try {
      // Move back to PENDING (not AVAILABLE) — user can re-verify without losing their
      // email/phone reservation; they just need to re-confirm OTP
      await db
        .update(users)
        .set({
          identityStatus:  'pending' as any,
          verifiedAt:       null as any,
          pendingExpiresAt: new Date(now.getTime() + 30 * 60 * 1000) as any, // fresh 30-min window
          updatedAt:        now,
        })
        .where(eq(users.id, user.id));

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
        VALUES
          (${uuidv4()}, ${user.id}, 'user', 'verified', 'pending', 'job',
           'Verified claim window expired (7 days) — re-verification required')
      `);

      count++;
      logger.info({ userId: user.id, verifiedAt: user.verifiedAt }, 'Downgraded stale verified claim to pending');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to downgrade stale verified claim');
    }
  }

  if (count > 0) {
    logger.info({ count }, 'releaseExpiredVerifiedClaims complete');
  }

  return { count };
}
