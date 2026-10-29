#!/usr/bin/env bash
# Mux the silent render with the mastered audio, export the thumbnail, run export QA.
# Run after:  python3 audio/make_audio.py  &&  node render.mjs video
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p deliver

# Remotion's JPEG frames come out as full-range yuvj420p: convert once to standard yuv420p (TV range, BT.709).
ffmpeg -v error -y -i out/video-silent.mp4 -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -profile:v high -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -r 60 -an out/video-tv.mp4

mux() { # $1 audio wav, $2 output
  ffmpeg -v error -y -i out/video-tv.mp4 -i "$1" -map 0:v:0 -map 1:a:0 \
    -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -t 60 -movflags +faststart "$2"
}
mux audio/final_mix.wav deliver/final_ad.mp4
mux audio/final_sfx_only.wav deliver/final_ad_no_music.mp4
node render.mjs thumb 10.8 > /dev/null 2>&1 && cp out/thumbnail.png deliver/thumbnail.png

report=deliver/qa-report.txt
{
  echo "== ffprobe =="
  for f in deliver/final_ad.mp4 deliver/final_ad_no_music.mp4; do
    echo "-- $f"
    ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,sample_rate,channels,bit_rate,duration -show_entries format=duration -of default=nw=1 "$f"
  done
  echo
  echo "== video: CRF / encoder settings =="
  ffprobe -v error -show_entries format_tags=encoder -of default=nw=1 out/video-tv.mp4 || true
  strings out/video-tv.mp4 | grep -o 'crf=[0-9.]*' | head -1 || true
  echo
  echo "== black frames (blackdetect d=0.04 pix_th=0.10) =="
  ffmpeg -v info -i deliver/final_ad.mp4 -vf blackdetect=d=0.04:pix_th=0.10 -an -f null - 2>&1 | grep -E 'black_start' || echo "none"
  echo
  echo "== frozen stretches > 1.5 s (freezedetect n=0.0005) =="
  ffmpeg -v info -i deliver/final_ad.mp4 -vf freezedetect=n=0.0005:d=1.5 -an -f null - 2>&1 | grep -E 'freeze_start|freeze_duration' || echo "none"
  echo
  echo "== decoded frame count =="
  ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1 deliver/final_ad.mp4
  echo
  for f in deliver/final_ad.mp4 deliver/final_ad_no_music.mp4; do
    echo "== loudness: $f (ebur128, true peak) =="
    ffmpeg -nostats -v info -i "$f" -vn -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p'
    echo "-- loudnorm (measurement only)"
    ffmpeg -nostats -v info -i "$f" -vn -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary -f null - 2>&1 | grep -E 'Input (Integrated|True Peak|LRA)'
    echo
  done
} > "$report"
cat "$report"
