/**
 * MIDI note name utilities.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert a MIDI note number (0–127) to a human-readable name like "C1" or "F#2". */
export function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 2;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}
