// C9 follow-up probe:
//  E1  control re-run (fresh closure after mute/unmute) with a settle wait, at the given viewport
//  E2  stale draggingPreset: mirror toggled mid-drag via the app's own window keydown 'm' listener
//      (synthetic KeyboardEvent, because Playwright's emulated drag does not deliver key presses)
//  E3  after an overwriting (stale) drop, make a real Composer edit (lane + note) and re-read pads
import {
  launch, wirePage, makeLogger, shot, newProject, importMidi, pad, occupiedPads,
  leftTab, soundRows, mouseDrag, installDragSpy, dragSummary, injectCopyFix,
  ghostCells, placedText,
} from './lib.mjs';

const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const TAG = process.env.TAG || '1600';
const { note, flush } = makeLogger(`probe2-${TAG}`);
const { browser, ctx } = await launch(W, H);
const page = await ctx.newPage();
const dialogs = wirePage(page, note, ['C9 Preset']);
const P = (s) => `${TAG}-${s}`;
const step = async (l, f) => { try { await f(); } catch (e) { note(`FAIL ${l}: ${e.message.split('\n')[0]}`); } };
const card = () => page.locator('div[draggable="true"].cursor-grab:has-text("C9 Preset")').first();

async function placeSounds(targets) {
  await leftTab(page, 'Sounds');
  const all = await soundRows(page).allInnerTexts();
  const names = all.map(t => t.split('\n').map(s => s.trim()).filter(Boolean)[0]).slice(0, targets.length);
  for (let i = 0; i < names.length; i++) {
    const row = page.locator(`div[draggable="true"]:has(button[title="Color & group"]):has(span[title="${names[i]}"])`).first();
    await mouseDrag(page, row, pad(page, targets[i][0], targets[i][1]));
  }
  await page.waitForTimeout(1500); // let auto-analysis settle so pads do not re-layout mid-drag
  note(`pads now: ${(await occupiedPads(page)).join(' || ')}`);
}

async function presetDrag(r, c, name, beforeRelease) {
  await installDragSpy(page);
  const before = await occupiedPads(page);
  const n = dialogs.length;
  let ghost;
  await mouseDrag(page, card(), pad(page, r, c), {
    midShot: name, note,
    beforeRelease: async () => { if (beforeRelease) await beforeRelease(); ghost = await ghostCells(page); },
  });
  const after = await occupiedPads(page);
  const spy = await dragSummary(page);
  note(`  ghost: ${JSON.stringify(ghost)}`);
  note(`  drop fired=${spy.counts.drop || 0}; dragend.dropEffect=${spy.end?.dropEffect}`);
  note(`  pads before: ${before.join(' || ')}`);
  note(`  pads after : ${after.join(' || ')}`);
  note(`  dialogs: ${JSON.stringify(dialogs.slice(n))}; placed: ${await placedText(page)}`);
}

// Build preset through the Composer (same as probe.mjs Phase A)
await newProject(page);
await page.locator('button:has-text("Composer")').first().click();
await page.waitForTimeout(600);
await page.locator('button[title="Add lane"]').click();
await page.waitForTimeout(200);
await page.locator('button[title="Add lane"]').click();
await page.waitForTimeout(400);
{
  const cells = page.locator('div.relative.cursor-pointer[style*="height: 32px"]');
  const per = (await cells.count()) / 2;
  for (const s of [0, 8, 16, 24]) await cells.nth(s).click();
  for (const s of [4, 12, 20, 28]) await cells.nth(per + s).click();
}
await page.waitForTimeout(800);
await placeSounds([[0, 0], [0, 1]]);
await page.locator('button:has-text("Save Preset")').click();
await page.waitForTimeout(600);

// E1 control
note('=== E1 control: fresh project, 3 sounds, mute+unmute (soundStreams change), fix injected, drop on occupied [3,1]');
await newProject(page);
await importMidi(page);
await placeSounds([[3, 1], [3, 2], [4, 1]]);
await injectCopyFix(page);
await soundRows(page).nth(5).locator('button[title="Mute"]').click(); await page.waitForTimeout(300);
await soundRows(page).nth(5).locator('button[title="Unmute"]').click(); await page.waitForTimeout(1500);
await leftTab(page, 'Presets');
await page.waitForTimeout(800);
await step('E1', () => presetDrag(3, 1, P('e01-mid-drag-control')));

// E2 stale draggingPreset / mirror
note('=== E2: drag to [6,4] (unmirrored left preset invalid there: col 5 > left zone), toggle mirror mid-drag via window keydown m');
await step('E2', () => presetDrag(6, 4, P('e02-mid-drag-mirrored-ghost'), async () => {
  const g0 = await ghostCells(page);
  note(`  ghost before m: ${JSON.stringify(g0)}`);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true })));
  await page.waitForTimeout(200);
  const bb = await pad(page, 6, 4).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2 - 3, bb.y + bb.height / 2, { steps: 2 });
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 2 });
  await page.waitForTimeout(300);
}));
await shot(page, P('e02-after-release'), note);

// E3 stale overwrite then composer edit
note('=== E3: fresh project, 3 sounds, fix injected, stale drop on occupied [3,1], then Composer edit (add lane + toggle a note)');
await newProject(page);
await importMidi(page);
await placeSounds([[3, 1], [3, 2], [4, 1]]);
await injectCopyFix(page);
await leftTab(page, 'Presets');
await page.waitForTimeout(800);
await step('E3-drop', () => presetDrag(3, 1, P('e03-mid-drag-stale')));
await shot(page, P('e03-after-stale-drop'), note);
await step('E3-edit', async () => {
  await page.locator('button:has-text("Composer")').first().click();
  await page.waitForTimeout(600);
  await page.locator('button[title="Add lane"]').click();
  await page.waitForTimeout(400);
  await page.locator('div.relative.cursor-pointer[style*="height: 32px"]').nth(2).click();
  await page.waitForTimeout(1500);
  note(`  composer status: ${await page.locator('text=/lanes · \\d+ events/').first().textContent()}`);
  note(`  pads after composer edit: ${(await occupiedPads(page)).join(' || ') || '(none)'}`);
  await leftTab(page, 'Sounds');
  note(`  sounds panel: ${JSON.stringify((await soundRows(page).allInnerTexts()).map(t => t.replace(/\n/g, ' | ')))}`);
  await shot(page, P('e03-after-composer-edit'), note);
});

flush();
await browser.close();
