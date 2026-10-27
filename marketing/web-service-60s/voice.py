"""
Places the TTS voice-over onto the 60 s timeline, phrase by phrase.

Each phrase is cut from the source at its pauses (found with silencedetect),
time-stretched with rubberband (tempo up, pitch/formants preserved) and laid
at the moment its scene shows the same words. The feature phrases also drive
the on-screen tile timings (written to voice_timing.json for build.py).

    python3 voice.py source.mp3 out_voice.wav
"""
import json
import subprocess
import sys
import wave

import numpy as np

SR = 48000
DUR = 60.0

# (source start, source end, target start on the video, tempo) — source times from silencedetect.
PLAN = [
    # hook
    (0.00, 2.45, 0.15, 1.20),   # زبونك هسه دا يدوّر عليك بكوكل…
    (3.38, 5.10, 2.30, 1.20),   # بس إنت ما عندك موقع؟
    (6.03, 7.85, 3.95, 1.25),   # يعني الزبون راح لغيرك.
    # build
    (8.82, 12.68, 5.50, 1.15),  # إحنا نبنيلك موقع احترافي، حسب طلبك ومن الصفر.
    (13.81, 16.08, 9.70, 1.15),  # تصميم، برمجة، ونشر.
    # sectors (one phrase per card)
    (17.06, 19.12, 11.70, 1.25),  # لكل مشروع موقع يناسبه:
    (19.40, 21.55, 13.42, 1.36),  # عيادتك بحجز مواعيد أونلاين.
    (22.54, 25.13, 15.08, 1.20),  # مطعمك بمنيو كيو آر وطلبات.
    (25.99, 27.68, 17.70, 1.15),  # صالونك بحجز بضغطة.
    (28.57, 31.76, 20.65, 1.20),  # متجرك بسلة، ودفع زين كاش وسوبر كي.
    (32.68, 34.69, 23.70, 1.15),  # شركتك بتعريف احترافي.
    (35.65, 37.48, 26.70, 1.15),  # ومعهدك بتسجيل أونلاين.
]
# features: spoken one after another from FEAT_START with short gaps; each starts its tile
FEATURES = [
    (40.68, 42.07),  # عربي وإنكليزي
    (42.32, 44.37),  # يشتغل على التلفون مثل التطبيق
    (44.68, 46.17),  # لوحة تحكم سهلة
    (46.47, 47.50),  # دفع محلي
    (47.73, 49.10),  # محادثة مباشرة
    (49.30, 50.47),  # حماية عالية
    (50.73, 51.87),  # ويطلع بكوكل
]
FEAT_START, FEAT_TEMPO, FEAT_GAP = 29.95, 1.30, 0.10
PRECISION = (52.75, 54.43, 1.25)  # ودقة بكل تفصيلة — right after the features
PLAN_TAIL = [
    # ready-made store
    (55.35, 56.37, 40.20, 1.15),  # تريده أسرع؟
    (57.25, 64.08, 41.30, 1.05),  # عندنا متجر جاهز مثل متجرنا، يشتغل خلال أيام، ويتعدّل باسمك وألوانك وخدماتك.
    # values (on each slam)
    (65.02, 66.45, 50.15, 1.10),  # أسعار تنافسية.
    (67.39, 68.79, 51.55, 1.10),  # احترافية عالية.
    (69.04, 70.35, 52.88, 1.10),  # دقة بالتنفيذ.
    (71.27, 72.83, 54.15, 1.10),  # ودعم بعد التسليم.
    # call to action
    (73.77, 75.18, 56.30, 1.10),  # للطلب والاستفسار…
    (76.12, 77.25, 57.65, 1.00),  # راسلنا خاص.
]


def cut(src, a, b, tempo):
    """Phrase a..b of src, time-stretched (pitch and formants kept), as float32 mono at 48 kHz."""
    af = (
        f"atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample={SR}:resampler=soxr,"
        f"rubberband=tempo={tempo}:pitch=0.98:formant=preserved:pitchq=quality:transients=smooth:window=long,"
        "afade=t=in:d=0.025,areverse,afade=t=in:d=0.06,areverse"
    )
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", src, "-af", af, "-ac", "1", "-f", "f32le", "-"], check=True, capture_output=True
    ).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def main(src, out):
    n = int(SR * DUR)
    track = np.zeros(n)
    placed = []

    def put(seg, at, label):
        i = int(at * SR)
        j = min(n, i + len(seg))
        track[i:j] += seg[: j - i]
        placed.append((label, round(at, 2), round(at + len(seg) / SR, 2)))
        return at + len(seg) / SR

    for k, (a, b, at, tempo) in enumerate(PLAN):
        put(cut(src, a, b, tempo), at, f"p{k}")

    tiles = []
    t = FEAT_START
    for k, (a, b) in enumerate(FEATURES):
        tiles.append(round(t, 2))
        t = put(cut(src, a, b, FEAT_TEMPO), t, f"feature{k}") + FEAT_GAP
    precision_at = round(t + 0.05, 2)
    put(cut(src, PRECISION[0], PRECISION[1], PRECISION[2]), precision_at, "precision")

    for k, (a, b, at, tempo) in enumerate(PLAN_TAIL):
        put(cut(src, a, b, tempo), at, f"t{k}")

    # overlap check: no two phrases at once
    spans = sorted(placed, key=lambda x: x[1])
    for (l1, s1, e1), (l2, s2, e2) in zip(spans, spans[1:]):
        if s2 < e1 - 0.02:
            print(f"WARNING overlap {l1} ends {e1} > {l2} starts {s2}")
    for p in spans:
        print(p)

    pcm = (np.clip(track, -1, 1) * 32767).astype("<i2")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    json.dump({"tiles": tiles, "precision": precision_at}, open("voice_timing.json", "w"))
    print("tiles", tiles, "precision", precision_at)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
