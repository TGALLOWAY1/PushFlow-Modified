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
 * The transport (transportEngine.ts) schedules sounds ahead at exact clock
 * times (scheduleHit, scheduleClick) and cancels what hasn't started when it
 * seeks or stops (cancelFrom). playWindow and playMetronomeWindow are the old
 * frame-driven path, kept behind a dev-only switch for one release (S4.3a).
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

/** Which sounds are audible during rehearsal, and how loud. */
export interface RehearsalAudioOptions {
  /** Play a click on each beat. */
  metronome: boolean;
  /** Play a tone for each performance hit. */
  hits: boolean;
  /** 0..1 output level. */
  volume: number;
  /** 0..1: the click's level, count-in included (S4.4, T59: the volume popover). */
  clickLevel: number;
  /** 0..1: the hits' level, auditions included (S4.4). */
  hitsLevel: number;
}

export const DEFAULT_REHEARSAL_AUDIO: RehearsalAudioOptions = {
  metronome: true,
  hits: true,
  volume: 0.6,
  clickLevel: 1,
  hitsLevel: 1,
};

/** A level as the options keep it: 0..1, and 1 for anything that isn't a number. */
export function clampLevel(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/** Whether audio can play right now, may soon (a context waiting to resume), or can't at all. */
export type AudioReadiness = 'running' | 'pending' | 'unavailable';

/** The audio clock: AudioContext.currentTime, and how far behind it what you hear is. */
export interface AudioClock {
  now(): number;
  /** Output latency in seconds: the playhead shows what is heard, not what was just rendered. */
  latency(): number;
}

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

/** One scheduled sound's nodes, so it can be cancelled before it starts. */
interface Voice {
  start: number;
  end: number;
  sources: AudioScheduledSourceNode[];
  /** The gains that reach the master bus: disconnecting them silences the voice. */
  outputs: GainNode[];
}

export class RehearsalAudio {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  /** The click's and the hits' own levels, before the master (S4.4). */
  private clickBus: GainNode | null = null;
  private hitsBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private options: RehearsalAudioOptions = { ...DEFAULT_REHEARSAL_AUDIO };
  /** Hits already played, keyed so a hit is never triggered twice (the frame-driven path). */
  private fired = new Set<string>();
  /** Sounds scheduled ahead and not yet over, oldest first. */
  private voices: Voice[] = [];
  private unavailable = false;
  /** A context handed in (an OfflineAudioContext in tests): never created, resumed or closed here. */
  private readonly external: boolean;

  constructor({ context }: { context?: BaseAudioContext } = {}) {
    this.external = !!context;
    if (context) this.attach(context);
  }

  setOptions(options: RehearsalAudioOptions): void {
    this.options = options;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(options.volume, now, 0.01);
      this.clickBus?.gain.setTargetAtTime(clampLevel(options.clickLevel), now, 0.01);
      this.hitsBus?.gain.setTargetAtTime(clampLevel(options.hitsLevel), now, 0.01);
    }
  }

  /**
   * Creates the AudioContext if there is none yet and asks it to resume.
   * Call it from a user gesture the first time. Says whether audio runs now.
   */
  ensure(): AudioReadiness {
    if (this.unavailable) return 'unavailable';
    if (!this.ctx) {
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) { this.unavailable = true; return 'unavailable'; }
        this.attach(new Ctor());
      } catch {
        this.unavailable = true;
        return 'unavailable';
      }
    }
    if (this.isActive) return 'running';
    void this.resume();
    return this.unavailable ? 'unavailable' : 'pending';
  }

  /**
   * Creates or resumes the AudioContext. Must be called from a user gesture the
   * first time, which is why it is separate from the constructor.
   */
  async resume(): Promise<void> {
    if (this.unavailable) return;
    try {
      if (!this.ctx) { this.ensure(); return; }
      const ctx = this.ctx as AudioContext;
      if (!this.external && ctx.state === 'suspended') await ctx.resume();
    } catch {
      // No audio in this environment; rehearsal stays visual.
      this.unavailable = true;
    }
  }

  /** Forgets which hits have played, so a seek or restart replays them (the frame-driven path). */
  reset(): void {
    this.fired.clear();
  }

  /** True when audio is running and something could be audible. */
  get isActive(): boolean {
    return !this.unavailable && this.ctx !== null && (this.ctx as AudioContext).state === 'running';
  }

  /** The audio clock while audio runs, else null. */
  clock(): AudioClock | null {
    if (!this.isActive || !this.ctx) return null;
    const ctx = this.ctx as AudioContext;
    return {
      now: () => ctx.currentTime,
      latency: () => {
        const latency = ctx.outputLatency || ctx.baseLatency || 0;
        return Number.isFinite(latency) && latency > 0 && latency < 0.5 ? latency : 0;
      },
    };
  }

  /** Schedules a hit of `soundId` at clock time `when`. */
  scheduleHit(soundId: string, when: number, velocity = 100): void {
    this.strike(soundId, velocity / 127, when);
  }

  /** Schedules a metronome click at clock time `when`; downbeats are pitched higher. */
  scheduleClick(when: number, downbeat: boolean): void {
    this.click(downbeat, when);
  }

  /** Cancels every scheduled sound due at or after clock time `when`; sounds already playing ring out. */
  cancelFrom(when: number): void {
    const kept: Voice[] = [];
    for (const voice of this.voices) {
      if (voice.start < when) { kept.push(voice); continue; }
      for (const output of voice.outputs) {
        try { output.disconnect(); } catch { /* already disconnected */ }
      }
      for (const source of voice.sources) {
        try { source.stop(0); } catch { /* already stopped */ }
      }
    }
    this.voices = kept;
  }

  /** How many scheduled sounds have not ended yet (for tests and the e2e hook). */
  get pendingSounds(): number {
    const now = this.ctx?.currentTime ?? 0;
    return this.voices.filter(v => v.end > now).length;
  }

  /**
   * Plays every hit that falls inside (fromTime, toTime], now: the old
   * frame-driven path (S4.3a keeps it behind a dev-only switch).
   *
   * The transport advances by frame, so this is called with the slice of time
   * that just elapsed. Hits are de-duplicated by sound and timestamp so a
   * re-render or an overlapping frame cannot double-trigger them.
   */
  playWindow(hits: readonly RehearsalHit[], fromTime: number, toTime: number): void {
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
   * Plays a metronome click, now, for every beat crossed in (fromTime,
   * toTime]: the old frame-driven path. The downbeat of each bar is pitched
   * higher so the player can hear where 1 is.
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

  /** Plays one sound immediately, when audio is running. */
  preview(soundId: string): void {
    if (!this.isActive) return;
    this.strike(soundId, 0.85);
  }

  /**
   * An audition (S4.4, T59): plays one Sound now, at the hits' level, whether
   * or not Hits, Mute or Solo would silence it in playback, since asking to
   * hear it is the point. Call it from a gesture: it starts audio if needed and
   * plays once audio runs.
   */
  audition(soundId: string): void {
    if (this.ensure() === 'unavailable') return;
    if (this.isActive) this.preview(soundId);
    else void this.resume().then(() => this.preview(soundId));
  }

  /** Releases audio resources. */
  dispose(): void {
    if (!this.external) {
      try { void (this.ctx as AudioContext | null)?.close(); } catch { /* already closed */ }
    }
    this.ctx = null;
    this.master = null;
    this.clickBus = null;
    this.hitsBus = null;
    this.voices = [];
    this.fired.clear();
  }

  // ── Synthesis ────────────────────────────────────────────────────────────

  private attach(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.options.volume;
    this.master.connect(ctx.destination);
    this.clickBus = ctx.createGain();
    this.clickBus.gain.value = clampLevel(this.options.clickLevel);
    this.clickBus.connect(this.master);
    this.hitsBus = ctx.createGain();
    this.hitsBus.gain.value = clampLevel(this.options.hitsLevel);
    this.hitsBus.connect(this.master);
    this.noiseBuffer = this.createNoiseBuffer(ctx);
  }

  private createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
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

  /** Keeps a scheduled sound's nodes until it is over, and forgets finished ones. */
  private track(voice: Voice): void {
    const now = this.ctx?.currentTime ?? 0;
    if (this.voices.length > 64) this.voices = this.voices.filter(v => v.end > now);
    this.voices.push(voice);
  }

  private strike(soundId: string, gain: number, at?: number): void {
    const ctx = this.ctx;
    const master = this.hitsBus;
    if (!ctx || !master) return;

    const { frequency, decay, noiseAmount, type } = voiceForSound(soundId);
    const now = at ?? ctx.currentTime;

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
    const sources: AudioScheduledSourceNode[] = [osc];
    const outputs: GainNode[] = [env];

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
      sources.push(noise);
      outputs.push(noiseEnv);
    }
    if (at !== undefined) this.track({ start: now, end: now + decay + 0.02, sources, outputs });
  }

  private click(isDownbeat: boolean, at?: number): void {
    const ctx = this.ctx;
    const master = this.clickBus;
    if (!ctx || !master) return;
    const now = at ?? ctx.currentTime;

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
    if (at !== undefined) this.track({ start: now, end: now + 0.06, sources: [osc], outputs: [env] });
  }
}
