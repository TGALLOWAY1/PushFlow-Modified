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
import { gmDrumName } from '../../utils/gmDrumMap';
import { useProject } from '../state/ProjectContext';
import { useToast } from '../components/shared/Toast';

export function useLaneImport() {
  const { state, dispatch, transact } = useProject();
  const toast = useToast();

  const importFiles = useCallback(async (files: File[]) => {
    // Parse everything first, so the whole import lands as one undo step.
    const parsed: { file: File; projectData: Awaited<ReturnType<typeof parseMidiFileToProject>> }[] = [];
    for (const file of files) {
      try {
        parsed.push({ file, projectData: await parseMidiFileToProject(file) });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse MIDI file';
        dispatch({ type: 'SET_ERROR', payload: `Import error (${file.name}): ${message}` });
      }
    }
    if (parsed.length === 0) return;

    // Names, colours and order carry over from one file to the next, so every
    // new Sound gets its own palette colour and name (T17), even when several
    // files are imported at once.
    let currentMaxOrder = state.performanceLanes.length > 0
      ? Math.max(...state.performanceLanes.map(l => l.orderIndex))
      : -1;
    const existingNames = state.soundStreams.map(s => s.name);
    const existingColors = state.soundStreams.map(s => s.color);
    let importedCount = 0;
    let gmPitches = 0;

    transact('Import', () => {
      for (const { file, projectData } of parsed) {
        // One lane per unique pitch (no group by default)
        const { lanes, sourceFile } = buildLanesFromMidiProject(projectData, file.name, {
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
      }
    });

    // Say what arrived, and offer the opt-in pitch naming when it can help (Q3).
    const from = parsed.length === 1 ? ` from ${parsed[0]!.file.name.replace(/\.(mid|midi)$/i, '')}` : ` from ${parsed.length} files`;
    toast.show({
      message: `Imported ${importedCount} ${importedCount === 1 ? 'Sound' : 'Sounds'}${from}`,
      action: gmPitches > 0
        ? { label: 'Name from GM drum map', onClick: () => dispatch({ type: 'APPLY_GM_DRUM_NAMES' }) }
        : undefined,
    });
  }, [state.performanceLanes, state.soundStreams, state.instrumentConfig, state.sourceFiles, state.tempo, dispatch, transact, toast]);

  return { importFiles };
}
