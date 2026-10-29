"""Procedural sound design for the HS clinic ad (no downloaded audio).

Writes 48 kHz stereo WAVs into audio/:
  music.wav, sfx.wav       stems (before mastering)
  final_mix.wav            music (ducked under SFX) + SFX, mastered to -14 LUFS / <= -1 dBTP
  final_sfx_only.wav       the same SFX at the same gain, without music

Every SFX time comes from src/timeline.json, the file the video uses.
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'src', 'timeline.json')))
SR = 48000
DUR = float(TL['duration'])
N = int(SR * DUR)
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def hz(note):
    """MIDI note number → Hz."""
    return 440.0 * 2 ** ((note - 69) / 12)


def fades(x, fin=0.005, fout=0.010):
    """5 ms fade-in / 10 ms fade-out on every SFX so nothing starts or stops with a click."""
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    a, b = min(a, len(x) // 2), min(b, len(x) // 2)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def lp(x, fc, order=2):
    sos = signal.butter(order, fc, 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def pan_gains(pan):
    """Constant-power pan, kept gentle (|pan| ≤ 0.6) so the mix stays mono-compatible."""
    pan = np.clip(pan, -0.6, 0.6)
    ang = (pan + 1) * np.pi / 4
    return np.cos(ang), np.sin(ang)


def place(bus, x, at, gain=1.0, pan=0.0):
    """Add mono `x` (or (n, 2) stereo) to the stereo bus at `at` seconds."""
    i = int(round(at * SR))
    if i >= N:
        return
    x = x[: N - i]
    if x.ndim == 1:
        if np.isscalar(pan):
            gl, gr = pan_gains(pan)
        else:
            gl, gr = pan_gains(np.asarray(pan)[: len(x)])
        bus[i : i + len(x), 0] += x * gl * gain
        bus[i : i + len(x), 1] += x * gr * gain
    else:
        bus[i : i + len(x)] += x * gain


def reverb_ir(sec=3.2, decay=3.2, seed=1):
    r = np.random.default_rng(seed)
    t = t_axis(sec)
    env = np.exp(-t * decay)
    ir = np.stack([r.standard_normal(len(t)) * env, r.standard_normal(len(t)) * env], axis=1)
    ir = np.stack([lp(ir[:, 0], 6000), lp(ir[:, 1], 6000)], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


def reverb(x_st, ir, wet):
    out = np.zeros((len(x_st) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x_st[:, c], ir[:, c])
    out = out[: len(x_st)]
    return x_st * (1 - wet) + out * wet


# ───────────────────────────── music bed (~84 BPM, A minor → C major at 7.0 s)
BEAT = 60 / 84
BAR = BEAT * 4


def pad_voice(freq, sec, detune_cents=5):
    t = t_axis(sec)
    v = np.zeros_like(t)
    for d in (-detune_cents, detune_cents):
        f = freq * 2 ** (d / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        v += np.sin(2 * np.pi * f * t + ph)
        v += 0.35 * signal.sawtooth(2 * np.pi * f * t + ph, 0.5)  # triangle layer
    return v / 2.7


def chord_pad(notes, sec, attack=1.5, release=1.6):
    x = sum(pad_voice(hz(n), sec + release) for n in notes) / len(notes)
    t = t_axis(sec + release)
    env = np.minimum(1, t / attack) * np.where(t > sec, np.exp(-(t - sec) * 3 / release), 1)
    return x * env


def pluck(freq, sec=1.6, decay=0.8):
    t = t_axis(sec)
    env = np.exp(-t / (decay / 4.6)) * np.minimum(1, t / 0.004)
    x = np.sin(2 * np.pi * freq * t) + 0.28 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 6) + 0.08 * np.sin(6 * np.pi * freq * t) * np.exp(-t * 9)
    return fades(x * env)


def build_music():
    pad = np.zeros((N, 2))
    pad_dark = np.zeros((N, 2))
    keys = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    lift = np.zeros((N, 2))

    # 0–7 s: A minor, dark and thin (pad only).
    am = [45, 52, 57, 60]  # A2 E3 A3 C4
    place(pad_dark, chord_pad(am, 7.3, attack=1.5, release=0.9), 0.0, 1.0)

    # From 7 s: C major, then a calm loop C – G/B – Am – F; the last bar resolves on C.
    prog = [
        [48, 55, 60, 64],  # C
        [47, 55, 59, 62],  # G/B
        [45, 52, 57, 60],  # Am
        [41, 48, 57, 60],  # F
    ]
    start = 7.0
    bars = []
    t0 = start
    k = 0
    while t0 < 56.0:
        bars.append((t0, prog[k % 4]))
        t0 += BAR
        k += 1
    final_at = bars[-1][0] + BAR if bars[-1][0] + BAR < 57.5 else bars[-1][0]
    if final_at != bars[-1][0]:
        bars.append((final_at, prog[0]))
    else:
        bars[-1] = (final_at, prog[0])
    for i, (b0, notes) in enumerate(bars):
        last = i == len(bars) - 1
        length = (DUR - b0 - 0.1) if last else BAR + 0.15
        place(pad, chord_pad(notes, length, attack=1.0 if i else 0.25, release=1.5), b0, 1.0)
        place(bass, lp(chord_pad([notes[0]], length, attack=0.4, release=1.2), 400), b0, 0.18)
        # soft piano: one note on beats 1 and 3, chord tones an octave up
        for j, beat in enumerate((0, 2)):
            if b0 + beat * BEAT < 57.6:
                n = notes[(j * 2 + i) % 4] + 12
                place(keys, pluck(hz(n), decay=0.8), b0 + beat * BEAT, 0.3, pan=0.25 if j else -0.25)
        if b0 >= 51.0 - 0.01 or (b0 + BAR > 51.0):
            # 51–60 s: gentle lift — a higher octave layer
            place(lift, chord_pad([n + 12 for n in notes[1:]], length, attack=1.4, release=1.5), max(b0, 51.0), 0.45)

    # One soft pluck per scene change (from the relief moment on).
    scene_notes = {7.0: 72, 12.0: 76, 18.0: 79, 24.0: 76, 29.0: 72, 35.0: 74, 41.0: 79, 45.0: 76, 51.0: 79, 56.0: 84}
    for at in TL['sceneChanges']:
        place(keys, pluck(hz(scene_notes[at]), decay=0.8), at, 0.5, pan=0.0)

    # Filters: dark (1.2 kHz) before 7 s, opens to 2.5 kHz at the relief moment.
    for c in range(2):
        pad_dark[:, c] = lp(pad_dark[:, c], 1200)
        pad[:, c] = lp(pad[:, c], 2500)
        lift[:, c] = lp(lift[:, c], 3500)
    for c in range(2):
        pad_dark[:, c] = hp(pad_dark[:, c], 90)
        pad[:, c] = hp(pad[:, c], 110)
    music = pad_dark * 0.9 + pad * 0.7 + bass + keys + lift * 0.6
    for c in range(2):
        music[:, c] = hp(music[:, c], 38)
    # slight stereo width on the pad via a short decorrelation delay (mono-safe: 9 ms, low level)
    d = int(0.009 * SR)
    music[d:, 1] += 0.12 * (pad[:-d, 0])
    music = reverb(music, reverb_ir(3.4, 2.6, seed=3), 0.38)
    # 0–7 s should feel thinner: keep that part a little lower
    t = np.arange(N) / SR
    shape = np.interp(t, [0, 6.6, 7.2, DUR], [0.7, 0.75, 1.0, 1.0])
    return music * shape[:, None]


# ───────────────────────────── SFX
def heartbeat():
    t = t_axis(0.5)
    def thump(delay, amp):
        tt = np.clip(t - delay, 0, None)
        env = np.where(t >= delay, np.exp(-tt * 28) * np.minimum(1, tt / 0.004), 0)
        return amp * np.sin(2 * np.pi * 55 * tt * (1 + 0.4 * np.exp(-tt * 40))) * env
    return fades(lp(thump(0, 1.0) + thump(0.07, 0.75), 400))


def phone_ring():
    sec = 1.15
    t = t_axis(sec)
    tone = np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)
    gate = ((t < 0.4) | ((t > 0.65) & (t < 1.05))).astype(float)
    gate = signal.lfilter([1 - 0.995], [1, -0.995], gate)  # smooth on/off
    return fades(lp(tone * gate * 0.5, 1500, 4))


def busy_blip():
    t = t_axis(0.15)
    x = np.sin(2 * np.pi * 480 * t) + np.sin(2 * np.pi * 620 * t)
    return fades(lp(x * 0.5, 2000), 0.005, 0.03)


def clock_spin(a, b):
    sec = b - a
    out = np.zeros(int(sec * SR) + SR // 10)
    # ticks accelerate: interval from 140 ms to 28 ms
    pos = 0.0
    while pos < sec:
        p = pos / sec
        interval = 0.14 * (1 - p) ** 1.6 + 0.028
        click = hp(rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / SR * 500), 2500)
        i = int(pos * SR)
        out[i : i + len(click)] += click * (0.5 + 0.5 * p)
        pos += interval
    return fades(bp(out, 1800, 7000))


def riser(sec):
    t = t_axis(sec)
    n = rng.standard_normal(len(t))
    # high-pass sweeping upward: blend progressively higher bands
    out = np.zeros_like(n)
    bands = [(300, 1200), (800, 3000), (2000, 7000), (4000, 12000)]
    for k, (lo, hi) in enumerate(bands):
        w = np.clip(t / sec * len(bands) - k + 0.5, 0, 1) * np.clip(len(bands) - t / sec * len(bands) + k + 0.5, 0, 1)
        out += bp(n, lo, hi) * w
    env = (t / sec) ** 2.2
    return fades(out * env, 0.05, 0.02)


def bloom():
    t = t_axis(2.2)
    sub = np.sin(2 * np.pi * 45 * t) * np.minimum(1, t / 0.08) * np.exp(-t * 1.8)
    air = bp(rng.standard_normal(len(t)), 5000, 7200) * np.minimum(1, t / 0.15) * np.exp(-t * 1.6)
    return fades(sub * 0.9 + air * 0.6)


def bell(freqs, sec=1.6, decay=1.2):
    t = t_axis(sec)
    x = np.zeros_like(t)
    for k, f in enumerate(freqs):
        x += (0.8 ** k) * np.sin(2 * np.pi * f * t) * np.exp(-t / (decay / 4.6))
        x += 0.15 * (0.8 ** k) * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (decay / 9))
    return fades(x * np.minimum(1, t / 0.003))


def glass_tap():
    t = t_axis(0.09)
    tone = np.sin(2 * np.pi * 2400 * t) * np.exp(-t / (0.04 / 4.6))
    tr = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 900) * 0.4
    return fades(tone + tr, 0.001, 0.01)


def whoosh(sec=0.35):
    t = t_axis(sec)
    n = rng.standard_normal(len(t))
    env = np.sin(np.pi * t / sec) ** 2
    x = lp(bp(n, 500, 4500), 3500) * env
    return fades(x), np.linspace(0.6, -0.6, len(t))  # pan R → L


def marimba(freq):
    t = t_axis(0.3)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / (0.15 / 4.6)) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 80)
    return fades(x)


def chime():
    a = bell([hz(84)], 1.4, 1.0)  # C6
    b = bell([hz(91)], 1.6, 1.2)  # G6
    out = np.zeros(int(1.9 * SR))
    out[: len(a)] += a
    i = int(0.16 * SR)
    out[i : i + len(b)] += b
    return out


def soft_click(bright=False):
    t = t_axis(0.03)
    x = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 400)
    x += (np.sin(2 * np.pi * (1800 if bright else 1100) * t) * np.exp(-t * 150)) * (1.4 if bright else 0.7)
    return fades(lp(x, 6000 if bright else 3500), 0.001, 0.01)


def full_tone():
    t = t_axis(0.9)
    def tone(f, d):
        tt = np.clip(t - d, 0, None)
        return np.where(t >= d, np.sin(2 * np.pi * f * tt) * np.minimum(1, tt / 0.01) * np.exp(-tt * 5), 0)
    return fades(tone(hz(57), 0) + tone(hz(57), 0.2) * 0.8 + tone(hz(64), 0.2) * 0.4)


def bubble_pop():
    sec = 0.06
    t = t_axis(sec)
    f = 400 + (900 - 400) * t / sec
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fades(np.sin(ph) * np.sin(np.pi * t / sec), 0.003, 0.01)


def typing(sec):
    out = np.zeros(int(sec * SR))
    pos = 0.02
    while pos < sec - 0.03:
        c = lp(hp(rng.standard_normal(int(0.008 * SR)), 2000), 6000) * np.exp(-np.arange(int(0.008 * SR)) / SR * 700)
        i = int(pos * SR)
        out[i : i + len(c)] += c * rng.uniform(0.5, 1.0)
        pos += rng.uniform(0.06, 0.15)
    return fades(out)


def handoff_swoosh():
    sec = 0.5
    t = t_axis(sec)
    rev = bp(rng.standard_normal(len(t)), 600, 5000) * (t / sec) ** 3  # reverse swell
    out = np.zeros(int(2.4 * SR))
    out[: len(rev)] += fades(rev)
    p = pluck(hz(79), decay=0.8)
    out[len(rev) - 200 : len(rev) - 200 + len(p)] += p * 0.8
    return out


def bloop():
    sec = 0.22
    t = t_axis(sec)
    f = 180 + 140 * np.exp(-t * 25)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fades(np.sin(ph) * np.exp(-t * 18) * np.minimum(1, t / 0.005))


def glide(sec):
    t = t_axis(sec)
    f = hz(64) * 2 ** (t / sec * 7 / 12)  # E4 rising a fifth
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * t / sec) ** 1.5
    return fades((np.sin(ph) + 0.3 * np.sin(2 * ph)) * env)


def sub_tap():
    t = t_axis(0.25)
    return fades(np.sin(2 * np.pi * 60 * t) * np.exp(-t * 16) * np.minimum(1, t / 0.005))


def build_sfx():
    sfx = np.zeros((N, 2))
    for b in TL['heartbeat']:
        place(sfx, heartbeat(), b, 0.9)
    place(sfx, phone_ring(), TL['ring'][0], 0.16, pan=0.1)
    for b in TL['busy']:
        place(sfx, busy_blip(), b, 0.14)
    a, b = TL['clockSpin']
    place(sfx, clock_spin(a, b), a, 0.28)
    r0, r1 = TL['riser']
    place(sfx, riser(r1 - r0), r0, 0.22)
    place(sfx, bloom(), TL['bloom'], 0.6)
    for s in TL['shimmer']:
        place(sfx, bell([1318.5, 1975.5], 1.6, 1.2), s, 0.12)
    for at in TL['taps']:
        place(sfx, glass_tap(), at, 0.22)
    for at in TL['whoosh']:
        w, panc = whoosh()
        place(sfx, w, at - 0.2, 0.2, pan=panc)
    for k, at in enumerate(TL['days']):
        place(sfx, marimba(880 * 2 ** (k * 2 / 12)), at, 0.16)
    place(sfx, chime(), TL['chime'], 0.16)
    for k, at in enumerate(TL['counter']):
        place(sfx, soft_click(bright=k == len(TL['counter']) - 1), at, 0.22)
    place(sfx, full_tone(), TL['full'], 0.2)
    for at in TL['bubbles']:
        place(sfx, bubble_pop(), at, 0.2)
    for a, b in TL['typing']:
        place(sfx, typing(b - a), a, 0.09)
    place(sfx, handoff_swoosh(), TL['handoff'] - 0.48, 0.22, pan=0.0)
    for at in TL['callPulse']:
        place(sfx, bloop(), at, 0.32)
    for at in TL['dashboard']:
        place(sfx, soft_click(), at, 0.16, pan=0.0)
    g0, g1 = TL['graph']
    place(sfx, glide(g1 - g0), g0, 0.08)
    for at in TL['ctaPulse']:
        place(sfx, sub_tap(), at, 0.5)
    sfx = reverb(sfx, reverb_ir(1.2, 5.0, seed=11), 0.14)
    return sfx


# ───────────────────────────── mix & master
def sidechain(music, sfx, depth_db=3.0):
    lvl = np.abs(sfx).max(axis=1)
    att = 1 - np.exp(-1 / (0.010 * SR))
    rel = 1 - np.exp(-1 / (0.250 * SR))
    env = np.zeros_like(lvl)
    e = 0.0
    for i, v in enumerate(lvl):  # simple peak follower
        e += (att if v > e else rel) * (v - e)
        env[i] = e
    norm = np.clip(env / (np.percentile(env[env > 1e-4], 90) if np.any(env > 1e-4) else 1), 0, 1)
    gain = 10 ** (-depth_db * norm / 20)
    return music * gain[:, None]


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def limiter(x, ceiling_db=-1.3, look=0.004, release=0.08):
    """Look-ahead peak limiter on 4× oversampled peaks."""
    ceil = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(axis=1)
    peaks = up.reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1, ceil / np.maximum(peaks, 1e-9))
    la = int(look * SR)
    need = np.minimum.reduce([np.roll(need, -k) for k in range(la)])
    g = np.empty_like(need)
    cur = 1.0
    rc = 1 - np.exp(-1 / (release * SR))
    for i, v in enumerate(need):
        cur = v if v < cur else cur + rc * (v - cur)
        g[i] = cur
    return x * g[:, None]


def end_fade(x):
    t = np.arange(len(x)) / SR
    f = np.where(t < DUR - 1.5, 1.0, np.cos(np.clip((t - (DUR - 1.5)) / 1.5, 0, 1) * np.pi / 2) ** 2)
    return x * f[:, None]


def write(name, x):
    wavfile.write(os.path.join(HERE, name), SR, x.astype(np.float32))


def main():
    music = build_music()
    sfx = build_sfx()
    write('music.wav', music)
    write('sfx.wav', sfx)
    ducked = sidechain(music, sfx)
    mix = end_fade(ducked * 0.55 + sfx)
    meter = pyln.Meter(SR)
    target = -14.0
    gain_db = 0.0
    out = mix
    for _ in range(4):  # gain → limit → re-measure until the integrated loudness lands on target
        out = limiter(mix * 10 ** (gain_db / 20))
        lufs = meter.integrated_loudness(out)
        gain_db += target - lufs
        if abs(target - lufs) < 0.05:
            break
    sfx_only = limiter(end_fade(sfx) * 10 ** (gain_db / 20))
    write('final_mix.wav', out)
    write('final_sfx_only.wav', sfx_only)
    print(f'gain {gain_db:+.2f} dB | mix {meter.integrated_loudness(out):.2f} LUFS, TP {true_peak_db(out):.2f} dBTP | sfx-only {meter.integrated_loudness(sfx_only):.2f} LUFS, TP {true_peak_db(sfx_only):.2f} dBTP')


if __name__ == '__main__':
    main()
