import 'dotenv/config';
import { app } from './app';
import { startConsumer } from './kafka/consumer';
import { getPool } from '@rald-alia/db';

const PORT = parseInt(process.env['PORT'] ?? '3007', 10);

async function main() {
  try {
    await getPool().query('SELECT 1');
    await startConsumer();
    app.listen(PORT, () => console.log(`[audit-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[audit-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
