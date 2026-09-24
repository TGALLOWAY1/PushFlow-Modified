/**
 * Lane Import Hook.
 *
 * Handles multi-file MIDI import for the Performance Lanes page.
 * Each file is parsed, split by unique MIDI pitch, and turned into
 * PerformanceLanes grouped by source file name (see import/midiToLanes.ts).
 */

import { DEFAULT_PROJECT_TEMPO } from '../state/projectState';
import { useCallback } from 'react';
import { parseMidiFileToProject } from '../../import/midiImport';
import { buildLanesFromMidiProject } from '../../import/midiToLanes';
import { useProject } from '../state/ProjectContext';

/** Color palette for auto-assigned group colors. */
const GROUP_COLORS = [
  '#f59e0b', '#3b82f6', '#a855f7', '#22c55e', '#ec4899', '#06b6d4',
  '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#d946ef',
];

export function useLaneImport() {
  const { state, dispatch } = useProject();

  const importFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        const projectData = await parseMidiFileToProject(file);

        const currentMaxOrder = state.performanceLanes.length > 0
          ? Math.max(...state.performanceLanes.map(l => l.orderIndex))
          : -1;

        // Pick a group color based on number of existing groups
        const groupColorIndex = state.laneGroups.length % GROUP_COLORS.length;
        const groupColor = GROUP_COLORS[groupColorIndex];

        // One lane per unique pitch (no group by default)
        const { lanes, sourceFile } = buildLanesFromMidiProject(projectData, file.name, {
          currentMaxOrder,
          color: groupColor,
        });

        dispatch({
          type: 'IMPORT_LANES',
          payload: { lanes, sourceFile },
        });

        // Adopt the file's tempo on the first import into an untouched project.
        //
        // The header tempo was parsed and then thrown away, so a 90 or 174 BPM
        // file left the project at the 120 BPM default while its notes sat at
        // their true absolute times. Bar lines landed mid-note, the click track
        // drifted against the music, and the Pattern Composer's grid (which is
        // required to follow project tempo) was wrong too — which makes the
        // rehearsal surfaces actively misleading rather than merely imprecise.
        //
        // Only on a first import, and only while the tempo is still the default,
        // so a tempo the user chose is never overwritten.
        const importedTempo = projectData.performance.tempo ?? 0;
        const isFirstImport = state.performanceLanes.length === 0 && state.sourceFiles.length === 0;
        if (isFirstImport && importedTempo > 0 && state.tempo === DEFAULT_PROJECT_TEMPO) {
          dispatch({ type: 'SET_TEMPO', payload: importedTempo });
        }

        // bottomLeftNote stays at default (36/C1). MIDI pitch is metadata
        // only and must not affect grid placement.

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse MIDI file';
        dispatch({ type: 'SET_ERROR', payload: `Import error (${file.name}): ${message}` });
      }
    }
  }, [state.performanceLanes, state.laneGroups, state.instrumentConfig, state.sourceFiles, state.tempo, dispatch]);

  return { importFiles };
}
