import 'dotenv/config';
import { app } from './app';
import { getPool } from '@rald-alia/db';

const PORT = parseInt(process.env['PORT'] ?? '3003', 10);

async function main() {
  try {
    await getPool().query('SELECT 1');
    console.log('[directory-service] Database connected');
    app.listen(PORT, () => console.log(`[directory-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[directory-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
