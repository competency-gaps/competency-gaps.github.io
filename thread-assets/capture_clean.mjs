import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// "Clean" variant: same concept area, same size/proportions, same animation,
// but with the top toggle/model row and the bottom colour legend hidden. The
// mode still switches under the hood, so the dots still recolour Benchmark<->Model.
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAGE = 'file://' + path.join(HERE, 'soccer_concept_map.html') + '?clean';
const VIDEO_DIR = path.join(HERE, 'video_clean');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const PAD = 10;                       // body horizontal padding (px each side)
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--no-sandbox']
});

// ---- pass 1: measure (chrome hidden -> content is just the viz container) ----
const probe = await browser.newContext({ viewport: { width: 1700, height: 1300 }, deviceScaleFactor: 1 });
const ppage = await probe.newPage();
await ppage.goto(PAGE, { waitUntil: 'networkidle' });
await ppage.waitForSelector('.dot');
await ppage.evaluate(() => document.fonts.ready);

const contentW = await ppage.evaluate(() => Math.ceil(document.querySelector('.viz-container').getBoundingClientRect().width));
const W = contentW + PAD * 2;
const H = await ppage.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
await probe.close();

// ---- pass 2: record ----
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: VIDEO_DIR, size: { width: W, height: H } }
});
const page = await context.newPage();
await page.goto(PAGE, { waitUntil: 'networkidle' });
await page.waitForSelector('.dot');
await page.evaluate(() => document.fonts.ready);
await page.mouse.move(W - 6, H - 6);

const SOCCER = 2;      // "soccer-related scenarios"
const REFUSE = 9;      // "refusing a request"
const sel = id => page.evaluate(i => window.viz.select(i), id);
const off = ()   => page.evaluate(() => window.viz.deselect());
const mode = m  => page.evaluate(x => window.viz.setMode(x), m);

// ---------- BENCHMARK GAPS: coverage ----------
await sleep(1500);

await sel(SOCCER); await sleep(2100);
await off();      await sleep(550);

await sel(REFUSE); await sleep(2300);
await off();      await sleep(750);

// ---------- switch to MODEL GAPS: performance ----------
await mode('model'); await sleep(1500);

await sel(SOCCER); await sleep(2100);
await off();      await sleep(550);

await sel(REFUSE); await sleep(2500);
await off();      await sleep(750);

// ---------- reset to BENCHMARK GAPS so the loop seam matches the start ----------
await mode('benchmark'); await sleep(1400);

const video = page.video();
await context.close();
const src = await video.path();
const dest = path.join(HERE, 'capture_clean.webm');
fs.copyFileSync(src, dest);
await browser.close();

console.log('SIZE', W + 'x' + H, 'VIDEO', dest);
