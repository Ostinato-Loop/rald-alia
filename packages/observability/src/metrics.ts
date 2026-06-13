// packages/observability/src/metrics.ts
// ALIA custom metrics — histograms and counters shared across all services.
// Uses the global OTEL MeterProvider initialised by tracer.ts.

import { metrics, type Histogram, type Counter, type UpDownCounter } from '@opentelemetry/api';

const meter = metrics.getMeter('alia', process.env['npm_package_version'] ?? '0.0.0');

// ── Resolution ────────────────────────────────────────────────────────────────

export const resolutionDuration: Histogram = meter.createHistogram(
  'alia.resolution.duration',
  {
    description: 'End-to-end alias resolution duration in milliseconds',
    unit:        'ms',
    advice:      { explicitBucketBoundaries: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000] },
  },
);

export const resolutionCounter: Counter = meter.createCounter(
  'alia.resolution.count',
  { description: 'Total alias resolutions by outcome, alias type, and country' },
);

export const resolutionErrors: Counter = meter.createCounter(
  'alia.resolution.errors',
  { description: 'Resolution errors by stage and error code' },
);

// ── API Keys ──────────────────────────────────────────────────────────────────

export const apiKeyVerifications: Counter = meter.createCounter(
  'alia.api_key.verifications',
  { description: 'API key verification attempts by environment and outcome' },
);

export const apiKeyVerificationDuration: Histogram = meter.createHistogram(
  'alia.api_key.verification.duration',
  {
    description: 'API key verification duration in milliseconds',
    unit:        'ms',
    advice:      { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100] },
  },
);

// ── Machine auth ──────────────────────────────────────────────────────────────

export const machineAuthErrors: Counter = meter.createCounter(
  'alia.machine.auth.errors',
  { description: 'Machine JWT auth failures by service and error type' },
);

export const machineTokenIssued: Counter = meter.createCounter(
  'alia.machine.token.issued',
  { description: 'Machine JWTs issued by requesting service' },
);

// ── Trust ─────────────────────────────────────────────────────────────────────

export const trustScoreUpdates: Counter = meter.createCounter(
  'alia.trust.score.updates',
  { description: 'Trust score recalculations by entity type and tier change' },
);

export const trustScoreHistogram: Histogram = meter.createHistogram(
  'alia.trust.score.distribution',
  {
    description: 'Distribution of trust scores at time of update',
    advice:      { explicitBucketBoundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
  },
);

// ── Kafka ─────────────────────────────────────────────────────────────────────

export const kafkaPublishDuration: Histogram = meter.createHistogram(
  'alia.kafka.publish.duration',
  {
    description: 'Kafka message publish duration in milliseconds',
    unit:        'ms',
    advice:      { explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500] },
  },
);

export const kafkaPublishErrors: Counter = meter.createCounter(
  'alia.kafka.publish.errors',
  { description: 'Kafka publish failures by topic and error type' },
);

export const kafkaConsumerLag: UpDownCounter = meter.createUpDownCounter(
  'alia.kafka.consumer.lag',
  { description: 'Consumer group message lag by topic and partition' },
);

// ── HTTP / Webhook ────────────────────────────────────────────────────────────

export const webhookDeliveries: Counter = meter.createCounter(
  'alia.webhook.deliveries',
  { description: 'Webhook delivery attempts by project environment and outcome' },
);

export const webhookDeliveryDuration: Histogram = meter.createHistogram(
  'alia.webhook.delivery.duration',
  {
    description: 'Webhook HTTP delivery duration in milliseconds',
    unit:        'ms',
    advice:      { explicitBucketBoundaries: [50, 100, 200, 500, 1000, 2000, 5000, 10000] },
  },
);

// ── Loop Voice ────────────────────────────────────────────────────────────────

export const voiceTranscriptions: Counter = meter.createCounter(
  'alia.voice.transcriptions',
  { description: 'Voice transcription requests by language and outcome' },
);

export const voiceTranscriptionDuration: Histogram = meter.createHistogram(
  'alia.voice.transcription.duration',
  {
    description: 'Whisper transcription round-trip duration in milliseconds',
    unit:        'ms',
    advice:      { explicitBucketBoundaries: [100, 250, 500, 1000, 2000, 5000, 10000] },
  },
);

// ── Registry ──────────────────────────────────────────────────────────────────

export const registryLookups: Counter = meter.createCounter(
  'alia.registry.lookups',
  { description: 'Registry entity lookups by entity type and dimension' },
);

export const registryCacheHits: Counter = meter.createCounter(
  'alia.registry.cache.hits',
  { description: 'Registry cache hits vs misses' },
);
