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
import { generateId } from '../../../utils/idGenerator';
import { LoopLaneSidebar } from '../loop-editor/LoopLaneSidebar';
import { LoopGridCanvas } from '../loop-editor/LoopGridCanvas';
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
import { saveLoopState, loadLoopState } from '../../persistence/loopStorage';
import { parseFingerConstraint } from '../../../utils/fingerConstraints';

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

  // Load persisted loop state on mount, fall back to fresh state
  const initialState = useMemo(() => {
    const saved = loadLoopState(projectState.id);
    return saved ?? createInitialLoopState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const [loopState, dispatch] = useReducer(loopEditorReducer, initialState, s => s);

  // Initialize hasTouchedComposer from loaded state (if it has content, sync should run)
  const [hasTouchedComposer, setHasTouchedComposer] = useState(
    () => initialState.lanes.length > 0 && initialState.events.size > 0
  );

  // Track whether the user explicitly cleared the composer (vs loading empty state)
  const userExplicitlyClearedRef = useRef(false);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const playheadRef = useRef<number>(loopState.playheadStep);
  const projectPatternMetaRef = useRef<ProjectPatternMeta>({
    existingGroupOrder: projectState.laneGroups.length,
    nextBaseOrder: 0,
  });

  playheadRef.current = loopState.playheadStep;

  // Persist loop state to localStorage on changes (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLoopState(projectState.id, loopState);
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [loopState, projectState.id]);

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
    userExplicitlyClearedRef.current = false;
    dispatch(action);
  }, []);

  // Build a mapping from composer lane IDs → voice IDs in layout.padToVoice.
  // Lanes and voices live in different ID spaces; this bridges them via name/MIDI note.
  const laneToVoiceId = useMemo(() => {
    const layout = getDisplayedLayout(projectState);
    if (!layout) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    const voices = Object.values(layout.padToVoice);
    for (const lane of loopState.lanes) {
      // Direct ID match (rare but possible)
      let v = voices.find(v => v.id === lane.id);
      // Name match
      if (!v) v = voices.find(v => v.name === lane.name);
      // MIDI note match
      if (!v && lane.midiNote !== null) v = voices.find(v => v.originalMidiNote === lane.midiNote);
      if (v) map[lane.id] = v.id;
    }
    return map;
  }, [loopState.lanes, projectState]);

  // Compute pad positions for each lane from the current layout, keyed by lane ID
  const lanePadPositions = useMemo(() => {
    const layout = getDisplayedLayout(projectState);
    if (!layout) return {};
    // Build voice ID → pad key map
    const voicePadMap: Record<string, string> = {};
    for (const [pk, voice] of Object.entries(layout.padToVoice)) {
      if (!voicePadMap[voice.id]) voicePadMap[voice.id] = pk;
    }
    // Map lane IDs to pad positions via the lane→voice bridge
    const map: Record<string, string> = {};
    for (const lane of loopState.lanes) {
      const voiceId = laneToVoiceId[lane.id];
      if (voiceId && voicePadMap[voiceId]) {
        map[lane.id] = voicePadMap[voiceId];
      }
    }
    return map;
  }, [loopState.lanes, laneToVoiceId, projectState]);

  // Derive finger assignments from project voiceConstraints (single source of truth).
  // Look up by both lane ID and the mapped voice ID to catch constraints set from any panel.
  const laneFingerAssignments = useMemo(() => {
    const assignments: Record<string, LaneFingerAssignment> = {};
    for (const lane of loopState.lanes) {
      const voiceId = laneToVoiceId[lane.id];
      const vc = projectState.voiceConstraints[lane.id]
        ?? (voiceId ? projectState.voiceConstraints[voiceId] : undefined);
      if (vc?.hand && vc?.finger) {
        assignments[lane.id] = { hand: vc.hand, finger: vc.finger as FingerType };
      }
    }
    return assignments;
  }, [loopState.lanes, laneToVoiceId, projectState.voiceConstraints]);

  // Finger assignment changes dispatch to project state for BOTH lane ID and voice ID,
  // ensuring constraints are visible from all panels (Sounds panel uses voice ID, Composer uses lane ID).
  const handleFingerAssignmentChange = useCallback((laneId: string, assignment: LaneFingerAssignment) => {
    projectDispatch({
      type: 'SET_VOICE_CONSTRAINT',
      payload: { streamId: laneId, hand: assignment.hand, finger: assignment.finger },
    });
    // Also set for the mapped voice ID so Sounds panel and Grid see it
    const voiceId = laneToVoiceId[laneId];
    if (voiceId && voiceId !== laneId) {
      projectDispatch({
        type: 'SET_VOICE_CONSTRAINT',
        payload: { streamId: voiceId, hand: assignment.hand, finger: assignment.finger },
      });
    }
  }, [projectDispatch, laneToVoiceId]);

  useEffect(() => {
    if (!loopState.isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = 0;
      return;
    }

    // Use project tempo for playback timing
    const effectiveConfig = { ...loopState.config, bpm: projectState.tempo };
    const stepDur = stepDuration(effectiveConfig);
    const steps = totalSteps(effectiveConfig);

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
  }, [loopState.isPlaying, loopState.config, projectState.tempo]);

  // Sync composer state to performance lanes (debounced)
  useEffect(() => {
    if (!hasTouchedComposer) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (loopState.lanes.length === 0 || loopState.events.size === 0) {
        // Only remove lane source if the user explicitly cleared — don't remove on empty load
        if (userExplicitlyClearedRef.current) {
          projectDispatch({
            type: 'REMOVE_LANE_SOURCE',
            payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
          });
        }
        return;
      }

      // Use project tempo for conversion timing
      const stateWithProjectTempo = {
        ...loopState,
        config: { ...loopState.config, bpm: projectState.tempo },
      };

      const conversion = convertLoopToPerformanceLanes(stateWithProjectTempo, WORKSPACE_PATTERN_NAME, {
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
  }, [hasTouchedComposer, loopState, projectState.tempo, projectDispatch]);

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

  const handleSubdivisionChange = useCallback((subdivision: '1/8' | '1/4' | '1/2' | '1/1') => {
    if (subdivision === loopState.config.subdivision) return;
    if (loopState.events.size > 0) {
      const ok = window.confirm(`Changing grid subdivision will clear ${loopState.events.size} events. Continue?`);
      if (!ok) return;
    }
    dispatchComposer({ type: 'SET_SUBDIVISION', payload: subdivision });
  }, [dispatchComposer, loopState.config.subdivision, loopState.events.size]);

  /**
   * Save current composer state as a ComposerPreset.
   * Uses voice constraints from project state as the primary source of finger assignments.
   * Falls back to layout finger constraints if no voice constraints exist.
   */
  const handleSaveComposerPreset = useCallback(() => {
    if (loopState.events.size === 0 || loopState.lanes.length === 0) return;

    const layout = getDisplayedLayout(projectState);
    if (!layout) return;

    // Check if any lane has a finger assignment via voiceConstraints
    const hasFingerAssignments = loopState.lanes.some(l => {
      const voiceId = laneToVoiceId[l.id];
      const vc = projectState.voiceConstraints[l.id]
        ?? (voiceId ? projectState.voiceConstraints[voiceId] : undefined);
      return vc?.hand && vc?.finger;
    });

    // If no finger assignments and no pads on grid, require finger assignments
    if (!hasFingerAssignments && Object.keys(layout.padToVoice).length === 0) {
      window.alert('Set finger assignments for each lane before saving a Composer Preset.\nClick the ·· button next to each lane name to assign a hand + finger.');
      return;
    }

    // Build preset pads from the current layout's padToVoice mapping
    const presetPads: PresetPad[] = [];
    const fingerConstraints = layout.fingerConstraints ?? {};

    for (const [padKeyStr, voice] of Object.entries(layout.padToVoice)) {
      // Match pads to composer lanes: try ID match, then name match, then MIDI note match
      let lane = loopState.lanes.find(l => l.id === voice.id);
      if (!lane) lane = loopState.lanes.find(l => l.name === voice.name);
      if (!lane) lane = loopState.lanes.find(l => l.midiNote !== null && l.midiNote === voice.originalMidiNote);
      if (!lane) continue;

      const coord = parsePadKey(padKeyStr);
      if (!coord) continue;

      // Primary: use voice constraint from project state (try voice ID, lane ID, and mapped voice ID)
      const mappedVoiceId = laneToVoiceId[lane.id];
      const vc = projectState.voiceConstraints[voice.id]
        ?? projectState.voiceConstraints[lane.id]
        ?? (mappedVoiceId ? projectState.voiceConstraints[mappedVoiceId] : undefined);
      let hand: HandSide;
      let finger: FingerType;

      if (vc?.hand && vc?.finger) {
        hand = vc.hand;
        finger = vc.finger as FingerType;
      } else {
        // Fallback: parse finger constraint from layout
        const constraint = fingerConstraints[padKeyStr];
        hand = coord.col <= 4 ? 'left' : 'right';
        finger = 'index';

        if (constraint) {
          const parsed = parseFingerConstraint(constraint);
          if (parsed) {
            hand = parsed.hand;
            finger = parsed.finger;
          }
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
      config: { ...loopState.config, bpm: projectState.tempo },
      lanes: loopState.lanes,
      events: Array.from(loopState.events.entries()),
      handedness,
      mirrorEligible: isMirrorEligible(handedness),
      boundingBox: computeBoundingBox(normalizedPads),
      tags: [],
    });
  }, [loopState, projectState]);

  const handleResetComposer = useCallback(() => {
    setHasTouchedComposer(true);
    userExplicitlyClearedRef.current = true;
    dispatch({ type: 'LOAD_LOOP_STATE', payload: createInitialLoopState() });
    projectDispatch({
      type: 'REMOVE_LANE_SOURCE',
      payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
    });
  }, [projectDispatch]);

  // Use project tempo for grid display
  const effectiveConfig = useMemo(
    () => ({ ...loopState.config, bpm: projectState.tempo }),
    [loopState.config, projectState.tempo],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-pf-lg bg-[var(--bg-panel)]/50 border border-[var(--border-default)]">
        <div>
          <div className="text-pf-md font-semibold text-[var(--text-primary)]">Pattern Composer</div>
          <div className="text-pf-xs text-[var(--text-secondary)]">Changes sync directly into the shared performance timeline.</div>
        </div>

        <div className="pf-divider-v h-6" />

        <div className="flex items-center gap-1">
          <span className="text-pf-xs text-[var(--text-secondary)]">Bars</span>
          {([4, 8, 16] as const).map(bars => (
            <button
              key={bars}
              className={`px-2 py-1 text-pf-sm rounded-pf-sm transition-colors ${
                loopState.config.barCount === bars
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => dispatchComposer({ type: 'SET_BAR_COUNT', payload: bars })}
            >
              {bars}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-pf-xs text-[var(--text-secondary)]">Grid</span>
          {(['1/8', '1/4', '1/2', '1/1'] as const).map(subdivision => (
            <button
              key={subdivision}
              className={`px-2 py-1 text-pf-sm rounded-pf-sm transition-colors ${
                loopState.config.subdivision === subdivision
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => handleSubdivisionChange(subdivision)}
            >
              {subdivision}
            </button>
          ))}
        </div>

        <button
          className={`px-2 py-1 text-pf-sm rounded-pf-sm transition-colors ${
            loopState.isPlaying
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
          }`}
          onClick={() => dispatch({ type: 'SET_PLAYING', payload: !loopState.isPlaying })}
        >
          {loopState.isPlaying ? 'Stop' : 'Play'}
        </button>

        {/* BPM display (read-only, uses project tempo) */}
        <div className="flex items-center gap-1">
          <span className="text-pf-sm text-[var(--text-secondary)] font-mono">{projectState.tempo}</span>
          <span className="text-pf-xs text-[var(--text-tertiary)]">BPM</span>
        </div>

        <div className="flex-1" />

        <span className="text-pf-xs text-emerald-300/80">
          {loopState.lanes.length} lanes · {loopState.events.size} events · live sync
        </span>

        <button
          className={`px-2 py-1 text-pf-sm rounded-pf-sm transition-colors ${
            loopState.events.size > 0 && loopState.lanes.length > 0
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30'
              : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] cursor-not-allowed'
          }`}
          onClick={handleSaveComposerPreset}
          disabled={loopState.events.size === 0 || loopState.lanes.length === 0}
          title="Save as Composer Preset (captures pad layout + finger assignments + events)"
        >
          Save Preset
        </button>

        <button
          className="pf-btn pf-btn-subtle text-pf-sm"
          onClick={handleResetComposer}
        >
          Clear
        </button>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 flex rounded-pf-lg bg-[var(--bg-card)]/20 border border-[var(--border-default)] overflow-hidden" style={{ minHeight: 260 }}>
          <LoopLaneSidebar
            lanes={loopState.lanes}
            dispatch={dispatchComposer}
            fingerAssignments={laneFingerAssignments}
            onFingerAssignmentChange={handleFingerAssignmentChange}
            onAddLane={handleAddLane}
            padPositions={lanePadPositions}
          />
          <LoopGridCanvas
            config={effectiveConfig}
            lanes={loopState.lanes}
            events={loopState.events}
            playheadStep={loopState.playheadStep}
            isPlaying={loopState.isPlaying}
            dispatch={dispatchComposer}
          />
        </div>
      </div>

    </div>
  );
}
