// services/developer-service/src/index.ts
import 'dotenv/config';
import pino from 'pino';
import { app } from './app';

export const logger = pino({
  name:      'developer-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3009', 10);

async function main() {
  logger.info('Starting developer-service…');

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'developer-service listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'developer-service fatal startup error');
  process.exit(1);
});
