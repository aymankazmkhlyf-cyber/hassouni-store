"""Premiere-ready project folder.

premiere_project/
  clips/<NN>_<scene>.mov   one ProRes 422 HQ clip per scene, cut frame-exactly from the Video A master
  audio/score.wav, sfx.wav, impacts.wav   48 kHz 24-bit stems (written by audio/make_audio.py)
  HS_ad_timeline.xml       FCP7 xmeml: 60 fps 1080×1920 sequence, clips + stems on their tracks, colour labels, markers
  README.md

Usage: python3 tools/make_premiere.py out/videoA_master.mov
"""
import json
import os
import subprocess
import sys
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
FPS = 60
OUT = os.path.join(ROOT, 'premiere_project')
LABELS = {'hook': 'Cerulean', 'hook2': 'Lavender', 'turn': 'Purple', 'reveal': 'Mango', 'loop': 'Cerulean', 'offer': 'Mango', 'cta': 'Rose'}


def fr(sec):
    return int(round(sec * FPS))


def make_clips(master):
    os.makedirs(os.path.join(OUT, 'clips'), exist_ok=True)
    items = []
    for i, s in enumerate(TL['scenes']):
        a, b = fr(s['start']), fr(s['end'])
        name = f"{i + 1:02d}_{s['id']}.mov"
        path = os.path.join(OUT, 'clips', name)
        if not os.path.exists(path):
            subprocess.run(
                ['ffmpeg', '-v', 'error', '-y', '-i', master, '-vf', f'select=between(n\\,{a}\\,{b - 1}),setpts=N/{FPS}/TB', '-frames:v', str(b - a), '-r', str(FPS),
                 '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0', '-an', path],
                check=True,
            )
        items.append({'id': s['id'], 'name': s['name'], 'file': name, 'start': a, 'end': b})
    return items


def file_el(fid, name, rel, dur, kind):
    media = (
        f'<media><video><samplecharacteristics><rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><width>1080</width><height>1920</height></samplecharacteristics></video></media>'
        if kind == 'video'
        else '<media><audio><samplecharacteristics><depth>24</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>2</channelcount></audio></media>'
    )
    return f'<file id="{fid}"><name>{escape(name)}</name><pathurl>{escape(rel)}</pathurl><rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><duration>{dur}</duration>{media}</file>'


def make_xml(items):
    total = fr(TL['duration'])
    v = []
    for i, it in enumerate(items):
        d = it['end'] - it['start']
        label = LABELS.get(it['id'], 'Iris' if it['id'].startswith('f') and int(it['id'][1]) % 2 else 'Caribbean')
        v.append(
            f'<clipitem id="clipitem-v{i + 1}"><name>{escape(it["name"])}</name><enabled>TRUE</enabled><duration>{d}</duration>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><start>{it["start"]}</start><end>{it["end"]}</end><in>0</in><out>{d}</out>'
            + file_el(f'file-v{i + 1}', it['file'], f'clips/{it["file"]}', d, 'video')
            + f'<labels><label2>{label}</label2></labels></clipitem>'
        )
    audio_tracks = []
    for j, (stem, label) in enumerate([('score', 'Forest'), ('sfx', 'Teal'), ('impacts', 'Tan')]):
        audio_tracks.append(
            f'<track><clipitem id="clipitem-a{j + 1}"><name>{stem}.wav</name><enabled>TRUE</enabled><duration>{total}</duration>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>{total}</end><in>0</in><out>{total}</out>'
            + file_el(f'file-a{j + 1}', f'{stem}.wav', f'audio/{stem}.wav', total, 'audio')
            + f'<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack><labels><label2>{label}</label2></labels></clipitem></track>'
        )
    markers = ''.join(f'<marker><name>{n}</name><comment></comment><in>{fr(t)}</in><out>-1</out></marker>' for n, t in [('HOOK', 0.0), ('REVEAL', 7.0), ('CTA', 55.0)])
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="sequence-1">'
        f'<name>HS_Business_Ad</name><duration>{total}</duration><rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
        '<timecode><rate><timebase>60</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>'
        + markers
        + '<media><video><format><samplecharacteristics><rate><timebase>60</timebase><ntsc>FALSE</ntsc></rate><width>1080</width><height>1920</height>'
        '<pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>'
        + '<track>' + ''.join(v) + '</track></video>'
        + '<audio><format><samplecharacteristics><depth>24</depth><samplerate>48000</samplerate></samplecharacteristics></format>' + ''.join(audio_tracks) + '</audio>'
        '</media></sequence></xmeml>\n'
    )
    open(os.path.join(OUT, 'HS_ad_timeline.xml'), 'w', encoding='utf-8').write(xml)


README = """# HS ad: Premiere project

1. Open Premiere Pro → **File → Import** → select `HS_ad_timeline.xml`.
2. A sequence **HS_Business_Ad** (1080 × 1920, 60 fps) appears with:
   - V1: the 14 scene clips (`clips/`, ProRes 422 HQ), colour-labelled, back to back;
   - A1 `score.wav`, A2 `sfx.wav` (incl. whooshes), A3 `impacts.wav` (48 kHz, 24-bit);
   - markers HOOK (0.0 s), REVEAL (7.0 s), CTA (55.0 s).
3. If Premiere asks to locate media, point it at this folder once; the other files relink automatically.

The stems sum to the final mix before mastering; the master in `final_ad.mp4` adds a −1.3 dBTP limiter at −14 LUFS.
"""


if __name__ == '__main__':
    master = sys.argv[1]
    items = make_clips(master)
    make_xml(items)
    open(os.path.join(OUT, 'README.md'), 'w').write(README)
    print(f'{len(items)} clips, XML written')
