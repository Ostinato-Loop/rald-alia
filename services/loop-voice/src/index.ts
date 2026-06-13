import { app } from './app';
import { MachineBootstrap } from '@rald-alia/shared/machineBootstrap';

const PORT = Number(process.env['PORT'] ?? 3013);

async function main() {
  await MachineBootstrap.init();
  app.listen(PORT, () => {
    console.info(`[loop-voice] listening on :${PORT}`);
  });
}

main().catch(err => {
  console.error('[loop-voice] fatal startup error:', err);
  process.exit(1);
});
