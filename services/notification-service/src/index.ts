import 'dotenv/config';
import { app } from './app';
import { startConsumer } from './kafka/consumer';

const PORT = parseInt(process.env['PORT'] ?? '3008', 10);

async function main() {
  try {
    await startConsumer();
    app.listen(PORT, () => console.log(`[notification-service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[notification-service] Failed to start:', err);
    process.exit(1);
  }
}

main();
