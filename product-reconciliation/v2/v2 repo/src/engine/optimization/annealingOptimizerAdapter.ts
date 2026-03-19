/**
 * Annealing Optimizer Adapter.
 *
 * Wraps the existing AnnealingSolver behind the OptimizerMethod interface.
 * The annealing solver jointly optimizes layout (via mutations) and finger
 * assignment (via beam search cost evaluation).
 *
 * This adapter:
 * 1. Converts OptimizerInput → SolverConfig + AnnealingConfig
 * 2. Runs the AnnealingSolver
 * 3. Runs the canonical evaluator on the result (with cost toggles)
 * 4. Packages everything into OptimizerOutput
 */

import {
  type OptimizerMethod,
  type OptimizerInput,
  type OptimizerOutput,
  type OptimizerTelemetry,
} from './optimizerInterface';
import { registerOptimizer } from './optimizerRegistry';
import { createAnnealingSolver } from './annealingSolver';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import {
  type SolverConfig,
  type AnnealingConfig,
  FAST_ANNEALING_CONFIG,
  DEEP_ANNEALING_CONFIG,
} from '../../types/engineConfig';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { buildPerformanceMoments } from '../structure/momentBuilder';

// ============================================================================
// Adapter Implementation
// ============================================================================

class AnnealingOptimizerAdapter implements OptimizerMethod {
  readonly key = 'annealing' as const;
  readonly name = 'Simulated Annealing';
  readonly description = 'Layout + finger optimization via simulated annealing. Slower but finds better global solutions.';
  readonly supportsStepHistory = false;

  async optimize(input: OptimizerInput): Promise<OptimizerOutput> {
    const startTime = Date.now();

    // Select annealing config based on optimization mode
    const annealingConfig: AnnealingConfig =
      input.config.optimizationMode === 'deep'
        ? DEEP_ANNEALING_CONFIG
        : FAST_ANNEALING_CONFIG;

    // Convert to SolverConfig
    const solverConfig: SolverConfig = {
      instrumentConfig: input.instrumentConfig,
      layout: input.layout,
      sourceLayoutRole: input.layout.role,
      seed: input.config.seed ?? Math.floor(Math.random() * 0x7fffffff),
      annealingConfig,
    };

    const solver = createAnnealingSolver(solverConfig);

    // Convert soft preferences to legacy manual assignments
    const manualAssignments = input.constraints.softPreferences
      && Object.keys(input.constraints.softPreferences).length > 0
      ? input.constraints.softPreferences
      : undefined;

    const executionPlan = await solver.solve(
      input.performance,
      input.config.engineConfig,
      manualAssignments,
    );

    // Get the optimized layout from the solver
    const finalLayout = solver.getBestLayout() ?? input.layout;

    // Extract pad-finger assignment
    const padFingerAssignment: PadFingerAssignment =
      executionPlan.padFingerOwnership ?? buildPadFingerAssignmentFromPlan(executionPlan);

    // Run canonical evaluator
    const moments = buildPerformanceMoments(input.performance.events);
    const diagnostics = evaluatePerformance({
      moments,
      layout: finalLayout,
      padFingerAssignment,
      config: input.evaluationConfig,
    });

    const wallClockMs = Date.now() - startTime;
    const initialCost = executionPlan.metadata?.solverTelemetry
      ? executionPlan.averageMetrics.total / (1 - (executionPlan.metadata.solverTelemetry.finalCostImprovement || 0))
      : executionPlan.averageMetrics.total;

    const telemetry: OptimizerTelemetry = {
      wallClockMs,
      iterationsCompleted: executionPlan.metadata?.solverTelemetry?.iterationsCompleted ?? 0,
      movesEvaluated: executionPlan.metadata?.solverTelemetry?.iterationsCompleted,
      movesAccepted: executionPlan.metadata?.solverTelemetry?.totalAccepted,
      movesRejected: executionPlan.metadata?.solverTelemetry?.totalRejected,
      initialCost,
      finalCost: executionPlan.averageMetrics.total,
      improvement: executionPlan.metadata?.solverTelemetry?.finalCostImprovement ?? 0,
    };

    return {
      layout: finalLayout,
      padFingerAssignment,
      executionPlan,
      diagnostics,
      costTogglesUsed: input.costToggles,
      stopReason: 'completed',
      telemetry,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildPadFingerAssignmentFromPlan(
  plan: import('../../types/executionPlan').ExecutionPlanResult,
): PadFingerAssignment {
  const assignment: PadFingerAssignment = {};
  for (const fa of plan.fingerAssignments) {
    if (fa.row != null && fa.col != null && fa.assignedHand !== 'Unplayable' && fa.finger) {
      const pk = `${fa.row},${fa.col}`;
      if (!assignment[pk]) {
        assignment[pk] = { hand: fa.assignedHand, finger: fa.finger };
      }
    }
  }
  return assignment;
}

// ============================================================================
// Registration
// ============================================================================

const annealingAdapter = new AnnealingOptimizerAdapter();
registerOptimizer(annealingAdapter);

export { annealingAdapter };
