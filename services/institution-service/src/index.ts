import 'dotenv/config';
import pino from 'pino';
import { app } from './app';
import { startInstitutionConsumers } from './consumers';

export const logger = pino({
  name:      'institution-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3010', 10);

async function main() {
  logger.info('Starting institution-service…');

  // Start Kafka consumers (non-blocking — service stays up if Kafka is unavailable)
  startInstitutionConsumers().catch((err) =>
    logger.error({ err }, 'Kafka consumer startup failed — continuing without consumers'),
  );

  app.listen(PORT, () => {
    logger.info({ port: PORT }, `institution-service listening`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'institution-service fatal startup error');
  process.exit(1);
});
