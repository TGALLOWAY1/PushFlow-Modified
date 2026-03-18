/**
 * Lane Import Hook.
 *
 * Handles multi-file MIDI import for the Performance Lanes page.
 * Each file is parsed, split by unique MIDI pitch, and turned into
 * PerformanceLanes grouped by source file name.
 */

import { useCallback } from 'react';
import { parseMidiFileToProject } from '../../import/midiImport';
import { generateId } from '../../utils/idGenerator';
import { useProject } from '../state/ProjectContext';
import { type PerformanceLane, type LaneEvent, type LaneGroup, type SourceFile } from '../../types/performanceLane';

/** Color palette for auto-assigned group colors. */
const GROUP_COLORS = [
  '#f59e0b', '#3b82f6', '#a855f7', '#22c55e', '#ec4899', '#06b6d4',
  '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#d946ef',
];

/**
 * Derive a clean display name from a file name.
 * "lead_chops.mid" → "Lead Chops"
 * "BASS.midi" → "Bass"
 */
function fileNameToDisplayName(fileName: string): string {
  return fileName
    .replace(/\.(mid|midi)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export function useLaneImport() {
  const { state, dispatch } = useProject();

  const importFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        const projectData = await parseMidiFileToProject(file);

        const sourceFileId = generateId('src');
        const groupId = generateId('grp');
        const displayName = fileNameToDisplayName(file.name);

        // Group events by unique MIDI pitch
        const byNote = new Map<number, typeof projectData.performance.events>();
        for (const event of projectData.performance.events) {
          const list = byNote.get(event.noteNumber) ?? [];
          list.push(event);
          byNote.set(event.noteNumber, list);
        }

        const sortedNotes = [...byNote.keys()].sort((a, b) => a - b);
        const hasMultiplePitches = sortedNotes.length > 1;
        const currentMaxOrder = state.performanceLanes.length > 0
          ? Math.max(...state.performanceLanes.map(l => l.orderIndex))
          : -1;

        // Pick a group color based on number of existing groups
        const groupColorIndex = state.laneGroups.length % GROUP_COLORS.length;
        const groupColor = GROUP_COLORS[groupColorIndex];

        // Create lanes — one per unique pitch
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
            sourceFileName: file.name,
            groupId,
            orderIndex: currentMaxOrder + 1 + i,
            color: groupColor,
            colorMode: 'inherited' as const,
            events,
            isHidden: false,
            isMuted: false,
            isSolo: false,
          };
        });

        // Create group named after the file
        const group: LaneGroup = {
          groupId,
          name: displayName,
          color: groupColor,
          orderIndex: state.laneGroups.length,
          isCollapsed: false,
        };

        // Create source file record
        const sourceFile: SourceFile = {
          id: sourceFileId,
          fileName: file.name,
          importedAt: new Date().toISOString(),
          laneCount: lanes.length,
        };

        dispatch({
          type: 'IMPORT_LANES',
          payload: { lanes, sourceFile, group },
        });

        // Update instrumentConfig.bottomLeftNote so the grid aligns with
        // the imported MIDI note range. Without this, notes below the default
        // bottomLeftNote (36) would fall outside the grid and be marked unmapped.
        if (projectData.minNoteNumber !== null) {
          const currentBottom = state.instrumentConfig.bottomLeftNote;
          // Only lower the bottom note — don't raise it if existing content
          // already uses lower pitches.
          if (projectData.minNoteNumber < currentBottom) {
            dispatch({
              type: 'SET_INSTRUMENT_CONFIG',
              payload: { bottomLeftNote: projectData.minNoteNumber },
            });
          }
        }

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse MIDI file';
        dispatch({ type: 'SET_ERROR', payload: `Import error (${file.name}): ${message}` });
      }
    }
  }, [state.performanceLanes, state.laneGroups, state.instrumentConfig, dispatch]);

  return { importFiles };
}
