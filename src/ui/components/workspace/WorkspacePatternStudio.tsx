import { useReducer, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import {
  loopEditorReducer,
  createInitialLoopState,
  type LoopEditorAction,
} from '../../state/loopEditorReducer';
import { convertLoopToPerformanceLanes } from '../../state/loopToLanes';
import { type LoopLane } from '../../../types/loopEditor';
import { stepDuration, totalSteps } from '../../../types/loopEditor';
import { type PatternRecipe } from '../../../types/patternRecipe';
import { generateId } from '../../../utils/idGenerator';
import { LoopLaneSidebar } from '../loop-editor/LoopLaneSidebar';
import { LoopGridCanvas } from '../loop-editor/LoopGridCanvas';
import { RudimentEventStepper } from '../loop-editor/RudimentEventStepper';
// RudimentPadGrid removed — pad assignments now sync to main InteractiveGrid
import { type Layout } from '../../../types/layout';
import { RecipeEditorModal } from '../loop-editor/RecipeEditorModal';
import { PatternSelector } from '../loop-editor/PatternSelector';
import { savePreset, deletePreset, presetToLoopState, type PerformancePreset } from '../../persistence/presetStorage';
import { saveComposerPreset } from '../../persistence/composerPresetStorage';
import {
  type PresetPad,
  computeBoundingBox,
  computeHandedness,
  isMirrorEligible,
  normalizePadPositions,
} from '../../../types/composerPreset';
import { type FingerType, type HandSide } from '../../../types/fingerModel';
import { type LaneFingerAssignment } from '../loop-editor/LoopLaneRow';
import { parsePadKey } from '../../../types/padGrid';
import { getDisplayedLayout } from '../../state/projectState';

const LANE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const DEFAULT_MIDI_NOTES = [36, 38, 42, 46, 48, 60, 62, 64];
const WORKSPACE_PATTERN_SOURCE_ID = 'workspace_pattern_source';
const WORKSPACE_PATTERN_GROUP_ID = 'workspace_pattern_group';
const WORKSPACE_PATTERN_NAME = 'Workspace Pattern';

interface ProjectPatternMeta {
  existingGroupOrder: number;
  nextBaseOrder: number;
}

export function WorkspacePatternStudio() {
  const { state: projectState, dispatch: projectDispatch } = useProject();
  const [loopState, dispatch] = useReducer(loopEditorReducer, undefined, createInitialLoopState);
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null);
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<PatternRecipe | undefined>(undefined);
  const [hasTouchedComposer, setHasTouchedComposer] = useState(false);
  const [laneFingerAssignments, setLaneFingerAssignments] = useState<Record<string, LaneFingerAssignment>>({});
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const playheadRef = useRef<number>(loopState.playheadStep);
  const projectPatternMetaRef = useRef<ProjectPatternMeta>({
    existingGroupOrder: projectState.laneGroups.length,
    nextBaseOrder: 0,
  });

  playheadRef.current = loopState.playheadStep;

  useEffect(() => {
    const existingGroup = projectState.laneGroups.find(group => group.groupId === WORKSPACE_PATTERN_GROUP_ID);
    const nonPatternLanes = projectState.performanceLanes.filter(
      lane => lane.sourceFileId !== WORKSPACE_PATTERN_SOURCE_ID,
    );
    projectPatternMetaRef.current = {
      existingGroupOrder: existingGroup?.orderIndex ?? projectState.laneGroups.length,
      nextBaseOrder: nonPatternLanes.length > 0
        ? Math.max(...nonPatternLanes.map(lane => lane.orderIndex)) + 1
        : 0,
    };
  }, [projectState.laneGroups, projectState.performanceLanes]);

  const dispatchComposer = useCallback((action: LoopEditorAction) => {
    setHasTouchedComposer(true);
    dispatch(action);
  }, []);

  const activeResult = useMemo(() => {
    if (loopState.patternResult) {
      return {
        fingerAssignments: loopState.patternResult.fingerAssignments,
        complexity: loopState.patternResult.complexity,
        padAssignments: loopState.patternResult.padAssignments,
      };
    }
    if (loopState.rudimentResult) {
      return {
        fingerAssignments: loopState.rudimentResult.fingerAssignments,
        complexity: loopState.rudimentResult.complexity,
        padAssignments: loopState.rudimentResult.padAssignments,
      };
    }
    return null;
  }, [loopState.patternResult, loopState.rudimentResult]);

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

  useEffect(() => {
    if (!hasTouchedComposer) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (loopState.lanes.length === 0 || loopState.events.size === 0) {
        projectDispatch({
          type: 'REMOVE_LANE_SOURCE',
          payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
        });
        return;
      }

      const conversion = convertLoopToPerformanceLanes(loopState, WORKSPACE_PATTERN_NAME, {
        sourceFileId: WORKSPACE_PATTERN_SOURCE_ID,
        sourceFileName: WORKSPACE_PATTERN_NAME,
        groupId: WORKSPACE_PATTERN_GROUP_ID,
        groupName: WORKSPACE_PATTERN_NAME,
        laneIdPrefix: 'workspace_pattern_',
        preserveLaneIds: true,
      });

      conversion.group.orderIndex = projectPatternMetaRef.current.existingGroupOrder;
      conversion.lanes = conversion.lanes.map((lane, index) => ({
        ...lane,
        orderIndex: projectPatternMetaRef.current.nextBaseOrder + index,
      }));

      projectDispatch({
        type: 'UPSERT_LANE_SOURCE',
        payload: {
          lanes: conversion.lanes,
          sourceFile: conversion.sourceFile,
          group: conversion.group,
        },
      });
    }, 200);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [hasTouchedComposer, loopState, projectDispatch]);

  const handleFingerAssignmentChange = useCallback((laneId: string, assignment: LaneFingerAssignment) => {
    setLaneFingerAssignments(prev => ({ ...prev, [laneId]: assignment }));
  }, []);

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
    dispatchComposer({ type: 'ADD_LANE', payload: newLane });
  }, [dispatchComposer, loopState.lanes.length]);

  const handleGeneratePattern = useCallback((recipe: PatternRecipe) => {
    dispatchComposer({ type: 'GENERATE_PATTERN', payload: { recipe } });
    setActiveEventIndex(null);
  }, [dispatchComposer]);

  const handleRandomizePattern = useCallback((seed: number) => {
    dispatchComposer({ type: 'GENERATE_RANDOM_PATTERN', payload: { seed } });
    setActiveEventIndex(null);
  }, [dispatchComposer]);

  const handleOpenRecipeEditor = useCallback((recipe?: PatternRecipe) => {
    setEditingRecipe(recipe ?? loopState.patternResult?.recipe);
    setShowRecipeEditor(true);
  }, [loopState.patternResult]);

  const handleRecipeGenerate = useCallback((recipe: PatternRecipe) => {
    dispatchComposer({ type: 'GENERATE_PATTERN', payload: { recipe } });
    setActiveEventIndex(null);
    setShowRecipeEditor(false);
  }, [dispatchComposer]);

  const handleSubdivisionChange = useCallback((subdivision: '1/8' | '1/4' | '1/2' | '1/1') => {
    if (subdivision === loopState.config.subdivision) return;
    if (loopState.events.size > 0) {
      const ok = window.confirm(`Changing grid subdivision will clear ${loopState.events.size} events. Continue?`);
      if (!ok) return;
    }
    dispatchComposer({ type: 'SET_SUBDIVISION', payload: subdivision });
  }, [dispatchComposer, loopState.config.subdivision, loopState.events.size]);

  const handleSavePreset = useCallback(() => {
    if (loopState.events.size === 0) return;
    const name = window.prompt('Preset name:', `Pattern ${new Date().toLocaleDateString()}`);
    if (!name) return;
    savePreset(name, loopState);
  }, [loopState]);

  /**
   * Save current composer state as a ComposerPreset.
   * Uses Composer finger assignments as the primary source.
   * Falls back to layout finger constraints if no Composer assignments exist.
   */
  const handleSaveComposerPreset = useCallback(() => {
    if (loopState.events.size === 0 || loopState.lanes.length === 0) return;

    const layout = getDisplayedLayout(projectState);
    if (!layout) return;

    // Check if any lane has a finger assignment set in the Composer
    const hasComposerFingerAssignments = loopState.lanes.some(l => laneFingerAssignments[l.id]);

    // If no Composer finger assignments and no pads on grid, require finger assignments
    if (!hasComposerFingerAssignments && Object.keys(layout.padToVoice).length === 0) {
      window.alert('Set finger assignments for each lane before saving a Composer Preset.\nClick the ·· button next to each lane name to assign a hand + finger.');
      return;
    }

    // Build preset pads from the current layout's padToVoice mapping
    const presetPads: PresetPad[] = [];
    const fingerConstraints = layout.fingerConstraints ?? {};

    for (const [padKeyStr, voice] of Object.entries(layout.padToVoice)) {
      // Only include pads that belong to current composer lanes
      const lane = loopState.lanes.find(l => l.id === voice.id);
      if (!lane) continue;

      const coord = parsePadKey(padKeyStr);
      if (!coord) continue;

      // Primary: use Composer finger assignment for this lane
      const composerFA = laneFingerAssignments[lane.id];
      let hand: HandSide;
      let finger: FingerType;

      if (composerFA) {
        hand = composerFA.hand;
        finger = composerFA.finger;
      } else {
        // Fallback: parse finger constraint from layout (format: "L2" = left index)
        const constraint = fingerConstraints[padKeyStr];
        hand = coord.col <= 4 ? 'left' : 'right';
        finger = 'index';

        if (constraint) {
          const handChar = constraint.charAt(0);
          const fingerNum = parseInt(constraint.charAt(1), 10);
          if (handChar === 'L' || handChar === 'l') hand = 'left';
          else if (handChar === 'R' || handChar === 'r') hand = 'right';
          const fingerMap: Record<number, FingerType> = {
            1: 'thumb', 2: 'index', 3: 'middle', 4: 'ring', 5: 'pinky',
          };
          finger = fingerMap[fingerNum] ?? 'index';
        }
      }

      presetPads.push({
        position: { rowOffset: coord.row, colOffset: coord.col },
        laneId: lane.id,
        finger,
        hand,
      });
    }

    if (presetPads.length === 0) {
      window.alert('No pads assigned. Assign pads on the grid before saving a Composer Preset.');
      return;
    }

    // Normalize to relative coordinates
    const normalizedPads = normalizePadPositions(presetPads);
    const handedness = computeHandedness(normalizedPads);

    const name = window.prompt('Composer Preset name:', `Preset ${new Date().toLocaleDateString()}`);
    if (!name) return;

    saveComposerPreset({
      name,
      pads: normalizedPads,
      config: loopState.config,
      lanes: loopState.lanes,
      events: Array.from(loopState.events.entries()),
      handedness,
      mirrorEligible: isMirrorEligible(handedness),
      boundingBox: computeBoundingBox(normalizedPads),
      tags: [],
    });
  }, [loopState, projectState, laneFingerAssignments]);

  const handleLoadPreset = useCallback((preset: PerformancePreset) => {
    setHasTouchedComposer(true);
    dispatch({ type: 'LOAD_LOOP_STATE', payload: presetToLoopState(preset) });
    setActiveEventIndex(null);
  }, []);

  const handleDeletePreset = useCallback((presetId: string) => {
    deletePreset(presetId);
  }, []);

  const handleResetComposer = useCallback(() => {
    setHasTouchedComposer(true);
    dispatch({ type: 'LOAD_LOOP_STATE', payload: createInitialLoopState() });
    setActiveEventIndex(null);
    projectDispatch({
      type: 'REMOVE_LANE_SOURCE',
      payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
    });
  }, [projectDispatch]);

  // Sync pattern pad assignments to main grid layout
  useEffect(() => {
    if (!activeResult || activeResult.padAssignments.length === 0) return;
    const padToVoice: Layout['padToVoice'] = {};
    for (const pa of activeResult.padAssignments) {
      const lane = loopState.lanes.find(l => l.id === pa.laneId);
      padToVoice[`${pa.pad.row},${pa.pad.col}`] = {
        id: pa.laneId,
        name: pa.laneName,
        sourceType: 'midi_track',
        sourceFile: WORKSPACE_PATTERN_NAME,
        originalMidiNote: lane?.midiNote ?? 0,
        color: lane?.color ?? '#888',
      };
    }
    projectDispatch({ type: 'BULK_ASSIGN_PADS', payload: padToVoice });
  }, [activeResult, loopState.lanes, projectDispatch]);

  const activeStepIndex = useMemo(() => {
    if (activeEventIndex === null || !activeResult) return null;
    const assignment = activeResult.fingerAssignments[activeEventIndex];
    return assignment?.stepIndex ?? null;
  }, [activeEventIndex, activeResult]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700">
        <div>
          <div className="text-sm font-semibold text-gray-200">Pattern Composer</div>
          <div className="text-[10px] text-gray-500">Changes sync directly into the shared performance timeline.</div>
        </div>

        <div className="w-px h-6 bg-gray-800" />

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Bars</span>
          {([4, 8, 16] as const).map(bars => (
            <button
              key={bars}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                loopState.config.barCount === bars
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => dispatchComposer({ type: 'SET_BAR_COUNT', payload: bars })}
            >
              {bars}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Grid</span>
          {(['1/8', '1/4', '1/2', '1/1'] as const).map(subdivision => (
            <button
              key={subdivision}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                loopState.config.subdivision === subdivision
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => handleSubdivisionChange(subdivision)}
            >
              {subdivision}
            </button>
          ))}
        </div>

        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            loopState.isPlaying
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-gray-700 text-gray-200'
          }`}
          onClick={() => dispatch({ type: 'SET_PLAYING', payload: !loopState.isPlaying })}
        >
          {loopState.isPlaying ? 'Stop' : 'Play'}
        </button>

        <div className="flex items-center gap-1">
          <input
            type="number"
            min={20}
            max={300}
            value={loopState.config.bpm}
            onChange={e => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) {
                dispatchComposer({ type: 'SET_BPM', payload: next });
              }
            }}
            className="w-16 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
          />
          <span className="text-[10px] text-gray-500">BPM</span>
        </div>

        <div className="flex-1" />

        <span className="text-[10px] text-emerald-300/80">
          {loopState.lanes.length} lanes · {loopState.events.size} events · live sync
        </span>

        <button
          className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
          onClick={handleAddLane}
        >
          + Lane
        </button>

        <PatternSelector
          onSelectPreset={handleGeneratePattern}
          onRandomize={handleRandomizePattern}
          onCustomize={handleOpenRecipeEditor}
          hasPatternResult={!!activeResult}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
        />

        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            loopState.events.size > 0
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          onClick={handleSavePreset}
          disabled={loopState.events.size === 0}
          title={loopState.events.size > 0 ? 'Save current pattern as preset' : 'Add events first'}
        >
          Save
        </button>

        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            loopState.events.size > 0 && loopState.lanes.length > 0
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          onClick={handleSaveComposerPreset}
          disabled={loopState.events.size === 0 || loopState.lanes.length === 0}
          title="Save as Composer Preset (captures pad layout + finger assignments + events)"
        >
          Save Preset
        </button>

        <button
          className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          onClick={handleResetComposer}
        >
          Clear
        </button>
      </div>

      {activeResult ? (
        <RudimentEventStepper
          fingerAssignments={activeResult.fingerAssignments}
          complexity={activeResult.complexity}
          activeEventIndex={activeEventIndex}
          onSetActiveEvent={setActiveEventIndex}
          lanes={loopState.lanes}
        />
      ) : loopState.events.size > 0 && hasTouchedComposer ? (
        <div className="px-3 py-1.5 rounded bg-gray-800/30 border border-gray-700/50 text-[10px] text-gray-500">
          Pattern edited — use Pattern Selector to re-generate analysis
        </div>
      ) : null}

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 flex rounded-lg bg-gray-800/20 border border-gray-700 overflow-hidden" style={{ minHeight: 260 }}>
          <LoopLaneSidebar
            lanes={loopState.lanes}
            dispatch={dispatchComposer}
            fingerAssignments={laneFingerAssignments}
            onFingerAssignmentChange={handleFingerAssignmentChange}
          />
          <LoopGridCanvas
            config={loopState.config}
            lanes={loopState.lanes}
            events={loopState.events}
            playheadStep={loopState.playheadStep}
            isPlaying={loopState.isPlaying}
            dispatch={dispatchComposer}
            activeStepIndex={activeStepIndex}
          />
        </div>

        {/* Pad assignments now sync to main InteractiveGrid via BULK_ASSIGN_PADS */}
      </div>

      {showRecipeEditor && (
        <RecipeEditorModal
          initialRecipe={editingRecipe}
          onGenerate={handleRecipeGenerate}
          onClose={() => setShowRecipeEditor(false)}
        />
      )}
    </div>
  );
}
