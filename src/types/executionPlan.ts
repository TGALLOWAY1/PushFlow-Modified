/**
 * Execution plan types.
 *
 * An ExecutionPlan is the full timeline mapping of events -> hand/finger actions.
 * This is a first-class output artifact of the system.
 *
 * Canonical terminology:
 * - FingerAssignment: per-event hand/finger decision (was EngineDebugEvent)
 * - ExecutionPlanResult: full plan output (was EngineResult)
 * - DifficultyBreakdown: cost component breakdown (was CostBreakdown)
 */

import { type DiagnosticsPayload, type V1CostBreakdown } from './diagnostics';
import { type FingerType } from './fingerModel';

// ============================================================================
// Pad-to-Finger Ownership (Invariant B)
// ============================================================================

/**
 * PadFingerAssignment: Stable mapping of pads to fingers for an entire solution.
 *
 * Invariant B: Within an active solution, each pad maps to exactly one finger.
 * Different candidate solutions may assign different fingers (Invariant D).
 */
export type PadFingerAssignment = Record<string, {
  hand: 'left' | 'right';
  finger: FingerType;
}>;

// ============================================================================
// Moment-Level Assignment Types
// ============================================================================

/**
 * NoteAssignment: Per-note finger/hand info within a moment.
 * Carries identity and position but NOT split cost.
 */
export interface NoteAssignmentInfo {
  noteNumber: number;
  soundId: string;
  padId: string;
  row: number;
  col: number;
  hand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  noteKey?: string;
}

/**
 * MomentAssignment: Per-moment assignment with full moment-level cost.
 *
 * Invariant E: Cost is per-moment, not divided per-note.
 * The difficulty of a moment reflects the combined hand pose required
 * to play all notes simultaneously.
 */
export interface MomentAssignment {
  /** Index of this moment in the performance timeline. */
  momentIndex: number;
  /** Absolute start time in seconds. */
  startTime: number;
  /** Per-note assignments within this moment. */
  noteAssignments: NoteAssignmentInfo[];
  /** Full moment-level cost (NOT divided per-note). */
  cost: number;
  /** Difficulty classification for this moment. */
  difficulty: DifficultyLevel;
  /** Full cost breakdown for this moment (V1 schema). */
  costBreakdown: V1CostBreakdown;
}

/**
 * @deprecated Use V1CostBreakdown from diagnostics.ts instead.
 *
 * Legacy 7-component breakdown retained for backward compatibility.
 * Field mapping to V1CostBreakdown:
 *   movement   ← transitionCost
 *   stretch    ← fingerPreference
 *   drift      ← handShapeDeviation
 *   bounce     ← 0 (alternation removed)
 *   fatigue    ← 0 (no per-finger home tracking)
 *   crossover  ← constraintPenalty
 */
export interface DifficultyBreakdown {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
}

/** Difficulty classification for an event. */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Unplayable';

/**
 * FingerAssignment: Per-event hand/finger decision in the execution plan.
 *
 * Formerly EngineDebugEvent in Version1.
 */
export interface FingerAssignment {
  noteNumber: number;
  /** Stable voice identity (from PerformanceEvent.voiceId). */
  voiceId?: string;
  startTime: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  cost: number;
  /** V1 cost breakdown (replaces legacy DifficultyBreakdown). */
  costBreakdown?: V1CostBreakdown;
  difficulty: DifficultyLevel;
  row?: number;
  col?: number;
  eventIndex?: number;
  padId?: string;
  eventKey?: string;
}

/**
 * Finger usage statistics.
 */
export interface FingerUsageStats {
  [fingerKey: string]: number;
}

/**
 * Fatigue map: per-finger fatigue levels.
 */
export interface FatigueMap {
  [fingerKey: string]: number;
}

/**
 * Annealing iteration snapshot for optimization trace.
 */
export interface AnnealingIterationSnapshot {
  iteration: number;
  temperature: number;
  currentCost: number;
  bestCost: number;
  accepted: boolean;
  deltaCost: number;
  acceptanceProbability?: number;
  transitionSum: number;
  fingerPreferenceSum: number;
  handShapeDeviationSum: number;
  handBalanceSum: number;
  constraintPenaltySum: number;
  /** Which restart this snapshot belongs to (0 = initial run). */
  restartIndex?: number;
}

/**
 * SolverTelemetry: Instrumentation data for debugging and quality assessment.
 */
export interface SolverTelemetry {
  /** Optimization mode used. */
  optimizationMode: import('./engineConfig').OptimizationMode;
  /** Total wall-clock time in ms. */
  wallClockMs: number;
  /** Total iterations completed across all restarts. */
  iterationsCompleted: number;
  /** Number of restarts performed. */
  restartCount: number;
  /** Best cost at the end of each restart. */
  restartBestCosts: number[];
  /** Total accepted mutations. */
  totalAccepted: number;
  /** Total rejected mutations. */
  totalRejected: number;
  /** Total invalid mutations (produced invalid layouts). */
  totalInvalid: number;
  /** Acceptance rate: accepted / (accepted + rejected). */
  acceptanceRate: number;
  /** How many times global best was updated. */
  improvementCount: number;
  /** improvementCount / iterationsCompleted. */
  improvementRate: number;
  /** (initialCost - finalCost) / initialCost. */
  finalCostImprovement: number;
  /** Cost at iteration milestones. */
  costAtMilestones: {
    pct25: number;
    pct50: number;
    pct75: number;
    pct100: number;
  };
}

/**
 * Layout provenance: tracks which layout state an execution plan was computed against.
 * Required so downstream consumers can verify freshness and context.
 */
export interface ExecutionPlanLayoutBinding {
  /** The layout ID this plan was computed against. */
  layoutId: string;
  /** Deterministic hash of the layout's padToVoice mapping. */
  layoutHash: string;
  /** The workflow role of the source layout. */
  layoutRole: import('./layout').LayoutRole;
}

/**
 * ExecutionPlanResult: Complete output from a solver run.
 *
 * Every execution plan is bound to a specific layout state via `layoutBinding`.
 * This enables staleness detection, compare-mode correctness, and event
 * analysis that always knows which layout it's explaining.
 *
 * Formerly EngineResult in Version1.
 */
export interface ExecutionPlanResult {
  /** Total score on a normalized 0–100 scale (higher = better). */
  score: number;
  /** Count of events classified as Unplayable. */
  unplayableCount: number;
  /** Count of events classified as Hard. */
  hardCount: number;
  /** Per-event finger assignments. */
  fingerAssignments: FingerAssignment[];

  /**
   * Stable pad-to-finger ownership for the entire solution.
   * Invariant B: each pad maps to exactly one finger within a solution.
   */
  padFingerOwnership?: PadFingerAssignment;

  /**
   * Per-moment assignments with full moment-level cost.
   * Invariant E: cost is per-moment, not divided per-note.
   */
  momentAssignments?: MomentAssignment[];

  /** Count of moments classified as Unplayable. */
  unplayableMomentCount?: number;
  /** Count of moments classified as Hard. */
  hardMomentCount?: number;

  /** Per-finger usage counts. */
  fingerUsageStats: FingerUsageStats;
  /** Per-finger fatigue levels. */
  fatigueMap: FatigueMap;
  /** Average drift from home positions. */
  averageDrift: number;
  /** Average cost breakdown across all events (V1 schema). */
  averageMetrics: V1CostBreakdown;
  /** Annealing trace (only for AnnealingSolver). */
  annealingTrace?: AnnealingIterationSnapshot[];

  /**
   * Layout binding: which layout state this plan was computed against.
   * Required for staleness detection and compare-mode correctness.
   */
  layoutBinding?: ExecutionPlanLayoutBinding;

  /** Canonical diagnostics payload (Phase 3). */
  diagnostics?: DiagnosticsPayload;

  /**
   * Per-event rejection reasons explaining why events are unplayable.
   * Keyed by event index. Values are arrays of rejection reason strings:
   * - 'unmapped' — event couldn't be resolved to any pad position
   * - 'zone_conflict' — pads span both zones, no single-hand or split solution
   * - 'ownership_conflict' — pad ownership invariant rejected all grips
   * - 'speed_limit' — hand can't move fast enough between positions
   * - 'no_valid_grip' — no biomechanically valid finger assignment exists
   * - 'beam_exhausted' — beam had no valid parent nodes for this group
   */
  rejectionReasons?: Record<number, string[]>;

  /** Run metadata for debugging and telemetry. */
  metadata?: {
    /** @deprecated Use layoutBinding.layoutId instead. */
    layoutIdUsed?: string;
    /** @deprecated Use layoutBinding.layoutHash instead. */
    layoutHashUsed?: string;
    layoutCoverage?: { totalNotes: number; unmappedNotesCount: number; fallbackNotesCount: number };
    invalidReason?: string;
    seed?: number;
    strictMode?: boolean;
    beamWidthUsed?: number;
    objectiveTotal?: number;
    objectiveComponentsSummary?: Record<string, number>;
    solverTelemetry?: SolverTelemetry;
  };
}
