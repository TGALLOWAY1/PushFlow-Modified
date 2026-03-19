/**
 * PerformanceEvent: A time-stamped trigger in the musical sequence.
 *
 * This is the atomic timeline unit the execution plan must realize.
 * Canonical term per PROJECT_TERMINOLOGY_TABLE.MD.
 */

/**
 * Canonical epsilon for grouping notes into moments.
 * Notes within this window (in seconds) are considered simultaneous.
 * This is the single source of truth — no other epsilon should be used.
 */
export const MOMENT_EPSILON = 0.001;

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
  /** Stable voice/sound identity. */
  soundId: string;
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
