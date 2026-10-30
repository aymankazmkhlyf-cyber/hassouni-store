"""Procedural audio engine for the HS cinematic ad (numpy + scipy only, nothing downloaded).

Building blocks (oscillators, filters, envelopes, reverb, panning, limiter, loudness) plus the
trailer-style SFX recipes from the brief. Every SFX gets a 5 ms fade-in / fade-out.
"""
import json
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'src', 'timeline.json')))
DUR = float(TL['duration'])
N = int(SR * DUR)
_rng = np.random.default_rng(11)


# ───────────────────────────── basics
def t_axis(sec):
    return np.arange(int(round(sec * SR))) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def noise(sec, seed=None):
    r = np.random.default_rng(seed) if seed is not None else _rng
    return r.standard_normal(int(round(sec * SR)))


def fades(x, fin=0.005, fout=0.005):
    x = np.array(x, dtype=float, copy=True)
    a = min(int(fin * SR), len(x) // 2)
    b = min(int(fout * SR), len(x) // 2)
    ra = np.linspace(0, 1, a)
    rb = np.linspace(1, 0, b)
    if x.ndim == 2:
        ra, rb = ra[:, None], rb[:, None]
    if a:
        x[:a] *= ra
    if b:
        x[-b:] *= rb
    return x


def _sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(_sos('low', f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(_sos('high', f, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos('band', [lo, hi], order), x)


def sweep_filter(x, f0, f1, kind='low', steps=48):
    """Time-varying filter by crossfading blocks (good enough for sweeps)."""
    out = np.zeros_like(x)
    n = len(x)
    edges = np.linspace(0, n, steps + 1).astype(int)
    pad = int(0.02 * SR)
    for i in range(steps):
        a, b = edges[i], edges[i + 1]
        f = f0 * (f1 / f0) ** (i / max(1, steps - 1))
        s0 = max(0, a - pad)
        seg = signal.sosfilt(_sos(kind, min(f, SR / 2 - 100)), x[s0:b])
        out[a:b] = seg[a - s0 :]
    return out


def env_adsr(n, a, d, s, r, sec):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-6), e)
    e = np.where((t >= a + d) & (t < sec), s, e)
    e = np.where(t >= sec, s * np.exp(-(t - sec) / max(r / 4.6, 1e-6)), e)
    return e


def osc_saw(f, sec, detune_cents=(0,), phase_seed=0):
    t = t_axis(sec)
    r = np.random.default_rng(phase_seed)
    out = np.zeros_like(t)
    for c in detune_cents:
        ff = f * 2 ** (c / 1200)
        out += signal.sawtooth(2 * np.pi * ff * t + r.uniform(0, 2 * np.pi))
    return out / len(detune_cents)


def osc_sine(f, sec, phase=0.0):
    t = t_axis(sec)
    return np.sin(2 * np.pi * f * t + phase)


def glide_sine(f0, f1, sec, curve=1.0):
    t = t_axis(sec)
    f = f0 + (f1 - f0) * (t / sec) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ───────────────────────────── space
def pan_gains(pan):
    pan = np.clip(pan, -0.7, 0.7)  # gentle: mono-compatible
    ang = (pan + 1) * np.pi / 4
    return np.cos(ang), np.sin(ang)


def place(bus, x, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= len(bus):
        return
    if i < 0:
        x = x[-i:]
        i = 0
    x = x[: len(bus) - i]
    if x.ndim == 1:
        gl, gr = pan_gains(np.asarray(pan)[: len(x)] if not np.isscalar(pan) else pan)
        bus[i : i + len(x), 0] += x * gl * gain
        bus[i : i + len(x), 1] += x * gr * gain
    else:
        bus[i : i + len(x)] += x * gain


def reverb_ir(sec=3.0, decay=2.4, seed=1, damp=6000):
    r = np.random.default_rng(seed)
    t = t_axis(sec)
    env = np.exp(-t * decay)
    ir = np.stack([r.standard_normal(len(t)) * env, r.standard_normal(len(t)) * env], axis=1)
    ir[:, 0] = lp(ir[:, 0], damp)
    ir[:, 1] = lp(ir[:, 1], damp)
    return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


def reverb(x, ir, wet):
    st = x if x.ndim == 2 else np.stack([x, x], axis=1)
    out = np.zeros((len(st) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(st[:, c], ir[:, c])
    tail = out
    dry = np.zeros_like(tail)
    dry[: len(st)] = st
    return dry * (1 - wet) + tail * wet


def stereo(x, width=0.0):
    """Mono → stereo with a tiny mono-safe widening (short decorrelated copy)."""
    d = int(0.011 * SR)
    l = x.copy()
    r = x.copy()
    if width > 0:
        r[d:] = (1 - width) * r[d:] + width * x[:-d]
    return np.stack([l, r], axis=1)


# ───────────────────────────── SFX recipes (trailer style; no cartoon pops, no generic clicks)
def clock_tick():
    t = t_axis(0.09)
    click = hp(noise(0.09, 1), 1800) * np.exp(-t * 260)
    tone = np.sin(2 * np.pi * 2650 * t) * np.exp(-t * 120) * 0.5 + np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 90) * 0.35
    return fades(bp(click * 0.6 + tone, 700, 7000))


def low_boom(sec=4.0):
    t = t_axis(sec)
    f = 40 * (1 + 0.9 * np.exp(-t * 6))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 0.9)
    trans = lp(noise(sec, 2), 900) * np.exp(-t * 35) * 0.6
    return fades(body + trans)


def door_thump():
    t = t_axis(1.8)
    thump = lp(noise(1.8, 3), 220) * np.exp(-t * 18) * 2.2 + np.sin(2 * np.pi * 70 * t) * np.exp(-t * 14)
    latch = hp(noise(1.8, 4), 2500) * np.exp(-np.maximum(t - 0.05, 0) * 120) * (t > 0.05) * 0.25
    return fades(thump + latch)


def braam(sec=1.6):
    t = t_axis(sec + 1.2)
    x = osc_saw(55, sec + 1.2, (-14, -6, 0, 7, 15), 5) + 0.6 * osc_saw(110, sec + 1.2, (-9, 4), 6)
    x = sweep_filter(x, 300, 1400, 'low', 32)
    env = np.minimum(1, t / 0.05) * np.where(t < sec, 1.0, np.exp(-(t - sec) * 3.5))
    sub = np.sin(2 * np.pi * 27.5 * t) * env * 0.5
    return fades(x * env + sub)


def room_tone(sec):
    return fades(lp(hp(noise(sec, 7), 80), 900) * 0.04, 0.05, 0.05)


def reverse_riser(sec=0.9):
    """Reversed reverb swell: a bright hit through long reverb, reversed."""
    hit = np.zeros(int(sec * SR))
    burst = bp(noise(0.08, 8), 600, 6000) * np.exp(-t_axis(0.08) * 30)
    hit[: len(burst)] = burst
    hit[: len(t_axis(0.5))] += 0.5 * np.sin(2 * np.pi * hz(62) * t_axis(0.5)) * np.exp(-t_axis(0.5) * 4)
    wet = reverb(hit, reverb_ir(sec, 3.0, 9, 8000), 1.0)[: len(hit)]
    rev = wet[::-1]
    shape = (t_axis(sec) / sec) ** 1.4
    return fades(rev * shape[:, None] * 3.0, 0.02, 0.005)


def impact(sec=4.5):
    t = t_axis(sec)
    sub = np.sin(2 * np.pi * 45 * t * (1 + 0.3 * np.exp(-t * 10))) * np.exp(-t * 1.2) * 1.2
    metal = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) * a for f, d, a in [(523, 3.2, 0.3), (1187, 4.0, 0.22), (1975, 5.0, 0.15), (3220, 6.5, 0.1)])
    crack = hp(noise(sec, 10), 1200) * np.exp(-t * 28) * 0.8
    x = stereo(sub + metal + crack, 0.4)
    return reverb(x, reverb_ir(3.5, 1.8, 12), 0.32)


def shimmer():
    t = t_axis(2.4)
    x = sum(np.sin(2 * np.pi * f * t + i) * np.exp(-t * (1.6 + i * 0.6)) * a for i, (f, a) in enumerate([(1568, 0.5), (2349, 0.4), (3136, 0.18), (4699, 0.1)]))
    x *= np.minimum(1, t / 0.004)
    return reverb(stereo(fades(x), 0.5), reverb_ir(2.5, 2.2, 13, 9000), 0.35)


def whoosh(sec=0.65, seed=0):
    """Band-passed noise with a doppler-like pitch drop; returns (mono, pan curve R→L) plus a short tail."""
    t = t_axis(sec)
    n = noise(sec, 100 + seed)
    env = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 2.2
    swept = sweep_filter(n, 3200, 700, 'low', 24)
    swept = hp(swept, 220)
    tail = np.concatenate([np.zeros(int(sec * 0.6 * SR)), lp(noise(0.9, 200 + seed), 900) * np.exp(-t_axis(0.9) * 5) * 0.25])
    x = np.zeros(max(len(swept), len(tail)))
    x[: len(swept)] += swept * env
    x[: len(tail)] += tail
    pan = np.linspace(0.6, -0.6, len(x))
    return fades(x), pan


def counter_tick(step):
    f = hz(79 + step * 2)
    t = t_axis(0.35)
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 16)
    return fades(x * np.minimum(1, t / 0.002))


def tonal_hit(note=62, intensity=1.0):
    t = t_axis(2.2)
    f = hz(note)
    piano = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 5)) * np.exp(-t * 2.2)
    sub = np.sin(2 * np.pi * hz(note - 24) * t) * np.exp(-t * 3.5) * 0.9
    x = (piano * 0.7 + sub) * intensity * np.minimum(1, t / 0.003)
    return reverb(stereo(fades(x), 0.35), reverb_ir(2.0, 2.6, 14), 0.25)


def glass_tap():
    t = t_axis(0.03)
    x = np.sin(2 * np.pi * 3000 * t) * np.exp(-t * 120)
    return reverb(stereo(fades(x), 0.3), reverb_ir(1.2, 4.0, 15, 9000), 0.35)


def jet_flyby(sec=2.6):
    t = t_axis(sec)
    mid = sec * 0.45
    n = noise(sec, 16)
    roar = sweep_filter(n, 2600, 500, 'low', 40)
    whine = glide_sine(1900, 1100, sec, 1.0) * 0.08
    env = np.exp(-((t - mid) / (sec * 0.25)) ** 2)
    x = (roar + whine) * env
    pan = np.clip((t - mid) / (sec * 0.35), -1, 1) * -0.7
    return fades(x), pan


def ticket_print():
    out = np.zeros(int(1.9 * SR))
    for k in range(9):
        tt = t_axis(0.03)
        c = bp(noise(0.03, 30 + k), 900, 4000) * np.exp(-tt * 180)
        i = int((0.05 + k * 0.055) * SR)
        out[i : i + len(c)] += c * 0.7
    t = t_axis(1.2)
    chime = (np.sin(2 * np.pi * hz(86) * t) + 0.5 * np.sin(2 * np.pi * hz(93) * t)) * np.exp(-t * 3) * np.minimum(1, t / 0.003)
    i = int(0.55 * SR)
    out[i : i + len(chime)] += chime * 0.6
    return fades(out)


def capacity_rise(sec):
    """Rising granular tone."""
    out = np.zeros(int(sec * SR) + SR // 4)
    n_grains = int(sec * 38)
    r = np.random.default_rng(17)
    for g in range(n_grains):
        p = g / n_grains
        f = hz(57 + p * 14) * (1 + r.uniform(-0.01, 0.01))
        L = 0.06
        tt = t_axis(L)
        grain = np.sin(2 * np.pi * f * tt) * np.hanning(len(tt))
        i = int((p * sec + r.uniform(0, 0.02)) * SR)
        out[i : i + len(grain)] += grain * (0.25 + 0.75 * p)
    return fades(out / 3)


def chat_thock():
    t = t_axis(0.35)
    thock = np.sin(2 * np.pi * 180 * t * (1 + 0.4 * np.exp(-t * 60))) * np.exp(-t * 28)
    air = bp(noise(0.35, 18), 2000, 8000) * np.exp(-t * 40) * 0.25
    return fades(thock + air)


def tape_swell(sec=0.9):
    t = t_axis(sec)
    x = osc_saw(hz(50), sec, (-8, 8), 19) * 0.4 + noise(sec, 20) * 0.15
    x = sweep_filter(x, 300, 3000, 'low', 24) * (t / sec) ** 2
    return fades(x, 0.01, 0.005)


def data_tick(step):
    t = t_axis(0.12)
    f = 1800 + step * 220
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 60) + hp(noise(0.12, 40 + step), 3000) * np.exp(-t * 200) * 0.3
    return fades(x)


def cymbal_swell(sec=2.5):
    t = t_axis(sec)
    x = hp(noise(sec, 21), 5000) * (t / sec) ** 2.5
    return fades(x, 0.05, 0.02)


def final_hit():
    return impact(5.0)


# ───────────────────────────── mix utilities
def sidechain(music, key, depth_db=3.0, att=0.008, rel=0.35):
    lvl = np.abs(key).max(axis=1)
    a = 1 - np.exp(-1 / (att * SR))
    r = 1 - np.exp(-1 / (rel * SR))
    env = np.empty_like(lvl)
    e = 0.0
    for i, v in enumerate(lvl):
        e += (a if v > e else r) * (v - e)
        env[i] = e
    ref = np.percentile(env[env > 1e-4], 95) if np.any(env > 1e-4) else 1.0
    g = 10 ** (-depth_db * np.clip(env / ref, 0, 1) / 20)
    return music * g[:, None]


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def limiter(x, ceiling_db=-1.3, look=0.004, release=0.08):
    ceil = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(axis=1)
    peaks = up[: len(x) * 4].reshape(-1, 4).max(axis=1)[: len(x)]
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


def write(path, x, bits=32):
    x = np.asarray(x)
    if bits == 24:
        # 24-bit PCM: scipy has no int24 writer, so write via a packed byte buffer.
        q = np.clip(np.round(x * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype('<i4')
        raw = q.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
        import wave

        with wave.open(path, 'wb') as w:
            w.setnchannels(x.shape[1] if x.ndim == 2 else 1)
            w.setsampwidth(3)
            w.setframerate(SR)
            w.writeframes(raw)
    else:
        wavfile.write(path, SR, x.astype(np.float32))
