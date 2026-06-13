import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import { app } from './app';
import { getPool } from '@rald-alia/db';

const PORT = parseInt(process.env['PORT'] ?? '3005', 10);

async function main() {
  try {
    await getPool().query('SELECT 1');
    app.listen(PORT, () => console.log(`[routing-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[routing-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
