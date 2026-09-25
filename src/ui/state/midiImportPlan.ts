/**
 * What importing MIDI files does to a project, as reducer actions (T17, T51).
 *
 * The editor's import (useLaneImport) dispatches these inside one undo step;
 * the Library's "Import MIDI" reduces them over a new project. So a file
 * imported from either place gets the same Sounds: one per pitch, named from
 * the file (decision Q3), in palette colours that continue from the project's.
 * Nothing is placed (invariant 7) and bottomLeftNote is never touched
 * (invariant 5): pitch is metadata only.
 */

import { buildLanesFromMidiProject } from '../../import/midiToLanes';
import { type MidiProjectData } from '../../import/midiImport';
import { gmDrumName } from '../../utils/gmDrumMap';
import { DEFAULT_PROJECT_TEMPO, type ProjectAction, type ProjectState } from './projectState';

export interface ParsedMidiFile {
  fileName: string;
  projectData: MidiProjectData;
}

export interface MidiImportPlan {
  actions: ProjectAction[];
  /** Sounds the import adds. */
  importedCount: number;
  /** How many of them have a GM drum pitch (so "Name from GM drum map" can help). */
  gmPitches: number;
}

export function planMidiImport(
  state: Pick<ProjectState, 'performanceLanes' | 'soundStreams' | 'sourceFiles' | 'tempo'>,
  files: readonly ParsedMidiFile[],
): MidiImportPlan {
  // Names, colours and order carry over from one file to the next, so every
  // new Sound gets its own palette colour and name, even when several files
  // are imported at once.
  let currentMaxOrder = state.performanceLanes.length > 0
    ? Math.max(...state.performanceLanes.map(l => l.orderIndex))
    : -1;
  const existingNames = state.soundStreams.map(s => s.name);
  const existingColors = state.soundStreams.map(s => s.color);
  const actions: ProjectAction[] = [];
  let importedCount = 0;
  let gmPitches = 0;
  const isFirstImport = state.performanceLanes.length === 0 && state.sourceFiles.length === 0;

  for (const { fileName, projectData } of files) {
    // One lane per unique pitch (no group by default)
    const { lanes, sourceFile } = buildLanesFromMidiProject(projectData, fileName, {
      currentMaxOrder,
      existingNames,
      existingColors,
    });
    for (const lane of lanes) {
      existingNames.push(lane.name);
      existingColors.push(lane.color);
      currentMaxOrder = Math.max(currentMaxOrder, lane.orderIndex);
      if (gmDrumName(lane.events[0]?.rawPitch)) gmPitches++;
    }
    importedCount += lanes.length;
    actions.push({ type: 'IMPORT_LANES', payload: { lanes, sourceFile } });

    // Adopt the file's tempo on the first import into an untouched project,
    // and only while the tempo is still the default, so a tempo the user chose
    // is never overwritten. (The header tempo used to be thrown away, so a 90
    // or 174 BPM file sat on a 120 BPM bar grid and click.)
    const importedTempo = projectData.performance.tempo ?? 0;
    if (isFirstImport && importedTempo > 0 && state.tempo === DEFAULT_PROJECT_TEMPO) {
      actions.push({ type: 'SET_TEMPO', payload: importedTempo });
    }
  }
  return { actions, importedCount, gmPitches };
}

/** The toast after an import: "Imported 7 Sounds from TEST MIDI 1". */
export function importSummary(importedCount: number, fileNames: readonly string[]): string {
  const from = fileNames.length === 1
    ? ` from ${fileNames[0]!.replace(/\.(mid|midi)$/i, '')}`
    : ` from ${fileNames.length} files`;
  return `Imported ${importedCount} ${importedCount === 1 ? 'Sound' : 'Sounds'}${from}`;
}
