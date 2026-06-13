// services/control-plane/src/index.ts
import 'dotenv/config';
import pino from 'pino';
import { app } from './app';

export const logger = pino({
  name:      'control-plane',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3011', 10);

async function main() {
  logger.info('Starting control-plane…');

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'control-plane listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'control-plane fatal startup error');
  process.exit(1);
});
