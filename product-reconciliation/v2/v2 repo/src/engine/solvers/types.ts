/**
 * Solver Strategy Types.
 *
 * Defines the Strategy Pattern interface for pluggable optimization algorithms.
 * Supports BeamSolver (execution plans) and AnnealingSolver (coupled layout+execution).
 *
 * Ported from Version1/src/engine/solvers/types.ts with canonical terminology:
 * - EngineResult → ExecutionPlanResult (already in executionPlan.ts)
 * - EngineDebugEvent → FingerAssignment (already in executionPlan.ts)
 * - CostBreakdown → DifficultyBreakdown (already in executionPlan.ts)
 * - GridMapping → Layout
 */

import { type Performance } from '../../types/performance';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type FingerType } from '../../types/fingerModel';
import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type SolverConfig } from '../../types/engineConfig';

// ============================================================================
// Constraint Types
// ============================================================================

/** A single hand/finger assignment constraint. */
export interface FingerConstraint {
  hand: 'left' | 'right';
  finger: FingerType;
}

/**
 * SolverConstraints: Separated hard and soft constraint inputs.
 *
 * Hard constraints (from placement locks + explicit finger assignments):
 *   The solver MUST honor these — violations make the solution invalid.
 *
 * Soft preferences (from finger constraints, voice-level hand preferences):
 *   The solver SHOULD prefer these but may violate them for a better overall solution.
 *   Implemented as a cost bias, not a hard filter.
 */
export interface SolverConstraints {
  /**
   * Hard finger assignments by eventKey.
   * The solver must assign exactly this hand/finger to these events.
   */
  hardAssignments?: Record<string, FingerConstraint>;
  /**
   * Soft finger preferences by eventKey.
   * The solver adds a penalty when deviating from these, but may still choose differently.
   */
  softPreferences?: Record<string, FingerConstraint>;
}

// ============================================================================
// Solver Strategy Interface
// ============================================================================

/**
 * SolverStrategy: Interface for optimization algorithms.
 *
 * Implementations must analyze a Performance and produce an ExecutionPlanResult.
 */
export interface SolverStrategy {
  readonly name: string;
  readonly type: SolverType;
  readonly isSynchronous: boolean;

  solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, FingerConstraint>,
    constraints?: SolverConstraints,
  ): Promise<ExecutionPlanResult>;

  solveSync?(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, FingerConstraint>,
    constraints?: SolverConstraints,
  ): ExecutionPlanResult;
}

/** Supported solver algorithm types. */
export type SolverType = 'beam' | 'annealing';

/** Factory function type for creating solver instances. */
export type SolverFactory = (config: SolverConfig) => SolverStrategy;
