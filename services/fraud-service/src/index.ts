import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import { app } from './app';
import { startConsumer } from './kafka/consumer';
import { getPool } from '@rald-alia/db';

const PORT = parseInt(process.env['PORT'] ?? '3006', 10);

async function main() {
  try {
    await getPool().query('SELECT 1');
    await startConsumer();
    app.listen(PORT, () => console.log(`[fraud-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[fraud-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
