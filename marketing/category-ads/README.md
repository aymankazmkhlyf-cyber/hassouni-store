# Category ads (15 s, 1080×1920)

One ad per TikTok-safe section: `gaming.html`, `subscriptions.html`, `design.html`
(followers/likes/numbers/exchange are excluded — TikTok rejects ads for them).

Shared motion engine: `engine.css` + `engine.js` (deterministic `window.render(t)`).
`compose_audio.py` synthesizes original music per style and derives every sound effect
from the `data-in` / `data-anim` attributes in the HTML, so audio always matches the picture.

```bash
cd marketing/category-ads
cp ../../node_modules/@fontsource-variable/cairo/files/cairo-{arabic,latin}-wght-normal.woff2 .
f=gaming   # or subscriptions / design
sed 's|__URL__|your-site.netlify.app|' $f.html > $f-build.html
node render.mjs "$PWD" $f-build.html /tmp/$f
python3 compose_audio.py $f.html $f /tmp/$f.wav
ffmpeg -framerate 30 -i /tmp/$f/f%04d.jpg -i /tmp/$f.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -shortest -movflags +faststart ../hassouni-ad-$f-15s.mp4
```
