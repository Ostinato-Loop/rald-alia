import { Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaClient } from './client';
import { KafkaEvent, KafkaTopic } from './events';

export type EventHandler<T extends KafkaEvent = KafkaEvent> = (event: T) => Promise<void>;

export interface ConsumerOptions {
  groupId: string;
  topics: KafkaTopic[];
  handlers: Partial<Record<KafkaTopic, EventHandler>>;
}

export async function createConsumer(options: ConsumerOptions): Promise<Consumer> {
  const kafka = getKafkaClient();
  const consumer = kafka.consumer({
    groupId: options.groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();
  await consumer.subscribe({ topics: options.topics, fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { topic, message } = payload;
      if (!message.value) return;

      try {
        const event = JSON.parse(message.value.toString()) as KafkaEvent;
        const handler = options.handlers[topic as KafkaTopic];
        if (handler) {
          await handler(event);
        }
      } catch (err) {
        console.error(`[Kafka] Failed to process message on topic ${topic}:`, err);
      }
    },
  });

  return consumer;
}
