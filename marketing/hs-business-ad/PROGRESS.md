# HS cinematic ad: progress

Resume rule: read this file and `git log`, then continue from the first part that is not ✅.
Never redo a finished part; commit any later fix to it separately.

| Part | Contents | Status |
|---|---|---|
| 1 | Setup, design system, `texts.ts`, 3D base, icons, audio engine | ✅ |
| 2 | Scenes 0.0–12.0 s (hook + reveal) | ⏳ |
| 3 | Scenes 12.0–28.0 s (features 1–3) | ⏳ |
| 4 | Scenes 28.0–44.0 s (features 4–6) | ⏳ |
| 5 | Scenes 44.0–60.0 s + seamless loop + Video A assembly | ⏳ |
| 6 | Mix & master, Video B, Premiere export, QA, final renders | ⏳ |

## Where things are

- `src/texts.ts`: every Arabic string. `brief` = exact lines from the brief (never edited), `ui` = demo-UI labels, `studio` = Video B labels.
- `src/timeline.json`: all timings (scenes, transitions, SFX events). Read by the picture, the audio scripts, Video B and the XML export.
- `src/theme.ts`: palette, fonts, layout lines (safe zones, `BADGE_Y`, `HEAD_Y`), easing, spring, glass.
- `src/ui/`: `Words` (word-by-word headline), `Icon` (line icons + animated badge), `Effects` (grade, grain, vignette, letterbox, flare, light leak, flash, light sweep, motion blur + chromatic aberration), `Logo` (HS: arrow + orbit + wordmark), `Phone` (CSS-3D phone + tap ripple), `Counter` (١/٧ … ٧/٧).
- `src/three/`: `Scenes3D.tsx` (night city, glass tower, globe with flight arcs, airplane) and `util.ts` (window textures, geometry, lat/lon, projection).
- `audio/engine.py`: synthesis, filters, reverb, panning, sidechain, limiter, 24-bit writer, and all SFX recipes from the brief. `audio/demo_sfx.py` renders every recipe in a row (check).
- `render.mjs`: `stills`, `preview` (half-res, 30 fps), `video` (full quality ProRes 4444 chunks, resumable).
- `tools/text_qa.py`: spelling/format checks on the brief strings.
- `previews/`: per-part preview videos and stills.

## Part log

### Part 1 ✅
- Remotion 4.0.539 + @remotion/three, three r180, @react-three/fiber 9. 3D renders in headless Chrome via SwiftShader (`gl: swangle`).
- Fonts: Readex Pro, IBM Plex Sans Arabic, Manrope (local woff2), loaded before render.
- Preview: `previews/part1.mp4` (design-system reel), stills `previews/part1/`.
- Text QA: 0 problems. `reveal2` (7 words) is shown on two lines (break after the 4th word); the string itself is unchanged.
- Notes for later parts: city/globe/tower cameras are only defaults; each scene frames its own shot. `reveal1` needs a 2+2 break or 68 px to avoid a one-word second line.
