/**
 * Playwright e2e config (roadmap P0 "Playwright runner").
 *
 * Specs live in test/e2e/ and import `test`/`expect` from ./fixtures, which
 * blocks remote fonts so screenshots are deterministic.
 *
 * Local / cloud runs:
 *   npx playwright test                                         # uses Playwright's own browser
 *   PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test   # cloud sessions: preinstalled Chromium
 *
 * Screenshot baselines are generated in CI only (.github/workflows/update-snapshots.yml),
 * never locally, because font rasterisation differs between machines.
 * The Firefox project runs only when PW_FIREFOX is set (nightly.yml).
 */

import { defineConfig, devices, type Project } from '@playwright/test';

const PORT = 5199;
const executablePath = process.env.PW_CHROMIUM || undefined;

const viewports = [
  { name: '1366', viewport: { width: 1366, height: 768 } },
  { name: '1600', viewport: { width: 1600, height: 1000 } },
];

const projects: Project[] = viewports.map(({ name, viewport }) => ({
  name: `chromium-${name}`,
  use: {
    ...devices['Desktop Chrome'],
    viewport,
    deviceScaleFactor: 1,
    launchOptions: { executablePath },
  },
}));

if (process.env.PW_FIREFOX) {
  projects.push({
    name: 'firefox-1366',
    use: { ...devices['Desktop Firefox'], viewport: viewports[0].viewport, deviceScaleFactor: 1 },
  });
}

export default defineConfig({
  testDir: 'test/e2e',
  // One snapshot per spec, argument and project; no platform suffix, since baselines come from CI's Linux runner.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_E2E: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
