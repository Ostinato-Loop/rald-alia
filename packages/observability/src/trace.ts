// packages/observability/src/trace.ts
// Tracer factory + withSpan() helper + ALIA semantic attribute constants.

import { trace, context, SpanStatusCode, SpanKind, type Span, type Attributes } from '@opentelemetry/api';

// ── ALIA semantic attributes ──────────────────────────────────────────────────
// Shared across all services so traces are queryable by the same attribute names.

export const AliaAttr = {
  // Alias resolution
  ALIAS_TYPE:         'alia.alias.type',         // phone | bank_account | national_id | ...
  ALIAS_COUNTRY:      'alia.alias.country',       // ISO-3166-1 alpha-2
  ALIAS_STATUS:       'alia.alias.status',        // active | suspended | revoked
  RESOLUTION_STAGE:   'alia.resolution.stage',    // directory_lookup | trust_check | consent_check | route
  RESOLUTION_OUTCOME: 'alia.resolution.outcome',  // resolved | not_found | blocked | error
  RESOLUTION_MS:      'alia.resolution.ms',       // number

  // Entity / registry
  ENTITY_ID:          'alia.entity.id',
  ENTITY_TYPE:        'alia.entity.type',         // user | organization | merchant | institution
  REGISTRY_ID:        'alia.entity.registry_id',

  // Machine identity
  MACHINE_SERVICE:    'alia.machine.service_name',
  MACHINE_SCOPE:      'alia.machine.scope',

  // Developer
  DEVELOPER_ID:       'alia.developer.id',
  PROJECT_ID:         'alia.developer.project_id',
  API_KEY_ENV:        'alia.developer.api_key.environment',

  // Institution
  INSTITUTION_ID:     'alia.institution.id',
  INSTITUTION_CODE:   'alia.institution.code',

  // Trust
  TRUST_SCORE:        'alia.trust.score',
  TRUST_TIER:         'alia.trust.tier',

  // Kafka
  KAFKA_TOPIC:        'alia.kafka.topic',
  KAFKA_PARTITION:    'alia.kafka.partition',
  KAFKA_OFFSET:       'alia.kafka.offset',
  KAFKA_CONSUMER_GRP: 'alia.kafka.consumer_group',
} as const;

// ── Tracer factory ────────────────────────────────────────────────────────────

export function getTracer(name: string) {
  return trace.getTracer(name, process.env['npm_package_version'] ?? '0.0.0');
}

// ── withSpan — wraps an async fn in a named span ──────────────────────────────
//
// Usage:
//   const result = await withSpan('resolution.directory_lookup', async (span) => {
//     span.setAttribute(AliaAttr.ALIAS_COUNTRY, 'NG');
//     return directoryLookup(alias);
//   }, { kind: SpanKind.CLIENT, attributes: { [AliaAttr.ALIAS_TYPE]: 'phone' } });

export async function withSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  opts: {
    kind?:       SpanKind;
    attributes?: Attributes;
    tracer?:     string;
  } = {},
): Promise<T> {
  const tracer = getTracer(opts.tracer ?? 'alia');
  return tracer.startActiveSpan(
    spanName,
    { kind: opts.kind ?? SpanKind.INTERNAL, attributes: opts.attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message ?? String(err) });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

// ── addSpanAttributes — add attributes to the currently active span ───────────
export function addSpanAttributes(attrs: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) span.setAttributes(attrs);
}

// ── currentTraceId — for propagating into logs ────────────────────────────────
export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext()?.traceId;
}

export { SpanKind, SpanStatusCode, context, trace };
