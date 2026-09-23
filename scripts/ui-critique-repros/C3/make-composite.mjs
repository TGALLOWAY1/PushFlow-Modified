import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const dir = '.ui-repro-out/C3/';
const a = readFileSync(dir + 'A-beam-lock-1600-1-before.png').toString('base64');
const b = readFileSync(dir + 'A-beam-lock-1600-2-after-generate.png').toString('base64');
const H = 660, W = 1600, BAND = 44;
const html = `<html><body style="margin:0;background:#111;font-family:Arial,sans-serif">
<div style="width:${W}px">
<div style="height:${BAND}px;line-height:${BAND}px;color:#fff;font-size:22px;padding-left:16px;background:#2a2a2a">BEFORE: hand-made layout, "TEST MIDI 1 1" locked on pad (7,0) (lock icon, top-left pad)</div>
<div style="height:${H}px;overflow:hidden"><img src="data:image/png;base64,${a}" style="display:block"></div>
<div style="height:${BAND}px;line-height:${BAND}px;color:#fff;font-size:22px;padding-left:16px;background:#5a1f1f">AFTER choosing Beam and clicking Generate: every sound moved, (7,0) empty, lock gone, no warning</div>
<div style="height:${H}px;overflow:hidden"><img src="data:image/png;base64,${b}" style="display:block"></div>
</div></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: W, height: (H + BAND) * 2 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: dir + 'composite-beam-lock-before-after.png', fullPage: true });
await browser.close();
