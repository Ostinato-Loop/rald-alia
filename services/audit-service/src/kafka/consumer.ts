import {
  createConsumer,
  KAFKA_TOPICS,
  AliasCreatedEvent,
  AliasUpdatedEvent,
  AliasDeletedEvent,
  ResolutionCompletedEvent,
  FraudDetectedEvent,
  UserVerifiedEvent,
} from '@rald-alia/kafka';
import { AuditService } from '../services/audit.service';

const auditService = new AuditService();

export async function startConsumer() {
  await createConsumer({
    groupId: 'audit-service',
    topics: [
      KAFKA_TOPICS.ALIAS_CREATED,
      KAFKA_TOPICS.ALIAS_UPDATED,
      KAFKA_TOPICS.ALIAS_DELETED,
      KAFKA_TOPICS.RESOLUTION_COMPLETED,
      KAFKA_TOPICS.FRAUD_DETECTED,
      KAFKA_TOPICS.USER_VERIFIED,
    ],
    handlers: {
      [KAFKA_TOPICS.ALIAS_CREATED]: async (event) => {
        const e = event as AliasCreatedEvent;
        await auditService.log({ eventType: 'alias.created', actorId: e.payload.userId, targetId: e.payload.aliasId, metadata: e.payload });
      },
      [KAFKA_TOPICS.ALIAS_UPDATED]: async (event) => {
        const e = event as AliasUpdatedEvent;
        await auditService.log({ eventType: 'alias.updated', actorId: e.payload.userId, targetId: e.payload.aliasId, metadata: e.payload });
      },
      [KAFKA_TOPICS.ALIAS_DELETED]: async (event) => {
        const e = event as AliasDeletedEvent;
        await auditService.log({ eventType: 'alias.deleted', actorId: e.payload.userId, targetId: e.payload.aliasId, metadata: e.payload });
      },
      [KAFKA_TOPICS.RESOLUTION_COMPLETED]: async (event) => {
        const e = event as ResolutionCompletedEvent;
        await auditService.log({ eventType: 'resolution.completed', targetId: e.payload.resolutionId, metadata: e.payload });
      },
      [KAFKA_TOPICS.FRAUD_DETECTED]: async (event) => {
        const e = event as FraudDetectedEvent;
        await auditService.log({ eventType: 'fraud.detected', targetId: e.payload.entityId, metadata: e.payload });
      },
      [KAFKA_TOPICS.USER_VERIFIED]: async (event) => {
        const e = event as UserVerifiedEvent;
        await auditService.log({ eventType: 'user.verified', actorId: e.payload.userId, metadata: e.payload });
      },
    },
  });

  console.log('[audit-service] Kafka consumer started');
}
