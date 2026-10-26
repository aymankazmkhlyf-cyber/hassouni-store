"""
Original music + sound effects for the 15 s category ads (synthesized, copyright-free).

Effects are generated FROM the animation file itself: every element with
data-in / data-anim in the HTML gets a matching sound at exactly that time,
so audio and picture stay in sync even when timings are edited.

    python3 compose_audio.py gaming.html gaming out.wav
"""
import re
import sys
import wave

import numpy as np

SR = 44100

STYLES = {
    # bpm, chord roots/notes, groove start, drum mute windows, character
    "gaming": dict(bpm=128, chords=[("E2", ["E3", "G3", "B3"]), ("C2", ["C3", "E3", "G3"]), ("G2", ["G3", "B3", "D4"]), ("D2", ["D3", "F#3", "A3"])], groove=2.0, mute=[], kick=1.1, bass=0.7, arp=0.13, pad=0.12, bright=4200),
    "subscriptions": dict(bpm=112, chords=[("D2", ["D3", "F3", "A3"]), ("A#1", ["A#2", "D3", "F3"]), ("F2", ["F3", "A3", "C4"]), ("C2", ["C3", "E3", "G3"])], groove=2.0, mute=[], kick=0.9, bass=0.55, arp=0.15, pad=0.15, bright=5200),
    # design: softer groove; drums drop out respectfully for the procession scene
    "design": dict(bpm=100, chords=[("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("C3", ["C4", "E4", "G4"]), ("G2", ["G3", "B3", "D4"])], groove=2.0, mute=[(6.5, 10.2)], kick=0.75, bass=0.45, arp=0.11, pad=0.2, bright=3200),
}


class Mixer:
    def __init__(self, dur, seed=11):
        self.dur, self.n = dur, int(SR * dur)
        self.music = np.zeros((self.n, 2))
        self.sfx = np.zeros((self.n, 2))
        self.rng = np.random.default_rng(seed)

    def place(self, bus, sig, at, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            sig = np.stack([sig * np.sqrt(1 - pan), sig * np.sqrt(1 + pan)], axis=1)
        i = int(at * SR)
        if i >= self.n or i < 0:
            return
        j = min(self.n, i + len(sig))
        bus[i:j] += sig[: j - i] * gain


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, attack, decay):
    t = np.arange(n) / SR
    e = np.exp(-t / decay)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def fft_convolve(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + len(ir) - 1]


def lowpass_fast(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    ir = (1 - a) * a ** np.arange(min(len(x), int(SR * 0.25)))
    return fft_convolve(x, ir)[: len(x)]


def lowpass_var(x, cutoff):
    a = np.exp(-2 * np.pi * np.asarray(cutoff) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a[k]) * x[k] + a[k] * acc
        y[k] = acc
    return y


def note_hz(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    return 440.0 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)


def up_octave(n):
    return n[:-1] + str(int(n[-1]) + 1)


def saw(freq, t, detune=0.0):
    return sum(2 * ((t * freq * (1 + d)) % 1.0) - 1 for d in (-detune, 0.0, detune)) / 3


# ------------------------------------------------------------------ instruments
def kick():
    t = t_axis(0.4)
    ph = 2 * np.pi * np.cumsum(45 + 115 * np.exp(-t * 30)) / SR
    return np.sin(ph) * np.exp(-t * 8) + 0.25 * np.sin(ph * 2) * np.exp(-t * 30)


def hat(m, open_=False):
    n = int(SR * (0.16 if open_ else 0.04))
    return np.diff(m.rng.standard_normal(n + 1)) * env(n, 0.0005, 0.05 if open_ else 0.011) * 0.25


def clap(m):
    n = int(SR * 0.2)
    x = m.rng.standard_normal(n)
    x = x - lowpass_fast(x, 900)
    e = env(n, 0.001, 0.065)
    for off in (0.008, 0.017):
        k = int(off * SR)
        e[k:] += env(n - k, 0.0005, 0.045) * 0.7
    return x * e * 0.35


def pluck(freq, bright, length=0.22):
    t = t_axis(length)
    x = 0.25 * np.sign(np.sin(2 * np.pi * freq * t)) + 0.7 * np.sin(2 * np.pi * freq * t)
    return lowpass_fast(x, bright) * env(len(t), 0.002, 0.085)


def bell(freq, length=1.4):
    t = t_axis(length)
    x = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 6)
    return x * env(len(t), 0.003, 0.5) * 0.4


def bass_note(freq, length):
    t = t_axis(length)
    return lowpass_fast(saw(freq, t, 0.004), 420) * env(len(t), 0.005, length * 0.9) * 0.9


def pad_chord(notes, length):
    t = t_axis(length)
    x = lowpass_fast(sum(saw(note_hz(n), t, 0.006) for n in notes) / len(notes), 1500)
    return x * np.minimum(1, t / 0.5) * np.clip((length - t) / 0.4, 0, 1)


# ------------------------------------------------------------------ effects
def whoosh(m, length=0.7):
    n = int(SR * length)
    x = m.rng.standard_normal(n)
    u = np.linspace(0, 1, n)
    c = 300 + 5000 * np.sin(np.pi * u) ** 2
    return (lowpass_var(x, c) - lowpass_var(x, c * 0.25)) * np.sin(np.pi * u) ** 1.5 * 1.4


def pop(pitch=1.0):
    t = t_axis(0.12)
    f = (550 + 900 * (1 - np.exp(-t * 60))) * pitch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.035) * 0.9


def ding(f1=1318.5, f2=1975.5):
    t = t_axis(0.9)
    x = np.sin(2 * np.pi * f1 * t) + 0.5 * np.sin(2 * np.pi * f2 * t) + 0.2 * np.sin(2 * np.pi * f1 * 2.01 * t)
    return x * env(len(t), 0.002, 0.25) * 0.45


def impact(m):
    t = t_axis(1.5)
    boom = np.sin(2 * np.pi * np.cumsum(35 + 80 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.8)
    return boom + lowpass_fast(m.rng.standard_normal(len(t)) * np.exp(-t * 18) * 0.5, 3000)


def shimmer(length=1.2):
    t = t_axis(length)
    x = sum(np.sin(2 * np.pi * f * t + i) * np.exp(-((t - 0.15 * i - 0.2) ** 2) / 0.02) for i, f in enumerate([2093, 2637, 3136, 3951]))
    return x * 0.18


def riser(m, length):
    t = t_axis(length)
    y = lowpass_var(m.rng.standard_normal(len(t)), 200 + 6000 * (t / length) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / length) ** 2) / SR) * 0.25
    return (y * 0.6 + tone) * (t / length) ** 2


# ------------------------------------------------------------------ timeline from HTML
TAG = re.compile(r"<(div|span|svg)\b([^>]*\bdata-in=\"([\d.]+)\"[^>]*)>", re.S)


def events_from_html(html):
    """Returns (time, kind, pan) for every animated element, derived from the markup."""
    events = []
    for m_ in TAG.finditer(html):
        attrs, at = m_.group(2), float(m_.group(3))
        anim = (re.search(r'data-anim="(\w+)"', attrs) or [None, "up"])[1]
        after = html[m_.end(): m_.end() + 260]
        style = re.search(r'style="([^"]*)"', attrs)
        side = 0.5 if style and "right:" in style.group(1) else -0.5 if style and "left:" in style.group(1) else 0.0
        if anim == "fade":
            events.append((at - 0.2, "whoosh", 0.0))
        elif anim == "rise":
            events.append((at, "whoosh_long", 0.0))
        elif anim == "zoom":
            events.append((at, "impact", 0.0))
        elif 'class="cta"' in after:
            events.append((at, "impact", 0.0))
        elif 'class="logo"' in after:
            events.append((at, "pop_low", 0.0))
        elif 'class="check"' in after:
            events.append((at + 0.12, "ding", side))
        elif anim == "pop" and ('class="card"' in after or 'class="frame"' in after):
            events.append((at + 0.03, "pop_seq", side))
        elif anim == "pop" and ('class="tag"' in after or 'class="chip"' in after):
            events.append((at + 0.05, "pop_hi", 0.0))
        elif anim == "pop":
            events.append((at, "impact_soft", 0.0))
        elif anim in ("left", "right") and 'class="tag"' in after:
            events.append((at + 0.1, "pop_seq", 0.5 if anim == "right" else -0.5))
        elif anim in ("left", "right"):
            events.append((at, "whoosh_short", 0.5 if anim == "right" else -0.5))
    for s in re.finditer(r'data-sweep="([\d.]+),', html):
        events.append((float(s.group(1)), "shimmer", 0.0))
    return sorted(events)


def compose(html_path, style_name, out):
    html = open(html_path, encoding="utf-8").read()
    dur = float(re.search(r'data-dur="([\d.]+)"', html).group(1))
    st = STYLES[style_name]
    m = Mixer(dur)
    beat = 60 / st["bpm"]
    bar = 4 * beat
    outro = dur - 1.0

    def muted(t):
        return t < st["groove"] or t >= outro or any(a <= t < b for a, b in st["mute"])

    for b in range(int(np.ceil(dur / bar))):
        root, notes = st["chords"][b % 4]
        bt0 = b * bar
        pad = pad_chord(notes, bar + 0.3)
        m.place(m.music, pad, bt0, st["pad"], pan=-0.3)
        m.place(m.music, pad, bt0 + 0.012, st["pad"], pan=0.3)
        for k in range(4):
            bt = bt0 + k * beat
            if not muted(bt):
                m.place(m.music, kick(), bt, st["kick"])
                m.place(m.music, hat(m), bt + beat / 2, 0.9, pan=0.25)
                if k in (1, 3):
                    m.place(m.music, clap(m), bt, 0.85)
                if k == 3 and b % 2:
                    m.place(m.music, hat(m, True), bt + beat * 0.75, 0.6, pan=-0.25)
                for e8 in range(2):
                    m.place(m.music, bass_note(note_hz(root), beat / 2 * 0.92), bt + e8 * beat / 2, st["bass"])
            if st["groove"] <= bt < outro:
                arp = notes + [notes[1]]
                for s in range(4):
                    n_ = up_octave(arp[(k * 4 + s) % len(arp)])
                    m.place(m.music, pluck(note_hz(n_), st["bright"]), bt + s * beat / 4, st["arp"], pan=0.35 if s % 2 else -0.35)
        # gentle bells in muted (respectful) sections
        for a, b_ in st["mute"]:
            if a <= bt0 < b_:
                for k, n_ in enumerate(notes):
                    m.place(m.music, bell(note_hz(up_octave(n_))), bt0 + k * beat, 0.5, pan=(k - 1) * 0.4)

    # hook riser into the very first frame and a closing chord
    m.place(m.sfx, riser(m, 0.5), 0.0, 0.3)
    last_root, last_notes = st["chords"][0]
    m.place(m.music, pad_chord(last_notes + [up_octave(last_notes[0])], 1.8), outro - 0.6, st["pad"] * 1.4)

    seq_i, last_kind_t = 0, {}
    for at, kind, pan in events_from_html(html):
        if at - last_kind_t.get(kind, -9) < 0.12:  # avoid doubled hits
            continue
        last_kind_t[kind] = at
        if kind == "whoosh":
            m.place(m.sfx, whoosh(m, 0.75), at, 0.55)
        elif kind == "whoosh_long":
            m.place(m.sfx, whoosh(m, 1.0), at, 0.32)
        elif kind == "whoosh_short":
            m.place(m.sfx, whoosh(m, 0.35), at, 0.35, pan=pan)
        elif kind == "impact":
            m.place(m.sfx, impact(m), at, 0.65)
        elif kind == "impact_soft":
            m.place(m.sfx, impact(m), at, 0.4)
            m.place(m.sfx, pop(0.8), at, 0.35)
        elif kind == "pop_low":
            m.place(m.sfx, pop(0.75), at, 0.55)
        elif kind == "pop_hi":
            m.place(m.sfx, pop(1.3), at, 0.45)
        elif kind == "pop_seq":
            m.place(m.sfx, pop(0.95 + 0.08 * (seq_i % 8)), at, 0.5, pan=pan)
            seq_i += 1
        elif kind == "ding":
            m.place(m.sfx, ding(), at, 0.45, pan=pan * 0.5)
        elif kind == "shimmer":
            m.place(m.sfx, shimmer(), at, 0.9)

    # mix: reverb, ducking, fades, limiter, -1 dBFS peak
    def reverb(bus, seconds, wet):
        out = bus.copy()
        n = int(SR * seconds)
        for ch in range(2):
            ir = m.rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
            ir[0] = 0
            ir /= np.sqrt(np.sum(ir**2))
            out[:, ch] += fft_convolve(bus[:, ch], ir)[: m.n] * wet
        return out

    music = reverb(m.music, 1.6, 0.22)
    sfx = reverb(m.sfx, 1.0, 0.15)
    duck = 1 - 0.35 * np.clip(lowpass_fast(np.abs(sfx).max(axis=1), 8) * 6, 0, 1)
    mix = music * duck[:, None] * 0.9 + sfx
    t = np.arange(m.n) / SR
    mix *= (np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.5, 0, 1))[:, None]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix /= np.abs(mix).max() / 10 ** (-1 / 20)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype("<i2").tobytes())
    print(f"{out}: {dur:.0f}s, {len(events_from_html(html))} synced effects")


if __name__ == "__main__":
    compose(sys.argv[1], sys.argv[2], sys.argv[3])
