import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');

  // Wait for the Demo list to load and click 'Simple Drum Groove'
  await page.waitForSelector('text/Simple Drum Groove', { timeout: 5000 });
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === 'Simple Drum Groove');
    if (el) el.click();
  });

  // Wait for Generate button to appear
  await page.waitForSelector('button', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Generate
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const gen = btns.find(b => b.textContent && b.textContent.includes('Generate'));
    if (gen) gen.click();
  });

  // Wait a few seconds for crash
  await new Promise(r => setTimeout(r, 4000));

  await browser.close();
  console.log('Test complete.');
})();
