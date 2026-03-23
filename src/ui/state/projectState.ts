/**
 * Project State.
 *
 * Central state type for the PushFlow project-based editor.
 *
 * V3 workflow state model:
 * - activeLayout: the committed baseline (read-mostly, changed only by Promote)
 * - workingLayout: session-scoped exploratory draft (created on first edit, discardable)
 * - savedVariants: durable named alternatives (kept for comparison)
 * - candidates: generated proposals (ephemeral, not persisted)
 *
 * Manual edits always target the working layout. If no working layout exists,
 * one is auto-created by cloning the active layout on first edit.
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type Layout, type LayoutRole, cloneLayout, createEmptyLayout } from '../../types/layout';
import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section, type VoiceProfile } from '../../types/performanceStructure';
import { type PerformanceLane, type LaneGroup, type SourceFile } from '../../types/performanceLane';
import { type LaneAction, isLaneAction, lanesReducer } from './lanesReducer';
import { type CostToggles, ALL_COSTS_ENABLED } from '../../types/costToggles';
import { type PerformanceCostBreakdown } from '../../types/costBreakdown';
import { type OptimizerMethodKey, type OptimizerMove, type OptimizationIteration } from '../../engine/optimization/optimizerInterface';
import { checkPlanFreshness } from '../../engine/evaluation/executionPlanValidation';
import { formatFingerConstraint, parseFingerConstraint } from '../../utils/fingerConstraints';

// ============================================================================
// Sound Stream Model
// ============================================================================

/** A single timing event within a sound stream. */
export interface SoundEvent {
  startTime: number;
  duration: number;
  velocity: number;
  eventKey: string;
  /**
   * Back-reference to the parent SoundStream.id.
   * Populated during import so events carry stable identity
   * even when flattened into a Performance timeline.
   */
  voiceId?: string;
}

/**
 * SoundStream: An independent timing track for a single sound.
 *
 * After MIDI import, each unique pitch becomes a SoundStream.
 * The timing data is preserved independently of the original MIDI pitch.
 * Muting a stream excludes it from grid, timeline, and analysis.
 */
export interface SoundStream {
  id: string;
  name: string;
  color: string;
  originalMidiNote: number;
  events: SoundEvent[];
  muted: boolean;
}

// ============================================================================
// Project State
// ============================================================================

/** Persistence format version for migration support. */
export const PROJECT_STATE_VERSION = 2;

export interface ProjectState {
  /** Persistence format version. */
  version: number;

  // Identity
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Sound Streams (canonical performance data)
  soundStreams: SoundStream[];
  tempo: number;
  instrumentConfig: InstrumentConfig;
  sections: Section[];
  voiceProfiles: VoiceProfile[];

  // === V3 Workflow Layout Model ===

  /** The committed baseline layout. Changed only by explicit Promote. */
  activeLayout: Layout;

  /**
   * Session-scoped exploratory draft. Created automatically on first edit.
   * Null when no edits have been made since last promote/discard.
   * Stripped on save/load (session-scoped per default).
   */
  workingLayout: Layout | null;

  /** Durable named alternative layouts. Persist across sessions. */
  savedVariants: Layout[];

  // === Legacy compatibility (kept for migration, will be removed) ===
  /** @deprecated Use activeLayout. Kept only for migration from V1 format. */
  layouts?: Layout[];
  /** @deprecated Use activeLayout.id. Kept only for migration from V1 format. */
  activeLayoutId?: string;

  // Analysis cache
  analysisResult: CandidateSolution | null;
  candidates: CandidateSolution[];
  selectedCandidateId: string | null;

  // Config
  engineConfig: EngineConfiguration;

  // Voice-level constraints (hand/finger per voice, key is stream ID)
  voiceConstraints: Record<string, { hand?: 'left' | 'right'; finger?: string }>;

  // Performance Lanes (pre-editor authoring data)
  performanceLanes: PerformanceLane[];
  laneGroups: LaneGroup[];
  sourceFiles: SourceFile[];

  // === Optimizer configuration ===

  /** Active optimization method. */
  optimizerMethod: OptimizerMethodKey;
  /** Cost toggle state (which cost families are active). */
  costToggles: CostToggles;

  // Ephemeral UI state (not persisted, not in undo stack)
  selectedEventIndex: number | null;
  /** Moment-level selection index (indexes into ExecutionPlanResult.momentAssignments). */
  selectedMomentIndex: number | null;
  /** Currently selected sound stream (for cross-panel highlighting). */
  selectedStreamId: string | null;
  compareCandidateId: string | null;
  isProcessing: boolean;
  error: string | null;
  analysisStale: boolean;

  /** Manual cost evaluation result (from Calculate Cost button). */
  manualCostResult: PerformanceCostBreakdown | null;
  /** Move history from interpretable optimizers (greedy). */
  moveHistory: OptimizerMove[] | null;
  /** Detailed iteration traces for the visual debugger. */
  iterationTrace: OptimizationIteration[] | null;
  /** Why the optimizer stopped (stored alongside moveHistory). */
  moveHistoryStopReason: string | null;
  /** Current index in move history for step-through replay. */
  moveHistoryIndex: number | null;

  // Transport
  currentTime: number;
  isPlaying: boolean;
}

// ============================================================================
// Derived State Helpers
// ============================================================================

/**
 * Build a Performance object from unmuted SoundStreams for solver consumption.
 */
export function getActivePerformance(state: ProjectState): Performance {
  const activeStreams = state.soundStreams.filter(s => !s.muted);
  const events = activeStreams.flatMap(stream =>
    stream.events.map(e => ({
      noteNumber: stream.originalMidiNote,
      voiceId: e.voiceId ?? stream.id,
      startTime: e.startTime,
      duration: e.duration,
      velocity: e.velocity,
      eventKey: e.eventKey,
    }))
  ).sort((a, b) => a.startTime - b.startTime);

  return { events, tempo: state.tempo, name: state.name };
}

/**
 * Get the active layout from the project state.
 * This always returns the committed baseline.
 */
export function getActiveLayout(state: ProjectState): Layout | null {
  return state.activeLayout ?? null;
}

/**
 * Get the currently displayed layout.
 * Returns the working layout if one exists, otherwise the active layout.
 * This is the layout the user sees and interacts with.
 */
export function getDisplayedLayout(state: ProjectState): Layout | null {
  return state.workingLayout ?? state.activeLayout ?? null;
}

/**
 * Get the role of the currently displayed layout.
 */
export function getDisplayedLayoutRole(state: ProjectState): LayoutRole | null {
  if (state.workingLayout) return 'working';
  if (state.activeLayout) return 'active';
  return null;
}

/** Whether the project has unsaved working changes. */
export function hasWorkingChanges(state: ProjectState): boolean {
  return state.workingLayout !== null;
}

/** Get only unmuted sound streams. */
export function getActiveStreams(state: ProjectState): SoundStream[] {
  return state.soundStreams.filter(s => !s.muted);
}

export function getCandidateById(
  state: ProjectState,
  candidateId: string | null,
): CandidateSolution | null {
  if (!candidateId) return null;
  return state.candidates.find(candidate => candidate.id === candidateId) ?? null;
}

export function getSelectedCandidate(state: ProjectState): CandidateSolution | null {
  return getCandidateById(state, state.selectedCandidateId);
}

export function getAnalysisForLayout(
  state: ProjectState,
  layout: Layout | null,
): CandidateSolution | null {
  if (!layout || !state.analysisResult) return null;
  if (state.analysisResult.layout.id === layout.id) return state.analysisResult;
  return checkPlanFreshness(state.analysisResult.executionPlan, layout).isFresh
    ? state.analysisResult
    : null;
}

export function getDisplayedCandidate(state: ProjectState): CandidateSolution | null {
  return getSelectedCandidate(state) ?? getAnalysisForLayout(state, getDisplayedLayout(state));
}

export function getDisplayedExecutionPlan(state: ProjectState): ExecutionPlanResult | null {
  return getDisplayedCandidate(state)?.executionPlan ?? null;
}

// ============================================================================
// Actions
// ============================================================================

export type ProjectAction =
  // Project lifecycle
  | { type: 'LOAD_PROJECT'; payload: ProjectState }
  | { type: 'RESET' }
  | { type: 'RENAME_PROJECT'; payload: string }
  | { type: 'SET_TEMPO'; payload: number }

  // Sound streams
  | { type: 'RENAME_SOUND'; payload: { streamId: string; name: string } }
  | { type: 'TOGGLE_MUTE'; payload: string }
  | { type: 'SOLO_STREAM'; payload: string }
  | { type: 'SET_SOUND_COLOR'; payload: { streamId: string; color: string } }
  | { type: 'SET_VOICE_CONSTRAINT'; payload: { streamId: string; hand?: 'left' | 'right' | null; finger?: string | null } }
  | { type: 'SELECT_STREAM'; payload: string | null }
  | { type: 'REORDER_STREAMS'; payload: { streamId: string; newIndex: number } }

  // Layout editing (targets working layout, auto-creates if needed)
  | { type: 'ASSIGN_VOICE_TO_PAD'; payload: { padKey: string; stream: SoundStream } }
  | { type: 'BULK_ASSIGN_PADS'; payload: Layout['padToVoice'] }
  | { type: 'MERGE_ASSIGN_PADS'; payload: Layout['padToVoice'] }
  | { type: 'REMOVE_VOICE_FROM_PAD'; payload: { padKey: string } }
  | { type: 'SWAP_PADS'; payload: { padKeyA: string; padKeyB: string } }
  | { type: 'SET_FINGER_CONSTRAINT'; payload: { padKey: string; constraint: string | null } }

  // Placement locks (hard constraints on the displayed layout)
  | { type: 'TOGGLE_PLACEMENT_LOCK'; payload: { voiceId: string; padKey: string } }

  // V3 Workflow actions
  | { type: 'CREATE_WORKING_LAYOUT' }
  | { type: 'DISCARD_WORKING_LAYOUT' }
  | { type: 'PROMOTE_WORKING_LAYOUT' }
  | { type: 'PROMOTE_CANDIDATE'; payload: { candidateId: string } }
  | { type: 'DELETE_CANDIDATE'; payload: { candidateId: string } }
  | { type: 'SAVE_AS_VARIANT'; payload: { name: string; source: 'working' | 'candidate'; candidateId?: string } }
  | { type: 'RENAME_LAYOUT'; payload: { target: 'active' | 'working'; name: string } }

  // Analysis
  | { type: 'SET_ANALYSIS_RESULT'; payload: CandidateSolution | null }
  | { type: 'SET_CANDIDATES'; payload: CandidateSolution[] }
  | { type: 'SELECT_CANDIDATE'; payload: string | null }
  | { type: 'MARK_ANALYSIS_STALE' }

  // Instrument config
  | { type: 'SET_INSTRUMENT_CONFIG'; payload: Partial<InstrumentConfig> }

  // Ephemeral UI
  | { type: 'SELECT_EVENT'; payload: number | null }
  | { type: 'SELECT_MOMENT'; payload: number | null }
  | { type: 'SET_COMPARE_CANDIDATE'; payload: string | null }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

  // Optimizer configuration
  | { type: 'SET_OPTIMIZER_METHOD'; payload: OptimizerMethodKey }
  | { type: 'SET_COST_TOGGLES'; payload: CostToggles }
  | { type: 'SET_MANUAL_COST_RESULT'; payload: PerformanceCostBreakdown | null }
  | { type: 'SET_MOVE_HISTORY'; payload: { moves: OptimizerMove[] | null; trace: OptimizationIteration[] | null; stopReason?: string } }
  | { type: 'SET_MOVE_HISTORY_INDEX'; payload: number | null }

  // Transport
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'TICK_TIME'; payload: number }
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'TOGGLE_PLAYING' }

  // Performance Lanes (delegated to lanesReducer)
  | LaneAction;

/** Actions that should NOT be recorded in the undo stack. */
const EPHEMERAL_ACTIONS = new Set<ProjectAction['type']>([
  'SELECT_EVENT',
  'SELECT_MOMENT',
  'SET_COMPARE_CANDIDATE',
  'SET_PROCESSING',
  'SET_ERROR',
  'MARK_ANALYSIS_STALE',
  'SET_ANALYSIS_RESULT',
  'SET_CANDIDATES',
  'SELECT_CANDIDATE',
  'TOGGLE_LANE_GROUP_COLLAPSE',
  'SET_CURRENT_TIME',
  'TICK_TIME',
  'SET_IS_PLAYING',
  'TOGGLE_PLAYING',
  'SET_MANUAL_COST_RESULT',
  'SET_MOVE_HISTORY',
  'SET_MOVE_HISTORY_INDEX',
]);

export function isEphemeralAction(action: ProjectAction): boolean {
  return EPHEMERAL_ACTIONS.has(action.type);
}

// ============================================================================
// Reducer Helpers
// ============================================================================

let _nextId = 0;
function generateId(): string {
  return `layout-${Date.now()}-${_nextId++}`;
}

/**
 * Ensure a working layout exists. If not, clone the active layout as a working draft.
 * Returns the state with a guaranteed non-null workingLayout.
 */
function ensureWorkingLayout(state: ProjectState): ProjectState & { workingLayout: Layout } {
  if (state.workingLayout) {
    return state as ProjectState & { workingLayout: Layout };
  }
  const working = cloneLayout(
    state.activeLayout,
    generateId(),
    `${state.activeLayout.name} (draft)`,
    'working',
  );
  return { ...state, workingLayout: working } as ProjectState & { workingLayout: Layout };
}

/**
 * Update the working layout (auto-creating it from active if needed).
 * All manual edits go through this helper.
 */
function updateWorkingLayout(
  state: ProjectState,
  updater: (layout: Layout) => Layout
): ProjectState {
  const withWorking = ensureWorkingLayout(state);
  const now = new Date().toISOString();
  return {
    ...withWorking,
    updatedAt: now,
    analysisStale: true,
    selectedCandidateId: null, // Clear candidate selection so grid shows the working layout
    workingLayout: { ...updater(withWorking.workingLayout), scoreCache: null },
  };
}

// ============================================================================
// Reducer
// ============================================================================

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  // Delegate lane/group actions to the dedicated lanes reducer
  if (isLaneAction(action.type)) {
    return lanesReducer(state, action as LaneAction);
  }

  switch (action.type) {
    case 'LOAD_PROJECT':
      return {
        ...action.payload,
        // Reset ephemeral state
        workingLayout: null, // Session-scoped: strip working layout on load
        selectedEventIndex: null,
        selectedMomentIndex: null,
        compareCandidateId: null,
        isProcessing: false,
        error: null,
        analysisStale: true,
        currentTime: 0,
        isPlaying: false,
      };

    case 'RESET':
      return createEmptyProjectState();

    case 'SET_INSTRUMENT_CONFIG':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        instrumentConfig: { ...state.instrumentConfig, ...action.payload },
        analysisStale: true,
      };

    case 'RENAME_PROJECT':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        name: action.payload,
      };

    case 'SET_TEMPO': {
      const bpm = Math.max(20, Math.min(999, Math.round(action.payload)));
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        tempo: bpm,
        analysisStale: true,
      };
    }

    // -- Sound streams --

    case 'RENAME_SOUND': {
      const { streamId, name } = action.payload;
      const renamePadVoices = (pv: Layout['padToVoice']) => {
        const out: Layout['padToVoice'] = {};
        for (const [k, v] of Object.entries(pv)) {
          out[k] = v.id === streamId ? { ...v, name } : v;
        }
        return out;
      };
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        soundStreams: state.soundStreams.map(s =>
          s.id === streamId ? { ...s, name } : s
        ),
        performanceLanes: state.performanceLanes.map(l =>
          l.id === streamId ? { ...l, name } : l
        ),
        activeLayout: {
          ...state.activeLayout,
          padToVoice: renamePadVoices(state.activeLayout.padToVoice),
        },
        workingLayout: state.workingLayout ? {
          ...state.workingLayout,
          padToVoice: renamePadVoices(state.workingLayout.padToVoice),
        } : null,
      };
    }

    case 'TOGGLE_MUTE': {
      const stream = state.soundStreams.find(s => s.id === action.payload);
      const newMuted = stream ? !stream.muted : true;
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        analysisStale: true,
        soundStreams: state.soundStreams.map(s =>
          s.id === action.payload ? { ...s, muted: newMuted } : s
        ),
        // Keep lane mute in sync
        performanceLanes: state.performanceLanes.map(l =>
          l.id === action.payload ? { ...l, isMuted: newMuted } : l
        ),
      };
    }

    case 'SOLO_STREAM': {
      const targetId = action.payload;
      const unmutedStreams = state.soundStreams.filter(s => !s.muted);
      const isAlreadySoloed = unmutedStreams.length === 1 && unmutedStreams[0].id === targetId;
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        analysisStale: true,
        soundStreams: state.soundStreams.map(s =>
          isAlreadySoloed
            ? { ...s, muted: false }
            : { ...s, muted: s.id !== targetId }
        ),
        performanceLanes: state.performanceLanes.map(l =>
          isAlreadySoloed
            ? { ...l, isMuted: false, isSolo: false }
            : { ...l, isMuted: l.id !== targetId, isSolo: l.id === targetId }
        ),
      };
    }

    case 'SET_SOUND_COLOR': {
      const { streamId: colorStreamId, color } = action.payload;
      const recolorPadVoices = (pv: Layout['padToVoice']) => {
        const out: Layout['padToVoice'] = {};
        for (const [k, v] of Object.entries(pv)) {
          out[k] = v.id === colorStreamId ? { ...v, color } : v;
        }
        return out;
      };
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        soundStreams: state.soundStreams.map(s =>
          s.id === colorStreamId ? { ...s, color } : s
        ),
        performanceLanes: state.performanceLanes.map(l =>
          l.id === colorStreamId ? { ...l, color } : l
        ),
        activeLayout: {
          ...state.activeLayout,
          padToVoice: recolorPadVoices(state.activeLayout.padToVoice),
        },
        workingLayout: state.workingLayout ? {
          ...state.workingLayout,
          padToVoice: recolorPadVoices(state.workingLayout.padToVoice),
        } : null,
      };
    }

    case 'SET_VOICE_CONSTRAINT': {
      const { streamId, hand, finger } = action.payload;
      const current = state.voiceConstraints[streamId] ?? {};
      const updated = { ...current };
      if (hand === null) delete updated.hand;
      else if (hand !== undefined) updated.hand = hand;
      if (finger === null) delete updated.finger;
      else if (finger !== undefined) updated.finger = finger;
      const next = { ...state.voiceConstraints };
      if (Object.keys(updated).length === 0) delete next[streamId];
      else next[streamId] = updated;

      // Cross-sync: update pad-level fingerConstraints for any pad holding this voice
      let newState: ProjectState = { ...state, updatedAt: new Date().toISOString(), voiceConstraints: next, analysisStale: true };
      const targetLayout = newState.workingLayout ?? newState.activeLayout;
      const padsForVoice = Object.entries(targetLayout.padToVoice)
        .filter(([, v]) => v.id === streamId)
        .map(([pk]) => pk);

      if (padsForVoice.length > 0 && updated.hand && updated.finger) {
        const constraintStr = formatFingerConstraint(updated.hand, updated.finger as Parameters<typeof formatFingerConstraint>[1]);
        newState = updateWorkingLayout(newState, layout => {
          const newConstraints = { ...layout.fingerConstraints };
          for (const pk of padsForVoice) {
            newConstraints[pk] = constraintStr;
          }
          return { ...layout, fingerConstraints: newConstraints };
        });
      } else if (padsForVoice.length > 0 && Object.keys(updated).length === 0) {
        // Voice constraint cleared — remove pad constraints for this voice's pads
        newState = updateWorkingLayout(newState, layout => {
          const newConstraints = { ...layout.fingerConstraints };
          for (const pk of padsForVoice) {
            delete newConstraints[pk];
          }
          return { ...layout, fingerConstraints: newConstraints };
        });
      }
      return newState;
    }

    case 'SELECT_STREAM':
      return { ...state, selectedStreamId: action.payload };

    case 'REORDER_STREAMS': {
      const { streamId: reorderId, newIndex } = action.payload;
      const streams = [...state.soundStreams];
      const oldIdx = streams.findIndex(s => s.id === reorderId);
      if (oldIdx === -1 || oldIdx === newIndex) return state;
      const [moved] = streams.splice(oldIdx, 1);
      streams.splice(newIndex, 0, moved);
      // Keep performanceLanes in same order
      const laneOrder = new Map(streams.map((s, i) => [s.id, i]));
      const lanes = [...state.performanceLanes].sort(
        (a, b) => (laneOrder.get(a.id) ?? 0) - (laneOrder.get(b.id) ?? 0)
      );
      return { ...state, updatedAt: new Date().toISOString(), soundStreams: streams, performanceLanes: lanes };
    }

    // -- Layout editing (all target working layout) --

    case 'ASSIGN_VOICE_TO_PAD':
      return updateWorkingLayout(state, layout => {
        const { padKey, stream } = action.payload;

        // Strip out existing assignments of this stream (acts as Move instead of Copy)
        const newPadToVoice = { ...layout.padToVoice };
        for (const [key, v] of Object.entries(newPadToVoice)) {
          if (v.id === stream.id) {
            delete newPadToVoice[key];
          }
        }

        const voice = {
          id: stream.id,
          name: stream.name,
          sourceType: 'midi_track' as const,
          sourceFile: '',
          originalMidiNote: stream.originalMidiNote,
          color: stream.color,
        };
        newPadToVoice[padKey] = voice;
        return {
          ...layout,
          padToVoice: newPadToVoice,
          layoutMode: 'manual',
        };
      });

    case 'BULK_ASSIGN_PADS':
      return updateWorkingLayout(state, layout => ({
        ...layout,
        padToVoice: action.payload,
        layoutMode: 'auto',
      }));

    case 'MERGE_ASSIGN_PADS':
      return updateWorkingLayout(state, layout => ({
        ...layout,
        padToVoice: { ...layout.padToVoice, ...action.payload },
        layoutMode: 'manual',
      }));

    case 'REMOVE_VOICE_FROM_PAD':
      return updateWorkingLayout(state, layout => {
        const { [action.payload.padKey]: _, ...rest } = layout.padToVoice;
        return { ...layout, padToVoice: rest, layoutMode: 'manual' };
      });

    case 'SWAP_PADS':
      return updateWorkingLayout(state, layout => {
        const { padKeyA, padKeyB } = action.payload;
        const voiceA = layout.padToVoice[padKeyA];
        const voiceB = layout.padToVoice[padKeyB];
        const newPadToVoice = { ...layout.padToVoice };
        if (voiceA) newPadToVoice[padKeyB] = voiceA;
        else delete newPadToVoice[padKeyB];
        if (voiceB) newPadToVoice[padKeyA] = voiceB;
        else delete newPadToVoice[padKeyA];
        return { ...layout, padToVoice: newPadToVoice, layoutMode: 'manual' };
      });

    case 'SET_FINGER_CONSTRAINT': {
      const { padKey: constraintPadKey, constraint } = action.payload;

      // Check for conflict with existing pad ownership in active solution
      if (constraint && state.analysisResult?.executionPlan?.padFingerOwnership) {
        const ownership = state.analysisResult.executionPlan.padFingerOwnership;
        const existing = ownership[constraintPadKey];
        if (existing) {
          const existingStr = `${existing.hand === 'left' ? 'L' : 'R'}-${existing.finger.charAt(0).toUpperCase() + existing.finger.slice(1)}`;
          if (existingStr !== constraint) {
            console.warn(
              `[PushFlow] Finger constraint conflict: pad ${constraintPadKey} is currently assigned to ${existingStr} in the active solution, but constraint is being set to ${constraint}. The solver will need to re-run.`
            );
          }
        }
      }

      let newState = updateWorkingLayout(state, layout => {
        const newConstraints = { ...layout.fingerConstraints };
        if (constraint) newConstraints[constraintPadKey] = constraint;
        else delete newConstraints[constraintPadKey];
        return { ...layout, fingerConstraints: newConstraints };
      });

      // Cross-sync: update voiceConstraints for the voice on this pad (if any)
      const displayedLayout = newState.workingLayout ?? newState.activeLayout;
      const voice = displayedLayout.padToVoice[constraintPadKey];
      if (voice) {
        const nextVC = { ...newState.voiceConstraints };
        if (constraint) {
          const parsed = parseFingerConstraint(constraint);
          if (parsed) {
            nextVC[voice.id] = { ...(nextVC[voice.id] ?? {}), hand: parsed.hand, finger: parsed.finger };
          }
        } else {
          // Constraint cleared — remove voice constraint
          if (nextVC[voice.id]) {
            const { hand: _, finger: __, ...rest } = nextVC[voice.id] as Record<string, unknown>;
            if (Object.keys(rest).length === 0) delete nextVC[voice.id];
            else nextVC[voice.id] = rest as typeof nextVC[string];
          }
        }
        newState = { ...newState, voiceConstraints: nextVC };
      }
      return newState;
    }

    // -- Placement locks --

    case 'TOGGLE_PLACEMENT_LOCK': {
      const { voiceId, padKey } = action.payload;
      // Locks operate on the displayed layout (working if exists, otherwise active)
      const targetLayout = state.workingLayout ?? state.activeLayout;
      const newLocks = { ...targetLayout.placementLocks };
      if (newLocks[voiceId] === padKey) {
        // Unlock: remove the lock
        delete newLocks[voiceId];
      } else {
        // Lock: voice is locked to this pad
        newLocks[voiceId] = padKey;
      }
      if (state.workingLayout) {
        return {
          ...state,
          updatedAt: new Date().toISOString(),
          workingLayout: { ...state.workingLayout, placementLocks: newLocks },
        };
      }
      // No working layout: lock on active layout directly (locks are durable)
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        activeLayout: { ...state.activeLayout, placementLocks: newLocks },
      };
    }

    // -- V3 Workflow actions --

    case 'CREATE_WORKING_LAYOUT': {
      if (state.workingLayout) return state; // Already exists
      return ensureWorkingLayout(state);
    }

    case 'DISCARD_WORKING_LAYOUT':
      return {
        ...state,
        workingLayout: null,
        analysisStale: true,
        selectedEventIndex: null,
        selectedMomentIndex: null,
        // Preserve candidates — discarding working layout doesn't invalidate them
        selectedCandidateId: null,
        compareCandidateId: null,
      };

    case 'PROMOTE_WORKING_LAYOUT': {
      if (!state.workingLayout) return state;
      const now = new Date().toISOString();

      // Auto-save the replaced active layout as a variant (if it has any assignments)
      const autoSavedVariants = [...state.savedVariants];
      if (Object.keys(state.activeLayout.padToVoice).length > 0) {
        const replaced = cloneLayout(
          state.activeLayout,
          generateId(),
          `${state.activeLayout.name} (replaced ${new Date().toLocaleDateString()})`,
          'variant',
        );
        autoSavedVariants.push(replaced);
      }

      // Promote: working becomes active
      const promoted: Layout = {
        ...state.workingLayout,
        role: 'active',
        baselineId: undefined,
        savedAt: now,
      };

      return {
        ...state,
        activeLayout: promoted,
        workingLayout: null,
        savedVariants: autoSavedVariants,
        updatedAt: now,
        analysisStale: true,
        // Preserve candidates — they remain valid for comparison/promotion
        selectedCandidateId: null,
        compareCandidateId: null,
      };
    }

    case 'PROMOTE_CANDIDATE': {
      const candidate = state.candidates.find(c => c.id === action.payload.candidateId);
      if (!candidate) return state;
      const now = new Date().toISOString();

      // Auto-save the replaced active layout as a variant
      const autoSavedVariants = [...state.savedVariants];
      if (Object.keys(state.activeLayout.padToVoice).length > 0) {
        const replaced = cloneLayout(
          state.activeLayout,
          generateId(),
          `${state.activeLayout.name} (replaced ${new Date().toLocaleDateString()})`,
          'variant',
        );
        autoSavedVariants.push(replaced);
      }

      // Promote: candidate's layout becomes active
      const promoted: Layout = {
        ...candidate.layout,
        id: generateId(),
        role: 'active',
        baselineId: undefined,
        placementLocks: state.activeLayout.placementLocks, // Preserve locks from active
        savedAt: now,
      };

      // Keep non-promoted candidates so the user can still compare or promote others
      const remainingCandidates = state.candidates.filter(c => c.id !== action.payload.candidateId);

      return {
        ...state,
        activeLayout: promoted,
        workingLayout: null,
        savedVariants: autoSavedVariants,
        updatedAt: now,
        analysisStale: true,
        candidates: remainingCandidates,
        selectedCandidateId: null,
        compareCandidateId: null,
      };
    }

    case 'DELETE_CANDIDATE': {
      const filtered = state.candidates.filter(c => c.id !== action.payload.candidateId);
      const wasSelected = state.selectedCandidateId === action.payload.candidateId;
      const wasCompare = state.compareCandidateId === action.payload.candidateId;
      return {
        ...state,
        candidates: filtered,
        selectedCandidateId: wasSelected ? null : state.selectedCandidateId,
        compareCandidateId: wasCompare ? null : state.compareCandidateId,
      };
    }

    case 'SAVE_AS_VARIANT': {
      const { name, source, candidateId } = action.payload;
      let sourceLayout: Layout | undefined;

      if (source === 'working' && state.workingLayout) {
        sourceLayout = state.workingLayout;
      } else if (source === 'candidate' && candidateId) {
        const candidate = state.candidates.find(c => c.id === candidateId);
        sourceLayout = candidate?.layout;
      }

      if (!sourceLayout) return state;

      const variant = cloneLayout(sourceLayout, generateId(), name, 'variant');

      return {
        ...state,
        savedVariants: [...state.savedVariants, variant],
        updatedAt: new Date().toISOString(),
      };
    }

    case 'RENAME_LAYOUT': {
      const { target, name: newName } = action.payload;
      if (target === 'active') {
        return {
          ...state,
          activeLayout: { ...state.activeLayout, name: newName },
          updatedAt: new Date().toISOString(),
        };
      }
      if (target === 'working' && state.workingLayout) {
        return {
          ...state,
          workingLayout: { ...state.workingLayout, name: newName },
          updatedAt: new Date().toISOString(),
        };
      }
      return state;
    }

    // -- Analysis --

    case 'SET_ANALYSIS_RESULT':
      return { ...state, analysisResult: action.payload, analysisStale: false };

    case 'SET_CANDIDATES':
      return {
        ...state,
        candidates: action.payload,
        selectedCandidateId: action.payload[0]?.id ?? null,
        compareCandidateId: null,
        isProcessing: false,
      };

    case 'SELECT_CANDIDATE':
      return { ...state, selectedCandidateId: action.payload };

    case 'MARK_ANALYSIS_STALE':
      return { ...state, analysisStale: true };

    // -- Ephemeral UI --

    case 'SELECT_EVENT':
      return { ...state, selectedEventIndex: action.payload };

    case 'SELECT_MOMENT':
      return { ...state, selectedMomentIndex: action.payload };

    case 'SET_COMPARE_CANDIDATE':
      return { ...state, compareCandidateId: action.payload };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isProcessing: false };

    // -- Transport --
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };

    case 'TICK_TIME':
      return { ...state, currentTime: state.currentTime + action.payload };

    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'TOGGLE_PLAYING':
      return { ...state, isPlaying: !state.isPlaying };

    // Optimizer configuration
    case 'SET_OPTIMIZER_METHOD':
      return { ...state, optimizerMethod: action.payload };

    case 'SET_COST_TOGGLES':
      return { ...state, costToggles: action.payload };

    case 'SET_MANUAL_COST_RESULT':
      return { ...state, manualCostResult: action.payload };

    case 'SET_MOVE_HISTORY':
      return {
        ...state,
        moveHistory: action.payload.moves,
        iterationTrace: action.payload.trace,
        moveHistoryStopReason: action.payload.stopReason ?? null,
        moveHistoryIndex: null,
      };

    case 'SET_MOVE_HISTORY_INDEX':
      return { ...state, moveHistoryIndex: action.payload };

    default:
      return state;
  }
}

// ============================================================================
// Empty State
// ============================================================================

export function createEmptyProjectState(): ProjectState {
  return {
    version: PROJECT_STATE_VERSION,
    id: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    soundStreams: [],
    tempo: 120,
    instrumentConfig: {
      id: 'default',
      name: 'Push 3',
      rows: 8,
      cols: 8,
      bottomLeftNote: 36,
      layoutMode: 'drum_64',
    },
    sections: [],
    voiceProfiles: [],
    activeLayout: createEmptyLayout('default-active', 'Default', 'active'),
    workingLayout: null,
    savedVariants: [],
    analysisResult: null,
    candidates: [],
    selectedCandidateId: null,
    engineConfig: {
      beamWidth: 30,
      stiffness: 0.3,
      restingPose: {
        left: { centroid: { x: 1.5, y: 3.5 }, fingers: {} },
        right: { centroid: { x: 5.5, y: 3.5 }, fingers: {} },
      },
    },
    voiceConstraints: {},
    optimizerMethod: 'greedy',
    costToggles: ALL_COSTS_ENABLED,
    performanceLanes: [],
    laneGroups: [],
    sourceFiles: [],
    selectedEventIndex: null,
    selectedMomentIndex: null,
    selectedStreamId: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: false,
    manualCostResult: null,
    moveHistory: null,
    iterationTrace: null,
    moveHistoryStopReason: null,
    moveHistoryIndex: null,
    currentTime: 0,
    isPlaying: false,
  };
}
