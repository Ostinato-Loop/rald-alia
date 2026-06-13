// services/control-plane/src/index.ts
import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import pino from 'pino';
import { app } from './app';
import { closeDb } from '@rald-alia/db';

export const logger = pino({
  name:      'control-plane',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3011', 10);

async function main(): Promise<void> {
  logger.info('Starting control-plane…');

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'control-plane listening');
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
  logger.error({ err }, 'control-plane fatal startup error');
  process.exit(1);
});
