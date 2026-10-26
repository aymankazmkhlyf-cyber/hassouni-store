import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [V, html, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const FPS = 30, DURATION = 30;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`file://${V}/${html}`);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
for (let f = 0; f < FPS * DURATION; f++) {
  await p.evaluate((t) => window.render(t), f / FPS);
  await p.screenshot({ path: `${outDir}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 });
  if (f % 150 === 0) console.log(`frame ${f}`);
}
await b.close();
