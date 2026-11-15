#!/usr/bin/env python3
"""Ardatir music, proof of concept: the Music of the Ainur motif, in the "creation" theme.

Every sound is synthesized here from sine waves and noise: no samples, nothing borrowed.
Deterministic (fixed seed), so the same score always renders the same audio.

    python3 out/music/creation.py            # writes out/music/creation.wav (then ffmpeg makes the mp3)

Form (seconds, at 60 bpm one beat = one second):
   0  The Void: a low open fifth on D, and a faint wind.
   8  One small choir sings the motif alone: the first theme.
  24  The full choir takes it up; strings enter beneath; violins sing a countermelody above.
  40  Melkor's discord: a harsh unison figure, the motif's fifth bent to a tritone (D-Ab), hammered
      over and over with a grinding noise, while the horns hold the motif against it.
  50  The violins rise over it; the discord falters, and its Ab resolves to A: woven into the theme.
  56  It settles: the last phrase in the choir, coming home to D. The Void again.

The motif (D Lydian colour): D A | B C# A | E D A  (rising fifth, a climb, an open ending on A).
At the very end it closes on D instead: the theme fulfilled.
"""
import os
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(1)
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- pitch

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(s: str) -> int:
    acc = {"#": 1, "b": -1}.get(s[1], 0)
    return 12 * (int(s[1 + abs(acc):]) + 1) + NAMES[s[0]] + acc


def hz(m: int) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def name(m: int) -> str:
    return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][m % 12] + str(m // 12 - 1)


# ---------------------------------------------------------------- the score

# (beat, length, note): the Music of the Ainur
MOTIF = [(0, 2, "D4"), (2, 2, "A4"), (4, 1, "B4"), (5, 1, "C#5"), (6, 3, "A4"),
         (9, 2, "E5"), (11, 1, "D5"), (12, 4, "A4")]

# D add9, B minor 7, G major 9, A: four bars of four beats under one statement of the motif
PROGRESSION = [["D2", "D3", "A3", "E4", "F#4"],
               ["B1", "B2", "F#3", "D4", "A4"],
               ["G1", "G2", "D3", "B3", "F#4"],
               ["A1", "A2", "E3", "C#4", "E4"]]

HARMONY_LOW = [(0, 4, "F#4"), (4, 4, "D4"), (8, 4, "B3"), (12, 4, "C#4")]
HARMONY_HIGH = [(0, 4, "A4"), (4, 4, "F#4"), (8, 4, "D5"), (12, 4, "E5")]

VIOLINS_COUNTER = [(0, 2, "A5"), (2, 4, "F#5"), (6, 2, "E5"), (8, 3, "B5"), (11, 1, "A5"), (12, 4, "C#6")]
VIOLINS_RISE = [(8, 2, "B5"), (10, 2, "D6"), (12, 4, "E6")]  # over Melkor's last notes

# Melkor: few notes, loud, in unison, repeated; the fifth bent to a tritone. Then it gives way:
# from DISCORD_YIELD its notes become A and E, part of the theme's A chord.
DISCORD_FIGURE = ["D3", "Ab3", "D3", "Ab3", "G3", "Ab3"]
DISCORD_START, DISCORD_PEAK, DISCORD_YIELD, DISCORD_END, DISCORD_STEP = 40.5, 49.5, 51.0, 54.0, 0.75

FINAL_PHRASE = [(0, 2, "D5"), (2, 2, "A4"), (4, 2, "E5"), (6, 2, "C#5"), (8, 7, "D5")]


def shift(line, semitones):
    return [(b, d, name(midi(n) + semitones)) for b, d, n in line]


# ---------------------------------------------------------------- sound

def envelope(dur, attack, release):
    n_on = max(1, int(dur * SR))
    n_r = int(release * SR)
    e = np.ones(n_on + n_r)
    na = min(int(attack * SR), n_on)
    if na > 0:
        e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if n_r > 0:
        e[n_on:] = e[n_on - 1] * np.cos(np.linspace(0, np.pi / 2, n_r)) ** 2
    return e


def phase_of(f0, n, vib_rate, vib_depth, vib_delay=0.6):
    t = np.arange(n) / SR
    ramp = np.clip((t - vib_delay) / 1.2, 0, 1)
    f = f0 * (1 + vib_depth * ramp * np.sin(2 * np.pi * vib_rate * t + rng.uniform(0, 2 * np.pi)))
    return 2 * np.pi * np.cumsum(f) / SR


def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def additive(f0, env, amp, voices, detune_cents, vib_rate, vib_depth, fmax, bright=0.0, spread=0.6):
    """An ensemble of slightly detuned voices, each a sum of harmonics weighted by amp(k, freq)."""
    n = len(env)
    out = np.zeros((2, n))
    for _ in range(voices):
        f = f0 * 2 ** (rng.uniform(-detune_cents, detune_cents) / 1200)
        ph = phase_of(f, n, vib_rate * rng.uniform(0.9, 1.1), vib_depth)
        sig = np.zeros(n)
        k = 1
        while k * f < fmax:
            a = amp(k, k * f)
            if a > 1e-3:
                part = np.sin(k * ph + rng.uniform(0, 2 * np.pi))
                if bright:  # upper harmonics bloom with loudness, as a played note does
                    part *= env ** (bright * (k - 1))
                sig += a * part
            k += 1
        left, right = pan_gains(rng.uniform(-spread, spread) if voices > 1 else 0.0)
        out[0] += left * sig * env
        out[1] += right * sig * env
    return out / np.sqrt(voices)


AH = [(700, 1.0, 130), (1220, 0.45, 140), (2600, 0.22, 200), (3300, 0.08, 250)]


def formant(freq):
    return 0.03 + sum(a * np.exp(-0.5 * ((freq - fc) / bw) ** 2) for fc, a, bw in AH)


def choir(note, dur, voices=5):
    env = envelope(dur, 0.55, 1.6)
    return additive(hz(midi(note)), env, lambda k, f: formant(f) * k ** -0.3, voices, 9, 5.2, 0.006, 6000)


def strings(note, dur, voices=3):
    env = envelope(dur, 1.4, 2.2)
    return additive(hz(midi(note)), env, lambda k, f: np.exp(-f / 2200) / k, voices, 12, 4.8, 0.003, 9000)


def violins(note, dur, voices=6):
    """A violin section: bright, with body resonances, a quicker vibrato and a little bow noise."""
    f0 = hz(midi(note))
    env = envelope(dur, 0.3, 1.3)
    body = lambda f: 0.4 + np.exp(-0.5 * ((f - 450) / 150) ** 2) + 0.8 * np.exp(-0.5 * ((f - 2900) / 700) ** 2)
    out = additive(f0, env, lambda k, f: body(f) * np.exp(-f / 6000) / k ** 0.9, voices, 10, 5.8, 0.007, 11000,
                   spread=0.5)
    bow = band_noise(len(env), 4500, 1500) * env * 0.03
    return out + np.stack([bow, bow])


def discord(note, dur):
    """Melkor: a raw, buzzing unison, every harmonic at full strength, roughly tuned, overdriven."""
    env = envelope(dur, 0.03, 0.18)
    x = additive(hz(midi(note)), env, lambda k, f: 1.0 / k, 6, 28, 7.0, 0.012, 9000, spread=0.3)
    return np.tanh(2.5 * x / np.abs(x).max())


def grinding_noise(dur, step, rise, fall):
    """The noise of Melkor's music: a dark roar and a grinding band, pulsing with his figure."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    level = np.clip(t / rise, 0, 1) ** 1.5 * np.clip((dur - t) / fall, 0, 1)
    pulse = 0.55 + 0.45 * np.exp(-(t % step) / 0.18)
    out = np.zeros((2, n))
    for c in range(2):
        roar = band_noise(n, 140, 120)
        grind = band_noise(n, 1900, 600) * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t + c))
        out[c] = np.tanh(2.2 * (roar + 0.6 * grind) * pulse) * level
    return out


def horn(note, dur):
    env = envelope(dur, 0.2, 1.1)
    return additive(hz(midi(note)), env, lambda k, f: np.exp(-f / 1400) / k ** 0.8, 2, 4, 4.5, 0.003, 6000,
                    bright=0.15, spread=0.2)


def bell(note, dur=4.5):
    f0 = hz(midi(note))
    t = np.arange(int(dur * SR)) / SR
    index = 2.2 * np.exp(-t / 0.5) + 0.25
    y = np.sin(2 * np.pi * f0 * t + index * np.sin(2 * np.pi * 3.5 * f0 * t)) * np.exp(-t / 1.6)
    y += 0.3 * np.sin(2 * np.pi * 2.0 * f0 * t) * np.exp(-t / 0.8)
    y *= np.clip(t / 0.004, 0, 1)
    left, right = pan_gains(rng.uniform(-0.5, 0.5))
    return np.stack([left * y, right * y])


def band_noise(n, centre, width):
    x = np.fft.rfft(rng.standard_normal(n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    y = np.fft.irfft(x * np.exp(-0.5 * ((fr - centre) / width) ** 2), n)
    return y / np.abs(y).max()


def drone(total):
    n = int(total * SR)
    t = np.arange(n) / SR
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * 0.06 * t)
    tone = (0.5 * np.sin(2 * np.pi * hz(midi("D2")) * t)
            + 0.3 * np.sin(2 * np.pi * hz(midi("A2")) * t + 1.0)
            + 0.25 * np.sin(2 * np.pi * hz(midi("D1")) * t)) * swell
    out = np.zeros((2, n))
    for c in range(2):
        wind = band_noise(n, 520, 380) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.045 * t + rng.uniform(0, 6)))
        out[c] = tone + 0.18 * wind
    fade = np.clip(t / 10, 0, 1) * np.clip((total - t) / 12, 0, 1)
    return out * fade ** 2


def reverb(x, rt60=4.8, length=5.5, wet=0.45):
    """A long, dark hall from decaying noise: the space the Music fills."""
    n_ir = int(length * SR)
    t = np.arange(n_ir) / SR
    ir = rng.standard_normal((2, n_ir)) * np.exp(-6.91 * t / rt60)
    spec = np.fft.rfft(ir, axis=1) * np.exp(-np.fft.rfftfreq(n_ir, 1 / SR) / 4500)
    ir = np.fft.irfft(spec, n_ir, axis=1)
    ir[:, : int(0.02 * SR)] = 0
    n = x.shape[1] + n_ir
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft, axis=1) * np.fft.rfft(ir, nfft, axis=1), nfft, axis=1)[:, : x.shape[1]]
    y *= np.sqrt((x ** 2).mean()) / max(np.sqrt((y ** 2).mean()), 1e-12)
    return (1 - wet) * x + wet * y


# ---------------------------------------------------------------- render

TOTAL = 86.0


def render():
    mix = np.zeros((2, int(TOTAL * SR)))

    def place(buf, at, gain):
        s = int(at * SR)
        e = min(s + buf.shape[1], mix.shape[1])
        mix[:, s:e] += gain * buf[:, : e - s]

    def line(inst, notes, at, gain, **kw):
        for b, d, n in notes:
            place(inst(n, d, **kw), at + b, gain)

    def chords(at, bars, gain):
        for i, chord in enumerate(bars):
            for n in chord:
                place(strings(n, 4.2), at + 4 * i, gain * (1.3 if midi(n) < midi("C3") else 1.0))

    place(drone(TOTAL), 0, 0.30)                                        # the Void

    line(choir, MOTIF, 8, 0.50, voices=2)                               # the first theme, alone

    line(choir, MOTIF, 24, 0.42)                                        # taken up by all
    line(choir, HARMONY_LOW, 24, 0.22, voices=4)
    chords(24, PROGRESSION, 0.10)
    line(violins, VIOLINS_COUNTER, 24, 0.16)

    line(horn, shift(MOTIF, -12), 40, 0.46)                             # the theme holds...
    line(choir, HARMONY_LOW, 40, 0.24, voices=4)
    line(choir, HARMONY_HIGH, 40, 0.20, voices=4)
    chords(40, PROGRESSION, 0.13)

    at, i = DISCORD_START, 0                                            # ...against Melkor's discord
    while at < DISCORD_END:
        note = DISCORD_FIGURE[i % len(DISCORD_FIGURE)]
        if at >= DISCORD_YIELD:                                         # it gives way, into the A chord
            note = "A3" if note != "D3" else "E3"
        rise = min(1.0, (at - DISCORD_START) / (DISCORD_PEAK - DISCORD_START))
        fall = np.clip((DISCORD_END - at) / (DISCORD_END - DISCORD_PEAK), 0, 1)
        place(discord(note, DISCORD_STEP * 0.85), at, 0.34 * (0.35 + 0.65 * rise) * fall)
        at += DISCORD_STEP
        i += 1
    place(grinding_noise(DISCORD_END - DISCORD_START + 1.0, DISCORD_STEP, 8.0, 4.0), DISCORD_START, 0.26)
    line(violins, VIOLINS_RISE, 40, 0.20)                               # the theme rises over it

    chords(56, [PROGRESSION[2], PROGRESSION[3]], 0.11)                  # coming home
    for n in ["D2", "D3", "A3", "F#4", "A4"]:                           # the long D at the close
        place(strings(n, 12), 64, 0.10 * (1.3 if midi(n) < midi("C3") else 1.0))
    line(choir, FINAL_PHRASE, 56, 0.40)
    for at, n in [(64, "A5"), (65.5, "D6"), (68, "A5"), (71, "D5")]:
        place(bell(n), at, 0.07)

    out = reverb(mix)
    fade_out = np.clip((TOTAL - np.arange(out.shape[1]) / SR) / 1.5, 0, 1)
    out *= fade_out
    out /= np.abs(out).max() / 0.9
    out = np.tanh(1.2 * out) / np.tanh(1.2)
    return out


def write_wav(path, x):
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    path = os.path.join(HERE, "creation.wav")
    write_wav(path, render())
    print("wrote", path)
