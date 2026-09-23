// C9 repro: drag a Composer preset onto the grid.
//  Phase A  - build a real 2-pad preset through the Composer UI (project A)
//  Phase B  - target project B (TEST MIDI 1 + 3 hand-placed sounds):
//             B1 no-fix drop on an empty valid spot, B2 no-fix drop on occupied spot,
//             B3 with dropEffect fix: drop on occupied spot (stale-closure test),
//             B4 with fix: drop on empty spot, B5 reload to check persistence
//  Phase C  - control project C: same as B but force a soundStreams change (mute+unmute)
//             right before the drop -> handleDrop is re-memoised with a fresh onPresetDrop
//  Phase D  - M-key mirror during drag vs what the drop uses
import {
  DIR, launch, wirePage, makeLogger, shot, newProject, importMidi, pad, occupiedPads,
  leftTab, soundRow, soundRows, mouseDrag, installDragSpy, dragSummary, injectCopyFix,
  ghostCells, presetsInStorage, placedText,
} from './lib.mjs';

const W = parseInt(process.env.W || '1600', 10);
const H = parseInt(process.env.H || '1000', 10);
const TAG = process.env.TAG || '1600';
const { note, flush } = makeLogger(`probe-${TAG}`);
const { browser, ctx } = await launch(W, H);
const page = await ctx.newPage();
const dialogs = wirePage(page, note, ['C9 Preset']);
const P = (s) => `${TAG}-${s}`;

async function step(label, fn) {
  try { await fn(); } catch (e) { note(`FAIL ${label}: ${e.message.split('\n')[0]}`); }
}

async function presetCard() {
  return page.locator('div[draggable="true"].cursor-grab:has-text("C9 Preset")').first();
}

async function presetDrag(targetR, targetC, shotName, opts = {}) {
  await installDragSpy(page);
  const before = await occupiedPads(page);
  const nDialogs = dialogs.length;
  let ghost = null;
  await mouseDrag(page, await presetCard(), pad(page, targetR, targetC), {
    midShot: shotName, note,
    beforeRelease: async () => {
      if (opts.pressM) {
        await page.keyboard.press('m'); await page.waitForTimeout(300);
        // Playwright only fires dragover on mouse moves; nudge so the ghost recomputes with the new mirror state
        const bb = await pad(page, targetR, targetC).boundingBox();
        await page.mouse.move(bb.x + bb.width / 2 - 2, bb.y + bb.height / 2, { steps: 2 });
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 2 });
        await page.waitForTimeout(300);
      }
      ghost = await ghostCells(page);
    },
  });
  const after = await occupiedPads(page);
  const spy = await dragSummary(page);
  note(`  ghost before release: ${JSON.stringify(ghost)}`);
  note(`  drag events: ${JSON.stringify(spy.counts)}; dragstart.effectAllowed=${spy.start?.effectAllowed}; last dragover dropEffect(final)=${spy.lastOver?.finalDropEffect}; dragend.dropEffect=${spy.end?.dropEffect}`);
  note(`  pads before (${before.length}): ${before.join(' || ')}`);
  note(`  pads after  (${after.length}): ${after.join(' || ')}`);
  note(`  new dialogs: ${JSON.stringify(dialogs.slice(nDialogs))}`);
  note(`  placed list: ${await placedText(page)}`);
  return { before, after, spy, ghost, newDialogs: dialogs.slice(nDialogs) };
}

async function placeSounds(targets) {
  await leftTab(page, 'Sounds');
  const all = await soundRows(page).allInnerTexts();
  const names = all.map(t => t.split('\n').map(s => s.trim()).filter(Boolean)[0]).slice(0, targets.length);
  note(`palette rows: ${JSON.stringify(all.map(t => t.replace(/\n/g, ' | ')))}`);
  for (let i = 0; i < names.length; i++) {
    const row = page.locator(`div[draggable="true"]:has(button[title="Color & group"]):has(span[title="${names[i]}"])`).first();
    const [r, c] = targets[i];
    await mouseDrag(page, (await row.count()) ? row : soundRows(page).nth(i), pad(page, r, c));
  }
  note(`placed palette sounds ${JSON.stringify(names)} at ${JSON.stringify(targets)}`);
  note(`pads now: ${(await occupiedPads(page)).join(' || ')}`);
}

// ─────────────────────────── Phase A: build a preset via Composer
note('=== Phase A: build preset in project A (Composer)');
await newProject(page);
await page.locator('button:has-text("Composer")').first().click();
await page.waitForTimeout(600);
await page.locator('button[title="Add lane"]').click();
await page.waitForTimeout(200);
await page.locator('button[title="Add lane"]').click();
await page.waitForTimeout(400);
const cells = page.locator('div.relative.cursor-pointer[style*="height: 32px"]');
const nCells = await cells.count();
const perLane = nCells / 2;
for (const s of [0, 8, 16, 24]) await cells.nth(s).click();
for (const s of [4, 12, 20, 28]) await cells.nth(perLane + s).click();
await page.waitForTimeout(800);
note(`composer status: ${await page.locator('text=/lanes · \\d+ events/').first().textContent()}`);
await placeSounds([[0, 0], [0, 1]]);
await shot(page, P('a01-lanes-on-grid'), note);
await page.locator('button:has-text("Save Preset")').click();
await page.waitForTimeout(600);
const stored = await presetsInStorage(page);
note(`presets in localStorage: ${JSON.stringify(stored.map(p => ({ name: p.name, pads: p.pads, handedness: p.handedness, mirrorEligible: p.mirrorEligible, bbox: p.boundingBox })))}`);

// ─────────────────────────── Phase B: target project with MIDI
note('=== Phase B: target project B with TEST MIDI 1 + 3 hand-placed sounds');
await newProject(page);
await importMidi(page);
await placeSounds([[3, 1], [3, 2], [4, 1]]);
await leftTab(page, 'Presets');
await shot(page, P('b00-presets-tab'), note);

await step('B1', async () => {
  note('--- B1 (as shipped): drop preset on EMPTY, valid spot [0,0]');
  const r = await presetDrag(0, 0, P('b01-mid-drag-empty-spot-ghost'));
  await shot(page, P('b01-after-release-empty-spot'), note);
  note(`  RESULT B1: pad count ${r.before.length} -> ${r.after.length}; drop events fired=${r.spy.counts.drop || 0}`);
});

await step('B2', async () => {
  note('--- B2 (as shipped): drop preset on OCCUPIED spot [3,1] (should raise collision alert if drop fired)');
  const r = await presetDrag(3, 1, P('b02-mid-drag-occupied-spot-ghost'));
  await shot(page, P('b02-after-release-occupied-spot'), note);
  note(`  RESULT B2: pad count ${r.before.length} -> ${r.after.length}; drop events fired=${r.spy.counts.drop || 0}; alerts=${r.newDialogs.length}`);
});

note('--- injecting A/B fix: window bubble dragover listener sets dropEffect=copy for preset drags only');
await injectCopyFix(page);

await step('B3', async () => {
  note('--- B3 (with dropEffect fix): drop preset on OCCUPIED spot [3,1] (ghost says invalid)');
  const r = await presetDrag(3, 1, P('b03-mid-drag-occupied-spot-ghost-fix'));
  await shot(page, P('b03-after-release-occupied-spot-fix'), note);
  note(`  RESULT B3: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});

await step('B4', async () => {
  note('--- B4 (with dropEffect fix): drop preset on EMPTY valid spot [0,0]');
  const r = await presetDrag(0, 0, P('b04-mid-drag-empty-spot-ghost-fix'));
  await shot(page, P('b04-after-release-empty-spot-fix'), note);
  note(`  RESULT B4: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});

await step('B5', async () => {
  note('--- B5: reload project B and re-read pads (persistence of the overwrite)');
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  note(`  pads after reload: ${(await occupiedPads(page)).join(' || ')}`);
  await shot(page, P('b05-after-reload'), note);
});

await step('B6', async () => {
  note('--- B6: one ordinary Composer edit in project B (add a lane), then re-read pads');
  await page.locator('button:has-text("Composer")').first().click();
  await page.waitForTimeout(600);
  await page.locator('button[title="Add lane"]').click();
  await page.waitForTimeout(1200);
  note(`  pads after composer edit: ${(await occupiedPads(page)).join(' || ') || '(none)'}`);
  await leftTab(page, 'Presets');
  note(`  placed list: ${await placedText(page)}`);
  await shot(page, P('b06-after-composer-edit'), note);
  await page.locator('button:has-text("Timeline")').first().click();
  await page.waitForTimeout(400);
});

await step('B7', async () => {
  note('--- B7 control: pad-to-pad swap drag (effectAllowed=move, dropEffect=move) still works');
  await installDragSpy(page);
  const before = await occupiedPads(page);
  await mouseDrag(page, pad(page, 4, 1), pad(page, 5, 1));
  const spy = await dragSummary(page);
  note(`  drag events: ${JSON.stringify(spy.counts)}; dragend.dropEffect=${spy.end?.dropEffect}`);
  note(`  pads before: ${before.join(' || ')}`);
  note(`  pads after : ${(await occupiedPads(page)).join(' || ')}`);
});

// ─────────────────────────── Phase C: control, handleDrop re-memoised
note('=== Phase C: control project C: same setup, but mute+unmute a sound right before the drop');
await newProject(page);
await importMidi(page);
await placeSounds([[3, 1], [3, 2], [4, 1]]);
await injectCopyFix(page);
await step('C1', async () => {
  const muteBtn = soundRows(page).nth(5).locator('button[title="Mute"]');
  await muteBtn.click(); await page.waitForTimeout(300);
  await soundRows(page).nth(5).locator('button[title="Unmute"]').click(); await page.waitForTimeout(500);
  note('  toggled mute/unmute on sound row 6 (changes state.soundStreams twice, layout untouched)');
  await leftTab(page, 'Presets');
  note('--- C1 (fix + fresh closure): drop preset on OCCUPIED spot [3,1]');
  const r = await presetDrag(3, 1, P('c01-mid-drag-occupied-ghost-control'));
  await shot(page, P('c01-after-release-occupied-control'), note);
  note(`  RESULT C1: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});
await step('C2', async () => {
  note('--- C2 (fix + fresh closure): drop preset on EMPTY spot [0,0]');
  const r = await presetDrag(0, 0, P('c02-mid-drag-empty-control'));
  await shot(page, P('c02-after-release-empty-control'), note);
  note(`  RESULT C2: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});
await step('C3', async () => {
  note('--- C3 (fix; handleDrop last memoised BEFORE C2 placed pads): drop again on [0,0], now occupied by the C2 preset pads');
  const r = await presetDrag(0, 0, P('c03-mid-drag-reoccupied'));
  await shot(page, P('c03-after-release-reoccupied'), note);
  note(`  RESULT C3: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});

// ─────────────────────────── Phase D: M-key mirror
note('=== Phase D: M-key mirror during drag (fix injected). Target [6,4]: unmirrored left preset is outside left zone at col 5; mirrored (right) is valid');
await step('D1', async () => {
  const r = await presetDrag(6, 4, P('d01-mid-drag-after-M'), { pressM: true });
  await shot(page, P('d01-after-release-M'), note);
  note(`  RESULT D1: drop fired=${r.spy.counts.drop || 0}; alerts=${JSON.stringify(r.newDialogs)}; pads ${r.before.length} -> ${r.after.length}`);
});

flush();
await browser.close();
