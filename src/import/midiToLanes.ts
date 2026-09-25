/**
 * MIDI → Performance Lanes.
 *
 * The pure half of the lane import (useLaneImport): turns one parsed MIDI file
 * into PerformanceLanes, one per unique pitch, plus its SourceFile record.
 * Kept free of React so tests can build Sounds through the same path as the app.
 */

import { generateId } from '../utils/idGenerator';
import { nextSoundColors } from '../utils/soundPalette';
import { type MidiProjectData } from './midiImport';
import { defaultSoundNames } from './soundNaming';
import { type PerformanceLane, type LaneEvent, type SourceFile } from '../types/performanceLane';

export { fileNameToDisplayName } from './soundNaming';

export interface MidiLanesOptions {
  /** Highest orderIndex among the project's existing lanes (-1 if none). */
  currentMaxOrder: number;
  /** The project's current Sound names: new names continue past them (Q3). */
  existingNames?: readonly string[];
  /** The project's current Sound colours: new Sounds take palette colours not yet used (T17). */
  existingColors?: readonly string[];
}

/**
 * Builds one lane per unique MIDI pitch in the file, and the file's SourceFile
 * record. Each new Sound gets its own palette colour (its own, not its group's:
 * colorMode 'overridden') and a name from its track or the file plus a letter,
 * never from its pitch (T17, Q3).
 */
export function buildLanesFromMidiProject(
  projectData: MidiProjectData,
  fileName: string,
  { currentMaxOrder, existingNames = [], existingColors = [] }: MidiLanesOptions,
): { lanes: PerformanceLane[]; sourceFile: SourceFile } {
  const sourceFileId = generateId('src');

  // Group events by unique MIDI pitch
  const byNote = new Map<number, typeof projectData.performance.events>();
  for (const event of projectData.performance.events) {
    const list = byNote.get(event.noteNumber) ?? [];
    list.push(event);
    byNote.set(event.noteNumber, list);
  }

  const sortedNotes = [...byNote.keys()].sort((a, b) => a - b);
  const names = defaultSoundNames(fileName, projectData.tracks ?? [], sortedNotes, existingNames);
  const colors = nextSoundColors(existingColors, sortedNotes.length);

  // Create lanes — one per unique pitch (no group by default)
  const lanes: PerformanceLane[] = sortedNotes.map((noteNumber, i) => {
    const laneId = generateId('lane');
    const rawEvents = byNote.get(noteNumber) ?? [];

    const events: LaneEvent[] = rawEvents.map((e, j) => ({
      eventId: e.eventKey ?? `${laneId}:${j}`,
      laneId,
      startTime: e.startTime,
      duration: e.duration ?? 0.25,
      velocity: e.velocity ?? 100,
      rawPitch: e.noteNumber,
      rawChannel: e.channel,
    }));

    return {
      id: laneId,
      name: names[i]!,
      sourceFileId,
      sourceFileName: fileName,
      groupId: null,
      orderIndex: currentMaxOrder + 1 + i,
      color: colors[i]!,
      colorMode: 'overridden' as const,
      events,
      isHidden: false,
      isMuted: false,
      isSolo: false,
    };
  });

  const sourceFile: SourceFile = {
    id: sourceFileId,
    fileName,
    importedAt: new Date().toISOString(),
    laneCount: lanes.length,
  };

  return { lanes, sourceFile };
}
