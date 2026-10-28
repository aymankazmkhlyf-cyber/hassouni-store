/*
 * Bundles the original React client components for the PHP site.
 *   node php-hosting/islands/build.mjs   (from the repository root)
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const shims = path.join(here, "shims");

const shimPlugin = {
  name: "php-shims",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(shims, "next-link.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(shims, "next-navigation.ts") }));
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: path.join(shims, "server-only.ts") }));
    b.onResolve({ filter: /^@\/app\/actions\/(auth|cart|checkout|orders|custom|password|push|reviews|support|wallet)$/ }, (a) => ({
      path: path.join(shims, "actions", a.path.split("/").pop() + ".ts"),
    }));
    // The cart context becomes one shared store across islands.
    b.onResolve({ filter: /cart-provider$/ }, () => ({ path: path.join(shims, "cart-provider.tsx") }));
    b.onResolve({ filter: /^@\/app\/actions\/admin$/ }, () => ({ errors: [{ text: "admin actions are handled by PHP forms" }] }));
  },
};

await build({
  entryPoints: [path.join(here, "entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15"],
  jsx: "automatic",
  outfile: path.join(root, "php-hosting/site/assets/islands.js"),
  tsconfig: path.join(root, "tsconfig.json"),
  alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [shimPlugin],
  legalComments: "none",
  logLevel: "info",
});
