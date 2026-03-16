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

import { type FingerType } from './fingerModel';

/**
 * DifficultyBreakdown: Per-event or aggregate breakdown of difficulty by factor.
 *
 * Uses the canonical 7-component model:
 * - transition: Fitts's law movement cost
 * - stretch: finger spread difficulty
 * - poseAttractor: spring to resting position
 * - perFingerHome: per-finger neutral position bias
 * - alternation: same-finger repetition penalty
 * - handBalance: left/right distribution
 * - constraints: fallback grip penalty
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
  startTime: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  cost: number;
  costBreakdown?: DifficultyBreakdown;
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
  movementSum: number;
  stretchSum: number;
  driftSum: number;
  bounceSum: number;
  fatigueSum: number;
  crossoverSum: number;
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
 * ExecutionPlanResult: Complete output from a solver run.
 *
 * Formerly EngineResult in Version1.
 */
export interface ExecutionPlanResult {
  /** Total score (lower = better). */
  score: number;
  /** Count of events classified as Unplayable. */
  unplayableCount: number;
  /** Count of events classified as Hard. */
  hardCount: number;
  /** Per-event finger assignments. */
  fingerAssignments: FingerAssignment[];
  /** Per-finger usage counts. */
  fingerUsageStats: FingerUsageStats;
  /** Per-finger fatigue levels. */
  fatigueMap: FatigueMap;
  /** Average drift from home positions. */
  averageDrift: number;
  /** Average difficulty breakdown across all events. */
  averageMetrics: DifficultyBreakdown;
  /** Annealing trace (only for AnnealingSolver). */
  annealingTrace?: AnnealingIterationSnapshot[];
  /** Run metadata for debugging. */
  metadata?: {
    layoutIdUsed?: string;
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
