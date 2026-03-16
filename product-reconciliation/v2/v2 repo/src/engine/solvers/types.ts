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
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): Promise<ExecutionPlanResult>;

  solveSync?(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): ExecutionPlanResult;
}

/** Supported solver algorithm types. */
export type SolverType = 'beam' | 'annealing';

/** Factory function type for creating solver instances. */
export type SolverFactory = (config: SolverConfig) => SolverStrategy;
