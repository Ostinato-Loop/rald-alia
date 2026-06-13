import 'dotenv/config';
import pino from 'pino';

export const logger = pino({ name: 'registry-service' });

// Defer app import so logger is defined first
import { app } from './app';
import { getPool } from '@rald-alia/db';
import { RegistryEngine } from './services/registryEngine';
import { Kafka } from 'kafkajs';

const PORT = parseInt(process.env['PORT'] ?? '3009', 10);

// ── Kafka consumer: sync registry dimensions from domain events ───────────────

async function startKafkaConsumer(): Promise<void> {
  const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
  const kafka   = new Kafka({ clientId: 'registry-service', brokers });
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
            await engine.onKycUpgraded(entityId, entityType, payload['tier'] as number ?? 1);
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
            await engine.onSanctioned(entityId, entityType, payload['reason'] as string ?? 'SANCTIONS_MATCH');
            break;
        }
      } catch (err) {
        logger.error({ err, topic, entityId }, 'Registry Kafka handler error');
      }
    },
  });

  logger.info('[registry-service] Kafka consumer started');
}

async function main() {
  try {
    await getPool().query('SELECT 1');
    logger.info('[registry-service] Database connected');

    // Start Kafka consumer (non-fatal if broker not available in dev)
    startKafkaConsumer().catch((err) =>
      logger.warn({ err }, '[registry-service] Kafka consumer failed to start — running without event sync'),
    );

    app.listen(PORT, () => {
      logger.info(`[registry-service] Running on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, '[registry-service] Failed to start');
    process.exit(1);
  }
}

main();
