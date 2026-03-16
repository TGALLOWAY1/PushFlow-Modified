/**
 * PerformanceEvent: A time-stamped trigger in the musical sequence.
 *
 * This is the atomic timeline unit the execution plan must realize.
 * Canonical term per PROJECT_TERMINOLOGY_TABLE.MD.
 */

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
