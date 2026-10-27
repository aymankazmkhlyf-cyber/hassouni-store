"""
Original soundtrack + sound design for the 60 s web-service promo.
Everything is synthesized here (no samples, no third-party audio), so the
result is free of copyright claims. Sound effects are placed from the
data-sfx cues in index.html, so they land exactly on the picture.

    python3 compose.py index.html out.wav [--bed bed.wav]

--bed also writes a music-only mix (no SFX) for adding a voice-over later.
"""
import re
import sys
import wave

import numpy as np

SR = 48000
DUR = 60.0
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
N = int(SR * DUR)
rng = np.random.default_rng(2026)

# ------------------------------------------------------------------ helpers
def tt(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a, d, sustain=0.0):
    t = np.arange(n) / SR
    e = sustain + (1 - sustain) * np.exp(-t / max(d, 1e-4))
    k = int(a * SR)
    if k > 0:
        e[:k] *= np.linspace(0, 1, k)
    return e


def onepole(x, cutoff):
    """One-pole lowpass; cutoff may be a scalar or an array (Hz)."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def lp2(x, cutoff):
    return onepole(onepole(x, cutoff), cutoff)


def hp(x, cutoff):
    return x - onepole(x, cutoff)


def bp(x, lo, hi):
    return hp(onepole(x, hi), lo)


def fftconv(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + len(ir) - 1]


def make_ir(sec, decay, seed):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / decay)
    ir = onepole(ir, 6500)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir**2))


IR_L, IR_R = make_ir(2.8, 0.55, 1), make_ir(2.8, 0.55, 2)


def reverb(st, wet):
    l = fftconv(st[:, 0], IR_L)[: len(st)]
    r = fftconv(st[:, 1], IR_R)[: len(st)]
    return st + wet * np.stack([l, r], 1)


def hz(n):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    return 440.0 * 2 ** ((names[n[:-1]] + 12 * (int(n[-1]) - 4)) / 12)


def saw(f, t):
    return 2 * ((t * f) % 1.0) - 1


def stereo(sig, pan=0.0):
    return np.stack([sig * np.sqrt((1 - pan) / 2), sig * np.sqrt((1 + pan) / 2)], 1) * 1.414


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, at, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            sig = stereo(sig, pan)
        i = int(round(at * SR))
        if i >= N:
            return
        s0 = max(0, -i)
        i = max(0, i)
        j = min(N, i + len(sig) - s0)
        self.x[i:j] += sig[s0 : s0 + (j - i)] * gain


# ------------------------------------------------------------------ instruments
def kick(tone=1.0):
    t = tt(0.55)
    f = 42 + 140 * np.exp(-t * 28) * tone
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 1.6) * 0.9


def snare():
    t = tt(0.35)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.5
    noise = hp(rng.standard_normal(len(t)), 1200) * np.exp(-t * 16) * 0.7
    return tone + noise


def clap():
    n = int(0.3 * SR)
    x = hp(rng.standard_normal(n), 1000)
    e = np.zeros(n)
    for off in (0.0, 0.009, 0.019, 0.03):
        k = int(off * SR)
        e[k:] += env(n - k, 0.0008, 0.05 if off < 0.03 else 0.11)
    return bp(x * e, 900, 7000) * 0.55


def hat(open_=False, vel=1.0):
    n = int(SR * (0.22 if open_ else 0.05))
    x = hp(rng.standard_normal(n), 7000)
    return x * env(n, 0.0005, 0.09 if open_ else 0.014) * 0.32 * vel


def sub(freq, sec):
    t = tt(sec)
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    e = np.minimum(1, t / 0.008) * np.minimum(1, (sec - t) / 0.04)
    return np.tanh(x * 1.4) * e * 0.55


def reese(freq, sec):
    t = tt(sec)
    x = saw(freq * 0.997, t) + saw(freq * 1.003, t)
    x = lp2(x, 420)
    e = np.minimum(1, t / 0.01) * np.minimum(1, (sec - t) / 0.05)
    return x * e * 0.35


def pluck(freq, bright=3800, sec=0.28):
    t = tt(sec)
    x = saw(freq, t) * 0.6 + np.sign(np.sin(2 * np.pi * freq * 0.5 * t)) * 0.15
    cut = 400 + bright * np.exp(-t * 18)
    return onepole(x, cut) * env(len(t), 0.002, 0.12) * 0.5


def pad_chord(notes, sec, cutoff=1800):
    t = tt(sec)
    l = np.zeros(len(t))
    r = np.zeros(len(t))
    for n in notes:
        f = hz(n)
        for d in (-0.006, -0.002, 0.003, 0.007):
            l += saw(f * (1 + d), t + rng.random())
            r += saw(f * (1 - d), t + rng.random())
    e = np.minimum(1, t / 0.6) * np.minimum(1, (sec - t) / 0.6)
    l = lp2(l, cutoff) * e
    r = lp2(r, cutoff) * e
    return np.stack([l, r], 1) * 0.045


def bell(freq, sec=1.6):
    t = tt(sec)
    x = np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 6)
    return x * env(len(t), 0.003, 0.5) * 0.22


def noise_sweep(sec, f0, f1, curve=2.0, gain=0.5):
    t = tt(sec)
    k = (t / sec) ** curve
    f = f0 * (f1 / f0) ** k
    x = rng.standard_normal(len(t))
    y = bp(x, f * 0.5, f * 1.6)
    return y * gain


# ------------------------------------------------------------------ sound effects
def fx_whoosh(sec=0.7, up=True):
    t = tt(sec)
    shape = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 1.6
    x = noise_sweep(sec, 300 if up else 4000, 4000 if up else 300, 1.3, 1.0) * shape
    pan = np.linspace(-0.8, 0.8, len(t))
    return np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1) * 1.1


def fx_swish():
    return fx_whoosh(0.35) * 0.7


def fx_boom(sec=2.4, f0=70, f1=28, gain=1.0):
    t = tt(sec)
    f = f1 + (f0 - f1) * np.exp(-t * 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 1.6)
    hit = lp2(rng.standard_normal(len(t)), 1800) * np.exp(-t * 9) * 0.9
    return np.tanh((body + hit) * 1.8) * 0.8 * gain


def fx_impact():
    b = fx_boom(1.8, 110, 38, 0.9)
    t = tt(1.8)
    crack = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 22) * 0.6
    return b + crack


def fx_hit():
    t = tt(0.9)
    return fx_boom(0.9, 140, 55, 0.6) + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 30) * 0.4


def fx_riser(sec=1.0):
    t = tt(sec)
    k = t / sec
    f = 220 * 2 ** (k * 2.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.25
    n = noise_sweep(sec, 400, 9000, 1.6, 0.7)
    return (onepole(tone, 300 + 6000 * k) + n) * k**1.8


def fx_tick(freq=2400):
    t = tt(0.06)
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 90) * 0.35


def fx_blip(freq=1300):
    t = tt(0.12)
    f = freq * (1 + 0.5 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.3


def fx_pop():
    t = tt(0.16)
    f = 300 + 900 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 25) * 0.45


def fx_click():
    t = tt(0.05)
    return (hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 160) + np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 120) * 0.5) * 0.5


def fx_key():
    t = tt(0.045)
    f = 1800 + rng.random() * 1400
    return (hp(rng.standard_normal(len(t)), f) * np.exp(-t * 170) * 0.6 + np.sin(2 * np.pi * 420 * t) * np.exp(-t * 120) * 0.25) * 0.55


def fx_success():
    a, b = bell(hz("E6"), 0.9), bell(hz("B6"), 1.1)
    out = np.zeros(len(b) + int(0.09 * SR))
    out[: len(a)] += a
    out[int(0.09 * SR) :] += b
    return out * 1.2


def fx_shimmer():
    out = np.zeros(int(2.4 * SR))
    for i, n in enumerate(["A5", "C6", "E6", "A6", "C7", "E7"]):
        s = bell(hz(n), 1.6) * 0.8
        k = int(i * 0.07 * SR)
        out[k : k + len(s)] += s[: len(out) - k]
    return out


def fx_glitch(music, at, sec=0.45):
    """Stutter: repeats tiny slices of the music bus + bitcrushed buzz."""
    i = int(at * SR)
    slice_len = int(0.045 * SR)
    src = music[max(0, i - slice_len * 2) : i].copy()
    if len(src) < slice_len:
        src = np.zeros((slice_len, 2))
    out = np.zeros((int(sec * SR), 2))
    k = 0
    while k < len(out):
        L = int(slice_len * (0.4 + rng.random()))
        seg = src[:L] if L <= len(src) else src
        e = min(len(seg), len(out) - k)
        out[k : k + e] += seg[:e] * (0.6 + rng.random() * 0.6)
        k += L
    t = tt(sec)
    buzz = np.sign(np.sin(2 * np.pi * (180 + 900 * rng.random()) * t)) * 0.18
    buzz = np.round(buzz * 6) / 6 * (rng.random(len(t)) > 0.35)
    return out * 1.3 + stereo(buzz * np.exp(-t * 3)) * 0.8


# ------------------------------------------------------------------ arrangement
CHORDS = [  # (bass note, pad notes, arp notes)
    ("A1", ["A3", "C4", "E4"], ["A4", "C5", "E5", "A5"]),
    ("F1", ["F3", "A3", "C4"], ["F4", "A4", "C5", "F5"]),
    ("C2", ["C4", "E4", "G4"], ["C5", "E5", "G5", "C6"]),
    ("G1", ["G3", "B3", "D4"], ["G4", "B4", "D5", "G5"]),
]


def chord_at(t):
    return CHORDS[int(t // BAR) % 4]


def compose(cues):
    music, drums, sfx = Bus(), Bus(), Bus()
    kicks = []

    # --- intro tension 0–5: drone, ticking clock, heartbeat sub
    music.add(pad_chord(["A2", "E3", "A3"], 5.4, cutoff=700) * 1.4, 0.0)
    for k in range(10):
        drums.add(fx_tick(1800 if k % 2 else 2600) * 0.9, 0.5 + k * 0.5)
    for k in (1.0, 2.0, 3.0):
        drums.add(kick(0.5) * 0.5, k)
        drums.add(kick(0.5) * 0.35, k + 0.22)

    # --- grooves
    def groove(a, b, half=False, bright=3600, bells=False, arp_gain=1.0):
        t = a
        while t < b - 1e-6:
            beat = int(round((t - 6.0) / BEAT))
            bass, padn, arp = chord_at(t - 6.0)
            in_bar = beat % 4
            if not half or in_bar in (0, 2):
                drums.add(kick(), t, 0.95)
                kicks.append(t)
            if (not half and in_bar in (1, 3)) or (half and in_bar == 2):
                drums.add(clap() if not half else snare() * 0.9, t, 0.9)
            for s in range(4):  # 16th hats
                ht = t + s * BEAT / 4
                if ht < b:
                    vel = 1.0 if s == 2 else 0.55
                    drums.add(hat(open_=(s == 2 and not half), vel=vel), ht, 0.9 if not half else 0.6, pan=0.25)
            # bass on 8ths, sub + reese
            for s in range(2):
                bt = t + s * BEAT / 2
                if bt < b:
                    music.add(sub(hz(bass), BEAT / 2 * 0.95), bt, 0.9)
                    music.add(reese(hz(bass) * 2, BEAT / 2 * 0.9), bt, 0.55 if not half else 0.35)
            # arp 16ths, ping-pong
            for s in range(4):
                at_ = t + s * BEAT / 4
                if at_ < b:
                    n = arp[(beat * 4 + s) % 4]
                    music.add(pluck(hz(n), bright) * arp_gain, at_, 0.8, pan=-0.45 if s % 2 else 0.45)
                    music.add(pluck(hz(n), bright * 0.6) * arp_gain * 0.35, at_ + BEAT * 0.75, 0.8, pan=0.45 if s % 2 else -0.45)
            if in_bar == 0:
                music.add(pad_chord(padn, BAR + 0.6, cutoff=2200 if not half else 1300), t - 0.1, 1.0)
                if bells:
                    for j, n in enumerate([arp[3], arp[2], arp[1], arp[2]]):
                        music.add(bell(hz(n)), t + j * BEAT, 0.9, pan=0.2)
            t += BEAT

    groove(6.0, 29.55, bright=3600)
    groove(29.55, 39.65, bright=5200, bells=True)
    groove(40.15, 48.4, half=True, bright=2400, arp_gain=0.7)
    # snare roll 48.4 -> 49.9, accelerating
    t = 48.4
    gap = 0.25
    while t < 49.9:
        drums.add(snare() * (0.35 + 0.65 * (t - 48.4) / 1.5), t, 0.85)
        t += gap
        gap = max(0.045, gap * 0.86)
    music.add(pad_chord(["G3", "B3", "D4"], 1.7, cutoff=2600), 48.4, 1.0)
    groove(50.0, 55.2, bright=4600, bells=True)
    # outro
    music.add(pad_chord(["A3", "C4", "E4", "A4"], 4.8, cutoff=2400) * 1.3, 55.2)
    music.add(sub(hz("A1"), 4.5), 55.25, 0.8)
    for k in range(8):
        drums.add(hat(vel=0.5), 55.5 + k * BEAT / 2, 0.6, pan=0.3)

    # --- sidechain pump on music (ducks under every kick)
    pump = np.ones(N)
    for k in kicks:
        i = int(k * SR)
        n = int(0.32 * SR)
        j = min(N, i + n)
        pump[i:j] = np.minimum(pump[i:j], 1 - 0.55 * np.exp(-np.arange(j - i) / SR / 0.09))
    music.x *= pump[:, None]

    # --- tape stop on the music+drums 39.65–40.15
    mix_md = music.x + drums.x
    a, b = int(39.65 * SR), int(40.15 * SR)
    seg_len = b - a
    rate = np.linspace(1.0, 0.05, seg_len)
    pos = a + np.cumsum(rate)
    pos = np.clip(pos, 0, N - 2)
    i0 = pos.astype(int)
    frac = (pos - i0)[:, None]
    stopped = mix_md[i0] * (1 - frac) + mix_md[i0 + 1] * frac
    stopped *= np.linspace(1, 0, seg_len)[:, None] ** 0.6
    mix_md[a:b] = stopped

    # --- sound effects from the picture's cues
    SFX = {
        "boom": lambda: fx_boom(3.0, 80, 26, 1.0),
        "boomtail": lambda: fx_boom(1.6, 90, 30, 0.85),
        "impact": fx_impact,
        "drop": fx_impact,
        "hit": fx_hit,
        "hitlow": lambda: fx_boom(1.4, 90, 34, 0.7),
        "whoosh": lambda: fx_whoosh(0.75),
        "zoomwhoosh": lambda: fx_whoosh(0.5) * 1.2,
        "swoosh": lambda: fx_whoosh(0.55) * 0.8,
        "swish": fx_swish,
        "riser": lambda: fx_riser(0.95),
        "tick": lambda: fx_tick(2200 + rng.random() * 900),
        "blip": lambda: fx_blip(1100 + rng.random() * 700),
        "pop": fx_pop,
        "click": fx_click,
        "success": fx_success,
        "shimmer": fx_shimmer,
        "snareroll": lambda: noise_sweep(1.5, 500, 8000, 1.5, 0.35) * np.linspace(0, 1, int(1.5 * SR)) ** 2,
        "tapestop": lambda: noise_sweep(0.5, 3000, 120, 1.0, 0.25),
    }
    GAIN = {"boom": 1.0, "impact": 0.95, "drop": 1.0, "hit": 0.75, "hitlow": 0.8, "boomtail": 0.9, "whoosh": 0.55, "zoomwhoosh": 0.6,
            "swoosh": 0.5, "swish": 0.45, "riser": 0.7, "tick": 0.5, "blip": 0.5, "pop": 0.55, "click": 0.8, "success": 0.6, "shimmer": 0.6,
            "snareroll": 0.8, "tapestop": 0.6, "glitch": 0.9, "type": 1.0}
    # whooshes and risers are placed so they PEAK on the cue, not start there
    LEAD = {"whoosh": 0.38, "zoomwhoosh": 0.25, "swoosh": 0.2, "swish": 0.12, "riser": 0.95}
    for c in cues:
        kind, t = c["sfx"], c["t"]
        if kind == "type":
            for k in range(22):
                sfx.add(fx_key(), t + k * (1.3 / 22) + rng.random() * 0.012, 0.9, pan=rng.random() * 0.4 - 0.2)
            continue
        if kind == "glitch":
            sfx.add(fx_glitch(mix_md, t), t, GAIN["glitch"])
            # duck music under the glitch
            i, j = int(t * SR), int((t + 0.45) * SR)
            mix_md[i:j] *= 0.25
            continue
        sig = SFX[kind]()
        sfx.add(sig, max(0.0, t - LEAD.get(kind, 0.0)), GAIN[kind], pan=(rng.random() - 0.5) * 0.3 if sig.ndim == 1 else 0)
    # music ducks a little under big hits for punch
    for c in cues:
        if c["sfx"] in ("boom", "impact", "drop", "boomtail"):
            i = int(c["t"] * SR)
            n = int(0.5 * SR)
            j = min(N, i + n)
            mix_md[i:j] *= (1 - 0.5 * np.exp(-np.arange(j - i) / SR / 0.15))[:, None]

    return mix_md, sfx.x


def finish(x, wet=0.16, peak=None):
    """Reverb, rumble filter, fades and a gentle soft clip. Stems pass the full mix's
    peak so they keep the same levels relative to each other."""
    x = reverb(x, wet)
    x = np.stack([hp(x[:, 0], 28), hp(x[:, 1], 28)], 1)
    fade_in = np.minimum(1, np.arange(N) / (0.02 * SR))
    fade_out = np.clip((DUR - np.arange(N) / SR) / 0.45, 0, 1)
    x *= (fade_in * fade_out)[:, None]
    p = peak or np.max(np.abs(x))
    x = np.tanh(x / p * 1.1) / np.tanh(1.1)
    return x * 0.95, p


def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_cues(html):
    cues = []
    for m in re.finditer(r"<[^>]*data-sfx=\"([a-z]+)\"[^>]*>", html):
        tag = m.group(0)
        t = re.search(r'data-t="([\d.]+)"', tag)
        if t:
            cues.append({"sfx": m.group(1), "t": float(t.group(1))})
    return sorted(cues, key=lambda c: c["t"])


if __name__ == "__main__":
    html = open(sys.argv[1]).read()
    cues = read_cues(html)
    print(f"{len(cues)} sound cues")
    md, fx = compose(cues)
    full, peak = finish(md + fx * 0.85)
    write(sys.argv[2], full)
    # Stems for adding a voice-over later: same scale as the full mix.
    if "--bed" in sys.argv:
        write(sys.argv[sys.argv.index("--bed") + 1], finish(md, peak=peak)[0])
    if "--sfx" in sys.argv:
        write(sys.argv[sys.argv.index("--sfx") + 1], finish(fx * 0.85, wet=0.12, peak=peak)[0])
    print("written")
