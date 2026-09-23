/**
 * Nightly-only vitest run (nightly.yml): the slow checks kept out of every PR.
 * Files are named *.nightly.ts so the default config (test/**\/*.test.ts) never picks them up.
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

export default mergeConfig(base, defineConfig({
  test: {
    include: ['test/nightly/**/*.nightly.ts'],
    testTimeout: 3 * 60 * 60 * 1000,
    hookTimeout: 3 * 60 * 60 * 1000,
  },
}));
