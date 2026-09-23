/**
 * Shared steps for the C1–C9 regression specs: open a project, import TEST MIDI 1
 * through the real file input, place Sounds, and wait for analysis to settle.
 * Everything reads app state through window.__pf, never React internals.
 */

import { fileURLToPath } from 'url';
import { expect, type Page } from '@playwright/test';
import type { PfHandle } from './fixtures';

export const TEST_MIDI_1 = fileURLToPath(new URL('../fixtures/midi/TEST MIDI 1.mid', import.meta.url));

/** Pads chosen to spread seven Sounds over the grid, corners included (from the C1 probe). */
export const SPREAD_PADS = ['0,0', '7,0', '4,3', '3,7', '7,7', '0,7', '5,5'];

/** Library → New Project → editor with the test hook ready. */
export async function newProject(page: Page, pf: PfHandle): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project' }).click();
  await page.waitForURL('**/project/**');
  await pf.ready();
}

/** Imports TEST MIDI 1 through the timeline's file input and waits for its 7 Sounds. */
export async function importTestMidi1(page: Page, pf: PfHandle): Promise<void> {
  await page.locator('input[type="file"][accept=".mid,.midi"]').first().setInputFiles(TEST_MIDI_1);
  await expect.poll(async () => (await pf.call('state')).soundStreams.length).toBe(7);
}

/** New project with TEST MIDI 1 imported and nothing placed. */
export async function openTestMidi1(page: Page, pf: PfHandle): Promise<void> {
  await newProject(page, pf);
  await importTestMidi1(page, pf);
}

/** Sound ids in the Sounds panel's order. */
export async function soundIds(pf: PfHandle): Promise<string[]> {
  return (await pf.call('state')).soundStreams.map(s => s.id);
}

/**
 * Places Sound i on pads[i], one ASSIGN_VOICE_TO_PAD each (the action a drag from
 * the Sounds panel dispatches). Returns the placed Sound ids.
 */
export async function placeSounds(pf: PfHandle, pads: string[] = SPREAD_PADS): Promise<string[]> {
  const streams = (await pf.call('state')).soundStreams;
  const ids: string[] = [];
  for (let i = 0; i < pads.length && i < streams.length; i++) {
    await pf.call('dispatch', { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: pads[i], stream: streams[i] } });
    ids.push(streams[i].id);
  }
  return ids;
}

/** Clicks the Analysis panel's "Suggest a starting layout" and waits for all 7 Sounds to be placed. */
export async function suggestStartingLayout(page: Page, pf: PfHandle): Promise<void> {
  await page.getByRole('button', { name: 'Suggest a starting layout' }).click();
  await expect.poll(async () => {
    const s = await pf.call('state');
    return Object.keys((s.workingLayout ?? s.activeLayout).padToVoice).length;
  }).toBe(7);
}

/** Waits until auto-analysis has finished: nothing stale, nothing processing, and a result exists. */
export async function waitForAnalysis(pf: PfHandle, timeout = 30_000): Promise<void> {
  await expect.poll(async () => {
    const s = await pf.call('state');
    return !s.analysisStale && !s.isProcessing && !!s.analysisResult;
  }, { timeout }).toBe(true);
}

/** Pad key → Sound id for the layout currently shown (draft if any, else Active). */
export async function shownPads(pf: PfHandle): Promise<Record<string, string>> {
  const s = await pf.call('state');
  const layout = s.workingLayout ?? s.activeLayout;
  return Object.fromEntries(Object.entries(layout.padToVoice).map(([k, v]) => [k, v.id]));
}

/** Chooses the optimizer in the toolbar ("Greedy", "Beam" or "Annealing"). */
export async function chooseMethod(page: Page, method: 'Greedy' | 'Beam' | 'Annealing'): Promise<void> {
  await page.getByTitle('Optimizer method').selectOption({ label: method });
}

/**
 * Clicks Generate and waits for the run to finish: isProcessing goes true, then
 * false. Generate is disabled while analysis runs, so wait for that first.
 */
export async function generateAndWait(page: Page, pf: PfHandle, timeout = 120_000): Promise<void> {
  await expect.poll(async () => (await pf.call('state')).isProcessing, { timeout: 30_000 }).toBe(false);
  const before = (await pf.call('state')).candidates.length;
  const beforeIds = (await pf.call('state')).candidates.map(c => c.id).join();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(async () => {
    const s = await pf.call('state');
    return !s.isProcessing && s.candidates.length > 0 && (s.candidates.length !== before || s.candidates.map(c => c.id).join() !== beforeIds);
  }, { timeout }).toBe(true);
}

/** Saves explicitly (toolbar "Save project"), reloads, and waits for the project to come back. */
export async function saveAndReload(page: Page, pf: PfHandle): Promise<void> {
  await page.getByTitle('Save project').click();
  await expect(page.getByTitle('Save project')).toHaveText('Saved');
  await page.reload();
  await pf.ready();
  await expect.poll(async () => (await pf.call('state')).soundStreams.length).toBeGreaterThan(0);
}

/**
 * True when some layout anywhere in project state (the draft, a saved variant, or
 * any list a later session adds, such as Recovered drafts) has exactly these pads.
 */
export async function isLayoutRecoverable(pf: PfHandle, pads: Record<string, string>): Promise<boolean> {
  const state = await pf.call('state');
  const want = JSON.stringify(Object.entries(pads).sort());
  const seen = new Set<unknown>();
  const visit = (node: unknown, key: string): boolean => {
    if (!node || typeof node !== 'object' || seen.has(node)) return false;
    seen.add(node);
    // Candidates and analysis results are proposals, not a place the user's draft is kept.
    if (key === 'candidates' || key === 'analysisResult') return false;
    const maybeLayout = node as { padToVoice?: Record<string, { id: string }> };
    if (maybeLayout.padToVoice && typeof maybeLayout.padToVoice === 'object') {
      const got = JSON.stringify(Object.entries(maybeLayout.padToVoice).map(([k, v]) => [k, v.id]).sort());
      if (got === want) return true;
    }
    return Object.entries(node as Record<string, unknown>).some(([k, v]) => visit(v, k));
  };
  return visit(state, '');
}

/** Opens the left panel's Events tab and selects the event row with this moment index. */
export async function selectMoment(page: Page, momentIndex: number): Promise<void> {
  await page.locator('button.pf-tab', { hasText: 'Events' }).first().click();
  await page.locator(`button[data-moment-index="${momentIndex}"]`).first().click();
}

/** Screen rectangle covering all 64 pads. */
export async function gridClip(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const a = (await page.getByTestId('pad-7-0').boundingBox())!;
  const b = (await page.getByTestId('pad-0-7').boundingBox())!;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/**
 * Centre of the part of a pad that is actually visible. At 1366x768 the grid
 * wrapper clips the top row (T04, fixed in S2.1), so a pad's own centre can be hidden.
 */
export async function visiblePadPoint(page: Page, padKey: string): Promise<{ x: number; y: number }> {
  const pad = page.getByTestId(`pad-${padKey.replace(',', '-')}`);
  await pad.scrollIntoViewIfNeeded();
  return pad.evaluate(el => {
    const r = el.getBoundingClientRect();
    let l = r.left, t = r.top, rt = r.right, b = r.bottom;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflow === 'visible' && s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      l = Math.max(l, ar.left); t = Math.max(t, ar.top); rt = Math.min(rt, ar.right); b = Math.min(b, ar.bottom);
    }
    l = Math.max(l, 0); t = Math.max(t, 0); rt = Math.min(rt, innerWidth); b = Math.min(b, innerHeight);
    return { x: Math.round((l + rt) / 2), y: Math.round((t + b) / 2) };
  });
}

/** A real native drag from one pad to another, using the visible part of each. */
export async function dragPad(page: Page, from: string, to: string): Promise<void> {
  const a = await visiblePadPoint(page, from);
  const b = await visiblePadPoint(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y + 6, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}
