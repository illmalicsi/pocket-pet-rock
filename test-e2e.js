import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[Browser Error]:', err);
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 1200));

  // Take screenshot of clean buttons
  const cleanShot = path.join(__dirname, 'test-buttons-clean.png');
  await page.screenshot({ path: cleanShot });
  console.log('Saved clean buttons screenshot:', cleanShot);

  // 1. Test Hide Button & Submerging
  console.log('Testing "Hide" button...');
  await page.click('#hide-btn');

  // Verify buttons disabled while hiding
  const isPetDisabled = await page.$eval('#pet-btn', el => el.disabled);
  console.log('Is pet button disabled during hide:', isPetDisabled);

  // Wait 1.2s while peeking above surface
  await new Promise(r => setTimeout(r, 1200));
  const hideSubmergedShot = path.join(__dirname, 'test-hide-submerged.png');
  await page.screenshot({ path: hideSubmergedShot });
  console.log('Saved submerged peeking screenshot:', hideSubmergedShot);

  // Wait for rock to pop back up (total hide cycle is ~4.2s)
  await new Promise(r => setTimeout(r, 3600));
  const speechAfterHide = await page.$eval('#speech-text', el => el.textContent);
  console.log('After surfacing -> Speech:', speechAfterHide);
  const isPetEnabled = await page.$eval('#pet-btn', el => !el.disabled);
  console.log('Are buttons re-enabled after surfacing:', isPetEnabled);

  // 2. Test Hat Button Cycling
  console.log('Testing "Hat" button (Crown)...');
  await page.click('#hat-btn');
  await new Promise(r => setTimeout(r, 600));
  const crownShot = path.join(__dirname, 'test-hat-crown.png');
  await page.screenshot({ path: crownShot });
  console.log('Crown speech:', await page.$eval('#speech-text', el => el.textContent));

  console.log('Testing "Hat" button (Top Hat)...');
  await page.click('#hat-btn');
  await new Promise(r => setTimeout(r, 600));
  const topHatShot = path.join(__dirname, 'test-hat-tophat.png');
  await page.screenshot({ path: topHatShot });
  console.log('Top Hat speech:', await page.$eval('#speech-text', el => el.textContent));

  console.log('Testing "Hat" button (Leaf)...');
  await page.click('#hat-btn');
  await new Promise(r => setTimeout(r, 600));
  const leafShot = path.join(__dirname, 'test-hat-leaf.png');
  await page.screenshot({ path: leafShot });
  console.log('Leaf speech:', await page.$eval('#speech-text', el => el.textContent));

  console.log('Testing "Hat" button (Bare rock)...');
  await page.click('#hat-btn');
  await new Promise(r => setTimeout(r, 600));
  console.log('Bare rock speech:', await page.$eval('#speech-text', el => el.textContent));

  // 3. Test Day / Night Toggle
  console.log('Testing "Day / Night" toggle (Night)...');
  await page.click('#night-btn');
  // Wait 1.8s for smooth lighting, stars, and sleeping eyes transition
  await new Promise(r => setTimeout(r, 1800));
  const nightShot = path.join(__dirname, 'test-night-scene.png');
  await page.screenshot({ path: nightShot });
  console.log('Saved night scene screenshot:', nightShot);
  console.log('Night speech:', await page.$eval('#speech-text', el => el.textContent));

  console.log('Testing "Day / Night" toggle (Back to Day)...');
  await page.click('#night-btn');
  await new Promise(r => setTimeout(r, 1800));
  console.log('Morning speech:', await page.$eval('#speech-text', el => el.textContent));

  await browser.close();
  console.log('All tests finished successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
