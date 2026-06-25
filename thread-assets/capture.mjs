import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAGE = 'file://' + path.join(HERE, 'soccer_concept_map.html');
const VIDEO_DIR = path.join(HERE, 'video');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const W = 1040;                       // 980 viz container + 30px body padding each side
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--no-sandbox']
});

// ---- pass 1: measure content height so the video frame is filled, no whitespace ----
const probe = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
const ppage = await probe.newPage();
await ppage.goto(PAGE, { waitUntil: 'networkidle' });
await ppage.waitForSelector('.dot');
await ppage.evaluate(() => document.fonts.ready);
const H = await ppage.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
await probe.close();

// ---- pass 2: record the driven sequence ----
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
await sleep(1500);                 // idle: soccer dark (tested), boundaries near-white (untested)

await sel(SOCCER); await sleep(2100);   // soccer-related scenarios: very high coverage
await off();      await sleep(550);

await sel(REFUSE); await sleep(2300);   // refusing a request: very low coverage
await off();      await sleep(750);

// ---------- switch to MODEL GAPS: performance ----------
await mode('model'); await sleep(1500); // dots recolor green / red

await sel(SOCCER); await sleep(2100);   // soccer: very good performance (green)
await off();      await sleep(550);

await sel(REFUSE); await sleep(2500);   // refusing: worst performance (red) — the punchline
await off();      await sleep(750);

// ---------- reset to BENCHMARK GAPS so the loop seam matches the start ----------
await mode('benchmark'); await sleep(1400);

const video = page.video();
await context.close();
const src = await video.path();
const dest = path.join(HERE, 'capture.webm');
fs.copyFileSync(src, dest);
await browser.close();

console.log('SIZE', W + 'x' + H, 'VIDEO', dest);
