// node render.mjs <outDir> [fps] [from] [to]  — renders index.html frame by frame (deterministic timeline).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const [outDir, fpsArg, fromArg, toArg] = process.argv.slice(2);
const FPS = +(fpsArg || 30);
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`file://${here}/index.html`);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
const dur = await p.evaluate(() => +document.body.dataset.dur);
const from = Math.round(+(fromArg || 0) * FPS), to = Math.round(+(toArg || dur) * FPS);
for (let f = from; f < to; f++) {
  await p.evaluate((t) => window.render(t), f / FPS);
  await p.screenshot({ path: `${outDir}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 93 });
  if (f % 150 === 0) console.log(`frame ${f}/${to}`);
}
await b.close();
