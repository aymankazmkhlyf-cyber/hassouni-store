import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [dir, name, ...times] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`file://${dir}/${name}`);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
for (const t of times) { await p.evaluate((t) => window.render(t), +t); await p.screenshot({ path: `${dir}/pv-${name}-${t}.jpg`, type: "jpeg", quality: 75 }); }
await b.close();
