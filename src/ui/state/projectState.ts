/**
 * Project State.
 *
 * Central state type for the PushFlow project-based editor.
 *
 * V3 workflow state model:
 * - activeLayout: the committed baseline (read-mostly, changed only by Promote)
 * - workingLayout: exploratory draft (created on first edit, discardable)
 * - savedVariants: durable named alternatives (kept for comparison)
 * - candidates: generated proposals (ephemeral, not persisted)
 *
 * State is split into a document slice (what Undo covers) and a session slice
 * (what it never touches); see ProjectDocument, ProjectSession and
 * projectDocument.ts.
 *
 * Manual edits always target the working layout. If no working layout exists,
 * one is auto-created by cloning the active layout on first edit.
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type BeamSearchSummary, type CandidateSolution, type CandidateGenerationSummary } from '../../types/candidateSolution';
import { type Layout, type LayoutProvenance, cloneLayout, createEmptyLayout, reconcileLayoutVoices } from '../../types/layout';
import { type AnnealingIterationSnapshot, type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section, type VoiceProfile } from '../../types/performanceStructure';
import { type PerformanceLane, type LaneGroup, type SourceFile } from '../../types/performanceLane';
import { type LaneAction, isLaneAction, lanesReducer } from './lanesReducer';
import { type CostToggles, ALL_COSTS_ENABLED } from '../../types/costToggles';
import { type PerformanceCostBreakdown } from '../../types/costBreakdown';
import {
  type OptimizerMethodKey,
  type OptimizerMove,
  type OptimizationIteration,
  type OptimizerTelemetry,
  type StopReason,
} from '../../engine/optimization/optimizerInterface';
import { type GreedyLayoutStrategy } from '../../engine/optimization/greedyCandidatePipeline';
import { checkPlanFreshness } from '../../engine/evaluation/executionPlanValidation';
import { hashLayout } from '../../engine/mapping/mappingResolver';
import { padKey } from '../../types/padGrid';
import { createDefaultPose0, getPose0PadsWithOffset } from '../../engine/prior/naturalHandPose';
import { formatFingerConstraint, parseFingerConstraint } from '../../utils/fingerConstraints';
import { type RehearsalAudioOptions, DEFAULT_REHEARSAL_AUDIO } from '../audio/rehearsalAudio';
import { gmDrumRenames } from '../../utils/gmDrumMap';
import { uniqueName } from '../../utils/uniqueName';
import { suggestVariantName } from './variantNames';
import { EMPTY_CANDIDATE_RUNS, candidateLetterFor, olderRuns, withRun, type CandidateRunsState } from './candidateRuns';

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

/** Tempo a new project starts at, before any MIDI is imported. */
export const DEFAULT_PROJECT_TEMPO = 120;

/**
 * The document slice: the project the user authors.
 *
 * Undo and Redo snapshot and restore exactly these fields, and nothing else
 * (see projectDocument.ts). Every reducer result that leaves them unchanged
 * records no history entry.
 */
export interface ProjectDocument {
  /** Persistence format version. */
  version: number;

  // Identity
  id: string;
  name: string;
  createdAt: string;
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
   * Exploratory draft. Created automatically on first edit.
   * Null when no edits have been made since last promote/discard.
   */
  workingLayout: Layout | null;

  /** Durable named alternative layouts. Persist across sessions. */
  savedVariants: Layout[];

  /**
   * Working/Test Layouts kept automatically when Preview, Load Draft or a
   * Promote replaced them (oldest first, deduped by layout hash, at most
   * RECOVERED_DRAFTS_CAP). Never mixed into savedVariants.
   */
  recoveredDrafts: Layout[];

  // === Legacy compatibility (kept for migration, will be removed) ===
  /** @deprecated Use activeLayout. Kept only for migration from V1 format. */
  layouts?: Layout[];
  /** @deprecated Use activeLayout.id. Kept only for migration from V1 format. */
  activeLayoutId?: string;

  // Voice-level constraints (hand/finger per voice, key is stream ID)
  voiceConstraints: Record<string, { hand?: 'left' | 'right'; finger?: string }>;

  // Performance Lanes (pre-editor authoring data)
  performanceLanes: PerformanceLane[];
  laneGroups: LaneGroup[];
  sourceFiles: SourceFile[];
}

/**
 * The session slice: everything derived from or about the document.
 *
 * Never enters undo history, and Undo never restores it. Some of it is still
 * saved with the project (updatedAt, engineConfig, optimizerMethod,
 * greedyStrategy, costToggles): undo membership and persistence are separate.
 */
export interface ProjectSession {
  /** Last change to anything saved; drives autosave. Undo and Redo bump it. */
  updatedAt: string;
  /** When the project was last opened in the editor (saved; the Library's "Opened"). */
  lastOpenedAt: string;

  // Analysis cache
  analysisResult: CandidateSolution | null;
  /** Every run's candidates, newest run first (S3.3: each Generate adds a run). */
  candidates: CandidateSolution[];
  /** The runs those candidates came from and each candidate's letter for the session (candidateRuns.ts). */
  candidateRuns: CandidateRunsState;
  /**
   * The layout on screen (S3.2): null for the layout edits go to (the draft,
   * else Active). Never in undo history, never saved.
   */
  inspectedLayout: InspectedLayoutRef | null;
  /**
   * The read-only inspected layout's own plan, mirrored from the per-layout
   * analysis cache (useInspectedAnalysis) so the pure selectors the timeline,
   * the Events list and SELECT_EVENT's playhead use can read it. Bound to its
   * layout, and ignored unless it is fresh for the layout shown.
   */
  inspectedAnalysis: CandidateSolution | null;
  /** What the last Generate reported about its list (dropped candidates, diversity). */
  generationSummary: CandidateGenerationSummary | null;

  // Config
  engineConfig: EngineConfiguration;

  // === Optimizer configuration ===

  /** Active optimization method. */
  optimizerMethod: OptimizerMethodKey;
  /** Selected greedy layout seeding strategy. */
  greedyStrategy: GreedyLayoutStrategy;
  /** Cost toggle state (which cost families are active). */
  costToggles: CostToggles;

  // Ephemeral UI state (not persisted)
  selectedEventIndex: number | null;
  /** Moment-level selection index (indexes into ExecutionPlanResult.momentAssignments). */
  selectedMomentIndex: number | null;
  /** Currently selected sound stream (for cross-panel highlighting). */
  selectedStreamId: string | null;
  /**
   * The Sound armed for click-to-place (T62): a click on an empty pad places it.
   * Set by clicking a Sound; cleared by Escape. See src/ui/input/inputTable.ts.
   */
  armedStreamId: string | null;
  /** The pad selected by a click (T28 slice): Delete removes its Sound. */
  selectedPadKey: string | null;
  compareCandidateId: string | null;
  isProcessing: boolean;
  error: string | null;
  analysisStale: boolean;

  /** Manual cost evaluation result (from Calculate Cost button). */
  manualCostResult: PerformanceCostBreakdown | null;
  // The trace on screen (T33): the inspected candidate's, else restingTrace.
  // The reducer keeps moveHistory, iterationTrace, moveHistoryStopReason and
  // traceSubject on it (withTraceOnScreen); MoveTracePanel reads them.

  /** Move history from interpretable optimizers (greedy). */
  moveHistory: OptimizerMove[] | null;
  /** Detailed iteration traces for the visual debugger. */
  iterationTrace: OptimizationIteration[] | null;
  /** Why the optimizer stopped (stored alongside moveHistory). */
  moveHistoryStopReason: string | null;
  /** Current index in move history for step-through replay. */
  moveHistoryIndex: number | null;
  /** Whose trace is on screen, and the rest of it (annealing snapshots, a beam summary). */
  traceSubject: TraceSubject | null;
  /**
   * The trace shown while no candidate is inspected: the latest run's
   * candidate A, or the candidate promoted since (traces survive promotion).
   */
  restingTrace: CandidateTrace | null;
  /**
   * How the last Generate ended (T35). A cancelled run commits nothing else
   * (no candidates, summary or trace), so its 'cancelled' lives here: the
   * candidate list and the trace fields above still describe the run before.
   */
  lastGenerationRun: GenerationRunRecord | null;

  // Transport
  currentTime: number;
  isPlaying: boolean;
  /**
   * Playback rate for rehearsal, 1 = written tempo.
   *
   * Practising a hard passage means slowing it down until it is clean and then
   * working back up, so the transport needs to run at a fraction of tempo
   * without the analysis or the layout changing.
   */
  playbackRate: number;
  /** Loop the section between loopStart and loopEnd during playback. */
  loopEnabled: boolean;
  /** Loop region bounds in seconds; null means the whole performance. */
  loopStart: number | null;
  loopEnd: number | null;
  /** Bars of metronome count-in before the performance starts. */
  countInBars: number;
  /** Rehearsal audio settings (click track and audible hits). */
  rehearsalAudio: RehearsalAudioOptions;
}

/** How a Generate run ended (session only; see ProjectSession.lastGenerationRun). */
export interface GenerationRunRecord {
  outcome: 'completed' | 'cancelled' | 'failed';
  /**
   * 'cancelled' for Cancel; for a completed run 'time_budget' when a candidate
   * used its whole time limit, else 'completed'; null when the run failed.
   */
  stopReason: StopReason | null;
  method: OptimizerMethodKey;
  /** Candidates the run committed: 0 unless it completed. */
  candidateCount: number;
  elapsedMs: number;
}

/** Whose trace is on screen (T33), and what its method keeps besides moves. */
export interface TraceSubject {
  /** The candidate it describes; null for a trace set without one (SET_MOVE_HISTORY). */
  candidateId: string | null;
  /** Its letter when the trace was taken ("B"): the title still names it once it has left the list. */
  letter: string | null;
  /** Annealing: one snapshot per iteration (the candidate's annealingTrace). */
  annealing: AnnealingIterationSnapshot[] | null;
  /** Beam: what the search did. */
  beam: BeamSearchSummary | null;
  /** The run's telemetry: time, iterations, budgets. */
  telemetry: OptimizerTelemetry | null;
  /** It was promoted, so it stays when it leaves the candidate list. */
  promoted: boolean;
}

/** A candidate's whole trace, as the trace panel shows it (T33). */
export interface CandidateTrace extends TraceSubject {
  moves: OptimizerMove[] | null;
  iterations: OptimizationIteration[] | null;
  stopReason: string | null;
}

/**
 * The whole in-memory project: document plus session, kept flat so every
 * consumer reads fields directly (state.moveHistory, state.activeLayout, ...).
 */
export type ProjectState = ProjectDocument & ProjectSession;

/**
 * Which layout the screen shows (S3.2, T01): the grid, its plan, the timeline
 * and the Analysis and Events panels all describe it. Looking never writes:
 * the Active Layout while a differing draft exists, a Candidate Solution, a
 * Saved Layout Variant or a recovered draft is shown read-only.
 */
export type InspectedLayoutKind = 'active' | 'working' | 'candidate' | 'variant' | 'recovered';

export interface InspectedLayoutRef {
  kind: InspectedLayoutKind;
  /** The layout's id (a candidate's id for a candidate). */
  id: string;
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
 * The layout edits go to: the Working/Test Layout if one exists, otherwise the
 * Active Layout (the first edit starts a draft from it). The grid shows it
 * unless a read-only layout is inspected (getInspectedLayout).
 */
export function getDisplayedLayout(state: ProjectState): Layout | null {
  return state.workingLayout ?? state.activeLayout ?? null;
}

/**
 * Whether the Working/Test Layout differs from the Active Layout (T14): by
 * pads, locks or finger constraints, everything hashLayout covers. A draft
 * that matches Active is not a change, so Promote and Discard stay hidden.
 */
export function hasWorkingChanges(state: ProjectState): boolean {
  return state.workingLayout !== null && hashLayout(state.workingLayout) !== hashLayout(state.activeLayout);
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

/** The layout on screen, resolved (S3.2). */
export interface ResolvedInspection {
  /** The role it is shown in; a draft identical to Active shows as Active. */
  role: InspectedLayoutKind;
  layout: Layout;
  /** Not the layout edits go to: shown read-only, through the grid's layoutOverride. */
  readOnly: boolean;
  /** The candidate, when a Candidate Solution is shown. */
  candidate: CandidateSolution | null;
}

/**
 * What state.inspectedLayout points at now. A reference that no longer
 * resolves (a deleted candidate or variant) or that names the layout edits go
 * to falls back to that layout: the draft, else Active.
 */
export function resolveInspectedLayout(state: ProjectState): ResolvedInspection {
  const ref = state.inspectedLayout;
  const differingDraft = hasWorkingChanges(state);
  switch (ref?.kind) {
    case 'active':
      // With no differing draft, Active is simply the layout being edited.
      if (differingDraft) return { role: 'active', layout: state.activeLayout, readOnly: true, candidate: null };
      break;
    case 'candidate': {
      const candidate = getCandidateById(state, ref.id);
      if (candidate) return { role: 'candidate', layout: candidate.layout, readOnly: true, candidate };
      break;
    }
    case 'variant': {
      const variant = state.savedVariants.find(v => v.id === ref.id);
      if (variant) return { role: 'variant', layout: variant, readOnly: true, candidate: null };
      break;
    }
    case 'recovered': {
      const draft = (state.recoveredDrafts ?? []).find(l => l.id === ref.id);
      if (draft) return { role: 'recovered', layout: draft, readOnly: true, candidate: null };
      break;
    }
  }
  return {
    role: differingDraft ? 'working' : 'active',
    layout: state.workingLayout ?? state.activeLayout,
    readOnly: false,
    candidate: null,
  };
}

/** The layout on screen: the inspected one, or the layout edits go to. */
export function getInspectedLayout(state: ProjectState): Layout {
  return resolveInspectedLayout(state).layout;
}

/** Whether the layout on screen is one edits don't go to (S3.2). */
export function isInspectedReadOnly(state: ProjectState): boolean {
  return resolveInspectedLayout(state).readOnly;
}

/** The candidate on screen, when a Candidate Solution is inspected. */
export function getInspectedCandidate(state: ProjectState): CandidateSolution | null {
  return resolveInspectedLayout(state).candidate;
}

/**
 * The optimizer trace the trace panel and its step-through replay use: the
 * one on screen. The reducer keeps state.iterationTrace on the inspected
 * candidate's trace, else the run's candidate A's or the promoted one's
 * (withTraceOnScreen), so this reads state as MoveTracePanel does.
 */
export function getActiveTrace(state: ProjectState): OptimizationIteration[] | null {
  return state.iterationTrace;
}

/** A candidate's trace, taken now, with its session letter (T33; letters are stable, S3.3). */
export function candidateTrace(
  state: Pick<ProjectState, 'candidates' | 'candidateRuns'>,
  candidate: CandidateSolution,
  promoted = false,
): CandidateTrace {
  return {
    candidateId: candidate.id,
    letter: candidateLetterFor(state, candidate.id),
    moves: candidate.moveHistory ?? null,
    iterations: candidate.iterationTrace ?? null,
    stopReason: candidate.stopReason ?? null,
    annealing: candidate.annealingTrace ?? null,
    beam: candidate.beamSummary ?? null,
    telemetry: candidate.telemetry ?? null,
    promoted,
  };
}

/** Whether a trace is on screen: moves, iterations, annealing snapshots or a beam summary. */
export function hasTraceOnScreen(state: ProjectState): boolean {
  return !!state.moveHistory?.length || !!state.iterationTrace?.length
    || !!state.traceSubject?.annealing?.length || !!state.traceSubject?.beam;
}

/** The trace to show: the inspected candidate's, else the resting one while it applies. */
function traceToShow(state: ProjectState): CandidateTrace | null {
  const ref = state.inspectedLayout;
  const inspected = ref?.kind === 'candidate' ? getCandidateById(state, ref.id) : null;
  if (inspected) return candidateTrace(state, inspected);
  const resting = state.restingTrace;
  // A candidate deleted from the list takes its trace with it, unless it was promoted.
  if (resting?.candidateId && !resting.promoted && !state.candidates.some(c => c.id === resting.candidateId)) return null;
  return resting;
}

function showsTrace(state: ProjectState, trace: CandidateTrace | null): boolean {
  const subject = state.traceSubject;
  return state.moveHistory === (trace?.moves ?? null)
    && state.iterationTrace === (trace?.iterations ?? null)
    && state.moveHistoryStopReason === (trace?.stopReason ?? null)
    && (subject?.candidateId ?? null) === (trace?.candidateId ?? null)
    && (subject?.letter ?? null) === (trace?.letter ?? null)
    && (subject?.annealing ?? null) === (trace?.annealing ?? null)
    && (subject?.beam ?? null) === (trace?.beam ?? null);
}

/**
 * Keeps the trace fields on the trace on screen (T33): whenever the
 * inspection, the candidate list or the resting trace changes, moveHistory,
 * iterationTrace, moveHistoryStopReason and traceSubject take the inspected
 * candidate's trace, else the resting one (a new trace starts with no replay
 * step). Every reducer step and every Undo/Redo goes through it, so the panel,
 * bound to state.moveHistory, always describes the candidate on screen.
 */
export function withTraceOnScreen(prev: ProjectState, next: ProjectState): ProjectState {
  if (next === prev) return next;
  if (next.inspectedLayout === prev.inspectedLayout && next.candidates === prev.candidates
    && next.restingTrace === prev.restingTrace) return next;
  const trace = traceToShow(next);
  if (showsTrace(next, trace)) return next;
  return {
    ...next,
    moveHistory: trace?.moves ?? null,
    iterationTrace: trace?.iterations ?? null,
    moveHistoryStopReason: trace?.stopReason ?? null,
    moveHistoryIndex: null,
    traceSubject: trace && {
      candidateId: trace.candidateId,
      letter: trace.letter,
      annealing: trace.annealing,
      beam: trace.beam,
      telemetry: trace.telemetry,
      promoted: trace.promoted,
    },
  };
}

/**
 * Traces survive promotion (T33): the promoted candidate's trace becomes the
 * one shown while no candidate is inspected, so MoveTracePanel still renders
 * it, named by the candidate's letter, after the candidate leaves the list.
 * Every reducer path that promotes a candidate returns through it.
 */
export function withPromotedTrace(before: ProjectState, after: ProjectState, candidate: CandidateSolution): ProjectState {
  return { ...after, restingTrace: candidateTrace(before, candidate, true) };
}

/** Whether the grid shows a step of the optimizer trace (the replay is read-only too). */
export function isReplayingTrace(state: ProjectState): boolean {
  return state.moveHistoryIndex !== null && !!getActiveTrace(state)?.[state.moveHistoryIndex];
}

/**
 * Whether the grid shows a layout edits don't go to (an inspected read-only
 * layout, or a replayed trace step): every edit path is refused then, with
 * "Use as my draft to edit".
 */
export function isShownLayoutReadOnly(state: ProjectState): boolean {
  return isInspectedReadOnly(state) || isReplayingTrace(state);
}

/**
 * Re-points a Candidate Solution's analysis at a layout it still describes.
 *
 * Promotion clones the chosen layout under a new id, which left the candidate's
 * Execution Plan bound to the old one. `getAnalysisForLayout` then rejected it and
 * the cost panel, grid finger overlay and timeline pills went blank — permanently,
 * because promotion also declared the analysis fresh so nothing re-ran it.
 *
 * The pad map is unchanged by promotion, so the plan is still valid; only its
 * binding needs to follow the layout.
 */
export function rebindAnalysisToLayout(
  candidate: CandidateSolution,
  layout: Layout,
): CandidateSolution {
  return {
    ...candidate,
    layout,
    executionPlan: {
      ...candidate.executionPlan,
      layoutBinding: {
        layoutId: layout.id,
        layoutHash: hashLayout(layout),
        layoutRole: layout.role ?? 'active',
      },
    },
  };
}

export function getAnalysisForLayout(
  state: ProjectState,
  layout: Layout | null,
): CandidateSolution | null {
  if (!layout || !state.analysisResult) return null;
  // Always check freshness. Short-circuiting on a matching layout id defeated the
  // check in exactly the case that matters: a manual pad edit keeps the same
  // working-layout id, so the Score, Hard/Unplay counts, cost bars, grid finger
  // overlay and timeline pills kept showing the numbers from BEFORE the edit for
  // the full debounce plus solve time — and indefinitely whenever a re-analysis
  // did not follow. The hash comparison is cheap.
  return checkPlanFreshness(state.analysisResult.executionPlan, layout).isFresh
    ? state.analysisResult
    : null;
}

/**
 * The plan of the layout on screen: the draft's (or Active's) analysis, or a
 * read-only inspected layout's own plan from the cache (its mirror,
 * state.inspectedAnalysis), never a candidate's optimizer plan (S3.2). So the
 * fingering on the grid, the timeline and the Events list is the one its
 * Score describes, and the one the draft gets after "Use as my draft". Null
 * until that plan is ready for the layout shown.
 */
export function getDisplayedCandidate(state: ProjectState): CandidateSolution | null {
  const shown = resolveInspectedLayout(state);
  if (!shown.readOnly) return getAnalysisForLayout(state, shown.layout);
  const mirror = state.inspectedAnalysis;
  return mirror && checkPlanFreshness(mirror.executionPlan, shown.layout).isFresh ? mirror : null;
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
  /** "Name from GM drum map" (T17): every Sound with a GM drum pitch takes its drum's name, as one step. */
  | { type: 'APPLY_GM_DRUM_NAMES' }
  | { type: 'TOGGLE_MUTE'; payload: string }
  | { type: 'SOLO_STREAM'; payload: string }
  | { type: 'SET_SOUND_COLOR'; payload: { streamId: string; color: string } }
  | { type: 'SET_VOICE_CONSTRAINT'; payload: { streamId: string; hand?: 'left' | 'right' | null; finger?: string | null } }
  | { type: 'SELECT_STREAM'; payload: string | null }
  /** Arms a Sound for click-to-place (null disarms); it is also the selected Sound. */
  | { type: 'ARM_SOUND'; payload: string | null }
  /** Selects a pad and the Sound on it (null clears both). */
  | { type: 'SELECT_PAD'; payload: { padKey: string | null; streamId: string | null } }
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
  // The one Promote (S3.3, T13), from the draft, a candidate or a variant. `reviewed`
  // is the plan the user saw for that layout (its plan from the per-layout
  // cache, usePromote); it is rebound to the new Active Layout.
  | { type: 'PROMOTE_WORKING_LAYOUT'; payload?: { reviewed?: CandidateSolution | null } }
  | { type: 'PROMOTE_CANDIDATE'; payload: { candidateId: string; reviewed?: CandidateSolution | null } }
  | { type: 'DELETE_CANDIDATE'; payload: { candidateId: string } }
  | { type: 'PROMOTE_VARIANT'; payload: { variantId: string; reviewed?: CandidateSolution | null } }
  | { type: 'DELETE_VARIANT'; payload: { variantId: string } }
  | { type: 'SAVE_AS_VARIANT'; payload: { name: string; source: 'working' | 'candidate'; candidateId?: string; /** The new variant's id, so the caller can show it. */ variantId?: string } }
  | { type: 'LOAD_SAVED_VARIANT'; payload: { variantId: string } }
  | { type: 'RENAME_LAYOUT'; payload: { target: 'active' | 'working'; name: string } | { target: 'variant'; variantId: string; name: string } }
  | { type: 'RESTORE_RECOVERED_DRAFT'; payload: { layoutId: string } }
  | { type: 'DELETE_RECOVERED_DRAFT'; payload: { layoutId: string } }

  // Analysis
  | { type: 'SET_ANALYSIS_RESULT'; payload: CandidateSolution | null }
  /** A Generate run's candidates: added as a run (S3.3), candidate A shown read-only (Q4). */
  | { type: 'SET_CANDIDATES'; payload: CandidateSolution[] }
  /** A run that isn't a Generate ("Place remaining N Sounds", T37): added and shown like one. */
  | { type: 'ADD_CANDIDATE_RUN'; payload: CandidateSolution[] }
  /** Removes every run but the newest, with its candidates. */
  | { type: 'CLEAR_OLDER_RUNS' }
  | { type: 'SET_GENERATION_SUMMARY'; payload: CandidateGenerationSummary | null }
  /** Shows a layout (S3.2): null (or the draft) for the layout edits go to; anything else read-only. Writes nothing. */
  | { type: 'INSPECT_LAYOUT'; payload: InspectedLayoutRef | null }
  /** The inspected read-only layout's plan, from the per-layout cache (useInspectedAnalysis). */
  | { type: 'SET_INSPECTED_ANALYSIS'; payload: CandidateSolution | null }
  | { type: 'MARK_ANALYSIS_STALE' }
  | { type: 'APPLY_GENERATION_TO_LAYOUT'; payload: { candidateId: string } }
  | { type: 'SUGGEST_STARTING_LAYOUT' }

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
  | { type: 'SET_GREEDY_STRATEGY'; payload: GreedyLayoutStrategy }
  | { type: 'SET_COST_TOGGLES'; payload: CostToggles }
  | { type: 'SET_MANUAL_COST_RESULT'; payload: PerformanceCostBreakdown | null }
  | { type: 'SET_MOVE_HISTORY'; payload: { moves: OptimizerMove[] | null; trace: OptimizationIteration[] | null; stopReason?: string } }
  | { type: 'SET_MOVE_HISTORY_INDEX'; payload: number | null }
  | { type: 'SET_GENERATION_RUN'; payload: GenerationRunRecord | null }

  // Transport
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'TICK_TIME'; payload: number }
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'TOGGLE_PLAYING' }
  | { type: 'SET_PLAYBACK_RATE'; payload: number }
  | { type: 'SET_LOOP_ENABLED'; payload: boolean }
  | { type: 'SET_LOOP_REGION'; payload: { start: number | null; end: number | null } }
  | { type: 'SET_COUNT_IN_BARS'; payload: number }
  | { type: 'SET_REHEARSAL_AUDIO'; payload: Partial<RehearsalAudioOptions> }

  // Performance Lanes (delegated to lanesReducer)
  | LaneAction;

/**
 * Actions that never record an undo step of their own.
 *
 * Undo history holds only the document (projectDocument.ts), and a dispatch that
 * leaves the document unchanged records nothing, so session-only actions
 * (analysis, candidates, selection, transport, trace) need no entry here. This
 * list is for actions that do touch the document but are not a user edit in
 * their own right: their change folds into the current step.
 */
const EPHEMERAL_ACTIONS = new Set<ProjectAction['type']>([
  // View state stored on the lane group.
  'TOGGLE_LANE_GROUP_COLLAPSE',
  // Derived from the lanes after a lane edit (which already synced the Sounds).
  'SYNC_STREAMS_FROM_LANES',
  // Builds lanes for a project saved before lanes existed, on open.
  'POPULATE_LANES_FROM_STREAMS',
  // Session-only, listed so high-frequency dispatches skip the document check.
  'SET_CURRENT_TIME',
  'TICK_TIME',
]);

export function isEphemeralAction(action: ProjectAction): boolean {
  return EPHEMERAL_ACTIONS.has(action.type);
}

/**
 * Actions that edit a layout's pads, locks or pad finger preferences, or start
 * a draft. While the grid shows a layout edits don't go to (a read-only
 * inspection or a trace replay) the reducer refuses them, whatever dispatched
 * them (S3.2, defence in depth behind the grid's own checks): looking never
 * writes the Working/Test Layout. Named role actions (Use as my draft,
 * Promote, Save as variant, Discard, Restore) are not edits and still run.
 * A Sound's own finger preference (SET_VOICE_CONSTRAINT) is not a layout edit
 * either: it belongs to the Sound in every layout (invariant 6).
 */
const LAYOUT_EDIT_ACTIONS = new Set<ProjectAction['type']>([
  'ASSIGN_VOICE_TO_PAD',
  'BULK_ASSIGN_PADS',
  'MERGE_ASSIGN_PADS',
  'REMOVE_VOICE_FROM_PAD',
  'SWAP_PADS',
  'SET_FINGER_CONSTRAINT',
  'TOGGLE_PLACEMENT_LOCK',
  'CREATE_WORKING_LAYOUT',
  'SUGGEST_STARTING_LAYOUT',
]);

export function isLayoutEditAction(action: ProjectAction): boolean {
  return LAYOUT_EDIT_ACTIONS.has(action.type);
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
 *
 * The draft keeps the Active Layout's base name: names never carry a role
 * (T32), and the UI labels it "Draft of Default" (layoutLabels.ts).
 */
function ensureWorkingLayout(state: ProjectState): ProjectState & { workingLayout: Layout } {
  if (state.workingLayout) {
    return state as ProjectState & { workingLayout: Layout };
  }
  const working: Layout = {
    ...cloneLayout(state.activeLayout, generateId(), state.activeLayout.name, 'working'),
    provenance: 'manual',
  };
  return { ...state, workingLayout: working } as ProjectState & { workingLayout: Layout };
}

/** The provenance of a layout taken from a candidate (T32); a candidate with no metadata has no strategy to name. */
function candidateProvenance(candidate: CandidateSolution): LayoutProvenance {
  return `candidate:${candidate.metadata?.strategy ?? ''}`;
}

/**
 * The saved variants after a Promote replaces the Active Layout: the replaced
 * Active is auto-saved (CLAUDE.md default) when it has pads, under a clean
 * dated name, "Default – 25 Sep 14:02" (numbered when taken), with provenance
 * 'replaced-active'. It used to be "Default (replaced 9/25/2026)" (T32).
 */
function withReplacedActiveSaved(state: ProjectState, variants: Layout[], now: string): Layout[] {
  if (Object.keys(state.activeLayout.padToVoice).length === 0) return variants;
  const name = suggestVariantName(state.activeLayout.name, variants.map(v => v.name), new Date(now));
  const replaced: Layout = {
    ...cloneLayout(state.activeLayout, generateId(), name, 'variant'),
    provenance: 'replaced-active',
    savedAt: now,
  };
  return [...variants, replaced];
}

/**
 * The draft after an edit (T14): a draft whose pads, locks and finger
 * preferences are back to Active's is no draft at all, so it goes (the grid
 * shows Active, and Promote and Discard have nothing to act on).
 */
function draftOrNull(draft: Layout, active: Layout): Layout | null {
  return hashLayout(draft) === hashLayout(active) ? null : draft;
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
    // Edits reach here only while the layout edits go to is shown (the guard
    // refuses them otherwise); a Sound's finger preference, which also lands
    // here, keeps a read-only inspection on screen.
    inspectedLayout: isInspectedReadOnly(state) ? state.inspectedLayout : null,
    workingLayout: draftOrNull({ ...updater(withWorking.workingLayout), scoreCache: null }, state.activeLayout),
  };
}

/**
 * Shows `ref` (S3.2). Nothing is written: selections that belong to the
 * previous layout go (the selected pad, a trace replay step), and a Sound
 * armed for placing is disarmed when the new layout is read-only. The event
 * selection stays, so the same event can be compared across layouts.
 */
function inspecting(state: ProjectState, ref: InspectedLayoutRef | null): ProjectState {
  const next: ProjectState = { ...state, inspectedLayout: ref, selectedPadKey: null, moveHistoryIndex: null };
  if (!resolveInspectedLayout(next).readOnly) return { ...next, inspectedLayout: null };
  if (next.armedStreamId === null) return next;
  return {
    ...next,
    armedStreamId: null,
    selectedStreamId: next.selectedStreamId === next.armedStreamId ? null : next.selectedStreamId,
  };
}

/** The inspection after `id` left its list: the layout edits go to, if it was the one shown. */
function inspectionWithout(state: ProjectState, kind: InspectedLayoutKind, id: string): InspectedLayoutRef | null {
  const ref = state.inspectedLayout;
  return ref && ref.kind === kind && ref.id === id ? null : ref;
}

function buildLayoutFingerConstraints(
  padToVoice: Layout['padToVoice'],
  voiceConstraints: ProjectState['voiceConstraints'],
): Layout['fingerConstraints'] {
  const nextConstraints: Layout['fingerConstraints'] = {};
  for (const [padKey, voice] of Object.entries(padToVoice)) {
    const constraint = voiceConstraints[voice.id];
    if (constraint?.hand && constraint.finger) {
      nextConstraints[padKey] = formatFingerConstraint(
        constraint.hand,
        constraint.finger as Parameters<typeof formatFingerConstraint>[1],
      );
    }
  }
  return nextConstraints;
}

/** Shallow-compare two derived fingerConstraints maps (padKey → compact string). */
function fingerConstraintsEqual(
  a: Layout['fingerConstraints'],
  b: Layout['fingerConstraints'],
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => a[k] === b[k]);
}

/**
 * Why placing `voiceId` on `padKey` is refused by a placement lock, or null.
 *
 * Locks are hard for manual gestures too (canon section 11): a locked Sound
 * stays on its pad ('sound-locked': it may not be dragged out), and a locked
 * pad keeps its Sound ('pad-locked': nothing may be dropped onto it).
 */
export function placementBlockedByLock(
  layout: Pick<Layout, 'padToVoice' | 'placementLocks'>,
  voiceId: string,
  padKey: string,
): 'sound-locked' | 'pad-locked' | null {
  const lockedTo = layout.placementLocks?.[voiceId];
  if (lockedTo && lockedTo !== padKey) return 'sound-locked';
  const occupant = layout.padToVoice[padKey];
  if (occupant && occupant.id !== voiceId && layout.placementLocks?.[occupant.id] === padKey) {
    return 'pad-locked';
  }
  return null;
}

/** Whether a pad's Sound is locked to that pad. */
export function isPadLocked(layout: Pick<Layout, 'padToVoice' | 'placementLocks'>, padKey: string): boolean {
  const occupant = layout.padToVoice[padKey];
  return !!occupant && layout.placementLocks?.[occupant.id] === padKey;
}

/**
 * Whether assigning these pads would displace a locked Sound or put a locked
 * Sound on another pad (canon section 11). MERGE_ASSIGN_PADS refuses such a
 * placement; callers check first so they record nothing for it either.
 */
export function placementDisturbsLock(
  layout: Pick<Layout, 'padToVoice' | 'placementLocks'>,
  padToVoice: Record<string, { id: string } | null | undefined>,
): boolean {
  const locks = layout.placementLocks ?? {};
  return Object.entries(padToVoice).some(([padKey, voice]) =>
    isPadLocked(layout, padKey) || (!!voice && voice.id in locks && locks[voice.id] !== padKey));
}

function prunePlacementLocks(
  padToVoice: Layout['padToVoice'],
  placementLocks: Layout['placementLocks'],
): Layout['placementLocks'] {
  const nextLocks: Layout['placementLocks'] = {};
  for (const [voiceId, lockedPadKey] of Object.entries(placementLocks)) {
    if (padToVoice[lockedPadKey]?.id === voiceId) {
      nextLocks[voiceId] = lockedPadKey;
    }
  }
  return nextLocks;
}

/**
 * A layout as it must be after a layout switch (Discard, Promote, Preview,
 * Load, Restore): its pad fingerConstraints re-derived from voiceConstraints,
 * the one source of truth for finger preferences (invariant 6), and no lock
 * whose Sound is not on its locked pad (T12). A lock only ever means "this
 * Sound is on this pad"; one pointing elsewhere is invisible in the UI and
 * would silently drag the Sound back on the next Generate.
 */
export function withDerivedLayoutState(
  layout: Layout,
  voiceConstraints: ProjectState['voiceConstraints'],
): Layout {
  return {
    ...layout,
    fingerConstraints: buildLayoutFingerConstraints(layout.padToVoice, voiceConstraints),
    placementLocks: prunePlacementLocks(layout.padToVoice, layout.placementLocks ?? {}),
  };
}

/**
 * A layout's identity in this project (S3.3): the hash of its pads, locks and
 * the finger preferences it has once applied (withDerivedLayoutState), as the
 * scoring cache keys it. A candidate and the draft, variant or Active made
 * from it share one identity, even when the candidate keeps a moved Sound's
 * preference on the pad it left.
 */
export function layoutIdentity(state: Pick<ProjectState, 'voiceConstraints'>, layout: Layout): string {
  return hashLayout(withDerivedLayoutState(layout, state.voiceConstraints));
}

/** Recovered drafts kept per project; the oldest is pruned beyond this. */
export const RECOVERED_DRAFTS_CAP = 5;

/**
 * The Recovered drafts list after an explicit action replaces the draft with
 * `incoming` (Preview, Load Draft, a candidate or variant Promote, Restore).
 *
 * The draft is kept when it has pads and its hash differs from the Active
 * Layout, from the incoming layout, from every saved variant and from every
 * candidate: in those cases it is still recoverable where it is. A kept draft
 * keeps its id (so a "Restore" toast can name it), replaces any recovered
 * draft with the same hash, and the oldest are pruned beyond the cap. Returns
 * the same array when nothing is kept.
 */
function keepReplacedDraft(state: ProjectState, incoming: Layout | null, now: string): Layout[] {
  const kept = state.recoveredDrafts ?? [];
  const draft = state.workingLayout;
  if (!draft || Object.keys(draft.padToVoice).length === 0) return kept;
  const hash = hashLayout(draft);
  const stillRecoverable = [
    state.activeLayout,
    incoming,
    ...state.savedVariants,
    ...state.candidates.map(c => c.layout),
  ];
  if (stillRecoverable.some(layout => layout && hashLayout(layout) === hash)) return kept;
  const entry: Layout = {
    ...cloneLayout(draft, draft.id, draft.name, 'variant'),
    provenance: 'recovered',
    savedAt: now,
  };
  return [...kept.filter(layout => hashLayout(layout) !== hash), entry].slice(-RECOVERED_DRAFTS_CAP);
}

/**
 * The state once a run's candidates arrive (S3.3, T30): they are added as a
 * run, first in the list, instead of replacing it; each gets its letter for
 * the session; runs beyond the cap go, with their candidates (and with the
 * inspection or compare pick of one of them).
 */
function withInstalledRun(state: ProjectState, incoming: CandidateSolution[]): ProjectState {
  if (incoming.length === 0) return state;
  const { candidateRuns, droppedIds } = withRun(state, incoming, new Date().toISOString());
  const incomingIds = new Set(incoming.map(c => c.id));
  const gone = (id: string | null | undefined) => !!id && droppedIds.has(id) && !incomingIds.has(id);
  return {
    ...state,
    candidates: [...incoming, ...state.candidates.filter(c => !incomingIds.has(c.id) && !droppedIds.has(c.id))],
    candidateRuns,
    inspectedLayout: state.inspectedLayout?.kind === 'candidate' && gone(state.inspectedLayout.id) ? null : state.inspectedLayout,
    compareCandidateId: gone(state.compareCandidateId) ? null : state.compareCandidateId,
  };
}

/** What a Promote makes the Active Layout (S3.3). */
type PromoteSource =
  | { kind: 'working'; layout: Layout }
  | { kind: 'candidate'; candidate: CandidateSolution }
  | { kind: 'variant'; variant: Layout };

/**
 * The plan the user reviewed for the layout being promoted: the one the
 * Promote action carries (its plan from the per-layout cache), else the one on
 * screen (the draft's analysis, or an inspected layout's own plan), else none
 * (the new Active is analysed afresh, through the same cache).
 */
function reviewedPlanFor(state: ProjectState, source: PromoteSource, given: CandidateSolution | null | undefined): CandidateSolution | null {
  if (given) return given;
  if (source.kind === 'working') return getAnalysisForLayout(state, source.layout);
  const layout = source.kind === 'candidate' ? source.candidate.layout : source.variant;
  const mirror = state.inspectedAnalysis;
  return mirror && checkPlanFreshness(mirror.executionPlan, layout).isFresh ? mirror : null;
}

/**
 * The one Promote (S3.3, T13), from the draft, a candidate or a saved variant.
 *
 * The layout becomes the Active Layout (its finger preferences re-derived and
 * dead locks pruned), the replaced Active is auto-saved as a variant, and a
 * differing draft it replaces is kept in Recovered drafts. A pad map matching
 * a candidate's promotes as that candidate: its card leaves the list (Undo
 * puts it back) and its trace stays on screen. The plan the user reviewed is
 * rebound to the new Active, so its fingering and numbers carry over and
 * nothing is re-solved; staleness detection still holds, because the plan is
 * bound by the new layout's hash.
 */
function promote(state: ProjectState, source: PromoteSource, reviewed: CandidateSolution | null | undefined): ProjectState {
  const now = new Date().toISOString();
  const sourceLayout = source.kind === 'working' ? source.layout
    : source.kind === 'candidate' ? source.candidate.layout
    : source.variant;
  const base: Layout = source.kind === 'working'
    ? source.layout
    : source.kind === 'candidate'
      ? {
        ...source.candidate.layout,
        id: generateId(),
        placementLocks: { ...source.candidate.layout.placementLocks },
        provenance: candidateProvenance(source.candidate),
      }
      : { ...source.variant, provenance: `variant:${source.variant.id}` };
  const promoted: Layout = withDerivedLayoutState(reconcileLayoutVoices({
    ...base,
    role: 'active',
    baselineId: undefined,
    savedAt: now,
  }, state.soundStreams), state.voiceConstraints);

  // Every candidate with these pads goes: it is the Active Layout now.
  const identity = layoutIdentity(state, sourceLayout);
  const promotedCandidates = state.candidates.filter(c =>
    (source.kind === 'candidate' && c.id === source.candidate.id) || layoutIdentity(state, c.layout) === identity);
  const asCandidate = source.kind === 'candidate' ? source.candidate : promotedCandidates[0] ?? null;

  const plan = reviewedPlanFor(state, source, reviewed);
  const variants = source.kind === 'variant' ? state.savedVariants.filter(v => v.id !== source.variant.id) : state.savedVariants;

  const next: ProjectState = {
    ...state,
    activeLayout: promoted,
    workingLayout: null,
    savedVariants: withReplacedActiveSaved(state, variants, now),
    recoveredDrafts: keepReplacedDraft(state, promoted, now),
    candidates: promotedCandidates.length > 0 ? state.candidates.filter(c => !promotedCandidates.includes(c)) : state.candidates,
    updatedAt: now,
    analysisResult: plan ? rebindAnalysisToLayout(plan, promoted) : null,
    analysisStale: !plan,
    inspectedLayout: null,
    compareCandidateId: null,
  };
  // The promoted candidate's trace stays on screen once its card has left the list (T33).
  return asCandidate ? withPromotedTrace(state, next, asCandidate) : next;
}

/**
 * The layout with every unplaced Sound in scope placed (S3.3): busiest Sound
 * first, on the shipped Natural Hand Pose pads in their own order, then row by
 * row; a placed Sound is never moved or covered, so locks hold. "Suggest a
 * starting layout" writes the result as the draft; "Place remaining N Sounds"
 * proposes it as a candidate (Q4). Returns the same layout when nothing is
 * left to place.
 */
export function withRemainingPlaced(state: ProjectState, base: Layout): Layout {
  const streams = getActiveStreams(state);
  const padToVoice = { ...base.padToVoice };
  const takenPads = new Set(Object.keys(padToVoice));
  const placedVoiceIds = new Set(Object.values(padToVoice).map(v => v.id).filter(Boolean));

  // Most-used sounds first, so the busiest sound gets the strongest finger.
  const byUsage = [...streams].sort((a, b) => b.events.length - a.events.length);

  // The shipped Natural Hand Pose, in its own order. These ten pads are a real
  // relaxed two-hand shape, and taking them contiguously keeps the suggestion
  // compact. Reordering them to alternate hands looks tidier but measurably
  // hurts: on the reference performance it spread the right hand across the
  // grid and turned a layout with no hard moments into one with thirteen.
  //
  // This is only a starting point — Generate is what optimises it — but it
  // should be a starting point the user would not immediately want to undo.
  const posePads = getPose0PadsWithOffset(createDefaultPose0(), 0, true)
    .map(p => padKey(p.row, p.col));
  const fallbackPads: string[] = [];
  for (let row = 2; row < 8; row++) {
    for (let col = 0; col < 8; col++) fallbackPads.push(padKey(row, col));
  }
  const candidatePads = [...posePads, ...fallbackPads];

  let cursor = 0;
  let placed = 0;
  for (const stream of byUsage) {
    if (placedVoiceIds.has(stream.id)) continue;
    while (cursor < candidatePads.length && takenPads.has(candidatePads[cursor])) cursor++;
    if (cursor >= candidatePads.length) break;
    const pad = candidatePads[cursor];
    takenPads.add(pad);
    padToVoice[pad] = {
      id: stream.id,
      name: stream.name,
      sourceType: 'midi_track' as const,
      sourceFile: '',
      originalMidiNote: stream.originalMidiNote,
      color: stream.color,
    };
    placed++;
  }
  if (placed === 0) return base;
  return { ...base, padToVoice, fingerConstraints: buildLayoutFingerConstraints(padToVoice, state.voiceConstraints) };
}

// ============================================================================
// Reducer
// ============================================================================

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  return withTraceOnScreen(state, reduceProject(state, action));
}

function reduceProject(state: ProjectState, action: ProjectAction): ProjectState {
  // Delegate lane/group actions to the dedicated lanes reducer
  if (isLaneAction(action.type)) {
    return lanesReducer(state, action as LaneAction);
  }

  // Looking never writes (S3.2): no layout edit while the grid shows a layout
  // edits don't go to. Nothing changes, so no draft and no undo step.
  if (LAYOUT_EDIT_ACTIONS.has(action.type) && isShownLayoutReadOnly(state)) return state;

  switch (action.type) {
    case 'LOAD_PROJECT':
      return {
        ...action.payload,
        // Reset ephemeral state
        workingLayout: null, // Session-scoped: strip working layout on load
        inspectedLayout: null,
        inspectedAnalysis: null,
        selectedEventIndex: null,
        selectedMomentIndex: null,
        armedStreamId: null,
        selectedPadKey: null,
        compareCandidateId: null,
        isProcessing: false,
        error: null,
        analysisStale: true,
        currentTime: 0,
        isPlaying: false,
        playbackRate: 1,
        loopEnabled: false,
        loopStart: null,
        loopEnd: null,
        countInBars: 0,
        rehearsalAudio: { ...DEFAULT_REHEARSAL_AUDIO },
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
        savedVariants: state.savedVariants.map(v => ({
          ...v,
          padToVoice: renamePadVoices(v.padToVoice),
        })),
        // Layouts embed a display copy of each sound's name/color; keep every
        // layout-bearing store — including in-session candidates and the analysis
        // result — in sync so previews and compare never show a stale label.
        candidates: state.candidates.map(c => ({
          ...c,
          layout: { ...c.layout, padToVoice: renamePadVoices(c.layout.padToVoice) },
        })),
        analysisResult: state.analysisResult ? {
          ...state.analysisResult,
          layout: { ...state.analysisResult.layout, padToVoice: renamePadVoices(state.analysisResult.layout.padToVoice) },
        } : null,
      };
    }

    case 'APPLY_GM_DRUM_NAMES': {
      // Opt-in naming from pitch (canon §10, Q3). Read at dispatch time, so a
      // toast's action renames the Sounds as they are then. Nothing to rename
      // returns the same state (no undo step).
      const renames = gmDrumRenames(state.soundStreams);
      return Object.entries(renames).reduce(
        (s, [streamId, name]) => projectReducer(s, { type: 'RENAME_SOUND', payload: { streamId, name } }),
        state,
      );
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
        savedVariants: state.savedVariants.map(v => ({
          ...v,
          padToVoice: recolorPadVoices(v.padToVoice),
        })),
        // Keep candidates and analysis result in sync too (see RENAME_SOUND).
        candidates: state.candidates.map(c => ({
          ...c,
          layout: { ...c.layout, padToVoice: recolorPadVoices(c.layout.padToVoice) },
        })),
        analysisResult: state.analysisResult ? {
          ...state.analysisResult,
          layout: { ...state.analysisResult.layout, padToVoice: recolorPadVoices(state.analysisResult.layout.padToVoice) },
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

      // voiceConstraints is the SINGLE source of truth for per-sound finger
      // preferences; layout.fingerConstraints is always a pure DERIVED projection
      // (buildLayoutFingerConstraints), never patched independently. This removes
      // the previous two-store drift (Invariant #6). Only fork a working layout
      // when the derived pad constraints actually change — so setting a preference
      // on an unplaced sound does not spuriously create a draft.
      let newState: ProjectState = { ...state, updatedAt: new Date().toISOString(), voiceConstraints: next, analysisStale: true };
      const targetLayout = newState.workingLayout ?? newState.activeLayout;
      const derivedConstraints = buildLayoutFingerConstraints(targetLayout.padToVoice, next);
      if (!fingerConstraintsEqual(derivedConstraints, targetLayout.fingerConstraints)) {
        newState = updateWorkingLayout(newState, layout => ({
          ...layout,
          fingerConstraints: buildLayoutFingerConstraints(layout.padToVoice, next),
        }));
      }
      return newState;
    }

    case 'SELECT_STREAM':
      return { ...state, selectedStreamId: action.payload };

    case 'ARM_SOUND': {
      const armed = action.payload;
      if (armed === null) {
        if (state.armedStreamId === null) return state;
        // Disarming also drops the Sound selection that came with arming.
        const selectedStreamId = state.selectedStreamId === state.armedStreamId ? null : state.selectedStreamId;
        return { ...state, armedStreamId: null, selectedStreamId };
      }
      // Arming selects the Sound and ends any pad selection, so Delete can't
      // act on a pad the user has moved on from.
      if (armed === state.armedStreamId && armed === state.selectedStreamId && state.selectedPadKey === null) return state;
      return { ...state, armedStreamId: armed, selectedStreamId: armed, selectedPadKey: null };
    }

    case 'SELECT_PAD': {
      const { padKey, streamId } = action.payload;
      if (padKey === state.selectedPadKey && streamId === state.selectedStreamId) return state;
      return { ...state, selectedPadKey: padKey, selectedStreamId: streamId };
    }

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

    case 'ASSIGN_VOICE_TO_PAD': {
      const { padKey, stream } = action.payload;
      const shown = state.workingLayout ?? state.activeLayout;
      // Dropping a Sound on the pad it already occupies changes nothing (T14):
      // no draft, no stale analysis, no undo step.
      if (shown.padToVoice[padKey]?.id === stream.id) return state;
      // A locked Sound is not dragged out, and a locked pad takes no drop
      // (canon section 11). Nothing changes, so no draft and no undo step.
      if (placementBlockedByLock(shown, stream.id, padKey)) {
        return state;
      }
      return updateWorkingLayout(state, layout => {
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
        // Locks never move with a Sound: a locked Sound could not get here.
        return {
          ...layout,
          padToVoice: newPadToVoice,
          fingerConstraints: buildLayoutFingerConstraints(newPadToVoice, state.voiceConstraints),
          placementLocks: prunePlacementLocks(newPadToVoice, layout.placementLocks),
          layoutMode: 'manual',
        };
      });
    }

    case 'BULK_ASSIGN_PADS':
      return updateWorkingLayout(state, layout => ({
        ...layout,
        padToVoice: action.payload,
        fingerConstraints: buildLayoutFingerConstraints(action.payload, state.voiceConstraints),
        placementLocks: prunePlacementLocks(action.payload, layout.placementLocks),
        layoutMode: 'auto',
      }));

    case 'MERGE_ASSIGN_PADS': {
      // Placing a preset never displaces a locked Sound or puts one on another
      // pad (canon section 11): the whole placement is refused, like a drop
      // onto a locked pad. Nothing changes, so no draft and no undo step.
      if (placementDisturbsLock(state.workingLayout ?? state.activeLayout, action.payload)) return state;
      // Nor does it overwrite a pad another Sound occupies (T65): refused whole.
      {
        const shown = state.workingLayout ?? state.activeLayout;
        if (Object.entries(action.payload).some(([k, v]) => shown.padToVoice[k] && shown.padToVoice[k].id !== v.id)) return state;
      }
      return updateWorkingLayout(state, layout => {
        const nextPadToVoice = { ...layout.padToVoice, ...action.payload };
        return {
          ...layout,
          padToVoice: nextPadToVoice,
          fingerConstraints: buildLayoutFingerConstraints(nextPadToVoice, state.voiceConstraints),
          placementLocks: prunePlacementLocks(nextPadToVoice, layout.placementLocks),
          layoutMode: 'manual',
        };
      });
    }

    case 'REMOVE_VOICE_FROM_PAD':
      // A locked Sound stays on its pad until it is unlocked (canon section
      // 11); Remove is refused like a drag out. Nothing changes, so no draft
      // and no undo step.
      if (isPadLocked(state.workingLayout ?? state.activeLayout, action.payload.padKey)) return state;
      return updateWorkingLayout(state, layout => {
        const removedVoice = layout.padToVoice[action.payload.padKey];
        const { [action.payload.padKey]: _, ...rest } = layout.padToVoice;
        const nextLocks = { ...layout.placementLocks };
        if (removedVoice) {
          delete nextLocks[removedVoice.id];
        }
        return {
          ...layout,
          padToVoice: rest,
          fingerConstraints: buildLayoutFingerConstraints(rest, state.voiceConstraints),
          placementLocks: prunePlacementLocks(rest, nextLocks),
          layoutMode: 'manual',
        };
      });

    case 'SWAP_PADS': {
      const { padKeyA, padKeyB } = action.payload;
      // A pad swapped with itself changes nothing (T14): no draft, no undo step.
      if (padKeyA === padKeyB) return state;
      // A swap moves both Sounds, so a lock on either pad refuses it (canon
      // section 11). Nothing changes, so no draft and no undo step.
      const shown = state.workingLayout ?? state.activeLayout;
      if (isPadLocked(shown, padKeyA) || isPadLocked(shown, padKeyB)) return state;
      return updateWorkingLayout(state, layout => {
        const voiceA = layout.padToVoice[padKeyA];
        const voiceB = layout.padToVoice[padKeyB];
        const newPadToVoice = { ...layout.padToVoice };
        if (voiceA) newPadToVoice[padKeyB] = voiceA;
        else delete newPadToVoice[padKeyB];
        if (voiceB) newPadToVoice[padKeyA] = voiceB;
        else delete newPadToVoice[padKeyA];
        // Locks never move with a Sound: neither pad here is locked.
        return {
          ...layout,
          padToVoice: newPadToVoice,
          fingerConstraints: buildLayoutFingerConstraints(newPadToVoice, state.voiceConstraints),
          placementLocks: prunePlacementLocks(newPadToVoice, layout.placementLocks),
          layoutMode: 'manual',
        };
      });
    }

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

      // Cross-sync: update voiceConstraints for the voice on this pad (if any)
      const displayedLayout = state.workingLayout ?? state.activeLayout;
      const voice = displayedLayout.padToVoice[constraintPadKey];
      const nextVC = { ...state.voiceConstraints };
      if (voice) {
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
      }
      const newState = updateWorkingLayout(state, layout => ({
        ...layout,
        fingerConstraints: buildLayoutFingerConstraints(layout.padToVoice, nextVC),
      }));
      return { ...newState, voiceConstraints: nextVC };
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
      // Locks are part of what an Execution Plan depends on (hashLayout covers
      // them), so the plan on screen no longer describes this layout: mark it
      // stale so auto-analysis runs again instead of the plan going blank for
      // good (T14).
      if (state.workingLayout) {
        return {
          ...state,
          updatedAt: new Date().toISOString(),
          analysisStale: true,
          workingLayout: draftOrNull({ ...state.workingLayout, placementLocks: newLocks }, state.activeLayout),
        };
      }
      // No working layout: lock on active layout directly (locks are durable)
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        analysisStale: true,
        activeLayout: { ...state.activeLayout, placementLocks: newLocks },
      };
    }

    // -- V3 Workflow actions --

    case 'CREATE_WORKING_LAYOUT': {
      if (state.workingLayout) return state; // Already exists
      return ensureWorkingLayout(state);
    }

    case 'DISCARD_WORKING_LAYOUT': {
      // Discard drops the exploratory pad moves, but NOT the placement locks made
      // during the session. A lock is the one hard, user-facing placement
      // guarantee the product offers — it is an explicit decision, not an
      // exploratory edit — and letting Discard take it meant the next Generate
      // freely relocated a sound the user had pinned, with nothing to tell them
      // the guarantee had lapsed.
      //
      // Only a lock whose Sound sits on the locked pad in Active can be kept,
      // though (T12): a lock made at a draft-only position would point at a pad
      // the Sound does not occupy in Active, be invisible (lock glyphs draw only
      // on the Sound's pad) and still pull the Sound back on the next Generate,
      // so Discard would have edited the Active Layout after all. Finger
      // preferences live in voiceConstraints and survive Discard (decision Q2);
      // Active's pad constraints are re-derived from them.
      const preservedLocks = state.workingLayout
        ? { ...state.activeLayout.placementLocks, ...state.workingLayout.placementLocks }
        : state.activeLayout.placementLocks;

      return {
        ...state,
        workingLayout: null,
        activeLayout: withDerivedLayoutState(
          { ...state.activeLayout, placementLocks: preservedLocks },
          state.voiceConstraints,
        ),
        updatedAt: new Date().toISOString(),
        analysisStale: true,
        selectedEventIndex: null,
        selectedMomentIndex: null,
        // Preserve candidates — discarding working layout doesn't invalidate them
        inspectedLayout: null,
        compareCandidateId: null,
      };
    }

    // Every Promote is one: the draft's, a candidate's and a variant's (S3.3, T13).
    case 'PROMOTE_WORKING_LAYOUT': {
      if (!state.workingLayout) return state;
      return promote(state, { kind: 'working', layout: state.workingLayout }, action.payload?.reviewed);
    }

    case 'PROMOTE_CANDIDATE': {
      const candidate = state.candidates.find(c => c.id === action.payload.candidateId);
      if (!candidate) return state;
      return promote(state, { kind: 'candidate', candidate }, action.payload.reviewed);
    }

    case 'DELETE_CANDIDATE': {
      const filtered = state.candidates.filter(c => c.id !== action.payload.candidateId);
      const wasCompare = state.compareCandidateId === action.payload.candidateId;
      return {
        ...state,
        candidates: filtered,
        inspectedLayout: inspectionWithout(state, 'candidate', action.payload.candidateId),
        compareCandidateId: wasCompare ? null : state.compareCandidateId,
      };
    }

    case 'SAVE_AS_VARIANT': {
      const { name, source, candidateId } = action.payload;
      let sourceLayout: Layout | undefined;
      // A variant keeps its source's provenance (T32); a candidate's is its strategy.
      let provenance: LayoutProvenance | undefined;

      if (source === 'working' && state.workingLayout) {
        sourceLayout = state.workingLayout;
        provenance = state.workingLayout.provenance;
      } else if (source === 'candidate' && candidateId) {
        const candidate = state.candidates.find(c => c.id === candidateId);
        sourceLayout = candidate?.layout;
        provenance = candidate ? candidateProvenance(candidate) : undefined;
      }

      if (!sourceLayout) return state;

      // No two variants share a name (T29): a taken name gets " (2)".
      const variant: Layout = {
        ...cloneLayout(
          sourceLayout,
          action.payload.variantId ?? generateId(),
          uniqueName(name, state.savedVariants.map(v => v.name)),
          'variant',
        ),
        ...(provenance ? { provenance } : {}),
      };

      return {
        ...state,
        savedVariants: [...state.savedVariants, variant],
        updatedAt: new Date().toISOString(),
      };
    }

    case 'LOAD_SAVED_VARIANT': {
      const variant = state.savedVariants.find(layout => layout.id === action.payload.variantId);
      if (!variant) return state;
      const reconciledVariant = reconcileLayoutVoices(variant, state.soundStreams);
      const now = new Date().toISOString();
      return {
        ...state,
        updatedAt: now,
        recoveredDrafts: keepReplacedDraft(state, reconciledVariant, now),
        workingLayout: withDerivedLayoutState(
          { ...cloneLayout(reconciledVariant, generateId(), reconciledVariant.name, 'working'), provenance: `variant:${variant.id}` },
          state.voiceConstraints,
        ),
        inspectedLayout: null,
        compareCandidateId: null,
        selectedEventIndex: null,
        selectedMomentIndex: null,
        analysisStale: true,
      };
    }

    case 'PROMOTE_VARIANT': {
      const variant = state.savedVariants.find(v => v.id === action.payload.variantId);
      if (!variant) return state;
      return promote(state, { kind: 'variant', variant }, action.payload.reviewed);
    }

    case 'DELETE_VARIANT': {
      return {
        ...state,
        savedVariants: state.savedVariants.filter(v => v.id !== action.payload.variantId),
        inspectedLayout: inspectionWithout(state, 'variant', action.payload.variantId),
        updatedAt: new Date().toISOString(),
      };
    }

    case 'RENAME_LAYOUT': {
      const { target, name: newName } = action.payload;
      if (action.payload.target === 'variant') {
        const { variantId } = action.payload;
        const others = state.savedVariants.filter(v => v.id !== variantId).map(v => v.name);
        const trimmed = newName.trim();
        if (!trimmed || !state.savedVariants.some(v => v.id === variantId)) return state;
        return {
          ...state,
          savedVariants: state.savedVariants.map(v => (v.id === variantId ? { ...v, name: uniqueName(trimmed, others) } : v)),
          updatedAt: new Date().toISOString(),
        };
      }
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

    case 'RESTORE_RECOVERED_DRAFT': {
      const recovered = (state.recoveredDrafts ?? []).find(l => l.id === action.payload.layoutId);
      if (!recovered) return state;
      const now = new Date().toISOString();
      const restored: Layout = withDerivedLayoutState({
        ...reconcileLayoutVoices(recovered, state.soundStreams),
        role: 'working',
        baselineId: state.activeLayout.id,
        provenance: undefined,
        savedAt: undefined,
        scoreCache: null,
      }, state.voiceConstraints);
      // The draft being replaced may itself need keeping (restoring over a
      // hand-made draft); the restored entry leaves the list either way.
      const withoutRestored = { ...state, recoveredDrafts: (state.recoveredDrafts ?? []).filter(l => l !== recovered) };
      return {
        ...state,
        workingLayout: restored,
        recoveredDrafts: keepReplacedDraft(withoutRestored, restored, now),
        updatedAt: now,
        analysisStale: true,
        inspectedLayout: null,
        compareCandidateId: null,
        selectedEventIndex: null,
        selectedMomentIndex: null,
      };
    }

    case 'DELETE_RECOVERED_DRAFT': {
      const remaining = (state.recoveredDrafts ?? []).filter(l => l.id !== action.payload.layoutId);
      if (remaining.length === (state.recoveredDrafts ?? []).length) return state;
      return {
        ...state,
        recoveredDrafts: remaining,
        inspectedLayout: inspectionWithout(state, 'recovered', action.payload.layoutId),
        updatedAt: new Date().toISOString(),
      };
    }

    // -- Analysis --

    // Analysis results and candidates are analysis-only state (never persisted),
    // so they must not bump updatedAt — otherwise merely opening a project
    // triggers an autosave and reshuffles the library's recency ordering.
    case 'SET_ANALYSIS_RESULT':
      return { ...state, analysisResult: action.payload, analysisStale: false };

    case 'SET_CANDIDATES': {
      // Candidates are proposals (decision Q4): a run's first candidate, A,
      // is shown read-only, even on an empty grid, and nothing is written. The
      // draft stays as it was until "Use as my draft". Each run is added to
      // the list, not put in its place (S3.3).
      const first = action.payload[0];
      const installed = withInstalledRun(state, action.payload);
      const next: ProjectState = {
        ...installed,
        generationSummary: null,
        compareCandidateId: null,
        isProcessing: false,
        // The run's candidate A: its trace shows whenever no candidate is inspected (T33).
        restingTrace: first ? candidateTrace(installed, first) : null,
      };
      if (first) return inspecting(next, { kind: 'candidate', id: first.id });
      return state.inspectedLayout?.kind === 'candidate' ? inspecting(next, null) : next;
    }

    case 'ADD_CANDIDATE_RUN': {
      // Installed like a Generate run, so it is shown read-only too (S3.2).
      const first = action.payload[0];
      if (!first) return state;
      const installed = withInstalledRun(state, action.payload);
      return inspecting({ ...installed, restingTrace: candidateTrace(installed, first) }, { kind: 'candidate', id: first.id });
    }

    case 'CLEAR_OLDER_RUNS': {
      const { runs, candidateIds } = olderRuns(state);
      if (runs.length === 0) return state;
      const cleared = (id: string | null | undefined) => !!id && candidateIds.has(id);
      return {
        ...state,
        candidates: state.candidates.filter(c => !candidateIds.has(c.id)),
        candidateRuns: { ...state.candidateRuns, runs: state.candidateRuns.runs.slice(0, 1) },
        inspectedLayout: state.inspectedLayout?.kind === 'candidate' && cleared(state.inspectedLayout.id) ? null : state.inspectedLayout,
        compareCandidateId: cleared(state.compareCandidateId) ? null : state.compareCandidateId,
      };
    }

    case 'SET_GENERATION_SUMMARY':
      return { ...state, generationSummary: action.payload };

    case 'INSPECT_LAYOUT': {
      const next = inspecting(state, action.payload?.kind === 'working' ? null : action.payload);
      // Showing what is already shown changes nothing (no re-render).
      const sameRef = next.inspectedLayout?.kind === state.inspectedLayout?.kind
        && next.inspectedLayout?.id === state.inspectedLayout?.id;
      if (sameRef && next.selectedPadKey === state.selectedPadKey && next.moveHistoryIndex === state.moveHistoryIndex
        && next.armedStreamId === state.armedStreamId) return state;
      return next;
    }

    case 'SET_INSPECTED_ANALYSIS':
      if (action.payload === state.inspectedAnalysis) return state;
      return { ...state, inspectedAnalysis: action.payload };

    case 'MARK_ANALYSIS_STALE':
      return { ...state, analysisStale: true };

    case 'SUGGEST_STARTING_LAYOUT': {
      // An explicit, user-initiated starting point.
      //
      // The product forbids placing sounds automatically, and rightly so — the
      // layout is the user's decision. But it left a new user facing an empty 8x8
      // grid with no indication of where anything should go, and nothing to
      // analyse or optimise from until they had placed every sound by hand. This
      // runs only when the user asks for it, produces a Working/Test Layout (so it
      // is exploratory and discardable), and never disturbs a pad the user has
      // already placed or locked.
      const streams = getActiveStreams(state);
      if (streams.length === 0) return state;

      const base = getDisplayedLayout(state) ?? state.activeLayout;
      // The base name stays; "suggested" is where it came from, not its name (T32).
      const clone: Layout = { ...cloneLayout(base, generateId(), base.name, 'working'), provenance: 'suggested' };
      const filled = withRemainingPlaced(state, clone);
      const working: Layout = filled === clone
        ? { ...clone, fingerConstraints: buildLayoutFingerConstraints(clone.padToVoice, state.voiceConstraints) }
        : filled;

      return {
        ...state,
        workingLayout: working,
        analysisStale: true,
        updatedAt: new Date().toISOString(),
      };
    }

    case 'APPLY_GENERATION_TO_LAYOUT': {
      const candidate = state.candidates.find(c => c.id === action.payload.candidateId);
      if (!candidate) return state;
      const now = new Date().toISOString();

      // Apply the candidate's layout as the working layout, reconciling voice
      // metadata. It keeps the candidate's base name; the strategy goes into
      // provenance, never "(draft)" into the name (T32).
      const reconciledCandidateLayout = reconcileLayoutVoices(candidate.layout, state.soundStreams);
      const working: Layout = {
        ...cloneLayout(reconciledCandidateLayout, generateId(), reconciledCandidateLayout.name || 'Generated', 'working'),
        provenance: candidateProvenance(candidate),
      };

      // The solver's fingering is NOT a user preference and must not be written
      // into voiceConstraints. Doing so meant one click of Generate stamped a
      // hand+finger onto every sound, persisted it, and rendered it in the Sounds
      // panel as though the user had chosen it — after which the user could no
      // longer tell their own preferences from the optimizer's guesses, and every
      // later Generate was boxed in by the previous one's output.
      //
      // Solver fingerings already live where they belong, on the candidate's
      // ExecutionPlan, and the Sounds panel renders them as dimmed suggestions
      // when no user constraint is set.
      return {
        ...state,
        recoveredDrafts: keepReplacedDraft(state, reconciledCandidateLayout, now),
        workingLayout: withDerivedLayoutState(working, state.voiceConstraints),
        // "Use as my draft": the grid now shows the draft it became.
        inspectedLayout: null,
        // The pad map changed, so any existing analysis describes a different
        // layout. Marking it stale re-runs analysis instead of showing figures
        // the freshness check itself would reject.
        analysisStale: true,
        updatedAt: now,
      };
    }

    // -- Ephemeral UI --

    case 'SELECT_EVENT':
      // Clearing an already-empty selection changes nothing (T06: an Escape
      // that closes an overlay must not also re-render the whole editor).
      if (action.payload === null && state.selectedEventIndex === null) return state;
      // Selecting an event while stopped moves the playhead to it, so Play
      // starts there (T10 slice); selecting it again seeks back to it. While
      // playing, the playhead is left alone.
      if (action.payload !== null && !state.isPlaying) {
        const hit = getDisplayedExecutionPlan(state)?.fingerAssignments.find(a => a.eventIndex === action.payload);
        if (hit) {
          if (action.payload === state.selectedEventIndex && state.currentTime === hit.startTime) return state;
          return { ...state, selectedEventIndex: action.payload, currentTime: hit.startTime };
        }
      }
      if (action.payload === state.selectedEventIndex) return state;
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

    case 'SET_PLAYBACK_RATE':
      // Clamped so the transport can never stall or run away.
      return { ...state, playbackRate: Math.min(2, Math.max(0.1, action.payload)) };

    case 'SET_LOOP_ENABLED':
      return { ...state, loopEnabled: action.payload };

    case 'SET_LOOP_REGION': {
      const { start, end } = action.payload;
      if (start === null || end === null) {
        return { ...state, loopStart: null, loopEnd: null };
      }
      // Normalise so dragging a region right-to-left still works.
      return {
        ...state,
        loopStart: Math.min(start, end),
        loopEnd: Math.max(start, end),
      };
    }

    case 'SET_COUNT_IN_BARS':
      return { ...state, countInBars: Math.min(4, Math.max(0, Math.round(action.payload))) };

    case 'SET_REHEARSAL_AUDIO':
      return { ...state, rehearsalAudio: { ...state.rehearsalAudio, ...action.payload } };

    // Optimizer configuration — persisted user preferences, so bump updatedAt
    // to schedule an autosave (otherwise the choice silently reverts on reload).
    case 'SET_OPTIMIZER_METHOD':
      return { ...state, optimizerMethod: action.payload, updatedAt: new Date().toISOString() };

    case 'SET_GREEDY_STRATEGY':
      return { ...state, greedyStrategy: action.payload, updatedAt: new Date().toISOString() };

    case 'SET_COST_TOGGLES':
      return { ...state, costToggles: action.payload, updatedAt: new Date().toISOString() };

    case 'SET_MANUAL_COST_RESULT':
      return { ...state, manualCostResult: action.payload };

    case 'SET_MOVE_HISTORY':
      // A trace with no candidate (Generate installs its run's through
      // SET_CANDIDATES): it shows while no candidate is inspected.
      return {
        ...state,
        restingTrace: {
          candidateId: null,
          letter: null,
          moves: action.payload.moves,
          iterations: action.payload.trace,
          stopReason: action.payload.stopReason ?? null,
          annealing: null,
          beam: null,
          telemetry: null,
          promoted: false,
        },
      };

    case 'SET_MOVE_HISTORY_INDEX':
      return { ...state, moveHistoryIndex: action.payload };

    case 'SET_GENERATION_RUN':
      return { ...state, lastGenerationRun: action.payload };

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
    lastOpenedAt: new Date().toISOString(),
    soundStreams: [],
    tempo: DEFAULT_PROJECT_TEMPO,
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
    recoveredDrafts: [],
    analysisResult: null,
    candidates: [],
    candidateRuns: EMPTY_CANDIDATE_RUNS,
    inspectedLayout: null,
    inspectedAnalysis: null,
    generationSummary: null,
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
    greedyStrategy: 'all',
    costToggles: ALL_COSTS_ENABLED,
    performanceLanes: [],
    laneGroups: [],
    sourceFiles: [],
    selectedEventIndex: null,
    selectedMomentIndex: null,
    selectedStreamId: null,
    armedStreamId: null,
    selectedPadKey: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: false,
    manualCostResult: null,
    moveHistory: null,
    iterationTrace: null,
    moveHistoryStopReason: null,
    moveHistoryIndex: null,
    traceSubject: null,
    restingTrace: null,
    lastGenerationRun: null,
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    loopEnabled: false,
    loopStart: null,
    loopEnd: null,
    countInBars: 0,
    rehearsalAudio: { ...DEFAULT_REHEARSAL_AUDIO },
  };
}
