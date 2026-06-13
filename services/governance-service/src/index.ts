// services/governance-service/src/index.ts
import 'dotenv/config';
import pino from 'pino';
import { app } from './app';
import { CountryGovernanceEngine } from './services/countryGovernance';

export const logger = pino({
  name:      'governance-service',
  level:     process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env['PORT'] ?? '3008', 10);

async function main() {
  logger.info('Starting governance-service…');

  // Seed country governance records on first boot
  try {
    const gov = new CountryGovernanceEngine();
    await gov.seed();
    logger.info('Country governance seed complete');
  } catch (err) {
    logger.error({ err }, 'Country governance seed failed — continuing');
  }

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'governance-service listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'governance-service fatal startup error');
  process.exit(1);
});
