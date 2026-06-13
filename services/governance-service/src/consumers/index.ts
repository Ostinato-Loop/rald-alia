// services/governance-service/src/consumers/index.ts
// Governance Kafka consumer — subscribes to RESOLUTION_COMPLETED events and
// enforces SLA/failure-rate policies per destination bank.
//
// POLICY CHECKS (evaluated on every event):
//
//   1. Failure Rate  — if >FAILURE_RATE_THRESHOLD of resolutions to a bank fail
//      within the rolling WINDOW_MS window AND the sample is large enough
//      (>= MIN_SAMPLE_SIZE), emit POLICY_VIOLATED.
//
//   2. High Latency  — if a single resolution reports latency > LATENCY_HARD_CAP_MS,
//      emit POLICY_VIOLATED immediately (no window needed — one bad reading is signal).
//
//   3. Alert Debounce — violations for the same bank are suppressed for
//      ALERT_DEBOUNCE_MS to prevent alert storms.
//
// State is kept in-process (Map). If the service restarts the window resets —
// acceptable given the 5-minute window. A Redis-backed variant can replace this
// when multi-replica deployment requires shared state.

import { createConsumer, publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import { logger } from '../index';

// ── Thresholds ────────────────────────────────────────────────────────────────

const FAILURE_RATE_THRESHOLD = 0.05;       // 5 % failure rate triggers alert
const MIN_SAMPLE_SIZE        = 20;         // ignore window until ≥ 20 samples
const LATENCY_HARD_CAP_MS    = 2_000;     // single event >2 s triggers alert
const WINDOW_MS              = 5 * 60 * 1_000;  // 5-minute rolling window
const ALERT_DEBOUNCE_MS      = 5 * 60 * 1_000;  // suppress re-alerts for 5 min

// ── In-process sliding-window state ──────────────────────────────────────────

interface WindowBucket {
  total:       number;
  failures:    number;
  windowStart: number;
}

const windows    = new Map<string, WindowBucket>();
const lastAlerts = new Map<string, number>();   // key → timestamp of last alert

function getOrResetWindow(key: string): WindowBucket {
  const now    = Date.now();
  const bucket = windows.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    const fresh: WindowBucket = { total: 0, failures: 0, windowStart: now };
    windows.set(key, fresh);
    return fresh;
  }
  return bucket;
}

function isDebounced(key: string): boolean {
  const last = lastAlerts.get(key);
  return last !== undefined && Date.now() - last < ALERT_DEBOUNCE_MS;
}

function markAlerted(key: string): void {
  lastAlerts.set(key, Date.now());
}

// ── Violation emitter ─────────────────────────────────────────────────────────

async function emitPolicyViolation(params: {
  bankCode:      string;
  policyId:      string;
  reason:        string;
  metric:        Record<string, unknown>;
}): Promise<void> {
  await publishEvent(KAFKA_TOPICS.POLICY_VIOLATED, {
    eventType:  KAFKA_TOPICS.POLICY_VIOLATED,
    actorId:    'governance-service',
    actorType:  'system',
    payload: {
      policyId:   params.policyId,
      targetId:   params.bankCode,
      targetType: 'institution',
      reason:     params.reason,
      metric:     params.metric,
      window_ms:  WINDOW_MS,
    },
  } as any);
}

// ── Consumer startup ──────────────────────────────────────────────────────────

export async function startGovernanceConsumers(): Promise<void> {
  await createConsumer({
    groupId: 'governance-service-group',
    topics:  [KAFKA_TOPICS.RESOLUTION_COMPLETED],

    handlers: {
      // ── RESOLUTION_COMPLETED ──────────────────────────────────────────────
      [KAFKA_TOPICS.RESOLUTION_COMPLETED]: async (event: any) => {
        const p = (event.payload ?? {}) as {
          resolutionId?:       string;
          alias?:              string;
          destinationBankCode?: string;
          latencyMs?:          number;
          success?:            boolean;
          fromCache?:          boolean;
        };

        const bankCode  = p.destinationBankCode ?? 'unknown';
        const success   = p.success ?? true;
        const latencyMs = p.latencyMs ?? null;
        const windowKey = `bank:${bankCode}`;

        // ── 1. Update rolling window ─────────────────────────────────────────
        const bucket = getOrResetWindow(windowKey);
        bucket.total++;
        if (!success) bucket.failures++;

        logger.debug(
          { bankCode, success, latencyMs, total: bucket.total, failures: bucket.failures },
          'governance-consumer: resolution event processed',
        );

        const violations: Promise<void>[] = [];

        // ── 2. Failure-rate check ────────────────────────────────────────────
        if (bucket.total >= MIN_SAMPLE_SIZE && !isDebounced(windowKey)) {
          const failureRate = bucket.failures / bucket.total;
          if (failureRate > FAILURE_RATE_THRESHOLD) {
            const rate = (failureRate * 100).toFixed(1);
            logger.warn(
              { bankCode, failureRate: rate, total: bucket.total, failures: bucket.failures },
              'governance-consumer: failure rate threshold exceeded — emitting POLICY_VIOLATED',
            );
            markAlerted(windowKey);
            violations.push(
              emitPolicyViolation({
                bankCode,
                policyId: 'RESOLUTION_FAILURE_RATE',
                reason:   `Bank ${bankCode} resolution failure rate ${rate}% exceeds 5% threshold over ${bucket.total} requests in 5-min window`,
                metric: {
                  failure_rate:   failureRate,
                  failure_count:  bucket.failures,
                  total_count:    bucket.total,
                  window_seconds: WINDOW_MS / 1_000,
                },
              }).catch((err) =>
                logger.error({ err, bankCode }, 'governance-consumer: failed to publish POLICY_VIOLATED (failure rate)'),
              ),
            );
          }
        }

        // ── 3. High-latency check (single-event, no debounce needed) ─────────
        if (latencyMs !== null && latencyMs > LATENCY_HARD_CAP_MS) {
          const latKey = `latency:${bankCode}`;
          if (!isDebounced(latKey)) {
            markAlerted(latKey);
            logger.warn(
              { bankCode, latencyMs },
              'governance-consumer: resolution latency exceeds hard cap — emitting POLICY_VIOLATED',
            );
            violations.push(
              emitPolicyViolation({
                bankCode,
                policyId: 'RESOLUTION_LATENCY_BREACH',
                reason:   `Bank ${bankCode} returned a resolution in ${latencyMs}ms — exceeds ${LATENCY_HARD_CAP_MS}ms hard cap`,
                metric:   { latency_ms: latencyMs, hard_cap_ms: LATENCY_HARD_CAP_MS },
              }).catch((err) =>
                logger.error({ err, bankCode }, 'governance-consumer: failed to publish POLICY_VIOLATED (latency)'),
              ),
            );
          }
        }

        await Promise.all(violations);
      },
    },
  });

  logger.info(
    {
      topics:             [KAFKA_TOPICS.RESOLUTION_COMPLETED],
      failure_threshold:  `${FAILURE_RATE_THRESHOLD * 100}%`,
      min_sample_size:    MIN_SAMPLE_SIZE,
      window_minutes:     WINDOW_MS / 60_000,
      latency_cap_ms:     LATENCY_HARD_CAP_MS,
    },
    'governance-service Kafka consumers running',
  );
}
