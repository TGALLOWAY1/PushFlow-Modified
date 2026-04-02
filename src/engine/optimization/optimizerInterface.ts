/**
 * Optimizer Interface.
 *
 * Canonical interface for pluggable optimization methods in PushFlow.
 * New algorithms (greedy, hill-climbing, genetic, etc.) implement
 * OptimizerMethod and register via the optimizer registry.
 *
 * The UI and orchestration layer should not need to know which algorithm
 * is running — it selects by method key and receives a uniform output.
 *
 * Key design decisions:
 * - Evaluator is separate from optimizer: all methods call the canonical
 *   evaluator rather than embedding custom scoring logic.
 * - Hard constraints use a shared contract: SolverConstraints from
 *   engine/solvers/types.ts.
 * - Cost toggles flow through to evaluation so disabled families
 *   contribute zero to the objective.
 * - Move history is optional (only interpretable methods provide it).
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type Layout } from '../../types/layout';
import { type ExecutionPlanResult, type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceCostBreakdown } from '../../types/costBreakdown';
import { type CostToggles } from '../../types/costToggles';
import { type SolverConstraints } from '../solvers/types';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type EngineConfiguration, type OptimizationMode } from '../../types/engineConfig';
import { type NaturalHandPose } from '../../types/ergonomicPrior';
import { type Section } from '../../types/performanceStructure';

// ============================================================================
// Optimizer Method Keys
// ============================================================================

/** Supported optimizer algorithms. Extensible as new methods are added. */
export type OptimizerMethodKey = 'beam' | 'annealing' | 'greedy';

// ============================================================================
// Optimizer Input
// ============================================================================

/** Configuration for the optimizer that is method-agnostic. */
export interface OptimizerConfig {
  /** Engine configuration (beam width, stiffness, resting pose). */
  engineConfig: EngineConfiguration;
  /** Optimization intensity for methods that support it. */
  optimizationMode?: OptimizationMode;
  /** Maximum iterations for iterative methods (greedy, annealing). */
  maxIterations?: number;
  /** Random seed for reproducibility. */
  seed?: number;
  /** Number of restart attempts for methods that support exploration (0 = single run). */
  restartCount?: number;
  /** Natural hand pose for pose0-based layout seeding. */
  pose0?: NaturalHandPose | null;
  /** Performance sections for difficulty analysis. */
  sections?: Section[];
}

/**
 * OptimizerInput: Everything an optimization method needs to produce a result.
 *
 * This is the uniform contract — every method receives the same input shape.
 */
export interface OptimizerInput {
  /** The performance timeline to optimize for. */
  performance: Performance;
  /** Starting layout (pad-to-voice mapping). May be empty for greedy init. */
  layout: Layout;
  /** Existing finger assignment (optional — methods may ignore or build on it). */
  padFingerAssignment?: PadFingerAssignment;
  /** Which cost families are active for this run. */
  costToggles: CostToggles;
  /** Hard and soft constraints from the user. */
  constraints: SolverConstraints;
  /** Method-agnostic optimizer settings. */
  config: OptimizerConfig;
  /** Biomechanical evaluation parameters. */
  evaluationConfig: EvaluationConfig;
  /** Instrument grid geometry. */
  instrumentConfig: InstrumentConfig;
  /** Canonical voice metadata from soundStreams — used to preserve user-assigned names/colors. */
  voiceHints?: ReadonlyArray<{ id: string; name: string; color: string; originalMidiNote: number | null }>;
}

// ============================================================================
// Move History (for interpretable methods)
// ============================================================================

/** Types of local moves in interpretable optimizers. */
export type MoveType = 'pad_move' | 'pad_swap' | 'finger_reassignment' | 'other';

/**
 * CandidateMoveRecord: Information about a single move evaluated by the optimizer.
 */
export interface CandidateMoveRecord {
  moveType: MoveType;
  /** Description for UI (e.g. "Moved Snare from (3,4) to (3,3)") */
  description: string;
  /** Pad key where the move originates */
  fromPadKey: string | null;
  /** Pad key where the move targets */
  toPadKey: string | null;
  /** Secondary pad key (for swaps) */
  secondaryPadKey?: string;
  /** The voice or assignment being moved */
  targetId?: string;
  /** Voice name for UI */
  voiceName?: string;
  /** Total cost difference (negative = improvement) */
  deltaTotal: number;
  /** Full evaluation breakdown for the candidate state */
  costBreakdown?: PerformanceCostBreakdown;
  /** Whether the optimizer chose this move */
  accepted: boolean;
  /** (Optional) why this move was chosen or rejected */
  reason?: string;
}

/**
 * OptimizationIteration: A single step in an interpretable optimization run.
 * Captures before/after state and all candidate moves considered.
 */
export interface OptimizationIteration {
  iterationIndex: number;
  phase?: 'init-layout' | 'init-fingers' | 'hill-climb';
  attemptIndex?: number;
  
  /** Score before any move is applied */
  scoreBefore: number;
  /** Score after the chosen move is applied */
  scoreAfter: number;
  
  /** Detailed delta (scoreAfter - scoreBefore) */
  netDelta: number;
  
  /** The full layout and assignment state before the move */
  stateBefore: {
    layout: Layout;
    assignment: PadFingerAssignment;
  };
  /** The full layout and assignment state after the move */
  stateAfter?: {
    layout: Layout;
    assignment: PadFingerAssignment;
  };
  
  /** All valid moves considered in this iteration */
  candidateMoves: CandidateMoveRecord[];
  /** The single move actually selected (null if local minimum reached) */
  chosenMove: CandidateMoveRecord | null;
  
  /** Plain English summary */
  summary: string;
}

/** Legacy record type for backwards compatibility (optional, being phased out). */
export interface OptimizerMove {
  iteration: number;
  type: MoveType;
  description: string;
  costBefore: number;
  costAfter: number;
  costDelta: number;
  affectedVoice?: string;
  affectedPad?: string;
  secondaryPad?: string;
  reason: string;
  rejectedAlternatives?: number;
  phase?: 'init-layout' | 'init-fingers' | 'hill-climb';
  attemptIndex?: number;
  layoutSnapshot?: Layout;
  assignmentSnapshot?: PadFingerAssignment;
}

// ============================================================================
// Stop Reasons
// ============================================================================

/** Why the optimizer stopped. */
export type StopReason =
  | 'no_improving_move'      // Local minimum: no move reduces cost
  | 'iteration_cap'          // Hit maximum iteration count
  | 'local_minimum'          // Same as no_improving_move (alias for clarity)
  | 'infeasible_neighborhood' // All neighboring moves violate hard constraints
  | 'completed'              // Non-iterative method finished normally
  | 'aborted';               // User cancelled

// ============================================================================
// Optimizer Telemetry
// ============================================================================

/** Performance metrics for the optimization run. */
export interface OptimizerTelemetry {
  /** Wall-clock time in milliseconds. */
  wallClockMs: number;
  /** Total iterations completed. */
  iterationsCompleted: number;
  /** Number of moves evaluated (for iterative methods). */
  movesEvaluated?: number;
  /** Number of moves accepted. */
  movesAccepted?: number;
  /** Number of moves rejected (infeasible or non-improving). */
  movesRejected?: number;
  /** Cost at start of optimization. */
  initialCost: number;
  /** Cost at end of optimization. */
  finalCost: number;
  /** Relative improvement: (initial - final) / initial. */
  improvement: number;
}

// ============================================================================
// Optimizer Output
// ============================================================================

/**
 * OptimizerOutput: The uniform result from any optimization method.
 *
 * Contains everything the UI needs to display results, compare candidates,
 * and allow step-through of interpretable methods.
 */
export interface OptimizerOutput {
  /** Final optimized layout. */
  layout: Layout;
  /** Final finger assignment for all pads in the layout. */
  padFingerAssignment: PadFingerAssignment;
  /**
   * Execution plan result (beam-solver-compatible format).
   * This is the primary output for backward compatibility with existing
   * UI components that consume ExecutionPlanResult.
   */
  executionPlan: ExecutionPlanResult;
  /** Full canonical evaluation of the final state. */
  diagnostics: PerformanceCostBreakdown;
  /** Echo back which cost toggles were active during this run. */
  costTogglesUsed: CostToggles;
  /** Move-by-move history (legacy format, optional). */
  moveHistory?: OptimizerMove[];
  /** Detailed iteration-by-iteration trace for Visual Debugger. */
  iterationTrace?: OptimizationIteration[];
  /** Why the optimizer stopped. */
  stopReason: StopReason;
  /** Performance telemetry. */
  telemetry: OptimizerTelemetry;
}

// ============================================================================
// Optimizer Method Interface
// ============================================================================

/**
 * OptimizerMethod: The pluggable interface for optimization algorithms.
 *
 * Implementations:
 * - BeamOptimizerAdapter: wraps existing BeamSolver
 * - AnnealingOptimizerAdapter: wraps existing AnnealingSolver
 * - GreedyOptimizer: new greedy/hill-climbing method
 *
 * Each method is registered in the optimizer registry by key.
 */
export interface OptimizerMethod {
  /** Unique identifier for this method. */
  readonly key: OptimizerMethodKey;
  /** Human-readable name for UI display. */
  readonly name: string;
  /** Short description of the algorithm. */
  readonly description: string;
  /** Whether this method produces a step-by-step move history. */
  readonly supportsStepHistory: boolean;

  /**
   * Run the optimization.
   *
   * All methods receive the same OptimizerInput and must produce
   * a conforming OptimizerOutput. The output includes an ExecutionPlanResult
   * for backward compatibility with existing UI components.
   */
  optimize(input: OptimizerInput): Promise<OptimizerOutput>;
}
