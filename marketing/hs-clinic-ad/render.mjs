// node render.mjs stills [t1 t2 ...] [--guides]  → out/stills/*.png
// node render.mjs video                          → out/video-silent.mp4 (H.264 CRF 14, yuv420p)
// node render.mjs thumb <t>                      → out/thumbnail.png
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const [mode = 'stills', ...rest] = process.argv.slice(2);
const guides = rest.includes('--guides');
const args = rest.filter((a) => !a.startsWith('--'));

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const inputProps = { guides };
const composition = await selectComposition({ serveUrl, id: 'HSClinicAd', inputProps, browserExecutable });
const chromiumOptions = { gl: 'swangle' };
fs.mkdirSync('out/stills', { recursive: true });

if (mode === 'stills' || mode === 'thumb') {
  const scenes = JSON.parse(fs.readFileSync('src/timeline.json', 'utf8')).scenes;
  const times = args.length ? args.map(Number) : scenes.map((s) => (s.start + s.end) / 2);
  for (const t of times) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 60));
    const output = mode === 'thumb' ? 'out/thumbnail.png' : `out/stills/${String(t.toFixed(2)).padStart(5, '0')}${guides ? '-guides' : ''}.png`;
    await renderStill({ composition, serveUrl, frame, output, inputProps, browserExecutable, chromiumOptions, imageFormat: 'png' });
    console.log('still', t, '→', output);
  }
} else if (mode === 'video') {
  let last = 0;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 14,
    pixelFormat: 'yuv420p',
    x264Preset: 'slow',
    imageFormat: 'jpeg',
    jpegQuality: 100,
    muted: true,
    outputLocation: 'out/video-silent.mp4',
    inputProps,
    browserExecutable,
    chromiumOptions,
    concurrency: 4,
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 5) {
        last = pct;
        console.log(`render ${pct}%`);
      }
    },
  });
  console.log('video → out/video-silent.mp4');
}
