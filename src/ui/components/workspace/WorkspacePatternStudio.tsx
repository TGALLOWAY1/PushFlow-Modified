import { useReducer, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import {
  loopEditorReducer,
  createInitialLoopState,
  type LoopEditorAction,
} from '../../state/loopEditorReducer';
import { convertLoopToPerformanceLanes } from '../../state/loopToLanes';
import { type LoopLane, type LoopState } from '../../../types/loopEditor';
import { stepDuration, totalSteps } from '../../../types/loopEditor';
import { generateId } from '../../../utils/idGenerator';
import { LoopLaneSidebar } from '../loop-editor/LoopLaneSidebar';
import { LoopGridCanvas } from '../loop-editor/LoopGridCanvas';
import { saveComposerPreset } from '../../persistence/composerPresetStorage';
import {
  type PresetPad,
  type PresetFingerSource,
  computeBoundingBox,
  computeHandedness,
  canMirrorPreset,
  normalizePadPositions,
} from '../../../types/composerPreset';
import { type FingerType, type HandSide } from '../../../types/fingerModel';
import { type LaneFingerAssignment } from '../loop-editor/LoopLaneRow';
import { parsePadKey } from '../../../types/padGrid';
import { getDisplayedLayout } from '../../state/projectState';
import { saveLoopState, loadLoopState } from '../../persistence/loopStorage';
import { parseFingerConstraint } from '../../../utils/fingerConstraints';
import {
  WORKSPACE_PATTERN_LANE_ID_PREFIX,
  laneForVoice,
  projectSoundIdForLane,
  voiceForLane,
} from './composerLaneIdentity';
import { useToast } from '../shared/Toast';

const LANE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const DEFAULT_MIDI_NOTES = [36, 38, 42, 46, 48, 60, 62, 64];
const WORKSPACE_PATTERN_SOURCE_ID = 'workspace_pattern_source';
const WORKSPACE_PATTERN_GROUP_ID = 'workspace_pattern_group';
const WORKSPACE_PATTERN_NAME = 'Workspace Pattern';
const CLEAR_LABEL = 'Clear Composer';

interface ProjectPatternMeta {
  existingGroupOrder: number;
  nextBaseOrder: number;
}

interface WorkspacePatternStudioProps {
  /**
   * Whether the Composer tab is the one shown. The Composer stays mounted while
   * the Timeline tab is shown (so playback and pending edits survive a switch);
   * it flushes pending saves and syncs when it stops being shown (T60, T67).
   */
  isActive?: boolean;
}

/** Composer lane actions that change the project Sound itself, not just its notes. */
type SoundLaneAction = Extract<LoopEditorAction, { type: 'RENAME_LANE' | 'TOGGLE_LANE_MUTE' | 'TOGGLE_LANE_SOLO' }>;

export function WorkspacePatternStudio({ isActive = true }: WorkspacePatternStudioProps = {}) {
  const { state: projectState, dispatch: projectDispatch, transact, undo, undoLabel } = useProject();
  const toast = useToast();

  // Load persisted loop state on mount, fall back to fresh state
  const initialState = useMemo(() => {
    const saved = loadLoopState(projectState.id);
    return saved ?? createInitialLoopState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const [loopState, dispatch] = useReducer(loopEditorReducer, initialState, s => s);

  // Sync starts with the first edit made here. Opening a project (the Composer
  // is mounted with it) never writes to it, so nothing is marked unsaved or
  // recorded as an undo step just by loading (F9-19).
  const [hasTouchedComposer, setHasTouchedComposer] = useState(false);

  // Track whether the user explicitly cleared the composer (vs loading empty state)
  const userExplicitlyClearedRef = useRef(false);
  // The pattern as it was before the last Clear, kept until the Composer is
  // edited again, so Undo and Redo of Clear can restore or clear it again.
  // `cleared`: whether the Composer is currently cleared.
  const clearSnapshotRef = useRef<{ pattern: LoopState; cleared: boolean } | null>(null);
  // The Clear toast; `viaUndo` when its Undo is the project's Undo.
  const clearToastRef = useRef<{ id: number; viaUndo: boolean } | null>(null);

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

  // Latest values for the save and sync flushes, which also run from Stop, a
  // tab switch, pagehide and unmount (outside the render that scheduled them).
  const latestRef = useRef({ loopState, projectState });
  latestRef.current = { loopState, projectState };

  // The pattern itself. The playhead and play state are left out, so playback
  // (a SET_PLAYHEAD every frame) no longer restarts the save and sync timers.
  const { config, lanes, events, rudimentResult } = loopState;
  const pattern = useMemo(
    () => ({ config, lanes, events, rudimentResult }),
    [config, lanes, events, rudimentResult],
  );

  const saveNow = useCallback(() => {
    if (saveTimerRef.current === undefined) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    saveLoopState(latestRef.current.projectState.id, latestRef.current.loopState);
  }, []);

  const syncNow = useCallback(() => {
    if (syncTimerRef.current === undefined) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = undefined;
    const { loopState: current, projectState: project } = latestRef.current;
    const inProject = project.sourceFiles.some(sf => sf.id === WORKSPACE_PATTERN_SOURCE_ID);

    if (current.lanes.length === 0 || (current.events.size === 0 && !inProject)) {
      // Only remove lane source if the user explicitly cleared — don't remove on empty load
      if (userExplicitlyClearedRef.current && inProject) {
        projectDispatch({
          type: 'REMOVE_LANE_SOURCE',
          payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
        });
      }
      return;
    }

    // Use project tempo for conversion timing
    const stateWithProjectTempo = {
      ...current,
      config: { ...current.config, bpm: project.tempo },
    };

    const conversion = convertLoopToPerformanceLanes(stateWithProjectTempo, WORKSPACE_PATTERN_NAME, {
      sourceFileId: WORKSPACE_PATTERN_SOURCE_ID,
      sourceFileName: WORKSPACE_PATTERN_NAME,
      groupId: WORKSPACE_PATTERN_GROUP_ID,
      groupName: WORKSPACE_PATTERN_NAME,
      laneIdPrefix: WORKSPACE_PATTERN_LANE_ID_PREFIX,
      preserveLaneIds: true,
    });

    conversion.group.orderIndex = projectPatternMetaRef.current.existingGroupOrder;
    conversion.lanes = conversion.lanes.map((lane, index) => ({
      ...lane,
      orderIndex: projectPatternMetaRef.current.nextBaseOrder + index,
    }));

    // Notes only: a Sound's name, colour and mute belong to the project and are
    // never written back from the Composer (F9-03).
    projectDispatch({
      type: 'UPSERT_LANE_SOURCE',
      payload: {
        lanes: conversion.lanes,
        sourceFile: conversion.sourceFile,
        group: conversion.group,
        notesOnly: true,
      },
    });
  }, [projectDispatch]);

  /** Writes a pending save and sync now instead of when their timers fire. */
  const flushPending = useCallback(() => {
    saveNow();
    syncNow();
  }, [saveNow, syncNow]);

  // Persist loop state to localStorage on changes (debounced); the pattern as
  // loaded is already stored.
  const loadedPatternRef = useRef(pattern);
  useEffect(() => {
    if (pattern === loadedPatternRef.current) return;
    if (saveTimerRef.current !== undefined) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNow, 500);
  }, [pattern, projectState.id, saveNow]);

  // Sync composer notes to performance lanes (debounced)
  useEffect(() => {
    if (!hasTouchedComposer) return;
    if (syncTimerRef.current !== undefined) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(syncNow, 200);
  }, [hasTouchedComposer, pattern, projectState.tempo, syncNow]);

  // A pending edit is written, never dropped: when the tab is switched away,
  // when the page is hidden or closed, and when the Composer unmounts.
  useEffect(() => {
    if (!isActive) flushPending();
  }, [isActive, flushPending]);
  useEffect(() => {
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [flushPending]);

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
    clearSnapshotRef.current = null;
    dispatch(action);
  }, []);

  // The project lane (Sound) each Composer lane is, by identity (T66).
  const projectLaneFor = useMemo(() => {
    const byId = new Map(projectState.performanceLanes.map(l => [l.id, l]));
    return (laneId: string) => byId.get(projectSoundIdForLane(laneId));
  }, [projectState.performanceLanes]);

  // The project owns a Sound's name, colour, mute and solo; the Composer shows
  // them. A lane with no Sound yet (no notes synced) shows its own.
  const displayLanes = useMemo(() => loopState.lanes.map(lane => {
    const sound = projectLaneFor(lane.id);
    return sound
      ? { ...lane, name: sound.name, color: sound.color, isMuted: sound.isMuted, isSolo: sound.isSolo }
      : lane;
  }), [loopState.lanes, projectLaneFor]);

  // Renaming, muting or soloing a lane that is already a project Sound changes
  // the Sound (one project undo step), as the Sounds panel would.
  const laneDispatch = useCallback((action: LoopEditorAction) => {
    const soundAction = action as SoundLaneAction;
    const laneId = soundAction.type === 'RENAME_LANE' ? soundAction.payload.laneId
      : soundAction.type === 'TOGGLE_LANE_MUTE' || soundAction.type === 'TOGGLE_LANE_SOLO' ? soundAction.payload
      : null;
    const sound = laneId ? projectLaneFor(laneId) : undefined;
    if (!sound) {
      dispatchComposer(action);
      return;
    }
    if (soundAction.type === 'RENAME_LANE') {
      dispatchComposer(action);
      projectDispatch({ type: 'RENAME_SOUND', payload: { streamId: sound.id, name: soundAction.payload.name } });
    } else if (soundAction.type === 'TOGGLE_LANE_MUTE') {
      projectDispatch({ type: 'TOGGLE_MUTE', payload: sound.id });
    } else {
      projectDispatch({ type: 'SOLO_STREAM', payload: sound.id });
    }
  }, [dispatchComposer, projectDispatch, projectLaneFor]);

  // Build a mapping from composer lane IDs → voice IDs in layout.padToVoice.
  // A lane is its project Sound (id under WORKSPACE_PATTERN_LANE_ID_PREFIX);
  // never matched by MIDI pitch (invariant 5).
  const laneToVoiceId = useMemo(() => {
    const layout = getDisplayedLayout(projectState);
    if (!layout) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    const voices = Object.values(layout.padToVoice);
    for (const lane of loopState.lanes) {
      const v = voiceForLane(lane, voices);
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

  // Finger preferences live in voiceConstraints, keyed by the lane's project
  // Sound id: the same entry the Sounds panel and the grid read and write
  // (invariant 6; F9-V04).
  const laneFingerAssignments = useMemo(() => {
    const assignments: Record<string, LaneFingerAssignment> = {};
    for (const lane of loopState.lanes) {
      const vc = projectState.voiceConstraints[projectSoundIdForLane(lane.id)];
      if (vc?.hand && vc?.finger) {
        assignments[lane.id] = { hand: vc.hand, finger: vc.finger as FingerType };
      }
    }
    return assignments;
  }, [loopState.lanes, projectState.voiceConstraints]);

  // A Composer finger edit sets (or, with null, clears) the lane's Sound's preference.
  const handleFingerAssignmentChange = useCallback((laneId: string, assignment: LaneFingerAssignment | null) => {
    projectDispatch({
      type: 'SET_VOICE_CONSTRAINT',
      payload: {
        streamId: projectSoundIdForLane(laneId),
        hand: assignment?.hand ?? null,
        finger: assignment?.finger ?? null,
      },
    });
  }, [projectDispatch]);

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

  const handleTogglePlay = useCallback(() => {
    const stopping = loopState.isPlaying;
    dispatch({ type: 'SET_PLAYING', payload: !stopping });
    if (stopping) flushPending();
  }, [loopState.isPlaying, flushPending]);

  // Clear undone (from its toast or with Undo anywhere): the Sounds are back in
  // the project, so the Composer gets its pattern back from memory (F9-08).
  // Clear redone: the Sounds are gone again, so the Composer clears again.
  useEffect(() => {
    const snapshot = clearSnapshotRef.current;
    if (!snapshot) return;
    const inProject = projectState.sourceFiles.some(sf => sf.id === WORKSPACE_PATTERN_SOURCE_ID);
    if (snapshot.cleared && inProject) {
      clearSnapshotRef.current = { ...snapshot, cleared: false };
      userExplicitlyClearedRef.current = false;
      dispatch({ type: 'LOAD_LOOP_STATE', payload: snapshot.pattern });
    } else if (!snapshot.cleared && !inProject) {
      clearSnapshotRef.current = { ...snapshot, cleared: true };
      userExplicitlyClearedRef.current = true;
      dispatch({ type: 'LOAD_LOOP_STATE', payload: createInitialLoopState() });
    }
  }, [projectState.sourceFiles]);

  // Clear's toast offers Undo only while Clear is still the step Undo would revert.
  useEffect(() => {
    if (clearToastRef.current?.viaUndo && undoLabel !== CLEAR_LABEL) {
      toast.dismiss(clearToastRef.current.id);
      clearToastRef.current = null;
    }
  }, [undoLabel, toast]);

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

    // Build preset pads from the current layout's padToVoice mapping (if layout exists)
    const presetPads: PresetPad[] = [];

    if (layout) {
      const fingerConstraints = layout.fingerConstraints ?? {};

      for (const [padKeyStr, voice] of Object.entries(layout.padToVoice)) {
        // Match pads to composer lanes by identity, never by MIDI pitch (invariant 5).
        const lane = laneForVoice(voice, loopState.lanes);
        if (!lane) continue;

        const coord = parsePadKey(padKeyStr);
        if (!coord) continue;

        // Primary: use voice constraint from project state (try voice ID, lane ID, and mapped voice ID)
        const mappedVoiceId = laneToVoiceId[lane.id];
        const vc = projectState.voiceConstraints[voice.id]
          ?? projectState.voiceConstraints[lane.id]
          ?? (mappedVoiceId ? projectState.voiceConstraints[mappedVoiceId] : undefined);
        // Only a real preference is recorded; otherwise the pad's hand and
        // finger stay blank. Save Preset never invents fingering (T65).
        let hand: HandSide | null = null;
        let finger: FingerType | null = null;
        let fingerSource: PresetFingerSource | undefined;

        if (vc?.hand && vc?.finger) {
          hand = vc.hand;
          finger = vc.finger as FingerType;
          fingerSource = 'preference';
        } else {
          // A pad-level preference (derived from the Sound's) counts too.
          const constraint = fingerConstraints[padKeyStr];
          const parsed = constraint ? parseFingerConstraint(constraint) : null;
          if (parsed) {
            hand = parsed.hand;
            finger = parsed.finger;
            fingerSource = 'preference';
          }
        }

        presetPads.push({
          position: { rowOffset: coord.row, colOffset: coord.col },
          laneId: lane.id,
          finger,
          hand,
          ...(fingerSource ? { fingerSource } : {}),
        });
      }
    }

    // Normalize to relative coordinates (empty array if no pads assigned yet)
    const normalizedPads = normalizePadPositions(presetPads);
    const handedness = computeHandedness(normalizedPads);

    const name = window.prompt('Composer Preset name:', `Preset ${new Date().toLocaleDateString()}`);
    if (!name) return;

    saveComposerPreset({
      name,
      pads: normalizedPads,
      config: { ...loopState.config, bpm: projectState.tempo },
      lanes: displayLanes,
      events: Array.from(loopState.events.entries()),
      handedness,
      mirrorEligible: canMirrorPreset(normalizedPads),
      boundingBox: computeBoundingBox(normalizedPads),
      tags: [],
    });
  }, [loopState, projectState, displayLanes]);

  const handleResetComposer = useCallback(() => {
    const previous = latestRef.current.loopState;
    const noteCount = previous.events.size;
    const soundCount = previous.lanes.length;
    if (noteCount === 0 && soundCount === 0) return;
    const inProject = latestRef.current.projectState.sourceFiles.some(sf => sf.id === WORKSPACE_PATTERN_SOURCE_ID);

    // A pending sync would only re-add what Clear removes.
    if (syncTimerRef.current !== undefined) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = undefined;
    setHasTouchedComposer(true);
    userExplicitlyClearedRef.current = true;
    clearSnapshotRef.current = { pattern: { ...previous, isPlaying: false }, cleared: true };
    dispatch({ type: 'LOAD_LOOP_STATE', payload: createInitialLoopState() });
    if (inProject) {
      transact(CLEAR_LABEL, () => projectDispatch({
        type: 'REMOVE_LANE_SOURCE',
        payload: { sourceFileId: WORKSPACE_PATTERN_SOURCE_ID, groupId: WORKSPACE_PATTERN_GROUP_ID },
      }));
    }

    // Undo restores the notes, and (through the project's Undo) the Sounds,
    // their pads and finger preferences. With nothing in the project yet, the
    // pattern alone comes back from memory.
    const restoreLocal = () => {
      const snapshot = clearSnapshotRef.current;
      if (!snapshot?.cleared) return;
      clearSnapshotRef.current = null;
      userExplicitlyClearedRef.current = false;
      dispatch({ type: 'LOAD_LOOP_STATE', payload: snapshot.pattern });
    };
    if (clearToastRef.current !== null) toast.dismiss(clearToastRef.current.id);
    const notes = `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`;
    const sounds = `${soundCount} ${soundCount === 1 ? 'Sound' : 'Sounds'}`;
    const id = toast.show({
      message: inProject ? `Composer cleared \u00b7 ${notes} and ${sounds} removed` : `Composer cleared \u00b7 ${notes} removed`,
      action: { label: 'Undo', onClick: inProject ? undo : restoreLocal },
    });
    clearToastRef.current = { id, viaUndo: inProject };
  }, [projectDispatch, transact, undo, toast]);

  // Use project tempo for grid display
  const effectiveConfig = useMemo(
    () => ({ ...loopState.config, bpm: projectState.tempo }),
    [loopState.config, projectState.tempo],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-pf-lg bg-bg-panel/50 border border-[var(--border-default)]">
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
          onClick={handleTogglePlay}
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
          disabled={loopState.lanes.length === 0 && loopState.events.size === 0}
        >
          Clear
        </button>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 flex rounded-pf-lg bg-bg-card/20 border border-[var(--border-default)] overflow-hidden" style={{ minHeight: 260 }}>
          <LoopLaneSidebar
            lanes={displayLanes}
            dispatch={laneDispatch}
            fingerAssignments={laneFingerAssignments}
            onFingerAssignmentChange={handleFingerAssignmentChange}
            onAddLane={handleAddLane}
            padPositions={lanePadPositions}
          />
          <LoopGridCanvas
            config={effectiveConfig}
            lanes={displayLanes}
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
