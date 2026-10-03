// Headless visual QA: drives the game in local Chrome and captures screenshots.
// Usage: node tools/shot.mjs <script.json> [outDir]
// Script: { url?, width?, height?, steps: [{click|key|type|wait|eval|shot}] }
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const scriptPath = process.argv[2];
const outDir = process.argv[3] ?? '/tmp/konoha-shots';
const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: script.width ?? 1600, height: script.height ?? 900, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[qa]')) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));

await page.goto(base + (script.url ?? ''), { waitUntil: 'networkidle0' });
let n = 0;
for (const step of script.steps) {
  if (step.wait) await new Promise(r => setTimeout(r, step.wait));
  if (step.click) await page.click(step.click);
  if (step.type) await page.keyboard.type(step.type, { delay: 20 });
  if (step.key) {
    const keys = Array.isArray(step.key) ? step.key : [step.key];
    const times = step.times ?? 1;
    for (let t = 0; t < times; t++) for (const k of keys) {
      await page.keyboard.press(k);
      await new Promise(r => setTimeout(r, step.keyDelay ?? 70));
    }
  }
  if (step.eval) logs.push(`eval: ${JSON.stringify(await page.evaluate(step.eval))}`);
  if (step.shot) {
    const file = path.join(outDir, `${String(n++).padStart(2, '0')}-${step.shot}.png`);
    await page.screenshot({ path: file });
    console.log('shot', file);
  }
}
for (const l of logs) console.log(l);
await browser.close();
await server.close();
