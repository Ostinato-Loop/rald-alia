// services/registry-service/src/index.ts
import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@rald-alia/db';
import { app } from './app';
import { RegistryEngine } from './services/registryEngine';
import { Kafka, Consumer } from 'kafkajs';

export const logger = pino({
  name:      'registry-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3006', 10);

// ── Kafka consumer ────────────────────────────────────────────────────────────
// Returned so shutdown() can call consumer.disconnect() cleanly.

async function startKafkaConsumer(): Promise<Consumer> {
  const brokers  = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
  const kafka    = new Kafka({ clientId: 'registry-service', brokers });
  const consumer = kafka.consumer({ groupId: 'registry-service-group' });
  const engine   = new RegistryEngine();

  await consumer.connect();
  await consumer.subscribe({
    topics: [
      'identity.user_verified',
      'identity.user_activated',
      'verification.kyc_approved',
      'trust.score_changed',
      'consent.granted',
      'routing.profile_updated',
      'trust.sanctioned',
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        logger.warn({ topic }, 'Failed to parse Kafka message');
        return;
      }

      const entityId   = payload['entity_id']   as string;
      const entityType = (payload['entity_type'] as string ?? 'person') as any;

      try {
        switch (topic) {
          case 'identity.user_verified':
            await engine.onIdentityVerified(entityId, entityType);
            break;
          case 'identity.user_activated':
            await engine.onIdentityActivated(entityId, entityType);
            break;
          case 'verification.kyc_approved':
            await engine.onKycUpgraded(entityId, entityType, (payload['tier'] as number) ?? 1);
            break;
          case 'trust.score_changed':
            await engine.onTrustScoreChanged(entityId, entityType, payload['score'] as number, payload['tier'] as string);
            break;
          case 'consent.granted':
            await engine.onConsentGranted(entityId, entityType);
            break;
          case 'routing.profile_updated':
            await engine.onRoutingActivated(entityId, entityType);
            break;
          case 'trust.sanctioned':
            await engine.onSanctioned(entityId, entityType, (payload['reason'] as string) ?? 'SANCTIONS_MATCH');
            break;
        }
      } catch (err) {
        logger.error({ err, topic, entityId }, 'Registry Kafka handler error');
      }
    },
  });

  logger.info('Kafka consumer started');
  return consumer;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // DB health-check — fail fast if DATABASE_URL is wrong
  try {
    await getDb().execute(sql`SELECT 1`);
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Database connection failed — aborting startup');
    process.exit(1);
  }

  // Kafka consumer (non-fatal if broker unavailable in dev)
  let kafkaConsumer: Consumer | undefined;
  startKafkaConsumer()
    .then((c) => { kafkaConsumer = c; })
    .catch((err) =>
      logger.warn({ err }, 'Kafka consumer failed to start — running without event sync'),
    );

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'registry-service listening');
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
      // Disconnect Kafka consumer before draining DB pool
      if (kafkaConsumer) {
        try {
          await kafkaConsumer.disconnect();
          logger.info('Kafka consumer disconnected');
        } catch (err) {
          logger.warn({ err }, 'Kafka consumer disconnect error');
        }
      }
      try {
        await closeDb();
        logger.info('DB pool drained — shutdown complete');
      } catch (err) {
        logger.error({ err }, 'Error draining DB pool during shutdown');
      }
      process.exit(0);
    });
    // Force exit if the server hasn't drained within 10s
    setTimeout(() => {
      logger.error('Shutdown timeout exceeded — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'registry-service fatal startup error');
  process.exit(1);
});
