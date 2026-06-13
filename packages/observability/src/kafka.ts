// packages/observability/src/kafka.ts
// Instrumented Kafka helpers — wraps publish/consume with ALIA spans and metrics.
// Use these instead of calling the producer/consumer directly when you want
// manual span control beyond what the KafkaJS auto-instrumentation provides.

import { SpanKind, type Attributes } from '@opentelemetry/api';
import { withSpan, AliaAttr } from './trace';
import {
  kafkaPublishDuration,
  kafkaPublishErrors,
  kafkaConsumerLag,
} from './metrics';

export interface PublishOptions {
  topic:     string;
  key?:      string;
  value:     string | Buffer;
  headers?:  Record<string, string>;
}

export interface TracedProducer {
  send(opts: PublishOptions): Promise<void>;
}

/**
 * Wraps a kafkajs Producer with OTEL tracing + metrics.
 *
 * Usage:
 *   import { traceProducer } from '@rald-alia/observability';
 *   const traced = traceProducer(producer);
 *   await traced.send({ topic: 'alia.alias.created', key: aliasId, value: JSON.stringify(event) });
 */
export function traceProducer(producer: {
  send(record: { topic: string; messages: Array<{ key?: string; value: string | Buffer; headers?: Record<string, string> }> }): Promise<any>;
}): TracedProducer {
  return {
    async send({ topic, key, value, headers = {} }: PublishOptions) {
      const attrs: Attributes = {
        [AliaAttr.KAFKA_TOPIC]: topic,
        'messaging.system':     'kafka',
        'messaging.operation':  'publish',
      };

      const start = Date.now();
      try {
        await withSpan(`kafka.publish ${topic}`, async (span) => {
          span.setAttributes(attrs);
          await producer.send({ topic, messages: [{ key, value, headers }] });
        }, { kind: SpanKind.PRODUCER, attributes: attrs });

        kafkaPublishDuration.record(Date.now() - start, { topic, outcome: 'success' });
      } catch (err: any) {
        kafkaPublishDuration.record(Date.now() - start, { topic, outcome: 'error' });
        kafkaPublishErrors.add(1, { topic, error: err?.constructor?.name ?? 'unknown' });
        throw err;
      }
    },
  };
}

/**
 * Records consumer lag as a gauge metric.
 * Call this from your consumer's `eachBatch` handler.
 */
export function recordConsumerLag(opts: {
  topic:          string;
  partition:      number;
  consumerGroup:  string;
  highWatermark:  string;
  resolvedOffset: string;
}): void {
  const lag = Number(BigInt(opts.highWatermark) - BigInt(opts.resolvedOffset));
  if (!Number.isNaN(lag)) {
    kafkaConsumerLag.add(lag, {
      [AliaAttr.KAFKA_TOPIC]:        opts.topic,
      [AliaAttr.KAFKA_PARTITION]:    String(opts.partition),
      [AliaAttr.KAFKA_CONSUMER_GRP]: opts.consumerGroup,
    });
  }
}
