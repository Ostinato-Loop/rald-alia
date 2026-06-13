import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, users, aliases } from '@rald-alia/db';
import {
  validateUserTransition,
  validateAliasTransition,
  pendingExpiresAt,
  verifiedWindowExpiresAt,
  archivedQuarantineEndsAt,
  type IdentityStatus,
  type AliasStatus,
  type TransitionTrigger,
} from '@rald-alia/shared';
import { logger } from '../index';

const db = getDb();

export interface TransitionOptions {
  actorId?:  string;
  reason?:   string;
  metadata?: Record<string, unknown>;
}

// ── User Transitions ──────────────────────────────────────────────────────────

export async function transitionUser(
  userId:  string,
  to:      IdentityStatus,
  trigger: TransitionTrigger,
  opts:    TransitionOptions = {},
): Promise<typeof users.$inferSelect> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw Object.assign(new Error(`User ${userId} not found`), { status: 404 });

  const from = (user.identityStatus ?? 'pending') as IdentityStatus;
  const result = validateUserTransition(from, to, trigger);
  if (!result.allowed) {
    throw Object.assign(new Error(result.reason), { status: 422, code: 'INVALID_TRANSITION' });
  }

  const now  = new Date();
  const patch: Partial<typeof users.$inferInsert> = {
    identityStatus: to,
    updatedAt:      now,
  };

  // Lifecycle timestamp bookkeeping
  switch (to) {
    case 'pending':
      patch.pendingExpiresAt = pendingExpiresAt();
      break;
    case 'verified':
      patch.verifiedAt = now;
      // Give user 7 days to complete profile before claim is released
      patch.pendingExpiresAt = verifiedWindowExpiresAt();
      break;
    case 'active':
      patch.activatedAt      = patch.activatedAt ?? now;
      patch.pendingExpiresAt = null;
      patch.isActive         = true;
      patch.isVerified       = true;
      break;
    case 'trusted':
      patch.trustedAt = now;
      break;
    case 'suspended':
      patch.suspendedAt      = now;
      patch.suspensionReason = opts.reason ?? null;
      patch.suspendedBy      = opts.actorId ?? null;
      patch.isActive         = false;
      break;
    case 'archived':
      patch.archivedAt          = now;
      patch.archiveReason        = opts.reason ?? null;
      patch.isActive             = false;
      // Quarantine: username held for 30 days before it becomes AVAILABLE again
      patch.usernameReleasedAt   = archivedQuarantineEndsAt(now);
      break;
    case 'available':
      // Username has been released back to the pool — clear all personal data
      // (In production: GDPR erasure job handles full scrub)
      patch.isActive = false;
      break;
  }

  const [updated] = await db
    .update(users)
    .set(patch as any)
    .where(eq(users.id, userId))
    .returning();

  // Append to identity_transitions log
  await db.execute(sql`
    INSERT INTO identity_transitions
      (id, entity_id, entity_type, from_status, to_status, triggered_by, actor_id, reason, metadata)
    VALUES
      (${uuidv4()}, ${userId}, 'user', ${from}, ${to}, ${trigger}, ${opts.actorId ?? null}, ${opts.reason ?? null}, ${JSON.stringify(opts.metadata ?? {})})
  `);

  logger.info({ userId, from, to, trigger }, 'User identity transitioned');
  return updated!;
}

// ── Alias Transitions ─────────────────────────────────────────────────────────

export async function transitionAlias(
  aliasId: string,
  to:      AliasStatus,
  trigger: TransitionTrigger,
  opts:    TransitionOptions = {},
): Promise<typeof aliases.$inferSelect> {
  const [alias] = await db.select().from(aliases).where(eq(aliases.id, aliasId)).limit(1);
  if (!alias) throw Object.assign(new Error(`Alias ${aliasId} not found`), { status: 404 });

  const from = alias.status as AliasStatus;
  const result = validateAliasTransition(from, to, trigger);
  if (!result.allowed) {
    throw Object.assign(new Error(result.reason), { status: 422, code: 'INVALID_TRANSITION' });
  }

  const now = new Date();
  const patch: Partial<typeof aliases.$inferInsert> = { updatedAt: now };

  switch (to) {
    case 'active':
      patch.status      = 'active';
      patch.activatedAt = now;
      break;
    case 'suspended':
      patch.status            = 'suspended';
      patch.suspendedAt       = now;
      patch.suspensionReason  = opts.reason ?? null;
      break;
    case 'deleted':
      patch.status        = 'deleted';
      patch.deletedAt     = now;
      patch.archivedAt    = now;
      // Quarantine the alias value for 30 days
      patch.quarantineUntil = archivedQuarantineEndsAt(now);
      break;
  }

  const [updated] = await db
    .update(aliases)
    .set(patch as any)
    .where(eq(aliases.id, aliasId))
    .returning();

  await db.execute(sql`
    INSERT INTO identity_transitions
      (id, entity_id, entity_type, from_status, to_status, triggered_by, actor_id, reason, metadata)
    VALUES
      (${uuidv4()}, ${aliasId}, 'alias', ${from}, ${to}, ${trigger}, ${opts.actorId ?? null}, ${opts.reason ?? null}, ${JSON.stringify(opts.metadata ?? {})})
  `);

  logger.info({ aliasId, from, to, trigger }, 'Alias status transitioned');
  return updated!;
}

// ── Claim registration helper ─────────────────────────────────────────────────
// Called by auth route on first registration step (sets PENDING + TTL)

export async function claimIdentity(userId: string): Promise<Date> {
  const expires = pendingExpiresAt();
  await db
    .update(users)
    .set({ identityStatus: 'pending', pendingExpiresAt: expires, updatedAt: new Date() } as any)
    .where(eq(users.id, userId));

  await db.execute(sql`
    INSERT INTO identity_transitions
      (id, entity_id, entity_type, from_status, to_status, triggered_by)
    VALUES
      (${uuidv4()}, ${userId}, 'user', 'available', 'pending', 'system')
  `);

  logger.info({ userId, expiresAt: expires }, 'Identity claim started');
  return expires;
}
