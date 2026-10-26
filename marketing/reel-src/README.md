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
