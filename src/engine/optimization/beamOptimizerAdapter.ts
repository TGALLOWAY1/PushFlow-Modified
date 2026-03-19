/**
 * Beam Optimizer Adapter.
 *
 * Wraps the existing BeamSolver behind the OptimizerMethod interface.
 * The beam solver handles finger assignment for a fixed layout —
 * it does not modify the layout itself.
 *
 * This adapter:
 * 1. Converts OptimizerInput → SolverConfig + EngineConfiguration
 * 2. Runs the BeamSolver
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
import { createBeamSolver } from '../solvers/beamSolver';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import { type SolverConfig } from '../../types/engineConfig';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { buildPerformanceMoments } from '../structure/momentBuilder';

// ============================================================================
// Adapter Implementation
// ============================================================================

class BeamOptimizerAdapter implements OptimizerMethod {
  readonly key = 'beam' as const;
  readonly name = 'Beam Search';
  readonly description = 'Fast finger assignment via beam search. Does not modify the layout.';
  readonly supportsStepHistory = false;

  async optimize(input: OptimizerInput): Promise<OptimizerOutput> {
    const startTime = Date.now();

    // Convert to SolverConfig
    const solverConfig: SolverConfig = {
      instrumentConfig: input.instrumentConfig,
      layout: input.layout,
      sourceLayoutRole: input.layout.role,
      mappingResolverMode: 'allow-fallback',
    };

    const solver = createBeamSolver(solverConfig);

    // Convert soft preferences to legacy manual assignments for beam solver
    const manualAssignments = input.constraints.softPreferences
      && Object.keys(input.constraints.softPreferences).length > 0
      ? input.constraints.softPreferences
      : undefined;

    const executionPlan = await solver.solve(
      input.performance,
      input.config.engineConfig,
      manualAssignments,
    );

    // Extract pad-finger assignment from the execution plan
    const padFingerAssignment: PadFingerAssignment =
      executionPlan.padFingerOwnership ?? buildPadFingerAssignmentFromPlan(executionPlan);

    // Run canonical evaluator
    const moments = buildPerformanceMoments(input.performance.events);
    const diagnostics = evaluatePerformance({
      moments,
      layout: input.layout,
      padFingerAssignment,
      config: input.evaluationConfig,
    });

    const wallClockMs = Date.now() - startTime;
    const telemetry: OptimizerTelemetry = {
      wallClockMs,
      iterationsCompleted: 0,
      initialCost: executionPlan.averageMetrics.total,
      finalCost: executionPlan.averageMetrics.total,
      improvement: 0,
    };

    return {
      layout: input.layout,
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

/**
 * Build a PadFingerAssignment from the per-event FingerAssignment array.
 * Uses the first occurrence of each pad to determine ownership.
 */
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

const beamAdapter = new BeamOptimizerAdapter();
registerOptimizer(beamAdapter);

export { beamAdapter };
