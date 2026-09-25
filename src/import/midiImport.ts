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
import { nextSoundColors } from '../utils/soundPalette';
import { defaultSoundNames, type ImportedTrack } from './soundNaming';

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
  /** Each track's name and note count per pitch: default Sound names come from these (Q3). */
  tracks: ImportedTrack[];
}

// ============================================================================
// Helpers
// ============================================================================

/** Checks whether a MIDI note fits within the 8x8 grid window. */
function noteInGrid(noteNumber: number, config: InstrumentConfig): boolean {
  const offset = noteNumber - config.bottomLeftNote;
  return offset >= 0 && offset < 64;
}

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
  const tracks: ImportedTrack[] = [];

  // Extract all note events
  midiData.tracks.forEach((track) => {
    const timeTally = new Map<string, number>();
    const noteCounts = new Map<number, number>();
    tracks.push({ name: (track.name ?? '').trim(), noteCounts });

    track.notes.forEach((note) => {
      const noteNumber = note.midi;
      noteCounts.set(noteNumber, (noteCounts.get(noteNumber) ?? 0) + 1);
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

  // Named and coloured as the import names new Sounds (Q3): never from pitch.
  const sortedUniqueNotes = Array.from(uniqueNotes).sort((a, b) => a - b);
  const names = defaultSoundNames(fileName || 'imported.mid', tracks, sortedUniqueNotes);
  const colors = nextSoundColors([], sortedUniqueNotes.length);
  const voices: Voice[] = sortedUniqueNotes.map((noteNumber, index) => ({
    id: generateId('sound'),
    name: names[index]!,
    sourceType: 'midi_track' as const,
    sourceFile: fileName || 'imported.mid',
    originalMidiNote: noteNumber,
    color: colors[index]!,
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
    tracks,
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
