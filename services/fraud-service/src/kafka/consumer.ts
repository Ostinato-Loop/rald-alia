import { createConsumer, KAFKA_TOPICS, ResolutionRequestedEvent } from '@rald-alia/kafka';
import { FraudService } from '../services/fraud.service';

const fraudService = new FraudService();

export async function startConsumer() {
  await createConsumer({
    groupId: 'fraud-service',
    topics: [KAFKA_TOPICS.RESOLUTION_REQUESTED],
    handlers: {
      [KAFKA_TOPICS.RESOLUTION_REQUESTED]: async (event) => {
        const e = event as ResolutionRequestedEvent;
        await fraudService.scoreEntity(e.payload.alias, 'alias', {
          initiatingBankCode: e.payload.initiatingBankCode,
          ipAddress: e.payload.ipAddress,
        });
      },
    },
  });

  console.log('[fraud-service] Kafka consumer started');
}
