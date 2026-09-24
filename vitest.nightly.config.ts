/**
 * Nightly-only vitest run (nightly.yml): the slow checks kept out of every PR.
 * Files are named *.nightly.ts so the default config (test/**\/*.test.ts) never picks them up.
 * Spreads the base config rather than mergeConfig, which would append to `include`.
 */

import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['test/nightly/**/*.nightly.ts'],
    testTimeout: 3 * 60 * 60 * 1000,
    hookTimeout: 3 * 60 * 60 * 1000,
  },
});
