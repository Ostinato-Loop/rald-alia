import { Kafka, KafkaConfig } from 'kafkajs';

let kafkaInstance: Kafka | null = null;

export function getKafkaClient(config?: KafkaConfig): Kafka {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka(
      config ?? {
        clientId: process.env['KAFKA_CLIENT_ID'] ?? 'rald-alia',
        brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
        ssl: process.env['KAFKA_SSL'] === 'true',
        sasl:
          process.env['KAFKA_SASL_USERNAME'] && process.env['KAFKA_SASL_PASSWORD']
            ? {
                mechanism: 'plain',
                username: process.env['KAFKA_SASL_USERNAME'],
                password: process.env['KAFKA_SASL_PASSWORD'],
              }
            : undefined,
      },
    );
  }
  return kafkaInstance;
}
