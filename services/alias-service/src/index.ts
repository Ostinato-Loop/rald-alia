import 'dotenv/config';
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import { app } from './app';
import { getPool } from '@rald-alia/db';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

async function main() {
  try {
    await getPool().query('SELECT 1');
    console.log('[alias-service] Database connected');
    app.listen(PORT, () => console.log(`[alias-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[alias-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
