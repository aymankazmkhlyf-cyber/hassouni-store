"""
Original soundtrack + sound effects for the 30 s Reel, synthesized from scratch
(no samples, no third-party music => no copyright claims).

Music: 120 BPM electronic groove in A minor (Am - F - C - G).
Effects are placed on the exact animation times used in ad.html.

    python3 marketing/reel-src/soundtrack.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def place(bus, sig, at, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into a bus at time `at` (seconds)."""
    if sig.ndim == 1:
        left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        sig = np.stack([sig * left * 1.414, sig * right * 1.414], axis=1)
    i = int(at * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * gain


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or a per-sample array."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a[k]) * x[k] + a[k] * acc
        y[k] = acc
    return y


def lowpass_fast(x, cutoff):
    """Fixed-cutoff one-pole low-pass, vectorised in blocks via FFT convolution."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    n = min(len(x), int(SR * 0.25))
    ir = (1 - a) * a ** np.arange(n)
    return fft_convolve(x, ir)[: len(x)]


def fft_convolve(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + len(ir) - 1]


def env(n, attack, decay):
    t = np.arange(n) / SR
    e = np.exp(-t / decay)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def note_hz(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    return 440.0 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)


def saw(freq, t, detune=0.0):
    out = np.zeros_like(t)
    for d in (-detune, 0.0, detune):
        f = freq * (1 + d)
        out += 2 * ((t * f) % 1.0) - 1
    return out / 3


# ---------------------------------------------------------------- music
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("C3", ["C4", "E4", "G4"]), ("G2", ["G3", "B3", "D4"])]
GROOVE_START = 3.2  # beat kicks in with the first product scene
OUTRO = 29.2


def kick():
    t = t_axis(0.42)
    f = 45 + 110 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t * 7.5) + 0.25 * np.sin(phase * 2) * np.exp(-t * 30)


def hat(open_=False):
    n = int(SR * (0.18 if open_ else 0.045))
    x = np.diff(rng.standard_normal(n + 1))
    return x * env(n, 0.0005, 0.06 if open_ else 0.012) * 0.25


def clap():
    n = int(SR * 0.22)
    x = rng.standard_normal(n)
    x = x - lowpass_fast(x, 900)
    e = env(n, 0.001, 0.07)
    for off in (0.008, 0.017):  # flam
        k = int(off * SR)
        e[k:] += env(n - k, 0.0005, 0.05) * 0.7
    return x * e * 0.35


def pluck(freq, length=0.24):
    t = t_axis(length)
    x = 0.6 * np.sign(np.sin(2 * np.pi * freq * t)) * 0.35 + 0.65 * np.sin(2 * np.pi * freq * t)
    return lowpass_fast(x, 3800) * env(len(t), 0.002, 0.09)


def bass_note(freq, length):
    t = t_axis(length)
    x = saw(freq, t, 0.004)
    return lowpass_fast(x, 420) * env(len(t), 0.005, length * 0.9) * 0.9


def pad_chord(notes, length):
    t = t_axis(length)
    x = sum(saw(note_hz(n), t, 0.006) for n in notes) / len(notes)
    x = lowpass_fast(x, 1500)
    e = np.minimum(1, t / 0.5) * np.minimum(1, (length - t) / 0.4).clip(0, 1)
    return x * e


n_bars = int(np.ceil(DUR / BAR))
for b in range(n_bars):
    root, notes = CHORDS[b % 4]
    bar_t = b * BAR
    # pad throughout (warm bed), a little wider in stereo
    pad = pad_chord(notes, BAR + 0.3)
    place(music, pad, bar_t, 0.16, pan=-0.3)
    place(music, pad, bar_t + 0.012, 0.16, pan=0.3)
    for beat in range(4):
        bt = bar_t + beat * BEAT
        groove = GROOVE_START <= bt < OUTRO
        if groove:
            place(music, kick(), bt, 0.95)
            place(music, hat(), bt + BEAT / 2, 0.9, pan=0.25)
            if beat in (1, 3):
                place(music, clap(), bt, 0.9)
            if beat == 3 and b % 2 == 1:
                place(music, hat(True), bt + BEAT * 0.75, 0.6, pan=-0.25)
            # bass on 8ths
            for e8 in range(2):
                place(music, bass_note(note_hz(root), BEAT / 2 * 0.92), bt + e8 * BEAT / 2, 0.55)
        # arpeggio (16ths) from the first scene on, dropped for the outro
        if 3.2 <= bt < OUTRO:
            arp = notes + [notes[1]]
            for s in range(4):
                n_ = arp[(beat * 4 + s) % len(arp)]
                f = note_hz(n_[:-1] + str(int(n_[-1]) + 1))
                place(music, pluck(f), bt + s * BEAT / 4, 0.12, pan=0.35 if s % 2 else -0.35)

# final sustained chord
place(music, pad_chord(["A3", "C4", "E4", "A4"], 2.2), 28.0, 0.22)

# ---------------------------------------------------------------- effects


def whoosh(length=0.7, rising=True):
    n = int(SR * length)
    x = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    cutoff = 300 + (5000 if rising else 2500) * (np.sin(np.pi * t) ** 2)
    y = lowpass(x, cutoff) - lowpass(x, cutoff * 0.25)
    return y * np.sin(np.pi * t) ** 1.5 * 1.4


def riser(length=3.0):
    t = t_axis(length)
    n = len(t)
    noise = rng.standard_normal(n)
    y = lowpass(noise, 200 + 6000 * (t / length) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / length) ** 2) / SR) * 0.25
    return (y * 0.6 + tone) * (t / length) ** 2


def pop(pitch=1.0):
    t = t_axis(0.12)
    f = (550 + 900 * (1 - np.exp(-t * 60))) * pitch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.035) * 0.9


def ding(f1=1318.5, f2=1975.5):
    t = t_axis(0.9)
    x = np.sin(2 * np.pi * f1 * t) + 0.5 * np.sin(2 * np.pi * f2 * t) + 0.2 * np.sin(2 * np.pi * f1 * 2.01 * t)
    return x * env(len(t), 0.002, 0.25) * 0.45


def impact():
    t = t_axis(1.6)
    boom = np.sin(2 * np.pi * np.cumsum(35 + 80 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.8)
    crack = rng.standard_normal(len(t)) * np.exp(-t * 18) * 0.5
    return boom + lowpass_fast(crack, 3000)


def shimmer(length=1.2):
    t = t_axis(length)
    x = np.zeros_like(t)
    for i, f in enumerate([2093, 2637, 3136, 3951]):
        x += np.sin(2 * np.pi * f * t + i) * np.exp(-((t - 0.15 * i - 0.2) ** 2) / 0.02)
    return x * 0.18


def tick():
    t = t_axis(0.03)
    return np.sin(2 * np.pi * 2200 * t) * env(len(t), 0.0005, 0.006) * 0.5


def send_blip():
    t = t_axis(0.16)
    f = 700 + 700 * t / 0.16
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.06) * 0.7


# Intro: riser into the logo, sparkle on the light sweep
place(sfx, riser(0.6), 0.0, 0.35)
place(sfx, impact(), 0.15, 0.55)
place(sfx, shimmer(), 0.9, 0.9)
place(sfx, whoosh(0.9), 0.9, 0.35)
place(sfx, riser(1.9), 1.3, 0.25)

# Scene transitions (whoosh slightly before each cut)
for at in (3.0, 8.75, 14.25, 18.25, 21.75, 25.55):
    place(sfx, whoosh(0.75), at - 0.15, 0.55)

# Gaming: phone rises, price tags slide in
place(sfx, whoosh(1.0), 3.7, 0.3, pan=0.0)
for i, at in enumerate((4.6, 5.2, 5.8, 6.4)):
    place(sfx, pop(1.0 + 0.08 * i), at + 0.05, 0.5, pan=0.5 if i % 2 == 0 else -0.5)
place(sfx, ding(1046.5, 1568.0), 7.0, 0.5)

# Subscriptions: cards pop in sequence (rising pitch)
for i, at in enumerate((9.7, 9.95, 10.2, 10.45, 10.7, 10.95)):
    place(sfx, pop(0.9 + 0.1 * i), at + 0.03, 0.55, pan=-0.4 if i % 2 == 0 else 0.4)
place(sfx, shimmer(1.0), 11.6, 0.7)

# Design
place(sfx, whoosh(1.0), 15.0, 0.3)
for i, at in enumerate((15.8, 16.3, 16.8)):
    place(sfx, pop(1.05 + 0.1 * i), at + 0.05, 0.5, pan=0.5 if i % 2 == 0 else -0.5)

# Payment pills + confirmation ding
for i, at in enumerate((19.1, 19.45, 19.8)):
    place(sfx, whoosh(0.35), at, 0.35, pan=0.6 if i % 2 == 0 else -0.6)
    place(sfx, pop(1.1 + 0.12 * i), at + 0.18, 0.45)
place(sfx, ding(), 20.45, 0.6)

# Live chat: send, typing, replies
place(sfx, send_blip(), 22.7, 0.6, pan=-0.3)
for k in range(10):
    place(sfx, tick(), 23.2 + k * 0.07, 0.35, pan=0.3)
place(sfx, ding(1567.98, 2349.3), 23.9, 0.5, pan=0.3)
place(sfx, ding(1318.5, 1975.5), 24.5, 0.4, pan=0.3)
place(sfx, pop(1.2), 24.95, 0.4)

# CTA: logo, button impact, sweep sparkle, final hit
place(sfx, pop(0.8), 25.95, 0.5)
place(sfx, impact(), 26.8, 0.7)
place(sfx, shimmer(1.3), 27.0, 1.0)
place(sfx, whoosh(1.2), 27.0, 0.3)
place(sfx, ding(880.0, 1318.5), 27.25, 0.35)

# ---------------------------------------------------------------- mix


def reverb(bus, seconds=1.4, wet=0.18):
    n = int(SR * seconds)
    out = bus.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
        ir[0] = 0
        ir /= np.sqrt(np.sum(ir**2))
        out[:, ch] += fft_convolve(bus[:, ch], ir)[:N] * wet
    return out


music = reverb(music, 1.6, 0.22)
sfx = reverb(sfx, 1.0, 0.15)

# Duck the music slightly under each effect so the sync reads clearly.
level = np.abs(sfx).max(axis=1)
duck = 1 - 0.35 * np.clip(lowpass_fast(level, 8) * 6, 0, 1)
mix = music * duck[:, None] * 0.9 + sfx

# Fade in/out to match the video's black fades.
t = np.arange(N) / SR
mix *= np.clip(t / 0.35, 0, 1)[:, None] * np.clip((DUR - t) / 0.6, 0, 1)[:, None]

# Gentle limiter, then peak-normalise to -1 dBFS.
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix /= np.abs(mix).max() / 10 ** (-1 / 20)

out = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"wrote {out} ({DUR:.0f}s, {SR} Hz stereo)")
