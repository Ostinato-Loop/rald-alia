// vitest.workspace.ts — root workspace config for pnpm monorepo test runs
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/sdk/vitest.config.ts',
  'services/developer-service/vitest.config.ts',
  'services/governance-service/vitest.config.ts',
]);
