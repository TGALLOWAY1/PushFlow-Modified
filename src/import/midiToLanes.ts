/**
 * MIDI → Performance Lanes.
 *
 * The pure half of the lane import (useLaneImport): turns one parsed MIDI file
 * into PerformanceLanes, one per unique pitch, plus its SourceFile record.
 * Kept free of React so tests can build Sounds through the same path as the app.
 */

import { generateId } from '../utils/idGenerator';
import { type MidiProjectData } from './midiImport';
import { type PerformanceLane, type LaneEvent, type SourceFile } from '../types/performanceLane';

/**
 * Derive a clean display name from a file name.
 * "lead_chops.mid" → "Lead Chops"
 * "BASS.midi" → "Bass"
 */
export function fileNameToDisplayName(fileName: string): string {
  return fileName
    .replace(/\.(mid|midi)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export interface MidiLanesOptions {
  /** Highest orderIndex among the project's existing lanes (-1 if none). */
  currentMaxOrder: number;
  /** Colour every new lane inherits. */
  color: string;
}

/** Builds one lane per unique MIDI pitch in the file, and the file's SourceFile record. */
export function buildLanesFromMidiProject(
  projectData: MidiProjectData,
  fileName: string,
  { currentMaxOrder, color }: MidiLanesOptions,
): { lanes: PerformanceLane[]; sourceFile: SourceFile } {
  const sourceFileId = generateId('src');
  const displayName = fileNameToDisplayName(fileName);

  // Group events by unique MIDI pitch
  const byNote = new Map<number, typeof projectData.performance.events>();
  for (const event of projectData.performance.events) {
    const list = byNote.get(event.noteNumber) ?? [];
    list.push(event);
    byNote.set(event.noteNumber, list);
  }

  const sortedNotes = [...byNote.keys()].sort((a, b) => a - b);
  const hasMultiplePitches = sortedNotes.length > 1;

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

    // Name: "Bass" if single pitch, "Bass 1", "Bass 2" if multiple
    const laneName = hasMultiplePitches
      ? `${displayName} ${i + 1}`
      : displayName;

    return {
      id: laneId,
      name: laneName,
      sourceFileId,
      sourceFileName: fileName,
      groupId: null,
      orderIndex: currentMaxOrder + 1 + i,
      color,
      colorMode: 'inherited' as const,
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
