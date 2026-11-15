#!/usr/bin/env python3
"""Melody guides for MusicGen-melody: our notes, dry and plain, so its chromagram hears the tune.

MusicGen-melody reads the pitch classes (a chromagram) of a guide and writes its own music over them.
It conditions on up to 30 s, so each guide is one section of creation.py's score:

  guide-theme.wav    30 s  the motif alone, then with its chords (creation.py 8-38 s)
  guide-discord.wav  16 s  the motif in the horns against Melkor's D-Ab figure, resolving to A (40-56 s)
"""
import os

import numpy as np

import creation as c

OUT = os.path.dirname(os.path.abspath(__file__))


def render(length, build):
    mix = np.zeros((2, int(length * c.SR)))

    def place(buf, at, gain):
        s = int(at * c.SR)
        e = min(s + buf.shape[1], mix.shape[1])
        mix[:, s:e] += gain * buf[:, : e - s]

    build(place)
    fade = np.clip((length - np.arange(mix.shape[1]) / c.SR) / 0.5, 0, 1)
    mix *= fade
    return mix / np.abs(mix).max() * 0.9


def theme(place):
    for b, d, n in c.MOTIF:                                      # the tune alone
        place(c.horn(n, d), b, 0.5)
    for b, d, n in c.MOTIF:                                      # again, over its chords
        place(c.horn(n, d), 16 + b, 0.5)
    for i, chord in enumerate(c.PROGRESSION):
        for n in chord[1:]:
            place(c.strings(n, 4.0, voices=1), 16 + 4 * i, 0.12)


def discord(place):
    for b, d, n in c.shift(c.MOTIF, -12):
        place(c.horn(n, d), b, 0.45)
    at, i = 0.5, 0
    while at < 14:
        n = c.DISCORD_FIGURE[i % len(c.DISCORD_FIGURE)]
        if at >= 11:
            n = "A3" if n != "D3" else "E3"
        place(c.discord(n, 0.6), at, 0.25)
        at += c.DISCORD_STEP
        i += 1


if __name__ == "__main__":
    for name, length, build in [("guide-theme", 30, theme), ("guide-discord", 16, discord)]:
        path = os.path.join(OUT, name + ".wav")
        c.write_wav(path, render(length, build))
        print("wrote", path)
