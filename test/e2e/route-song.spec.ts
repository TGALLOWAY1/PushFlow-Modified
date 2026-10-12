/**
 * S9.2 · the Performance Route at the Song level (roadmap P9-2a to P9-2e).
 *
 * TEST MIDI 1 through the real file input, its suggested layout promoted to
 * Active, and a route authored through the route actions (edit mode is
 * S9.4). The page is opened from the editor's toolbar, so it runs under the
 * same shell, project and transport as the editor.
 */

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, type PfHandle } from './fixtures';
import { newProject, openTestMidi1, placeSounds, suggestStartingLayout, waitForAnalysis, waitForSaved } from './project';

const dispatch = (pf: PfHandle, action: unknown) => pf.call('dispatch', action as never);

/** TEST MIDI 1 placed and promoted, with a three-section route: Intro 0–2, Verse 2–6 (Instrument from 3 to 5), Drop 6–8. */
async function authoredRoute(page: Page, pf: PfHandle): Promise<void> {
  await openTestMidi1(page, pf);
  await suggestStartingLayout(page, pf);
  await dispatch(pf, { type: 'PROMOTE_WORKING_LAYOUT' });
  await dispatch(pf, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 2, newSectionId: 'verse' } });
  await dispatch(pf, { type: 'ROUTE_SPLIT_SECTION', payload: { bar: 6, newSectionId: 'drop' } });
  for (const [id, name, text] of [
    ['section-1', 'Intro', 'Kick and hats, both hands low'],
    ['verse', 'Verse', 'Capture the drums, then the bass riff'],
    ['drop', 'Drop', 'Everything back on the pads'],
  ]) {
    await dispatch(pf, { type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: id, name } });
    await dispatch(pf, { type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: id, text } });
  }
  await dispatch(pf, { type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 3, endBar: 5, mode: 'instrument' } });
}

async function openRoute(page: Page): Promise<void> {
  await page.getByTestId('toolbar-route').click();
  await page.waitForURL('**/route');
  await expect(page.getByTestId('route-cards')).toBeVisible();
}

/** The left edge and width of an element, in page px. */
async function box(page: Page, testId: string) {
  const b = (await page.getByTestId(testId).first().boundingBox())!;
  return { x: Math.round(b.x), w: Math.round(b.width) };
}

test.describe('S9.2 · the Route at the Song level', () => {
  test('P9-2a: fills the viewport without a horizontal scroll; cards, strip, ruler and lanes share one bar axis', async ({ page, pf }, testInfo) => {
    await authoredRoute(page, pf);
    await openRoute(page);
    const scroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight }));
    expect(scroll.width).toBeLessThanOrEqual(scroll.client);
    expect(scroll.height).toBeLessThanOrEqual(scroll.clientH);

    // Every row starts and ends at the same pixels.
    const rows = await Promise.all(['route-line', 'route-cards', 'mode-strip', 'route-ruler', 'route-lanes-canvas'].map(id => box(page, id)));
    for (const row of rows) expect(row).toEqual(rows[0]);
    // The transport bar sits at the bottom of the viewport.
    const viewport = page.viewportSize()!;
    const transport = (await page.getByTestId('route-transport').boundingBox())!;
    expect(Math.round(transport.y + transport.height)).toBe(viewport.height);

    // A bar is at the same x in every row: Verse starts at bar 2 (of 8) on the
    // cards, the strip changes mode at bar 3, and the ruler numbers bar 3 there.
    const axis = rows[0]!;
    const at = (bar: number) => axis.x + (bar / 8) * axis.w;
    const verse = (await page.locator('[data-testid="route-card"][data-section-id="verse"]').boundingBox())!;
    expect(Math.abs(verse.x - 2 - at(2))).toBeLessThanOrEqual(1);
    const instrument = (await page.locator('[data-testid="mode-span"][data-mode="instrument"]').boundingBox())!;
    expect(Math.abs(instrument.x - at(3))).toBeLessThanOrEqual(1);
    expect(Math.abs(instrument.x + instrument.width - at(5))).toBeLessThanOrEqual(1);
    const label3 = (await page.getByTestId('route-ruler-label').filter({ hasText: /^3$/ }).boundingBox())!;
    expect(Math.abs(label3.x - 3 - at(2))).toBeLessThanOrEqual(1);
    await testInfo.attach('route.png', { body: await page.screenshot(), contentType: 'image/png' });
  });

  test('P9-2b: Space plays; the badge and the active card follow the playhead; the editor keeps playing', async ({ page, pf }) => {
    await authoredRoute(page, pf);
    await openRoute(page);
    expect((await pf.call('status')).route).toMatchObject({ level: 0, viewStart: 0, viewSpan: 8, editing: false, sectionId: 'section-1' });
    await expect(page.getByTestId('mode-badge')).toHaveAttribute('data-mode', 'drum');

    // From bar 2.5 (5 s at 120 BPM): the Verse, in Drum Rack until bar 3, then Instrument.
    await dispatch(pf, { type: 'SET_CURRENT_TIME', payload: 5 });
    await page.keyboard.press(' ');
    await expect.poll(async () => (await pf.call('transport'))?.running).toBe(true);
    await expect(page.getByTestId('route-state-word')).toHaveText('PLAYING');
    await expect(page.locator('[data-testid="route-card"][data-section-id="verse"]')).toHaveAttribute('data-state', 'active');
    await expect(page.locator('[data-testid="route-card"][data-section-id="section-1"]')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('mode-badge')).toHaveAttribute('data-mode', 'instrument', { timeout: 5_000 });
    expect((await pf.call('status')).route?.sectionId).toBe('verse');

    // To the editor mid-play: still playing, and the playhead still moves.
    await page.getByTestId('route-back').click();
    await expect(page.getByTestId('transport-bar')).toBeVisible();
    const first = (await pf.call('transport'))!;
    expect(first.running).toBe(true);
    await expect.poll(async () => (await pf.call('transport'))!.position).toBeGreaterThan(first.position);
    expect((await pf.call('status')).route).toBeNull();
    // And back: the Route picks up where the music is.
    await openRoute(page);
    expect((await pf.call('transport'))!.running).toBe(true);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('route-state-word')).not.toHaveText('PLAYING');
  });

  test('P9-2c: an authored route\'s cards read its text; with no route, the detected sections, the placeholder and the CTA', async ({ page, pf }) => {
    await authoredRoute(page, pf);
    await waitForSaved(page);
    await openRoute(page);
    const authored = [
      'Kick and hats, both hands low',
      'Capture the drums, then the bass riff',
      'Everything back on the pads',
    ];
    await expect(page.getByTestId('route-card-text')).toHaveText(authored);
    await expect(page.getByTestId('route-name-sections')).toHaveCount(0);
    // The route is saved with the project, and the Route opens straight from its address.
    await page.reload();
    await pf.ready();
    await expect(page.getByTestId('route-card-text')).toHaveText(authored);

    // Back to no route: the detected one (TEST MIDI 1 plays throughout, so one section).
    await dispatch(pf, { type: 'ROUTE_CLEAR' });
    await expect(page.getByTestId('route-card')).toHaveCount(1);
    await expect(page.getByTestId('route-card-text')).toHaveText(['Add what you do here']);
    await expect(page.getByTestId('route-detected')).toHaveText('Found from silences');
    const cta = page.getByTestId('route-name-sections');
    await expect(cta).toBeDisabled();
    const reasonId = await cta.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${reasonId}"]`)).toBeVisible();
  });

  test('P9-2d: an unplayable strike in the Active Layout\'s plan is drawn outlined red in its lane', async ({ page, pf }) => {
    // Twelve Sounds struck together, four times: more notes at once than ten fingers.
    await newProject(page, pf);
    const lanes = Array.from({ length: 12 }, (_, i) => ({
      id: `chord-${i}`, name: `Hit ${i + 1}`, sourceFileId: 'chord', sourceFileName: 'chord.mid', groupId: null,
      orderIndex: i, color: '#888888', colorMode: 'inherited', isHidden: false,
      events: [0, 2, 4, 6].map((t, j) => ({ eventId: `chord-${i}-${j}`, laneId: `chord-${i}`, startTime: t, duration: 0.2, velocity: 100, rawPitch: 36 + i })),
    }));
    await dispatch(pf, { type: 'IMPORT_LANES', payload: { lanes, sourceFile: { id: 'chord', fileName: 'chord.mid', importedAt: '2026-10-01T00:00:00.000Z', laneCount: 12 } } });
    await placeSounds(pf, ['0,0', '0,1', '0,2', '0,3', '1,0', '1,1', '1,2', '1,3', '2,0', '2,1', '2,2', '2,3']);
    await dispatch(pf, { type: 'PROMOTE_WORKING_LAYOUT' });
    await waitForAnalysis(pf);
    const plan = (await pf.call('state')).analysisResult!.executionPlan.fingerAssignments;
    const unplayable = plan.filter(a => a.assignedHand === 'Unplayable').length;
    expect(unplayable).toBeGreaterThan(0);

    await openRoute(page);
    const canvas = page.getByTestId('route-lanes-canvas');
    await expect(canvas).toHaveAttribute('data-unplayable', String(unplayable));
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(`${unplayable} notes can’t be played as fingered`));
    expect(await redPixels(page)).toBeGreaterThan(0);
    // Every strike is still drawn: one note mark per note.
    expect(await canvas.getAttribute('data-detail')).toBe('notes');
  });

  test('P9-2d: a playable layout draws no red', async ({ page, pf }) => {
    await authoredRoute(page, pf);
    await waitForAnalysis(pf);
    await openRoute(page);
    await expect(page.getByTestId('route-lanes-canvas')).toHaveAttribute('data-unplayable', '0');
    expect(await redPixels(page)).toBe(0);
  });

  test('P9-2e: no visible text under 11 px, every control at least 24 px, and axe finds nothing serious', async ({ page, pf }, testInfo) => {
    await authoredRoute(page, pf);
    await openRoute(page);
    const audit = await page.getByTestId('route-page').evaluate(root => {
      const small: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const el = node.parentElement;
        if (!text || !el || el.getClientRects().length === 0) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 11) small.push(`"${text}" at ${size}px`);
      }
      const tiny = [...root.querySelectorAll('button, a[href], [role="button"]')]
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
        .map(({ el, r }) => `${el.textContent?.trim() || el.getAttribute('aria-label')} ${Math.round(r.width)}×${Math.round(r.height)}`);
      return { small, tiny };
    });
    expect(audit.small).toEqual([]);
    expect(audit.tiny).toEqual([]);

    const results = await new AxeBuilder({ page }).include('[data-testid="route-page"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    await testInfo.attach('axe-results.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
});

/** Pixels of the unplayable red (--route-unplayable, #ef4444) on the lanes' canvas. */
async function redPixels(page: Page): Promise<number> {
  return page.getByTestId('route-lanes-canvas').evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! > 200 && data[i + 1]! < 110 && data[i + 2]! < 110 && data[i + 3]! > 200) n++;
    }
    return n;
  });
}
