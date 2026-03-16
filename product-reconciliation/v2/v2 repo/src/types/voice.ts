/**
 * Voice: A distinct mapped entity/stream tracked across a performance.
 *
 * Represents a unique MIDI pitch that can be assigned to a pad on the grid.
 * May represent a note-based or role-based identity.
 */

export interface Voice {
  /** Unique identifier (UUID). */
  id: string;
  /** Display name for the voice. */
  name: string;
  /** Source type: MIDI track or audio slice. */
  sourceType: 'midi_track' | 'audio_slice';
  /** Path or reference to the source file. */
  sourceFile: string;
  /** Original MIDI note number (0-127), or null if not MIDI-derived. */
  originalMidiNote: number | null;
  /** Color for UI display (hex code). */
  color: string;
}
