"""Final score + SFX + mix/master for the HS cinematic ad.

Outputs (audio/):
  score.wav, sfx.wav, impacts.wav, whooshes.wav   stems (48 kHz; 24-bit copies go to premiere_project/audio)
  final_mix.wav                                   master: -14 LUFS integrated, true peak <= -1 dBTP
  final_no_music.wav                              SFX + impacts only, same gain as the master
Also writes src/studio/waves.json and src/studio/levels.json for Video B (real waveforms and meters).

Every timing comes from src/timeline.json. Audio leads picture by ~6–12 frames on scene changes.
"""
import json
import os

import numpy as np
import pyloudnorm as pyln

import engine as E
from engine import SR, N, TL, hz, place

LEAD = 0.15  # seconds the sound leads the cut (9 frames at 60 fps)
BEAT = 60 / 70
EIGHTH = BEAT / 2
BAR = BEAT * 4


def bus():
    return np.zeros((N, 2))


# ───────────────────────────── score
def pad(notes, sec, attack=1.2, release=1.8, cutoff=2200, detune=7):
    x = sum(E.osc_saw(hz(n), sec + release, (-detune, detune), 50 + n) for n in notes) / len(notes)
    x = E.lp(x, cutoff, 2)
    t = E.t_axis(sec + release)
    env = np.minimum(1, t / attack) * np.where(t < sec, 1.0, np.exp(-(t - sec) * 3 / release))
    return E.fades(x * env, 0.01, 0.02)


def pluck(f, decay=0.35):
    t = E.t_axis(0.9)
    x = E.osc_saw(f, 0.9, (-4, 4), int(f)) * 0.5 + np.sin(2 * np.pi * f * t) * 0.6
    x = E.lp(x, 2600, 2) * np.exp(-t / decay * 3) * np.minimum(1, t / 0.003)
    return E.fades(x)


def perc_tap():
    t = E.t_axis(0.6)
    body = np.sin(2 * np.pi * 95 * t * (1 + 0.5 * np.exp(-t * 30))) * np.exp(-t * 9)
    snap = E.bp(E.noise(0.6, 77), 900, 5000) * np.exp(-t * 40) * 0.35
    return E.fades(body + snap)


def drone(sec, seed=0):
    t = E.t_axis(sec)
    sub = np.sin(2 * np.pi * 36.7 * t) * 0.9
    saw = E.lp(E.osc_saw(73.4, sec, (-6, 5), seed), 320, 2) * 0.55
    strings = E.hp(E.osc_saw(hz(50), sec, (-9, 9), seed + 1) + E.osc_saw(hz(53), sec, (-8, 8), seed + 2) + E.osc_saw(hz(57), sec, (-7, 7), seed + 3), 400)
    strings = E.lp(strings, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.2 * t)) * 0.07
    return sub + saw + strings


def build_score():
    music = bus()
    # 0–7 s: D minor drone + tension strings; drops to room tone for the silence beat (5.6–6.0 s)
    d = drone(7.2, 1)
    t = E.t_axis(7.2)
    gate = np.interp(t, [0, 5.45, 5.58, 6.1, 6.9, 7.2], [1, 1, 0.0, 0.0, 0.35, 0.0])
    place(music, E.stereo(d * gate, 0.3), 0.0, 0.55)
    place(music, E.stereo(E.room_tone(0.5), 0.5), 5.55, 1.0)

    # 7–50 s: D major lift, ostinato in 1/8 notes, warm pad; intensity rises a little with each feature
    prog = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]]  # D, Bm, G, A
    tt = 7.0
    k = 0
    while tt < 50.0:
        chord = prog[k % 4]
        L = min(BAR, 50.0 - tt + 0.01)
        place(music, E.stereo(pad(chord, L, 0.6 if k else 0.05, 1.6, 1800 + k * 40), 0.45), tt, 0.32)
        place(music, E.stereo(E.lp(pad([chord[0] - 12], L, 0.05, 1.2, 400, 3), 300), 0.0), tt, 0.5)
        intensity = 0.55 + 0.45 * (tt - 7) / 43
        arp = [chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[2] + 12]
        for j in range(8):
            at = tt + j * EIGHTH
            if at >= 50.0:
                break
            n = arp[j % 4] + (12 if (tt > 34 and j % 4 == 3) else 0)
            place(music, pluck(hz(n)), at, 0.16 * intensity * (1.0 if j % 2 == 0 else 0.75), pan=0.3 if j % 2 else -0.3)
        tt += BAR
        k += 1
    for at in [7.0] + TL['tonalHit']:
        place(music, perc_tap(), at - 0.02, 0.3)

    # 50–60 s: emotional lift — wide pad, higher octave, cymbal swell into the CTA, resolved D major
    lift = [[50, 57, 62, 66, 69], [43, 55, 59, 62, 67], [45, 57, 61, 64, 69], [50, 57, 62, 66, 74]]
    for i, chord in enumerate(lift):
        st = 50.0 + i * 2.5 if i < 3 else 57.0
        L = 2.6 if i < 3 else 2.4
        place(music, E.stereo(pad(chord, L, 0.4, 1.4, 2800, 9), 0.6), st, 0.34)
        place(music, E.stereo(pad([c + 12 for c in chord[1:]], L, 0.6, 1.4, 4200, 11), 0.6), st, 0.12)
        for j in range(int(L / EIGHTH)):
            place(music, pluck(hz(chord[(j % 4) + 1] + 12)), st + j * EIGHTH, 0.15, pan=0.3 if j % 2 else -0.3)
    place(music, E.stereo(E.cymbal_swell(2.6), 0.5), 55.0 - 2.6 + LEAD, 0.35)

    # last 0.5 s: the opening drone comes back so the loop is seamless
    tail = drone(0.5 + 0.05, 1)
    xf = np.linspace(0, 1, len(tail)) ** 1.5
    place(music, E.stereo(tail * xf, 0.3), 59.5, 0.55)
    music = E.reverb(music, E.reverb_ir(3.4, 2.2, 31), 0.3)[:N]
    # fade the score's own reverb tail out of 59.5 → 60 so only the drone carries over
    t = np.arange(N) / SR
    score_end = np.where(t < 59.5, 1.0, np.clip(1 - (t - 59.5) / 0.5, 0, 1) * 0.0 + 1.0)
    return music * score_end[:, None]


# ───────────────────────────── SFX / impacts / whooshes
def build_sfx():
    sfx, imp, wh = bus(), bus(), bus()
    for at in TL['ticks']:
        place(sfx, E.clock_tick(), at, 0.5, pan=0.15)
    place(imp, E.low_boom(), TL['boom'] - 0.01, 0.95)
    place(sfx, E.reverb(E.door_thump(), E.reverb_ir(1.8, 3.0, 41), 0.4), TL['door'] - 0.02, 0.8)
    place(imp, E.braam(), TL['braam'] - 0.04, 0.55)
    r0, r1 = TL['reverseRiser']
    place(sfx, E.reverse_riser(r1 - r0), r0, 0.9)
    place(imp, E.impact(), TL['impact'] - 0.01, 1.0)
    for s in TL['shimmer']:
        place(sfx, E.shimmer(), s, 0.35)
    for i, at in enumerate(TL['whoosh']):
        w, pan = E.whoosh(0.65, i)
        place(wh, w, at - 0.33 - LEAD * 0.6, 0.55, pan=pan)
    for i, at in enumerate(TL['counter']):
        place(sfx, E.counter_tick(i), at, 0.28)
    for i, at in enumerate(TL['tonalHit']):
        place(sfx, E.tonal_hit(62 + (i % 2) * 2, 0.8 + i * 0.03), at - 0.03, 0.42)
    for at in TL['taps']:
        place(sfx, E.glass_tap(), at, 0.35)
    for at in TL['jet']:
        j, pan = E.jet_flyby()
        place(imp, j, at - 1.17, 0.55, pan=pan)
    place(sfx, E.ticket_print(), TL['ticket'] - 0.55, 0.45)
    c0, c1 = TL['capacity']
    place(sfx, E.capacity_rise(c1 - c0), c0, 0.4)
    for at in TL['capacitySteps']:
        place(sfx, E.counter_tick(5), at, 0.22)
    place(sfx, E.tonal_hit(57, 0.7), TL['full'], 0.3)
    for at in TL['chat']:
        place(sfx, E.chat_thock(), at, 0.45)
    for a, b in TL['typing']:
        # soft keyboard-free typing texture: filtered ticks
        n = int((b - a) / 0.11)
        for k in range(n):
            place(sfx, E.data_tick(0) * 0.25, a + k * 0.11 + 0.02 * np.sin(k * 3.1), 0.25)
    place(sfx, E.tape_swell(), TL['handoff'] - 0.85, 0.35)
    place(sfx, E.tonal_hit(66, 0.7), TL['handoff'] + 0.02, 0.3)
    for at in TL['callPulse']:
        place(sfx, E.tonal_hit(50, 0.4), at, 0.18)
    for i, at in enumerate(TL['dataBuild']):
        place(sfx, E.data_tick(i), at, 0.3)
    g0, g1 = TL['graph']
    place(sfx, E.glide_sine(hz(62), hz(69), g1 - g0) * np.sin(np.pi * E.t_axis(g1 - g0) / (g1 - g0)) * 0.6, g0, 0.15)
    place(imp, E.final_hit(), TL['finalHit'] - 0.01, 0.9)
    for at in TL['ctaPulse']:
        place(sfx, E.tonal_hit(38, 0.35), at, 0.16)
    return sfx, imp, wh


def frame_levels(x, fps=60):
    hop = SR // fps
    n = len(x) // hop
    x = x[: n * hop].reshape(n, hop, -1)
    rms = np.sqrt((x ** 2).mean(axis=1) + 1e-12)
    return np.round(20 * np.log10(rms), 1).tolist()


def peaks(x, bins=1200):
    m = np.abs(x).max(axis=1)
    k = len(m) // bins
    return np.round(m[: k * bins].reshape(bins, k).max(axis=1), 3).tolist()


def main():
    score = build_score()
    sfx, imp, wh = build_sfx()
    score = E.sidechain(score, imp + 0.5 * wh, depth_db=3.0)
    fx = sfx + imp + wh
    mix = score + fx
    meter = pyln.Meter(SR)
    gain_db = 0.0
    out = mix
    for _ in range(5):
        out = E.limiter(mix * 10 ** (gain_db / 20), -1.3)
        lufs = meter.integrated_loudness(out)
        gain_db += -14.0 - lufs
        if abs(-14.0 - lufs) < 0.05:
            break
    g = 10 ** (gain_db / 20)
    no_music = E.limiter(fx * g, -1.3)
    here = os.path.dirname(os.path.abspath(__file__))
    for name, x in [('score', score * g), ('sfx', sfx * g), ('impacts', imp * g), ('whooshes', wh * g), ('final_mix', out), ('final_no_music', no_music)]:
        E.write(os.path.join(here, f'{name}.wav'), x)
    prem = os.path.join(here, '..', 'premiere_project', 'audio')
    os.makedirs(prem, exist_ok=True)
    for name, x in [('score', score * g), ('sfx', (sfx + wh) * g), ('impacts', imp * g)]:
        E.write(os.path.join(prem, f'{name}.wav'), np.clip(x, -1, 1), bits=24)
    studio = os.path.join(here, '..', 'src', 'studio')
    os.makedirs(studio, exist_ok=True)
    json.dump({'A1': peaks(score * g), 'A2': peaks(sfx * g), 'A3': peaks(imp * g), 'A4': peaks(wh * g)}, open(os.path.join(studio, 'waves.json'), 'w'))
    json.dump({'A1': frame_levels(score * g), 'A2': frame_levels(sfx * g), 'A3': frame_levels(imp * g), 'A4': frame_levels(wh * g), 'L': frame_levels(out[:, :1]), 'R': frame_levels(out[:, 1:])}, open(os.path.join(studio, 'levels.json'), 'w'))
    print(f'gain {gain_db:+.2f} dB | master {meter.integrated_loudness(out):.2f} LUFS, TP {E.true_peak_db(out):.2f} dBTP | no-music {meter.integrated_loudness(no_music):.2f} LUFS, TP {E.true_peak_db(no_music):.2f} dBTP')
    # loop check: level just before the end vs just after the start (should match closely)
    a = out[-int(0.25 * SR):]
    b = out[: int(0.25 * SR)]
    print('loop seam RMS dB: end %.1f  start %.1f' % (20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-12), 20 * np.log10(np.sqrt((b ** 2).mean()) + 1e-12)))


if __name__ == '__main__':
    main()
