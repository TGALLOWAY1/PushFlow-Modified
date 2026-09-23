/**
 * Rehearsal audio: a click track and audible pad hits for timeline playback.
 *
 * Playback used to be silent — a cursor sliding over coloured pills. You cannot
 * rehearse a groove you cannot hear: without a pulse there is nothing to place
 * your hands against, and without hearing the hits there is no way to tell
 * whether what you played matches what the layout asks for.
 *
 * This is deliberately synthesis-only (no samples, no network, no assets). Each
 * Sound gets a short percussive voice derived from its own identity, so the same
 * sound always sounds the same and two sounds are distinguishable. The point is
 * rhythmic reference, not realism.
 *
 * Everything is lazy and fault-tolerant: the AudioContext is created on first
 * use (browsers require a user gesture) and every call is safe to make when
 * audio is unavailable, so a muted or unsupported environment simply plays
 * silently rather than breaking the transport.
 */

/** A scheduled hit: which sound, and when in transport time. */
export interface RehearsalHit {
  /** Stable Sound identity — decides the timbre. */
  soundId: string;
  /** Transport time in seconds. */
  time: number;
  /** 0..127 MIDI velocity. */
  velocity?: number;
}

/** Which sounds are audible during rehearsal. */
export interface RehearsalAudioOptions {
  /** Play a click on each beat. */
  metronome: boolean;
  /** Play a tone for each performance hit. */
  hits: boolean;
  /** 0..1 output level. */
  volume: number;
}

export const DEFAULT_REHEARSAL_AUDIO: RehearsalAudioOptions = {
  metronome: true,
  hits: true,
  volume: 0.6,
};

/** Hashes a Sound id to a stable value in [0, 1). */
function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Derives a short percussive voice for a Sound from its identity.
 *
 * Low-hashing sounds get a body-heavy thump, high-hashing ones a bright tick,
 * which keeps a kit legible by ear without anyone having to pick timbres.
 */
function voiceForSound(soundId: string): {
  frequency: number;
  decay: number;
  noiseAmount: number;
  type: OscillatorType;
} {
  const u = hashUnit(soundId);
  return {
    // 60 Hz to ~900 Hz across the hash space, spaced so neighbours differ audibly.
    frequency: 60 * Math.pow(15, u),
    decay: 0.36 - 0.26 * u,
    noiseAmount: 0.15 + 0.6 * u,
    type: u > 0.55 ? 'triangle' : 'sine',
  };
}

export class RehearsalAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private options: RehearsalAudioOptions = { ...DEFAULT_REHEARSAL_AUDIO };
  /** Hits already played, keyed so a hit is never triggered twice. */
  private fired = new Set<string>();
  private unavailable = false;

  setOptions(options: RehearsalAudioOptions): void {
    this.options = options;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(options.volume, this.ctx.currentTime, 0.01);
    }
  }

  /**
   * Creates or resumes the AudioContext. Must be called from a user gesture the
   * first time, which is why it is separate from the constructor.
   */
  async resume(): Promise<void> {
    if (this.unavailable) return;
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) { this.unavailable = true; return; }
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.options.volume;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      // No audio in this environment; rehearsal stays visual.
      this.unavailable = true;
    }
  }

  /** Forgets which hits have played, so a seek or restart replays them. */
  reset(): void {
    this.fired.clear();
  }

  /** True when audio is running and something could be audible. */
  get isActive(): boolean {
    return !this.unavailable && this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Plays every hit that falls inside (fromTime, toTime].
   *
   * The transport advances by frame, so this is called with the slice of time
   * that just elapsed. Hits are de-duplicated by sound and timestamp so a
   * re-render or an overlapping frame cannot double-trigger them.
   */
  playWindow(hits: RehearsalHit[], fromTime: number, toTime: number): void {
    if (!this.options.hits || !this.isActive) return;
    for (const hit of hits) {
      if (hit.time <= fromTime || hit.time > toTime) continue;
      const key = `${hit.soundId}@${hit.time.toFixed(4)}`;
      if (this.fired.has(key)) continue;
      this.fired.add(key);
      this.strike(hit.soundId, (hit.velocity ?? 100) / 127);
    }
  }

  /**
   * Plays a metronome click for every beat crossed in (fromTime, toTime].
   * The downbeat of each bar is pitched higher so the player can hear where 1 is.
   */
  playMetronomeWindow(
    fromTime: number,
    toTime: number,
    tempo: number,
    beatsPerBar = 4,
  ): void {
    if (!this.options.metronome || !this.isActive || tempo <= 0) return;
    const secondsPerBeat = 60 / tempo;
    const firstBeat = Math.floor(fromTime / secondsPerBeat) + 1;
    const lastBeat = Math.floor(toTime / secondsPerBeat);
    for (let beat = firstBeat; beat <= lastBeat; beat++) {
      const key = `click@${beat}`;
      if (this.fired.has(key)) continue;
      this.fired.add(key);
      this.click(beat % beatsPerBar === 0);
    }
  }

  /** Plays one sound immediately — used when a pad is clicked. */
  preview(soundId: string): void {
    if (!this.isActive) return;
    this.strike(soundId, 0.85);
  }

  /** Releases audio resources. */
  dispose(): void {
    try { this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = null;
    this.master = null;
    this.fired.clear();
  }

  // ── Synthesis ────────────────────────────────────────────────────────────

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic pseudo-noise: same texture every session, and no reliance on
    // Math.random so the sound is reproducible.
    let seed = 1;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    return buffer;
  }

  private strike(soundId: string, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const { frequency, decay, noiseAmount, type } = voiceForSound(soundId);
    const now = ctx.currentTime;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain * 0.9, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    env.connect(master);

    // Pitched body with a short downward sweep — reads as a drum rather than a beep.
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency), now + decay * 0.6);
    osc.connect(env);
    osc.start(now);
    osc.stop(now + decay + 0.02);

    // Filtered noise transient for the attack.
    if (this.noiseBuffer && noiseAmount > 0) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = Math.min(9000, frequency * 4);
      band.Q.value = 0.9;
      const noiseEnv = ctx.createGain();
      noiseEnv.gain.setValueAtTime(gain * noiseAmount, now);
      noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.12, decay));
      noise.connect(band).connect(noiseEnv).connect(master);
      noise.start(now);
      noise.stop(now + 0.15);
    }
  }

  private click(isDownbeat: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(isDownbeat ? 0.32 : 0.18, now + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    env.connect(master);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = isDownbeat ? 1800 : 1200;
    osc.connect(env);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
