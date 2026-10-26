# 30-second Reel (1080×1920)

Regenerate `../hassouni-reel-30s.mp4`, e.g. after renaming the site:

```bash
D=marketing/reel-src
cp node_modules/@fontsource-variable/cairo/files/cairo-{arabic,latin}-wght-normal.woff2 $D/
sed 's|__URL__|your-site.netlify.app|' $D/ad.html > $D/ad-build.html
node $D/render.mjs "$PWD/$D" ad-build.html /tmp/reel-frames
ffmpeg -framerate 30 -i /tmp/reel-frames/f%04d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart marketing/hassouni-reel-30s.mp4
```

`capture.mjs` re-takes the site screenshots (`s-*.png`) from a running server on port 3001.
The ad intentionally omits follower/like/view and number sales (not allowed in Instagram/TikTok ads) and uses no third-party logos.

## Soundtrack

`soundtrack.py` synthesizes original music (120 BPM, A minor) and sound effects timed to the
animation in `ad.html` — no samples or third-party audio, so no copyright claims.

```bash
python3 marketing/reel-src/soundtrack.py /tmp/soundtrack.wav
ffmpeg -i marketing/hassouni-reel-30s.mp4 -i /tmp/soundtrack.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -shortest -movflags +faststart \
  marketing/hassouni-reel-30s-with-sound.mp4
```
If you change animation times in `ad.html`, update the matching times in `soundtrack.py`.
