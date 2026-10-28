/*
 * Compiles the original Tailwind stylesheet for the PHP site, scanning the
 * PHP templates and the React islands for class names.
 *   node php-hosting/build/build-css.mjs   (from the repository root)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "php-hosting/site/assets");
mkdirSync(path.join(out, "fonts"), { recursive: true });

// Cairo variable font (same files as the original site).
const fontDir = path.join(root, "node_modules/@fontsource-variable/cairo");
for (const f of readdirSync(path.join(fontDir, "files")).filter((f) => f.includes("-wght-normal"))) {
  copyFileSync(path.join(fontDir, "files", f), path.join(out, "fonts", f));
}
const fontCss = readFileSync(path.join(fontDir, "index.css"), "utf8").replaceAll("./files/", "./fonts/");

const globals = readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace(
  '@import "tailwindcss";',
  `@import "tailwindcss" source(none);
@source "../site/app/**/*.php";
@source "../site/*.php";
@source "../../src/components/**/*.tsx";
@source "../islands/**/*.tsx";`,
);
const entry = path.join(here, "app.entry.css");
writeFileSync(entry, globals);
const result = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(globals + "\n" + fontCss, { from: entry });
writeFileSync(path.join(out, "app.css"), result.css);
console.log(`app.css: ${(result.css.length / 1024).toFixed(1)} KB`);
