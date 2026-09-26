/**
 * PerformanceEvent: A time-stamped trigger in the musical sequence.
 *
 * This is the atomic timeline unit the execution plan must realize.
 * Canonical term per PROJECT_TERMINOLOGY_TABLE.MD.
 */

/**
 * Canonical window for grouping notes into moments.
 * Notes within this window (in seconds) are considered simultaneous.
 * This is the single source of truth — no other epsilon should be used.
 *
 * 25 ms is a performance window, not a floating-point tolerance. At 1 ms — the
 * previous value — any humanized, played-in or groove-quantized chord shattered
 * into separate moments, and the engine then charged a hand for "moving" between
 * two pads it was striking together. The same three-note chord scored 1.86 when
 * perfectly quantized and 3936 with its notes 2 ms apart, where it was also
 * declared partly unplayable. Most real MIDI is not perfectly quantized.
 *
 * 25 ms is below the threshold at which two drum hits are heard as separate
 * (about 30 ms) and comfortably above the timing spread of a hand-played chord,
 * so it groups what a player performs as one gesture without merging hits they
 * intended as distinct — at 240 BPM a 32nd note is still 31 ms.
 */
export const MOMENT_EPSILON = 0.025;

/**
 * A single performance event (formerly NoteEvent in Version1).
 *
 * Represents a MIDI note event with timing, dynamics, and identity.
 */
export interface PerformanceEvent {
  /** MIDI note number (0-127). Retained as provenance metadata. */
  noteNumber: number;
  /**
   * Stable voice identity (SoundStream.id or Voice.id).
   * This is the canonical solver-facing identity — not pitch.
   * When present, the solver uses this to look up pad assignments
   * instead of relying on noteNumber alone.
   */
  voiceId?: string;
  /** Absolute start time in seconds. */
  startTime: number;
  /** Duration in seconds (optional). */
  duration?: number;
  /** MIDI velocity 0-127 (optional). */
  velocity?: number;
  /** MIDI channel 1-16 (optional). */
  channel?: number;
  /**
   * Deterministic unique identifier.
   * Format: "tick:startTime:noteNumber:ordinal" or similar.
   * Used to stably identify events across solver runs.
   */
  eventKey?: string;
}

/**
 * NoteInstance: A single note within a performance moment.
 * Contains the note-level detail (sound, pad, MIDI provenance).
 */
export interface NoteInstance {
  /**
   * Grouping key for the note's Sound: its voiceId, or the pitch string for an
   * event with no Sound. Use `voiceId` to know whether the note has a Sound.
   */
  soundId: string;
  /**
   * The event's Sound identity (PerformanceEvent.voiceId), or undefined for an
   * event with no Sound. Absence is stated here, never inferred from `soundId`.
   */
  voiceId?: string;
  /** Pad key "row,col" where this sound is mapped. */
  padId: string;
  /** MIDI note number (provenance). */
  noteNumber: number;
  /** MIDI velocity 0-127. */
  velocity?: number;
  /** Duration in seconds. */
  duration?: number;
  /** Deterministic unique ID for stable identification. */
  noteKey?: string;
  /**
   * The note's own start time in seconds (S4.1). It can lie up to MOMENT_EPSILON
   * after its moment's startTime, which is the first note's.
   */
  startTime?: number;
}

/**
 * PerformanceMoment: A time slice containing all notes at the same moment.
 * This is the canonical grouped event — the atomic timeline unit.
 *
 * Invariant A: all notes within MOMENT_EPSILON of startTime belong here.
 * A single-note moment is still a PerformanceMoment.
 */
export interface PerformanceMoment {
  /** Index of this moment in the performance timeline. */
  momentIndex: number;
  /** Absolute start time in seconds. */
  startTime: number;
  /** All notes occurring at this moment. */
  notes: NoteInstance[];
}
