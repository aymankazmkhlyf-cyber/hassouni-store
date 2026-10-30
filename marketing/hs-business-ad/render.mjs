// Rendering helper.
//   node render.mjs stills <Comp> <t1> [t2 …] [--guides]      → out/stills/<Comp>-<t>.png
//   node render.mjs preview <Comp> <startS> <endS> <out.mp4>   → half-res 30 fps preview of a range
//   node render.mjs video <Comp> <out.mp4> [startS endS]       → full quality, resumable 10 s chunks
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = { gl: 'swangle' };
const [mode, compId, ...rest] = process.argv.slice(2);
const guides = rest.includes('--guides');
const args = rest.filter((a) => !a.startsWith('--'));

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const inputProps = { guides };
const composition = await selectComposition({ serveUrl, id: compId, inputProps, browserExecutable, chromiumOptions });
const FPS = composition.fps;
const common = { composition, serveUrl, inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000 };
fs.mkdirSync('out/stills', { recursive: true });

const progress = (label) => {
  let last = -1;
  return ({ progress: p }) => {
    const pct = Math.floor(p * 10) * 10;
    if (pct > last) {
      last = pct;
      console.log(`${label}: ${pct}%`);
    }
  };
};

if (mode === 'stills') {
  for (const s of args) {
    const t = Number(s);
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * FPS));
    const output = `out/stills/${compId}-${t.toFixed(2).padStart(5, '0')}${guides ? '-guides' : ''}.png`;
    await renderStill({ ...common, frame, output, imageFormat: 'png' });
    console.log('still', t, '→', output);
  }
} else if (mode === 'preview') {
  const [a, b, out] = args;
  const from = Math.round(Number(a) * FPS);
  const to = Math.min(composition.durationInFrames, Math.round(Number(b) * FPS)) - 1;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderMedia({
    ...common,
    codec: 'h264',
    crf: 20,
    pixelFormat: 'yuv420p',
    imageFormat: 'jpeg',
    jpegQuality: 90,
    scale: 0.5,
    everyNthFrame: 2,
    muted: true,
    frameRange: [from, to],
    outputLocation: out,
    concurrency: 4,
    onProgress: progress(`preview ${a}-${b}`),
  });
  console.log('preview →', out);
} else if (mode === 'video') {
  const [out, a, b] = args;
  const startF = a ? Math.round(Number(a) * FPS) : 0;
  const endF = b ? Math.round(Number(b) * FPS) : composition.durationInFrames;
  const dir = `out/chunks-${compId}`;
  fs.mkdirSync(dir, { recursive: true });
  const CH = 300;
  const parts = [];
  for (let from = startF; from < endF; from += CH) {
    const to = Math.min(endF, from + CH) - 1;
    const file = `${dir}/${String(from).padStart(4, '0')}-${String(to).padStart(4, '0')}.mov`;
    parts.push(file);
    if (fs.existsSync(file)) continue;
    // Chunks are ProRes 4444 (near-lossless intermediate); the delivery H.264 is encoded once in finish.sh.
    await renderMedia({
      ...common,
      codec: 'prores',
      proResProfile: '4444',
      imageFormat: 'png',
      muted: true,
      frameRange: [from, to],
      outputLocation: file + '.part.mov',
      concurrency: 4,
      onProgress: progress(`chunk ${from}-${to}`),
    });
    fs.renameSync(file + '.part.mov', file);
  }
  fs.writeFileSync(`${dir}/list.txt`, parts.map((p) => `file '${path.resolve(p)}'`).join('\n') + '\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-c', 'copy', out]);
  console.log('video →', out);
}
