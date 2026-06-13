// services/consent-service/src/index.ts
import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@rald-alia/db';
import { app } from './app';

export const logger = pino({
  name:      'consent-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3014', 10);

async function main(): Promise<void> {
  logger.info('Starting consent-service…');

  try {
    await getDb().execute(sql`SELECT 1`);
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Database connection failed — aborting startup');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'consent-service listening');
  });

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
    setTimeout(() => {
      logger.error('Shutdown timeout exceeded — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'consent-service fatal startup error');
  process.exit(1);
});
