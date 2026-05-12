import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api/vitest.config.ts',
  'apps/infra/vitest.config.ts',
  'packages/shared/vitest.config.ts',
]);
