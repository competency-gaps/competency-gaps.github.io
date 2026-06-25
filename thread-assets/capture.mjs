import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAGE = 'file://' + path.join(HERE, 'soccer_concept_map.html');
const VIDEO_DIR = path.join(HERE, 'video');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const W = 860, H = 700;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--no-sandbox']
});

const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: VIDEO_DIR, size: { width: W, height: H } }
});

const page = await context.newPage();
await page.goto(PAGE, { waitUntil: 'networkidle' });
await page.waitForSelector('.dot');
await sleep(400);

// Move the synthetic cursor off-screen so no dot sits in a :hover state.
await page.mouse.move(W - 6, H - 6);

const click = async (sel) => {
  await page.click(sel, { force: true });
};
const clickAway = async () => {
  // Click the hint paragraph: not a dot/card/mode-btn, so it deselects.
  await page.click('.hint', { force: true });
};

// ---- Timeline (real time; video captures the CSS fades) ----
await sleep(1300);                 // idle: full field of concepts

await click('[data-id="2"]');      // "match results" — soccer, very good (green)
await page.mouse.move(W - 6, H - 6);
await sleep(2600);                 // hold on the high green score

await clickAway();
await sleep(900);                  // brief idle

await click('[data-id="9"]');      // "refusing a request" — very poor (red)
await page.mouse.move(W - 6, H - 6);
await sleep(3000);                 // hold longer on the punchline

await clickAway();
await sleep(1300);                 // settle back to the field, ready to loop

const video = page.video();
await context.close();             // flushes the webm
const src = await video.path();
const dest = path.join(HERE, 'capture.webm');
fs.copyFileSync(src, dest);
await browser.close();

console.log('VIDEO:', dest);
