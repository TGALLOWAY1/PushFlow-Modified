/**
 * MIDI Import.
 *
 * Parses MIDI files into Performance objects and project data.
 *
 * Ported from Version1/src/utils/midiImport.ts with canonical terminology:
 * - NoteEvent → PerformanceEvent
 * - GridMapping → Layout, .cells → .padToVoice
 */

import { Midi } from '@tonejs/midi';
import { type Performance, type InstrumentConfig } from '../types/performance';
import { type PerformanceEvent, type PerformanceMoment } from '../types/performanceEvent';
import { type Voice } from '../types/voice';
import { type Layout } from '../types/layout';
import { generateId } from '../utils/idGenerator';
import { buildPerformanceMoments } from '../engine/structure/momentBuilder';

// ============================================================================
// Result Types
// ============================================================================

/**
 * Complete project data structure returned from parseMidiProject.
 * Contains all consolidated types needed to initialize a project.
 */
export interface MidiProjectData {
  /** The parsed performance with all events. */
  performance: Performance;
  /** Canonical grouped moments (all notes at same time = one moment). */
  moments: PerformanceMoment[];
  /** Unique voices extracted from the MIDI file. */
  voices: Voice[];
  /** Instrument configuration with intelligent root note adjustment. */
  instrumentConfig: InstrumentConfig;
  /** Initial layout (starts empty — all voices go to staging area). */
  layout: Layout;
  /** Minimum note number found (for root note adjustment). */
  minNoteNumber: number | null;
  /** Count of notes that were out of bounds before root note adjustment. */
  unmappedNoteCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteName(midiNote: number): string {
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2;
  return `${note}${octave}`;
}

/** Checks whether a MIDI note fits within the 8x8 grid window. */
function noteInGrid(noteNumber: number, config: InstrumentConfig): boolean {
  const offset = noteNumber - config.bottomLeftNote;
  return offset >= 0 && offset < 64;
}

const VOICE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

// ============================================================================
// Core Parser
// ============================================================================

/**
 * Parses a MIDI file from ArrayBuffer and creates a complete project structure.
 *
 * @param arrayBuffer - The MIDI file as ArrayBuffer
 * @param fileName - Optional file name for naming
 * @param existingConfig - Optional existing instrument config to use as base
 * @returns Complete project data structure
 */
export async function parseMidiProject(
  arrayBuffer: ArrayBuffer,
  fileName?: string,
  existingConfig?: InstrumentConfig
): Promise<MidiProjectData> {
  const midiData = new Midi(arrayBuffer);
  const events: PerformanceEvent[] = [];

  // Extract all note events
  midiData.tracks.forEach((track) => {
    const timeTally = new Map<string, number>();

    track.notes.forEach((note) => {
      const noteNumber = note.midi;
      const channelLabel = track.channel + 1;

      // Deterministic event key for stable identification
      const nominalTime = note.ticks !== undefined ? note.ticks : Math.round(note.time * 10000);
      const hashKey = `${nominalTime}:${noteNumber}:${channelLabel}`;
      const ordinal = (timeTally.get(hashKey) || 0) + 1;
      timeTally.set(hashKey, ordinal);
      const eventKey = `${hashKey}:${ordinal}`;

      events.push({
        noteNumber,
        startTime: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
        channel: channelLabel,
        eventKey,
      });
    });
  });

  // Sort events by start time
  events.sort((a, b) => a.startTime - b.startTime);

  // Determine tempo
  const tempo = midiData.header.tempos.length > 0
    ? Math.round(midiData.header.tempos[0].bpm)
    : 120;

  // Find minimum note number for intelligent root note logic
  const minNote = events.length > 0
    ? Math.min(...events.map(e => e.noteNumber))
    : null;

  // Create or update instrument config
  const baseConfig: InstrumentConfig = existingConfig || {
    id: generateId('inst'),
    name: 'Imported Kit',
    rows: 8,
    cols: 8,
    bottomLeftNote: 36,
    layoutMode: 'drum_64',
  };

  const instrumentConfig: InstrumentConfig = {
    ...baseConfig,
    // Always use the default bottomLeftNote (36/C1). A sound's MIDI pitch is
    // metadata only — it must never determine grid placement.
  };

  // Count unmapped notes
  let unmappedNoteCount = 0;
  for (const event of events) {
    if (!noteInGrid(event.noteNumber, instrumentConfig)) {
      unmappedNoteCount++;
    }
  }

  // Create performance
  const performance: Performance = {
    events,
    tempo,
    name: fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Imported Performance',
  };

  // Extract unique voices
  const uniqueNotes = new Set<number>();
  for (const event of events) {
    uniqueNotes.add(event.noteNumber);
  }

  const sortedUniqueNotes = Array.from(uniqueNotes).sort((a, b) => a - b);
  const voices: Voice[] = sortedUniqueNotes.map((noteNumber, index) => ({
    id: generateId('sound'),
    name: `${getNoteName(noteNumber)} (${noteNumber})`,
    sourceType: 'midi_track' as const,
    sourceFile: fileName || 'imported.mid',
    originalMidiNote: noteNumber,
    color: VOICE_COLORS[index % VOICE_COLORS.length],
  }));

  // Create empty layout (no auto-mapping on import)
  const layout: Layout = {
    id: generateId('layout'),
    name: `${performance.name} Layout`,
    padToVoice: {},
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'none',
    role: 'active' as const,
  };

  // Build canonical moments from flat events (group by timestamp)
  const moments = buildPerformanceMoments(events);

  return {
    performance,
    moments,
    voices,
    instrumentConfig,
    layout,
    minNoteNumber: minNote,
    unmappedNoteCount,
  };
}

/**
 * Parses a MIDI file from a File object.
 */
export async function parseMidiFileToProject(
  file: File,
  existingConfig?: InstrumentConfig
): Promise<MidiProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }
        const result = await parseMidiProject(e.target.result as ArrayBuffer, file.name, existingConfig);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
