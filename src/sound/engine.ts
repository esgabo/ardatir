// The sound itself: noise, filters and envelopes in the Web Audio API (DESIGN §9.5).
//
// Nothing here is a recording, and that is the whole design. A sampled ambience bed for every
// place would be tens of megabytes in a repository that cannot use LFS, a licence to track for
// each file, and someone else's wood standing in for ours. These are a few simple shapes — noise
// through a filter, an envelope, a pulse — which is the same bargain the faceted terrain makes:
// obviously made, cheap, and ours.
//
// The bed (wind, leaves, water, fire, crickets, birds, drips) runs on the audio clock, as the
// shimmer and the drift do on `ambient` seconds: it is idle motion, and no story depends on where
// in a gust you are. Everything that belongs to the story — a footstep, a knock — arrives as a
// `Cue` decided purely from `t` in sound/cues.ts, so it cannot drift away from the picture.
//
// Loaded with a dynamic import() from main.ts, so a visitor who never unmutes never fetches it.

import type { Layers } from './scape';
import type { CueKind } from '../data/types';
import type { Cue } from './cues';

/** How loud the whole thing is at most: sound is a layer over the scene, never the scene. */
const MASTER = 0.5;
/** How far ahead sparse events (birds, crackles, drips) are scheduled, in seconds. */
const LOOKAHEAD = 0.35;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** A deterministic little generator, so a session sounds the same twice over. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** One second of white noise, shared by every layer that needs it. */
function noiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(20261125);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return buf;
}

/**
 * A room's tail, built rather than recorded: noise with an exponential decay, a little later in
 * the right channel so it has width. `room` in the scape sets how much of it is heard, which is
 * what tells the ear whether a sound is in a hall, a cave or out of doors.
 */
function roomImpulse(ctx: BaseAudioContext, seconds = 1.7): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const r = rng(7771);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const pre = Math.floor(ctx.sampleRate * (c ? 0.013 : 0.007));
    for (let i = pre; i < n; i++) {
      const u = (i - pre) / (n - pre);
      d[i] = (r() * 2 - 1) * Math.pow(1 - u, 2.6) * (1 - 0.4 * u);
    }
  }
  return buf;
}

/**
 * A looping noise source through one filter, gusting, with its own level: the shape every bed
 * layer takes. The gust is a slow wave *multiplying* the layer rather than added to it, so a
 * faint layer gusts faintly and the level the scape asks for is still the level you hear.
 */
function bed(
  ctx: AudioContext, noise: AudioBuffer, out: AudioNode,
  type: BiquadFilterType, freq: number, q: number,
  gust?: { amount: number; hz: number; phase?: number },
): GainNode {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  // The gust rides at 1 ± amount, and the level multiplies it.
  const swing = ctx.createGain();
  swing.gain.value = 1;
  if (gust) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = gust.hz;
    const depth = ctx.createGain();
    depth.gain.value = gust.amount;
    osc.connect(depth).connect(swing.gain);
    osc.start(ctx.currentTime + (gust.phase ?? 0));
  }
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(swing).connect(g).connect(out);
  src.start();
  return g;
}

type Sparse = 'birds' | 'night' | 'fire' | 'drip';

export class Soundstage {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly noise: AudioBuffer;
  private readonly beds: Record<'wind' | 'leaves' | 'water' | 'fire' | 'night', GainNode>;
  private readonly rand = rng(31337);
  /** Where each sparse layer has scheduled up to, on the audio clock. */
  private readonly next: Record<Sparse, number> = { birds: 0, night: 0, fire: 0, drip: 0 };
  private layers: Layers | null = null;
  private muted = false;
  private volume = 1;
  private closed = false;

  constructor() {
    const Ctx: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    this.noise = noiseBuffer(ctx);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Everything goes out dry, and again through the room's tail; `room` sets how much of the
    // second one is heard, so the same footstep is a footstep in a field or in a cave.
    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.dry.connect(conv).connect(this.wet).connect(this.master);

    const out = this.dry;
    this.beds = {
      // Open air: almost all of it below a few hundred hertz, gusting. The wind and the leaves
      // breathe at close but different rates, so the two never pump together.
      wind: bed(ctx, this.noise, out, 'lowpass', 420, 0.7, { amount: 0.5, hz: 0.055 }),
      // The same air in leaves: a band up where dry leaves live.
      leaves: bed(ctx, this.noise, out, 'bandpass', 2100, 0.6, { amount: 0.55, hz: 0.083, phase: 0.4 }),
      // Running water: wider and steadier, with a little movement in it.
      water: bed(ctx, this.noise, out, 'bandpass', 900, 0.4, { amount: 0.12, hz: 0.13 }),
      // A fire's body, under the crackles that carry it.
      fire: bed(ctx, this.noise, out, 'lowpass', 320, 0.8, { amount: 0.18, hz: 0.21 }),
      // The night behind the crickets: faint, high and even.
      night: bed(ctx, this.noise, out, 'highpass', 3600, 0.5),
    };
  }

  /** The audio clock may start suspended until a gesture; the play button is one. */
  async resume(): Promise<void> {
    if (this.closed) return;
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => { /* still blocked */ });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * What is heard now, and how much of it. `volume` carries the duck under narration, so the
   * bed steps back while a passage is read and comes up again after it.
   */
  set(layers: Layers, volume: number): void {
    this.layers = layers;
    this.volume = clamp(volume, 0, 1);
    if (this.closed) return;
    const t = this.ctx.currentTime;
    const level = this.muted ? 0 : MASTER * this.volume;
    this.master.gain.setTargetAtTime(level, t, 0.12);
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.5);
    set(this.beds.wind, layers.wind * 0.5);
    set(this.beds.leaves, layers.leaves * 0.32);
    set(this.beds.water, layers.water * 0.34);
    set(this.beds.fire, layers.fire * 0.3);
    set(this.beds.night, layers.night * 0.045);
    this.wet.gain.setTargetAtTime(0.08 + layers.room * 0.5, t, 0.6);
  }

  /** Schedule the sparse parts of the bed a little ahead. Call it every frame. */
  tick(): void {
    if (this.closed || this.muted || !this.layers || this.ctx.state !== 'running') return;
    const l = this.layers;
    const until = this.ctx.currentTime + LOOKAHEAD;
    this.sparse('birds', l.birds, until, 0.5, 5.5, (at, g) => this.birdCall(at, g));
    this.sparse('night', l.night, until, 0.18, 0.55, (at, g) => this.cricket(at, g));
    this.sparse('fire', l.fire, until, 0.035, 0.22, (at, g) => this.crackle(at, g));
    this.sparse('drip', l.drip, until, 1.2, 7, (at, g) => this.drip(at, g));
  }

  /**
   * Keep one sparse layer fed up to `until`. The gap between events runs from `slow` down to
   * `fast` as the layer comes up, so a loud layer is busy and a faint one is occasional, and the
   * gaps are uneven, because nothing in a wood is on a metronome.
   */
  private sparse(
    key: Sparse, gain: number, until: number, fast: number, slow: number,
    make: (at: number, gain: number) => void,
  ): void {
    if (gain < 0.02) { this.next[key] = 0; return; }
    const now = this.ctx.currentTime;
    if (this.next[key] < now) this.next[key] = now + this.rand() * fast;
    const mean = slow + (fast - slow) * Math.min(1, gain);
    let guard = 0;
    while (this.next[key] < until && guard++ < 24) {
      make(this.next[key], gain);
      this.next[key] += mean * (0.45 + 1.1 * this.rand());
    }
  }

  // ---- the voices: each is an envelope on a filtered noise burst or a short oscillator -------

  /** A burst of noise through a band, with an attack and a decay: most sounds are this. */
  private burst(at: number, gain: number, freq: number, q: number, attack: number, decay: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.7 + this.rand() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    src.connect(f).connect(g).connect(this.dry);
    src.start(at);
    src.stop(at + attack + decay + 0.02);
  }

  /** A short tone that slides: a bird, a chime, a hoot. */
  private tone(at: number, gain: number, from: number, to: number, length: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + Math.min(0.02, length * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(g).connect(this.dry);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** Two to four notes up and down: a songbird, heard across a garden. */
  private birdCall(at: number, gain: number): void {
    const notes = 2 + Math.floor(this.rand() * 3);
    const base = 2200 + this.rand() * 1600;
    for (let i = 0; i < notes; i++) {
      const up = this.rand() > 0.45;
      const f = base * (1 + i * 0.07);
      this.tone(at + i * (0.07 + this.rand() * 0.06), gain * 0.1, up ? f : f * 1.4, up ? f * 1.4 : f, 0.055 + this.rand() * 0.04);
    }
  }

  /** A cricket's trill: a few very short high bursts in a row. Now and then an owl instead. */
  private cricket(at: number, gain: number): void {
    if (this.rand() < 0.02) {
      this.tone(at, gain * 0.16, 400, 330, 0.3);
      this.tone(at + 0.42, gain * 0.13, 390, 320, 0.36);
      return;
    }
    const n = 3 + Math.floor(this.rand() * 3);
    for (let i = 0; i < n; i++) this.burst(at + i * 0.035, gain * 0.055, 4300 + this.rand() * 900, 14, 0.002, 0.016);
  }

  /** A fire: a pop with a little wood in it. */
  private crackle(at: number, gain: number): void {
    this.burst(at, gain * (0.08 + this.rand() * 0.16), 900 + this.rand() * 2200, 5, 0.001, 0.02 + this.rand() * 0.05);
  }

  /** Water off stone: a drop, and the pitch of the little pool it falls in. */
  private drip(at: number, gain: number): void {
    this.tone(at, gain * 0.14, 1500 + this.rand() * 900, 600, 0.09);
    this.burst(at, gain * 0.05, 2600, 2, 0.001, 0.03);
  }

  // ---- the cues (sound/cues.ts): a sound that belongs to a moment in the story ---------------

  /** Play one cue now. Unknown kinds are ignored rather than guessed at. */
  play(cue: Cue): void {
    if (this.closed || this.muted || this.ctx.state !== 'running') return;
    const at = this.ctx.currentTime + 0.01;
    const g = clamp(cue.gain, 0, 2);
    const voice = VOICES[cue.kind];
    if (voice) voice(this, at, g);
  }

  // The cue voices live here as methods so they can reach `burst` and `tone`.
  cueStep(at: number, g: number): void {
    // A foot on ground: a low thump with a scuff of grit over it.
    this.burst(at, g * 0.075, 150 + this.rand() * 90, 1.2, 0.002, 0.075, 'lowpass');
    this.burst(at + 0.006, g * 0.022, 2600 + this.rand() * 1400, 1.4, 0.002, 0.045);
  }

  cueKnock(at: number, g: number): void {
    for (let i = 0; i < 3; i++) {
      const t = at + i * 0.17;
      this.burst(t, g * 0.3, 190, 2.4, 0.001, 0.11, 'lowpass');
      this.burst(t, g * 0.1, 1100, 3, 0.001, 0.05);
    }
  }

  cueDoor(at: number, g: number): void {
    // The leaf: a creak that rises and slows, then the latch dropping into its keeper.
    this.tone(at, g * 0.05, 300, 420, 0.5, 'sawtooth');
    this.burst(at + 0.05, g * 0.05, 700, 1, 0.1, 0.4);
    this.burst(at + 0.62, g * 0.2, 2300, 6, 0.001, 0.06);
    this.burst(at + 0.62, g * 0.14, 240, 2, 0.001, 0.09, 'lowpass');
  }

  cueThud(at: number, g: number): void {
    this.burst(at, g * 0.34, 95, 1.1, 0.003, 0.22, 'lowpass');
    this.burst(at, g * 0.06, 900, 1, 0.002, 0.08);
  }

  cueClang(at: number, g: number): void {
    // Metal is a few partials that are not in tune with each other, ringing on.
    [1, 2.76, 5.4, 8.9].forEach((m, i) => this.tone(at, (g * 0.1) / (i + 1), 520 * m, 505 * m, 0.6 + 0.5 * this.rand()));
    this.burst(at, g * 0.1, 3800, 2, 0.001, 0.05);
  }

  cueSplash(at: number, g: number): void {
    this.burst(at, g * 0.28, 1500, 0.6, 0.004, 0.16);
    this.burst(at + 0.04, g * 0.12, 3200, 0.8, 0.02, 0.4);
  }

  cueCrack(at: number, g: number): void {
    this.burst(at, g * 0.36, 1700, 1.6, 0.0008, 0.035);
    this.burst(at + 0.01, g * 0.12, 420, 1.4, 0.002, 0.14, 'lowpass');
  }

  cueWhoosh(at: number, g: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(260, at);
    f.frequency.exponentialRampToValueAtTime(1500, at + 0.22);
    f.frequency.exponentialRampToValueAtTime(240, at + 0.5);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, at);
    gn.gain.linearRampToValueAtTime(g * 0.18, at + 0.18);
    gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.52);
    src.connect(f).connect(gn).connect(this.dry);
    src.start(at);
    src.stop(at + 0.55);
  }

  cueWings(at: number, g: number): void {
    // One slow beat: air pushed down, then the feathers closing.
    this.burst(at, g * 0.16, 180, 0.9, 0.06, 0.2, 'lowpass');
    this.burst(at + 0.22, g * 0.07, 1400, 0.8, 0.03, 0.14);
  }

  cueRumble(at: number, g: number): void {
    this.burst(at, g * 0.4, 70, 0.8, 0.25, 1.5, 'lowpass');
    this.burst(at + 0.1, g * 0.07, 300, 0.7, 0.3, 1.2, 'lowpass');
  }

  cueChime(at: number, g: number): void {
    [1, 2.01, 3.03, 4.8].forEach((m, i) => this.tone(at, (g * 0.09) / (i * 1.6 + 1), 880 * m, 876 * m, 1.6 - i * 0.2));
  }

  cuePour(at: number, g: number): void {
    // The stream, with the vessel's note rising as it fills.
    this.burst(at, g * 0.1, 2400, 1.2, 0.06, 0.75);
    for (let i = 0; i < 7; i++) this.tone(at + 0.07 * i, g * 0.035, 300 + i * 55, 330 + i * 60, 0.09);
  }

  cueClatter(at: number, g: number): void {
    const n = 3 + Math.floor(this.rand() * 4);
    for (let i = 0; i < n; i++) {
      const t = at + this.rand() * 0.22;
      this.burst(t, g * 0.09, 2200 + this.rand() * 2600, 7, 0.001, 0.05 + this.rand() * 0.07);
      this.tone(t, g * 0.03, 1400 + this.rand() * 900, 1350, 0.12);
    }
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.master.gain.value = 0;
    void this.ctx.close().catch(() => { /* already gone */ });
  }
}

/** Which method makes each cue. Kept as a table so an unknown kind simply makes no sound. */
const VOICES: Partial<Record<CueKind, (s: Soundstage, at: number, g: number) => void>> = {
  step: (s, at, g) => s.cueStep(at, g),
  knock: (s, at, g) => s.cueKnock(at, g),
  door: (s, at, g) => s.cueDoor(at, g),
  thud: (s, at, g) => s.cueThud(at, g),
  clang: (s, at, g) => s.cueClang(at, g),
  splash: (s, at, g) => s.cueSplash(at, g),
  crack: (s, at, g) => s.cueCrack(at, g),
  whoosh: (s, at, g) => s.cueWhoosh(at, g),
  wings: (s, at, g) => s.cueWings(at, g),
  rumble: (s, at, g) => s.cueRumble(at, g),
  chime: (s, at, g) => s.cueChime(at, g),
  pour: (s, at, g) => s.cuePour(at, g),
  clatter: (s, at, g) => s.cueClatter(at, g),
};
