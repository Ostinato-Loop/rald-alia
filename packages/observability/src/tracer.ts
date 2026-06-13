// packages/observability/src/tracer.ts
// OTEL SDK initialisation — MUST be the very first import in each service's
// index.ts so that auto-instrumentation patches modules before they load.
//
// Usage (services/*/src/index.ts line 1):
//   import '@rald-alia/observability';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// ── Env vars ──────────────────────────────────────────────────────────────────
const SERVICE_NAME    = process.env['OTEL_SERVICE_NAME']     ?? process.env['npm_package_name'] ?? 'alia-unknown';
const SERVICE_VERSION = process.env['OTEL_SERVICE_VERSION']  ?? process.env['npm_package_version'] ?? '0.0.0';
const ENVIRONMENT     = process.env['NODE_ENV']              ?? 'development';
const ENABLED         = process.env['OTEL_ENABLED'] !== 'false'; // default ON
const COLLECTOR_URL   = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://otel-collector:4318';

if (!ENABLED) {
  // Noop — skip SDK initialisation entirely (e.g. during unit tests)
  process.stdout.write('[observability] OTEL disabled via OTEL_ENABLED=false\n');
} else {
  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]:    SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      'deployment.environment': ENVIRONMENT,
      'service.namespace':      'alia',
    }),
  );

  const traceExporter = new OTLPTraceExporter({
    url: `${COLLECTOR_URL}/v1/traces`,
    headers: {},
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${COLLECTOR_URL}/v1/metrics`,
    headers: {},
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // HTTP: capture all inbound + outbound requests
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? '';
            return url === '/healthz' || url === '/health';
          },
          requestHook: (span, req) => {
            span.setAttribute('http.request_id', (req as any).headers?.['x-request-id'] ?? '');
          },
        },
        // Express: trace each route handler
        '@opentelemetry/instrumentation-express': { enabled: true },
        // PostgreSQL: trace every query
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: true,
          addSqlCommenterCommentToQueries: false,
        },
        // Redis / ioredis
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        // KafkaJS: producer + consumer spans
        '@opentelemetry/instrumentation-kafkajs': { enabled: true },
        // DNS — useful for debugging service-discovery issues
        '@opentelemetry/instrumentation-dns': { enabled: true },
        // Disable noisy or unused instructions
        '@opentelemetry/instrumentation-graphql': { enabled: false },
        '@opentelemetry/instrumentation-aws-sdk':  { enabled: false },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => process.stdout.write('[observability] OTEL SDK shutdown complete\n'))
      .catch((err) => process.stderr.write(`[observability] OTEL shutdown error: ${err}\n`));
  });
}
