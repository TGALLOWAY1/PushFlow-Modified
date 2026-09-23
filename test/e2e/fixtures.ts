/**
 * Shared Playwright fixtures. Every spec imports `test` and `expect` from here.
 *
 * - Blocks fonts.googleapis.com / fonts.gstatic.com, so the one remaining remote
 *   stylesheet (Material Symbols, removed in P5) can never make screenshots flaky.
 *   Inter and Space Grotesk are self-hosted in public/fonts.
 * - `pf` reads the window.__pf test hook (VITE_E2E builds only) instead of React internals.
 */

import { test as base, expect, type Page } from '@playwright/test';
import type { PfTestHook } from '../../src/ui/testing/e2eHook';

export const BLOCKED_HOSTS = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//;

/** A fixed wall-clock time for screenshot specs (relative dates such as "3 days ago" stay stable). */
export const FIXED_NOW = new Date('2026-09-01T12:00:00Z');

type HookMethod = { [K in keyof PfTestHook]: PfTestHook[K] extends (...args: never[]) => unknown ? K : never }[keyof PfTestHook];

export interface PfHandle {
  /** Resolves once the editor has mounted and window.__pf exists. */
  ready(): Promise<void>;
  /** Calls a window.__pf method in the page and returns its (serialisable) result. */
  call<K extends HookMethod>(method: K, ...args: Parameters<PfTestHook[K]>): Promise<Awaited<ReturnType<PfTestHook[K]>>>;
}

function pfHandle(page: Page): PfHandle {
  return {
    ready: async () => {
      await page.waitForFunction(() => !!window.__pf);
    },
    call: (method, ...args) =>
      page.evaluate(
        ([m, a]) => (window.__pf as unknown as Record<string, (...x: unknown[]) => unknown>)[m](...a),
        [method, args] as [string, unknown[]],
      ) as never,
  };
}

export const test = base.extend<{ pf: PfHandle }>({
  context: async ({ context }, use) => {
    await context.route(BLOCKED_HOSTS, route => route.abort());
    await use(context);
  },
  pf: async ({ page }, use) => {
    await use(pfHandle(page));
  },
});

export { expect };
