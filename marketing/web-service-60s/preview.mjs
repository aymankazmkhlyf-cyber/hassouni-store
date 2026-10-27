// node preview.mjs <outDir> t1 t2 ... — single frames for checking layout.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const [outDir, ...times] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(`file://${here}/index.html`);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
for (const t of times) {
  await p.evaluate((x) => window.render(x), +t);
  await p.screenshot({ path: `${outDir}/t${t}.jpg`, type: "jpeg", quality: 80 });
}
console.log(errs.length ? errs : "no errors");
await b.close();
