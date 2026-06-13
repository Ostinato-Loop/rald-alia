// Identity State Machine — Background Job Scheduler
// Runs inside identity-service process via setInterval.
// For production at scale: replace with a dedicated worker or pg_cron.

import { logger } from '../index';
import { releaseExpiredPendingClaims }  from './releaseExpiredPendingClaims';
import { releaseExpiredVerifiedClaims } from './releaseExpiredVerifiedClaims';
import { escalateSuspendedToArchived }  from './escalateSuspendedToArchived';
import { releaseArchivedUsernames }     from './releaseArchivedUsernames';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DAILY_MS        = 24 * 60 * 60 * 1000;

function runSafe(name: string, fn: () => Promise<unknown>): void {
  fn().catch((err) => logger.error({ err, job: name }, 'Background job failed'));
}

function scheduledDailyAt(hour: number, fn: () => Promise<unknown>, name: string): void {
  const now          = new Date();
  const nextRun      = new Date(now);
  nextRun.setHours(hour, 0, 0, 0);
  if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
  const msUntilFirst = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    runSafe(name, fn);
    setInterval(() => runSafe(name, fn), DAILY_MS);
  }, msUntilFirst);

  logger.info({ job: name, firstRunAt: nextRun.toISOString() }, 'Daily job scheduled');
}

export function startIdentityJobs(): void {
  // Job 1: Release expired PENDING claims — every 5 minutes (critical for UX)
  setInterval(() => runSafe('releaseExpiredPendingClaims', releaseExpiredPendingClaims), FIVE_MINUTES_MS);
  // Run immediately on startup to catch any claims that expired while service was down
  runSafe('releaseExpiredPendingClaims', releaseExpiredPendingClaims);
  logger.info('Job 1 (releaseExpiredPendingClaims) started — interval: 5 min');

  // Job 2: Release stale VERIFIED claims — daily at 02:00
  scheduledDailyAt(2, releaseExpiredVerifiedClaims, 'releaseExpiredVerifiedClaims');

  // Job 3: Escalate SUSPENDED → ARCHIVED — daily at 03:00
  scheduledDailyAt(3, escalateSuspendedToArchived, 'escalateSuspendedToArchived');

  // Job 4: Release ARCHIVED usernames — daily at 04:00
  scheduledDailyAt(4, releaseArchivedUsernames, 'releaseArchivedUsernames');

  logger.info('All identity state machine jobs registered');
}

// ── Health endpoint data for /healthz ────────────────────────────────────────
export const JOB_SCHEDULE = {
  releaseExpiredPendingClaims:  { schedule: 'every 5 minutes', description: 'Releases PENDING claims past TTL back to AVAILABLE' },
  releaseExpiredVerifiedClaims: { schedule: 'daily 02:00',     description: 'Downgrades stale VERIFIED claims (7-day window) to PENDING' },
  escalateSuspendedToArchived:  { schedule: 'daily 03:00',     description: 'Archives users suspended > 90 days' },
  releaseArchivedUsernames:     { schedule: 'daily 04:00',     description: 'Releases quarantined usernames/aliases after 30 days' },
} as const;
