// Job 3: Escalate long-suspended users to ARCHIVED
// Schedule: daily at 03:00
// Users suspended for > 90 days without admin reinstatement are archived.
// Archived = soft-deleted. Their username enters a 30-day quarantine.

import { v4 as uuidv4 } from 'uuid';
import { lt, eq, and, isNotNull, sql } from 'drizzle-orm';
import { getDb, users, aliases } from '@rald-alia/db';
import {
  archivedQuarantineEndsAt,
  IDENTITY_TTL,
} from '@rald-alia/shared';
import { logger } from '../index';

const NINETY_DAYS_MS = IDENTITY_TTL.SUSPENDED_ESCALATION_DAYS * 86_400_000;

export async function escalateSuspendedToArchived(): Promise<{ count: number }> {
  const db        = getDb();
  const now       = new Date();
  const threshold = new Date(now.getTime() - NINETY_DAYS_MS);

  // Users who have been SUSPENDED for > 90 days
  const staleSuspended = await db
    .select({ id: users.id, suspendedAt: users.suspendedAt as any })
    .from(users)
    .where(
      and(
        eq(users.identityStatus as any, 'suspended'),
        isNotNull(users.suspendedAt as any),
        lt(users.suspendedAt as any, threshold),
      ),
    );

  let count = 0;
  for (const user of staleSuspended) {
    try {
      const quarantineEnds = archivedQuarantineEndsAt(now);

      await db
        .update(users)
        .set({
          identityStatus:     'archived' as any,
          archivedAt:          now as any,
          archiveReason:       `Auto-archived: suspended for more than ${IDENTITY_TTL.SUSPENDED_ESCALATION_DAYS} days without reinstatement`,
          usernameReleasedAt:  quarantineEnds as any,
          isActive:            false,
          updatedAt:           now,
        })
        .where(eq(users.id, user.id));

      // Cascade: delete all active aliases for this user
      const userAliases = await db
        .select({ id: aliases.id })
        .from(aliases)
        .where(and(eq(aliases.userId, user.id), eq(aliases.status, 'active')));

      for (const alias of userAliases) {
        await db
          .update(aliases)
          .set({
            status:          'deleted',
            deletedAt:        now,
            archivedAt:       now as any,
            quarantineUntil:  quarantineEnds as any,
            updatedAt:        now,
          })
          .where(eq(aliases.id, alias.id));

        await db.execute(sql`
          INSERT INTO identity_transitions
            (id, entity_id, entity_type, from_status, to_status, triggered_by, reason)
          VALUES
            (${uuidv4()}, ${alias.id}, 'alias', 'active', 'deleted', 'job',
             'Cascaded from user archival (90-day suspension escalation)')
        `);
      }

      await db.execute(sql`
        INSERT INTO identity_transitions
          (id, entity_id, entity_type, from_status, to_status, triggered_by, reason, metadata)
        VALUES
          (${uuidv4()}, ${user.id}, 'user', 'suspended', 'archived', 'job',
           'Auto-archived after 90 days suspended',
           ${JSON.stringify({ suspendedAt: user.suspendedAt, aliasesCascaded: userAliases.length })})
      `);

      count++;
      logger.warn(
        { userId: user.id, suspendedAt: user.suspendedAt, quarantineEnds, aliasesCascaded: userAliases.length },
        'User escalated from suspended to archived',
      );
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to escalate suspended user to archived');
    }
  }

  if (count > 0) {
    logger.info({ count }, 'escalateSuspendedToArchived complete');
  }

  return { count };
}
