/**
 * Lane Import Hook.
 *
 * Handles multi-file MIDI import for the Performance Lanes page.
 * Each file is parsed, split by unique MIDI pitch, and turned into
 * PerformanceLanes grouped by source file name (see import/midiToLanes.ts).
 */

import { useCallback } from 'react';
import { parseMidiFileToProject } from '../../import/midiImport';
import { importSummary, planMidiImport } from '../state/midiImportPlan';
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

    const { actions, importedCount, gmPitches } = planMidiImport(
      { performanceLanes: state.performanceLanes, soundStreams: state.soundStreams, sourceFiles: state.sourceFiles, tempo: state.tempo },
      parsed.map(({ file, projectData }) => ({ fileName: file.name, projectData })),
    );
    transact('Import', () => {
      for (const action of actions) dispatch(action);
    });

    // Say what arrived, and offer the opt-in pitch naming when it can help (Q3).
    toast.show({
      message: importSummary(importedCount, parsed.map(p => p.file.name)),
      action: gmPitches > 0
        ? { label: 'Name from GM drum map', onClick: () => dispatch({ type: 'APPLY_GM_DRUM_NAMES' }) }
        : undefined,
    });
  }, [state.performanceLanes, state.soundStreams, state.instrumentConfig, state.sourceFiles, state.tempo, dispatch, transact, toast]);

  return { importFiles };
}
