// services/governance-service/src/index.ts
import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import pino from 'pino';
import { app } from './app';
import { closeDb } from '@rald-alia/db';
import { CountryGovernanceEngine } from './services/countryGovernance';
import { startGovernanceConsumers } from './consumers';
import { startRetentionJob } from './services/retentionEngine';

export const logger = pino({
  name:      'governance-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3008', 10);

async function main(): Promise<void> {
  logger.info('Starting governance-service…');

  // Seed country governance records on first boot (idempotent)
  try {
    const gov = new CountryGovernanceEngine();
    await gov.seed();
    logger.info('Country governance seed complete');
  } catch (err) {
    logger.error({ err }, 'Country governance seed failed — continuing');
  }

  // Boot Kafka consumer (non-fatal if Kafka unavailable in dev)
  try {
    await startGovernanceConsumers();
  } catch (err) {
    logger.error({ err }, 'governance-service Kafka consumer failed to start — continuing without consumers');
  }

  // Boot retention job — runs immediately then every hour
  // Non-fatal: governance service remains fully functional if the initial job run fails
  try {
    startRetentionJob(
      parseInt(process.env['RETENTION_JOB_INTERVAL_MS'] ?? String(60 * 60 * 1_000), 10),
      parseInt(process.env['RETENTION_JOB_BATCH_SIZE']  ?? '50', 10),
    );
    logger.info('Retention deletion job scheduled');
  } catch (err) {
    logger.error({ err }, 'Retention job failed to start — continuing');
  }

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'governance-service listening');
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
    setTimeout(() => {
      logger.error('Shutdown timeout exceeded — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'governance-service fatal startup error');
  process.exit(1);
});
