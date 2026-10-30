#!/usr/bin/env bash
# Split-screen version: editing timeline (Remotion, HSClinicSplit) on top + the finished ad composited into its slot.
# Run after:  ./finish.sh  &&  COMP=HSClinicSplit node render.mjs video
set -euo pipefail
cd "$(dirname "$0")"
# Rounded-corner mask for the slot, cut from a still of the panel (slot: x 227, y 700, 626×777, radius 28).
COMP=HSClinicSplit node render.mjs stills 30 > /dev/null 2>&1
python3 - <<'PY'
from PIL import Image, ImageDraw
X, Y, W, H, R = 227, 700, 626, 777, 28
crop = Image.open('out/stills/30.00-split.png').convert('RGBA').crop((X, Y, X + W, Y + H))
S = 4
m = Image.new('L', (W * S, H * S), 255)
ImageDraw.Draw(m).rounded_rectangle((0, 0, W * S - 1, H * S - 1), R * S, fill=0)
crop.putalpha(m.resize((W, H), Image.LANCZOS))
crop.save('out/slot-mask.png')
PY
ffmpeg -v error -y -i out/video-silent-split.mp4 -i deliver/final_ad.mp4 -i out/slot-mask.png -i audio/final_mix.wav \
  -filter_complex "[0:v]scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p[p];[1:v]crop=1080:1340:0:200,scale=626:777:flags=lanczos[ad];[p][ad]overlay=227:700[b];[b][2:v]overlay=227:700,format=yuv420p[v]" \
  -map "[v]" -map 3:a -c:v libx264 -preset slow -crf 14 -profile:v high -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -r 60 \
  -c:a aac -b:a 320k -ar 48000 -ac 2 -t 60 -movflags +faststart deliver/final_ad_split.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,sample_rate -show_entries format=duration -of default=nw=1 deliver/final_ad_split.mp4
ffmpeg -nostats -v info -i deliver/final_ad_split.mp4 -vn -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|Peak):'
