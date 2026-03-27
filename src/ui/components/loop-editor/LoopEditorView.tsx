/**
 * LoopEditorView.
 *
 * Top-level container for the Loop Editor tab.
 * Manages local loop state, persistence, playback, project commit,
 * and rudiment generation with event stepping.
 */

import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import {
  loopEditorReducer,
  createInitialLoopState,
} from '../../state/loopEditorReducer';
import { saveLoopState, loadLoopStateAsync } from '../../persistence/loopStorage';
import { convertLoopToPerformanceLanes } from '../../state/loopToLanes';
import { type LoopLane } from '../../../types/loopEditor';
import { stepDuration, totalSteps } from '../../../types/loopEditor';
import { generateId } from '../../../utils/idGenerator';
import { LoopEditorToolbar } from './LoopEditorToolbar';
import { LoopLaneSidebar } from './LoopLaneSidebar';
import { LoopGridCanvas } from './LoopGridCanvas';
import { RudimentEventStepper } from './RudimentEventStepper';
import { RudimentPadGrid } from './RudimentPadGrid';

const LANE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const DEFAULT_MIDI_NOTES = [36, 38, 42, 46, 48, 60, 62, 64];

export function LoopEditorView() {
  const { state: projectState, dispatch: projectDispatch } = useProject();

  // Initialize fresh, then load from Supabase
  const [loopState, dispatch] = useReducer(loopEditorReducer, undefined, createInitialLoopState);
  const loopLoadedRef = useRef(false);

  useEffect(() => {
    if (loopLoadedRef.current) return;
    loopLoadedRef.current = true;
    loadLoopStateAsync(projectState.id)
      .then(saved => {
        if (saved) {
          dispatch({ type: 'LOAD_LOOP_STATE', payload: saved });
        }
      })
      .catch(err => console.error('Failed to load loop state:', err));
  }, [projectState.id]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const playheadRef = useRef<number>(loopState.playheadStep);

  // Event stepping state (local, not persisted)
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null);

  // Keep playheadRef in sync
  playheadRef.current = loopState.playheadStep;

  // Derive the active result from rudimentResult
  const activeResult = useMemo(() => {
    if (loopState.rudimentResult) {
      return {
        fingerAssignments: loopState.rudimentResult.fingerAssignments,
        complexity: loopState.rudimentResult.complexity,
        padAssignments: loopState.rudimentResult.padAssignments,
      };
    }
    return null;
  }, [loopState.rudimentResult]);

  // Clear active event when result changes to null
  const prevResultRef = useRef(activeResult);
  useEffect(() => {
    if (prevResultRef.current && !activeResult) {
      setActiveEventIndex(null);
    }
    prevResultRef.current = activeResult;
  }, [activeResult]);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLoopState(projectState.id, loopState);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [loopState, projectState.id]);

  // Playback animation
  useEffect(() => {
    if (!loopState.isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const stepDur = stepDuration(loopState.config);
    const steps = totalSteps(loopState.config);

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = (timestamp - lastTimeRef.current) / 1000;
      const stepsAdvanced = elapsed / stepDur;
      const newStep = (playheadRef.current + stepsAdvanced) % steps;

      dispatch({ type: 'SET_PLAYHEAD', payload: newStep });
      lastTimeRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [loopState.isPlaying, loopState.config]);

  // Add lane
  const handleAddLane = useCallback(() => {
    const nextIndex = loopState.lanes.length;
    const newLane: LoopLane = {
      id: generateId('llane'),
      name: `Lane ${nextIndex + 1}`,
      color: LANE_COLORS[nextIndex % LANE_COLORS.length],
      midiNote: DEFAULT_MIDI_NOTES[nextIndex % DEFAULT_MIDI_NOTES.length] ?? null,
      orderIndex: nextIndex,
      isMuted: false,
      isSolo: false,
    };
    dispatch({ type: 'ADD_LANE', payload: newLane });
  }, [loopState.lanes.length]);

  // Commit loop to project
  const handleCommitToProject = useCallback(() => {
    const label = projectState.name || 'Loop Pattern';
    const result = convertLoopToPerformanceLanes(loopState, label);

    // Set group orderIndex after existing groups
    result.group.orderIndex = projectState.laneGroups.length;

    projectDispatch({
      type: 'IMPORT_LANES',
      payload: {
        lanes: result.lanes,
        sourceFile: result.sourceFile,
        group: result.group,
      },
    });
  }, [loopState, projectState.name, projectState.laneGroups.length, projectDispatch]);

  // Derive active step index for grid column highlight
  const activeStepIndex = useMemo(() => {
    if (activeEventIndex === null || !activeResult) return null;
    const fa = activeResult.fingerAssignments;
    if (activeEventIndex < 0 || activeEventIndex >= fa.length) return null;
    return fa[activeEventIndex].stepIndex;
  }, [activeEventIndex, activeResult]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <LoopEditorToolbar
        config={loopState.config}
        laneCount={loopState.lanes.length}
        eventCount={loopState.events.size}
        isPlaying={loopState.isPlaying}
        dispatch={dispatch}
        onAddLane={handleAddLane}
        onCommitToProject={handleCommitToProject}
      />

      {/* Event stepper (visible when any result exists) */}
      {activeResult && (
        <RudimentEventStepper
          fingerAssignments={activeResult.fingerAssignments}
          complexity={activeResult.complexity}
          activeEventIndex={activeEventIndex}
          onSetActiveEvent={setActiveEventIndex}
          lanes={loopState.lanes}
        />
      )}

      {/* Step sequencer + pad grid side by side */}
      <div className="flex gap-3 items-start">
        {/* Step sequencer: sidebar + grid */}
        <div className="flex-1 min-w-0 flex rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-default)] overflow-hidden" style={{ minHeight: 300 }}>
          <LoopLaneSidebar lanes={loopState.lanes} dispatch={dispatch} />
          <LoopGridCanvas
            config={loopState.config}
            lanes={loopState.lanes}
            events={loopState.events}
            playheadStep={loopState.playheadStep}
            isPlaying={loopState.isPlaying}
            dispatch={dispatch}
            activeStepIndex={activeStepIndex}
          />
        </div>

        {/* Pad grid (visible when any result exists) */}
        {activeResult && (
          <div className="flex-shrink-0">
            <RudimentPadGrid
              padAssignments={activeResult.padAssignments}
              fingerAssignments={activeResult.fingerAssignments}
              activeEventIndex={activeEventIndex}
              lanes={loopState.lanes}
            />
          </div>
        )}
      </div>
    </div>
  );
}
