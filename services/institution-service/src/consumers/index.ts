// institution-service Kafka consumers
// Listens for events from other services that require institution record updates.

import { createConsumer, KAFKA_TOPICS } from '@rald-alia/kafka';
import { InstitutionRepository } from '../repositories/institution.repository';
import { logger } from '../index';

const repo = new InstitutionRepository();

export async function startInstitutionConsumers(): Promise<void> {
  const consumer = await createConsumer('institution-service-group');

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.POLICY_VIOLATED,     // governance violations → possibly suspend institution
      KAFKA_TOPICS.FRAUD_DETECTED,      // fraud signals → flag institution for review
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      let payload: any;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        logger.warn({ topic }, 'Failed to parse Kafka message');
        return;
      }

      switch (topic) {
        case KAFKA_TOPICS.POLICY_VIOLATED: {
          const { targetId, targetType, policyId } = payload.payload ?? {};
          if (targetType !== 'institution') break;
          logger.warn({ institutionId: targetId, policyId }, 'Policy violation against institution — flagging for review');
          await repo.update(targetId, {
            metadata: { policyViolationFlagged: true, policyId, flaggedAt: new Date().toISOString() } as any,
          }).catch((err) => logger.error({ err }, 'Failed to flag institution'));
          break;
        }

        case KAFKA_TOPICS.FRAUD_DETECTED: {
          const { entityId, entityType, riskLevel } = payload.payload ?? {};
          if (entityType !== 'institution') break;
          logger.warn({ institutionId: entityId, riskLevel }, 'Fraud signal for institution');
          if (riskLevel === 'critical') {
            await repo.suspend(entityId, `Auto-suspended: critical fraud signal detected`, 'system')
              .catch((err) => logger.error({ err }, 'Failed to auto-suspend institution'));
          }
          break;
        }

        default:
          break;
      }
    },
  });

  logger.info('institution-service Kafka consumers running');
}
