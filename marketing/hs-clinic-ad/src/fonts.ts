import { continueRender, delayRender, staticFile } from 'remotion';

// Local Google Fonts (woff2). Rendering waits until every face is loaded, so no frame uses a fallback font.
const ARABIC = 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FEFF';
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const faces: { family: string; file: string; weight: string; range: string }[] = [
  { family: 'Readex Pro', file: 'fonts/readex-arabic.woff2', weight: '160 700', range: ARABIC },
  { family: 'Readex Pro', file: 'fonts/readex-latin.woff2', weight: '160 700', range: LATIN },
  ...(['400', '500', '600'] as const).flatMap((w) => [
    { family: 'IBM Plex Sans Arabic', file: `fonts/plex-${w}-arabic.woff2`, weight: w, range: ARABIC },
    { family: 'IBM Plex Sans Arabic', file: `fonts/plex-${w}-latin.woff2`, weight: w, range: LATIN },
  ]),
  { family: 'Manrope', file: 'fonts/manrope-latin.woff2', weight: '200 800', range: LATIN },
];

const handle = delayRender('Loading fonts');
Promise.all(
  faces.map((f) => {
    const face = new FontFace(f.family, `url('${staticFile(f.file)}') format('woff2')`, {
      weight: f.weight,
      unicodeRange: f.range,
      display: 'block',
    });
    document.fonts.add(face);
    return face.load();
  }),
)
  .then(() => document.fonts.ready)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error('Font loading failed', err);
    // Never render with fallback fonts: leave the render blocked so it times out loudly.
  });
