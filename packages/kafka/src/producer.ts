import { Producer, ProducerRecord } from 'kafkajs';
import { ulid } from 'ulid';
import { getKafkaClient } from './client';
import { KafkaEvent, KafkaTopic } from './events';

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = getKafkaClient();
    producer = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
    });
    await producer.connect();
  }
  return producer;
}

export async function publishEvent<T extends KafkaEvent>(
  topic: KafkaTopic,
  payload: Omit<T, 'eventId' | 'timestamp' | 'version'>,
): Promise<void> {
  const prod = await getProducer();
  const event: KafkaEvent = {
    ...payload,
    eventId: ulid(),
    timestamp: new Date().toISOString(),
    version: '1.0',
  } as KafkaEvent;

  const record: ProducerRecord = {
    topic,
    messages: [
      {
        key: ulid(),
        value: JSON.stringify(event),
        headers: {
          eventType: topic,
          version: '1.0',
          timestamp: event.timestamp,
        },
      },
    ],
  };

  await prod.send(record);
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
