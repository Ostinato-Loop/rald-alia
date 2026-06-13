// services/institution-service/src/index.ts
import 'dotenv/config';
import pino from 'pino';
import { app } from './app';
import { closeDb } from '@rald-alia/db';
import { startInstitutionConsumers } from './consumers';

export const logger = pino({
  name:      'institution-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3010', 10);

async function main(): Promise<void> {
  logger.info('Starting institution-service…');

  // Start Kafka consumers (non-blocking — service stays up if Kafka is unavailable)
  startInstitutionConsumers().catch((err) =>
    logger.error({ err }, 'Kafka consumer startup failed — continuing without consumers'),
  );

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'institution-service listening');
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
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
  logger.error({ err }, 'institution-service fatal startup error');
  process.exit(1);
});
