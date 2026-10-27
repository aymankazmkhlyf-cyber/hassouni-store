#!/usr/bin/env bash
# Mix a recorded voice-over onto the 60 s promo.
#   ./mix_voice.sh voice.m4a [offset_seconds]
# Needs: hassouni-web-service-60s.mp4 (picture) and soundtrack-bed.wav (music without SFX)
# plus soundtrack-sfx.wav (effects only) in this folder.
set -euo pipefail
cd "$(dirname "$0")"
VOICE="$1"
OFFSET="${2:-0.15}"
MS=$(python3 -c "print(int(float('$OFFSET')*1000))")
ffmpeg -hide_banner -y -i hassouni-web-service-60s.mp4 -i soundtrack-bed.wav -i soundtrack-sfx.wav -i "$VOICE" -filter_complex "
  [3:a]aformat=channel_layouts=mono,highpass=f=85,lowpass=f=12000,afftdn=nf=-25,
       equalizer=f=220:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.2:g=3,
       acompressor=threshold=-20dB:ratio=3.5:attack=8:release=120:makeup=6,
       adelay=${MS},apad=whole_dur=60,pan=stereo|c0=c0|c1=c0,asplit=2[vo][vkey];
  [1:a][vkey]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=350[bed];
  [bed][2:a][vo]amix=inputs=3:weights=1 0.8 1.35:normalize=0,
       loudnorm=I=-14:TP=-1.0:LRA=9,atrim=0:60[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart hassouni-web-service-60s-voice.mp4
echo "written hassouni-web-service-60s-voice.mp4"
