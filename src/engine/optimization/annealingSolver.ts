/**
 * AnnealingSolver - Simulated Annealing optimization algorithm.
 *
 * Optimizes the Layout by iteratively mutating pad assignments
 * and accepting better or probabilistically worse solutions based on temperature.
 * Uses Beam Search as the cost evaluation function.
 *
 * Supports configurable parameters via AnnealingConfig:
 * - Fast mode: single trajectory, conservative budget (default)
 * - Deep mode: multiple restarts, larger budget, wider beam
 */

import { type Performance } from '../../types/performance';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type Layout } from '../../types/layout';
import { type FingerType } from '../../types/fingerModel';
import {
  type ExecutionPlanResult,
  type AnnealingIterationSnapshot,
  type SolverTelemetry,
} from '../../types/executionPlan';
import {
  type SolverConfig,
  type NeutralPadPositions,
  type AnnealingConfig,
  FAST_ANNEALING_CONFIG,
} from '../../types/engineConfig';
import { type SolverStrategy, type SolverType } from '../solvers/types';
import { createBeamSolver } from '../solvers/beamSolver';
import { countRelaxedStrikes } from '../evaluation/constraintRelaxation';

import { applyRandomMutation, applyZoneTransferMutation } from './mutationService';
import { computeMappingCoverage } from '../mapping/mappingCoverage';
import { createSeededRng } from '../../utils/seededRng';
import { type AnnealingRunControl, Yielder, throwIfCancelled } from './runControl';
import { type OptimizerTelemetry } from './optimizerInterface';

/**
 * Cost added per strike whose plan breaks a structural rule (hand separation or
 * one finger per sound).
 *
 * The annealer minimises the plan's average per-event cost, which is a few
 * units for any playable layout. A relaxed strike adds far more than any
 * ergonomic difference between layouts, so whenever two layouts are compared
 * — above all when choosing the best one found — a layout whose plan keeps the
 * rules wins. Early in a run, at high temperature, moves into rule-breaking
 * layouts are still accepted freely (that is how annealing explores); it is
 * the choice of the final layout that is rules-first. Each iteration's trace
 * snapshot records the relaxed strikes behind its cost.
 */
const RELAXED_STRIKE_PENALTY = 100;

// ============================================================================
// Run plan (budgets)
// ============================================================================

/** How a run's iterations are laid out over its restarts. */
export interface AnnealingPlan {
  /** Iterations each restart runs unless its share of the time runs out. */
  iterationsPerRestart: number[];
  /** Cooling factor applied after each iteration, per restart. */
  coolingRates: number[];
  /** Iterations planned for the whole run. */
  total: number;
}

/**
 * The run's plan. Without an iteration budget every restart runs `iterations`
 * at `coolingRate`, exactly as before. With one, the budget is shared equally
 * by the restarts (every restart runs at least one iteration), and each
 * restart's cooling is rescaled so it still ends at the temperature the
 * configured schedule reaches: the same schedule, in fewer steps.
 */
export function planAnnealingRun(config: AnnealingConfig): AnnealingPlan {
  const runs = Math.max(0, config.restartCount) + 1;
  const configured = Math.max(1, config.iterations);
  const iterationsPerRestart: number[] = [];
  if (config.iterationBudget === undefined) {
    for (let r = 0; r < runs; r++) iterationsPerRestart.push(configured);
  } else {
    const budget = Math.max(runs, Math.floor(config.iterationBudget));
    const share = Math.floor(budget / runs);
    const extra = budget % runs;
    for (let r = 0; r < runs; r++) iterationsPerRestart.push(share + (r < extra ? 1 : 0));
  }
  const coolingRates = iterationsPerRestart.map(n => (n === configured
    ? config.coolingRate
    : Math.pow(config.coolingRate, configured / n)));
  return {
    iterationsPerRestart,
    coolingRates,
    total: iterationsPerRestart.reduce((sum, n) => sum + n, 0),
  };
}

// ============================================================================
// AnnealingSolver Implementation
// ============================================================================

/**
 * AnnealingSolver - Simulated Annealing algorithm implementation.
 *
 * Implements the SolverStrategy interface for pluggable solver support.
 * Optimizes Layout by mutating pad assignments and accepting solutions
 * based on the Metropolis criterion. Supports configurable restarts.
 */
export class AnnealingSolver implements SolverStrategy {
  public readonly name = 'Simulated Annealing';
  public readonly type: SolverType = 'annealing';
  public readonly isSynchronous = false;

  private instrumentConfig: SolverConfig['instrumentConfig'];
  private initialLayout: Layout | null;
  private neutralPadPositionsOverride: NeutralPadPositions | null = null;
  private initialPadOwnership: SolverConfig['initialPadOwnership'];
  private bestLayout: Layout | null = null;
  private seed: number;
  private annealingConfig: AnnealingConfig;
  /** Cancel, clock and progress for the solve (see runControl.ts). */
  private runControl: AnnealingRunControl;
  /** The user's finger preferences, applied to every evaluation of the run. */
  private manualAssignments: Record<string, { hand: 'left' | 'right'; finger: FingerType }> | undefined;

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.initialLayout = config.layout ?? null;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    // Pose0 pad→finger pre-seed. Positional (keyed by pad), so it stays valid as
    // annealing moves voices between pads. Forwarding it to the internal beam
    // evaluations gives annealing the same natural-finger head-start the "Quick"
    // (beam-only) path already gets — without it, annealing produced far more
    // unplayable events than the quick arrangement.
    this.initialPadOwnership = config.initialPadOwnership;
    this.seed = config.seed ?? Math.floor(Math.random() * 0x7fffffff);
    this.annealingConfig = config.annealingConfig ?? FAST_ANNEALING_CONFIG;
    this.runControl = config.runControl ?? {};
  }

  /**
   * Gets the best Layout found during the last solve() call.
   * Returns null if solve() hasn't been called yet.
   */
  public getBestLayout(): Layout | null {
    return this.bestLayout;
  }

  /**
   * Evaluates the cost of a Layout by running Beam Search.
   * Invalid candidates (unmapped notes) return Infinity and are always rejected.
   */
  private async evaluateLayoutCost(
    layout: Layout,
    performance: Performance,
    config: EngineConfiguration,
    beamWidth: number
  ): Promise<{ result: ExecutionPlanResult; cost: number; relaxedStrikes?: number; invalidReason?: string }> {
    // Enforce full coverage: unmapped candidates are invalid
    const coverage = computeMappingCoverage(performance, layout);
    if (coverage.unmappedNotes.length > 0) {
      const sentinelResult: ExecutionPlanResult = {
        score: 0,
        unplayableCount: performance.events.length,
        hardCount: 0,
        fingerAssignments: [],
        fingerUsageStats: {},
        fatigueMap: {},
        averageDrift: 0,
        averageMetrics: {
          fingerPreference: 0, handShapeDeviation: 0, alternation: 0, transitionCost: 0,
          handBalance: 0, constraintPenalty: 0, total: Number.POSITIVE_INFINITY,
        },
        metadata: {
          layoutCoverage: {
            totalNotes: coverage.totalNotes,
            unmappedNotesCount: coverage.unmappedNotes.length,
            fallbackNotesCount: 0,
          },
          invalidReason: 'invalid_unmapped_notes',
        },
      };
      return {
        result: sentinelResult,
        cost: Number.POSITIVE_INFINITY,
        invalidReason: 'invalid_unmapped_notes',
      };
    }

    // Create a BeamSolver with strict mode (no fallback during optimization)
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      layout,
      neutralPadPositionsOverride: this.neutralPadPositionsOverride,
      initialPadOwnership: this.initialPadOwnership,
      mappingResolverMode: 'strict',
    };

    const beamSolver = createBeamSolver(solverConfig);

    const evaluationConfig: EngineConfiguration = {
      ...config,
      beamWidth,
    };

    // Preferences are keyed by event, not by pad, so they stay valid as
    // annealing moves Sounds between pads. Evaluating every candidate layout
    // under them means the layout is chosen for how it plays WITH the user's
    // fingering, not for a fingering the final plan then has to abandon.
    const result = await beamSolver.solve(performance, evaluationConfig, this.manualAssignments);
    const relaxedStrikes = countRelaxedStrikes(result);

    return {
      result,
      cost: result.averageMetrics.total + RELAXED_STRIKE_PENALTY * relaxedStrikes,
      relaxedStrikes,
    };
  }

  /** Deep-copy a Layout to prevent shared mutation. Locks travel with it. */
  private deepCopyLayout(layout: Layout): Layout {
    return {
      ...layout,
      padToVoice: { ...layout.padToVoice },
      fingerConstraints: { ...layout.fingerConstraints },
      placementLocks: { ...(layout.placementLocks ?? {}) },
    };
  }

  /**
   * Applies a mutation, choosing between standard and zone transfer
   * based on the config's useZoneTransfer flag.
   */
  private applyMutation(layout: Layout, rng: () => number): Layout {
    if (this.annealingConfig.useZoneTransfer && rng() < 0.05) {
      return applyZoneTransferMutation(layout, rng);
    }
    return applyRandomMutation(layout, rng);
  }

  /**
   * Solves the performance optimization problem using Simulated Annealing.
   *
   * The algorithm:
   * 1. Starts with the current Layout
   * 2. Runs restartCount+1 SA trajectories (reheating each time)
   * 3. Each trajectory mutates the layout and evaluates cost via beam search
   * 4. Accepts better solutions or probabilistically accepts worse ones
   * 5. Cools temperature each iteration
   * 6. After all restarts, runs final high-quality Beam Search on best layout
   *
   * Budgets (AnnealingConfig): an iteration budget sizes each restart (see
   * planAnnealingRun); a wall-clock budget gives each restart an equal share
   * of the time, so every restart starts. A restart whose share runs out stops
   * early, the run keeps the best layout found so far, and the telemetry and
   * the trace say 'time_budget'. Cancel (runControl.signal) throws
   * GenerationCancelledError at the next iteration.
   *
   * The clock (runControl.now) is read once when the solve starts, once per
   * iteration and once at the end, so an injected clock steps predictably.
   */
  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): Promise<ExecutionPlanResult> {
    if (!this.initialLayout) {
      throw new Error('AnnealingSolver requires an initial Layout. Cannot optimize an empty layout.');
    }

    this.manualAssignments = manualAssignments;
    const ac = this.annealingConfig;
    const plan = planAnnealingRun(ac);
    const restartCount = plan.iterationsPerRestart.length - 1;
    const { signal, onProgress } = this.runControl;
    const now = this.runControl.now ?? Date.now;
    const yielder = new Yielder(signal);
    throwIfCancelled(signal);
    const startWallClock = now();
    // Each restart's share of the wall-clock budget ends at a fixed point from
    // the start, so time a restart leaves unused passes to the next one.
    const timeShare = ac.timeBudgetMs !== undefined
      ? Math.max(0, ac.timeBudgetMs) / (restartCount + 1)
      : Number.POSITIVE_INFINITY;

    // Deep copy initial layout
    let currentLayout = this.deepCopyLayout(this.initialLayout);

    // Calculate initial cost
    const initialEvaluation = await this.evaluateLayoutCost(
      currentLayout, performance, config, ac.fastBeamWidth
    );
    let currentCost = initialEvaluation.cost;
    const initialCost = currentCost;
    // The same costs without the rule penalty, for telemetry a person reads.
    const initialErgonomicCost = initialEvaluation.result.averageMetrics.total;

    // Fail early if initial layout is invalid
    if (
      !Number.isFinite(currentCost) ||
      currentCost === Number.POSITIVE_INFINITY ||
      initialEvaluation.invalidReason
    ) {
      throw new Error(
        'Initial layout does not cover all sounds. Seed the layout from Pose0 or assign all required notes before optimizing.'
      );
    }

    // Track the global best layout across all restarts
    let globalBestLayout = this.deepCopyLayout(currentLayout);
    let globalBestCost = currentCost;
    let globalBestErgonomicCost = initialErgonomicCost;

    const rng = createSeededRng(this.seed);
    const annealingTrace: AnnealingIterationSnapshot[] = [];

    // Telemetry counters
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalInvalid = 0;
    let improvementCount = 0;
    const restartBestCosts: number[] = [];
    const completedIterationsPerRestart: number[] = [];
    const restartsStoppedByTime: number[] = [];
    const totalIterations = plan.total;
    const costAtMilestones = { pct25: 0, pct50: 0, pct75: 0, pct100: 0 };
    let globalStep = 0;
    let clock = startWallClock;
    const reportProgress = (restartIndex: number) => onProgress?.({
      iteration: globalStep,
      iterationsPlanned: totalIterations,
      restartIndex,
      runs: restartCount + 1,
      elapsedMs: clock - startWallClock,
    });

    // ====================================================================
    // Restart Loop
    // ====================================================================
    for (let restart = 0; restart <= restartCount; restart++) {
      // Reset for this restart
      if (restart === 0) {
        currentLayout = this.deepCopyLayout(this.initialLayout);
        currentCost = initialCost;
      } else {
        // Start each restart from the global best found so far
        currentLayout = this.deepCopyLayout(globalBestLayout);
        currentCost = globalBestCost;
      }

      let currentTemp = ac.initialTemp;
      const iterations = plan.iterationsPerRestart[restart];
      const coolingRate = plan.coolingRates[restart];
      const deadline = startWallClock + (restart + 1) * timeShare;
      let completed = 0;
      reportProgress(restart);

      // ================================================================
      // SA Iteration Loop
      // ================================================================
      for (let step = 0; step < iterations; step++) {
        throwIfCancelled(signal);
        clock = now();
        // Every restart runs at least one iteration, so every restart starts.
        if (step > 0 && clock >= deadline) {
          annealingTrace[annealingTrace.length - 1].stoppedBy = 'time_budget';
          restartsStoppedByTime.push(restart);
          break;
        }

        const candidateLayout = this.applyMutation(currentLayout, rng);

        const candidateEvaluation = await this.evaluateLayoutCost(
          candidateLayout, performance, config, ac.fastBeamWidth
        );
        const candidateCost = candidateEvaluation.cost;

        const candidateInvalid =
          !Number.isFinite(candidateCost) || candidateCost === Number.POSITIVE_INFINITY;

        let accepted = false;
        let acceptanceProbability: number | undefined = undefined;

        if (candidateInvalid) {
          accepted = false;
          totalInvalid++;
        } else {
          const delta = candidateCost - currentCost;
          if (delta < 0) {
            accepted = true;
          } else if (delta > 0 && Number.isFinite(currentCost) && currentCost > 0) {
            acceptanceProbability = Math.exp(-delta / currentTemp);
            accepted = rng() < acceptanceProbability;
          } else {
            accepted = true;
          }
        }

        if (accepted) {
          totalAccepted++;
          currentLayout = candidateLayout;
          currentCost = candidateCost;

          if (candidateCost < globalBestCost) {
            globalBestLayout = this.deepCopyLayout(candidateLayout);
            globalBestCost = candidateCost;
            globalBestErgonomicCost = candidateEvaluation.result.averageMetrics.total;
            improvementCount++;
          }
        } else if (!candidateInvalid) {
          totalRejected++;
        }

        // Compute per-metric sums from finger assignments
        const playableEvents = candidateEvaluation.result.fingerAssignments.filter(
          e => e.assignedHand !== 'Unplayable' && e.costBreakdown
        );

        let transitionSum = 0, fingerPrefSum = 0, shapeDevSum = 0;
        let handBalanceSum = 0, constraintPenaltySum = 0;

        for (const event of playableEvents) {
          if (event.costBreakdown) {
            transitionSum += event.costBreakdown.transitionCost;
            fingerPrefSum += event.costBreakdown.fingerPreference;
            shapeDevSum += event.costBreakdown.handShapeDeviation;
            handBalanceSum += event.costBreakdown.handBalance;
            constraintPenaltySum += event.costBreakdown.constraintPenalty;
          }
        }

        const deltaCost = candidateInvalid ? 0 : candidateCost - currentCost;

        annealingTrace.push({
          iteration: step,
          temperature: currentTemp,
          currentCost,
          bestCost: globalBestCost,
          accepted,
          deltaCost,
          acceptanceProbability,
          transitionSum,
          fingerPreferenceSum: fingerPrefSum,
          handShapeDeviationSum: shapeDevSum,
          handBalanceSum,
          constraintPenaltySum,
          relaxedStrikes: candidateEvaluation.relaxedStrikes ?? 0,
          restartIndex: restart,
        });

        // Cooling
        currentTemp *= coolingRate;

        // Track cost at milestone iterations
        globalStep++;
        completed++;
        if (globalStep === Math.floor(totalIterations * 0.25)) costAtMilestones.pct25 = globalBestCost;
        if (globalStep === Math.floor(totalIterations * 0.50)) costAtMilestones.pct50 = globalBestCost;
        if (globalStep === Math.floor(totalIterations * 0.75)) costAtMilestones.pct75 = globalBestCost;

        // Yield on elapsed time (about every 50 ms), so the page can paint
        // progress and take a Cancel click; yielding never changes the result.
        if (yielder.due()) {
          reportProgress(restart);
          await yielder.yield();
        }
      }

      restartBestCosts.push(globalBestCost);
      completedIterationsPerRestart.push(completed);
    }

    costAtMilestones.pct100 = globalBestCost;
    // Milestones a time-limited run never reached hold the best it ended with, not 0.
    if (globalStep < Math.floor(totalIterations * 0.25)) costAtMilestones.pct25 = globalBestCost;
    if (globalStep < Math.floor(totalIterations * 0.50)) costAtMilestones.pct50 = globalBestCost;
    if (globalStep < Math.floor(totalIterations * 0.75)) costAtMilestones.pct75 = globalBestCost;
    throwIfCancelled(signal);

    // Store the best layout
    this.bestLayout = this.deepCopyLayout(globalBestLayout);

    // Final high-quality evaluation on best layout
    const finalSolverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      layout: globalBestLayout,
      neutralPadPositionsOverride: this.neutralPadPositionsOverride,
      initialPadOwnership: this.initialPadOwnership,
    };

    const finalBeamSolver = createBeamSolver(finalSolverConfig);
    const finalConfig: EngineConfiguration = {
      ...config,
      beamWidth: ac.finalBeamWidth,
    };

    const finalResult = await finalBeamSolver.solve(
      performance, finalConfig, manualAssignments
    );

    const wallClockMs = now() - startWallClock;
    const iterationsCompleted = globalStep;
    const totalDecisions = totalAccepted + totalRejected;

    const solverTelemetry: SolverTelemetry = {
      optimizationMode: ac === FAST_ANNEALING_CONFIG ? 'fast' : 'deep',
      wallClockMs,
      iterationsCompleted,
      restartCount,
      restartBestCosts,
      totalAccepted,
      totalRejected,
      totalInvalid,
      acceptanceRate: totalDecisions > 0 ? totalAccepted / totalDecisions : 0,
      improvementCount,
      improvementRate: iterationsCompleted > 0 ? improvementCount / iterationsCompleted : 0,
      // Reported on the ergonomic cost, without the rule penalty: a ratio mixing
      // the two described neither.
      finalCostImprovement: initialErgonomicCost > 0 && Number.isFinite(initialErgonomicCost)
        ? (initialErgonomicCost - globalBestErgonomicCost) / initialErgonomicCost
        : 0,
      initialErgonomicCost,
      stopReason: restartsStoppedByTime.length > 0 ? 'time_budget' : 'completed',
      ...(ac.iterationBudget !== undefined ? { iterationBudget: ac.iterationBudget } : {}),
      ...(ac.timeBudgetMs !== undefined ? { timeBudgetMs: ac.timeBudgetMs } : {}),
      plannedIterationsPerRestart: plan.iterationsPerRestart,
      completedIterationsPerRestart,
      restartsStoppedByTime,
      costAtMilestones,
    };

    return {
      ...finalResult,
      annealingTrace,
      metadata: {
        ...finalResult.metadata,
        seed: this.seed,
        objectiveTotal: finalResult.averageMetrics.total,
        objectiveComponentsSummary: finalResult.metadata?.objectiveComponentsSummary,
        solverTelemetry,
      },
    };
  }
}

/** Factory function to create an AnnealingSolver instance. */
export function createAnnealingSolver(config: SolverConfig): AnnealingSolver {
  return new AnnealingSolver(config);
}

/**
 * An annealing plan's run as the method-agnostic OptimizerTelemetry and stop
 * reason (the optimizer output contract), budgets included.
 */
export function annealingRunSummary(
  plan: ExecutionPlanResult,
  wallClockMs?: number,
): { stopReason: 'completed' | 'time_budget'; telemetry: OptimizerTelemetry } {
  const solver = plan.metadata?.solverTelemetry;
  // Prefer the initial cost the solver recorded. Back-computing it from the
  // improvement ratio is only a fallback; an improvement at or above 1 (final
  // cost reached 0) would divide by zero or flip sign.
  const improvementRatio = solver?.finalCostImprovement || 0;
  const initialCost = solver?.initialErgonomicCost
    ?? (improvementRatio > 0 && improvementRatio < 1
      ? plan.averageMetrics.total / (1 - improvementRatio)
      : plan.averageMetrics.total);
  const planned = solver?.plannedIterationsPerRestart;
  return {
    stopReason: solver?.stopReason ?? 'completed',
    telemetry: {
      wallClockMs: wallClockMs ?? solver?.wallClockMs ?? 0,
      iterationsCompleted: solver?.iterationsCompleted ?? 0,
      movesEvaluated: solver?.iterationsCompleted,
      movesAccepted: solver?.totalAccepted,
      movesRejected: solver?.totalRejected,
      initialCost,
      finalCost: plan.averageMetrics.total,
      improvement: solver?.finalCostImprovement ?? 0,
      seed: plan.metadata?.seed,
      ...(solver?.iterationBudget !== undefined ? { iterationBudget: solver.iterationBudget } : {}),
      ...(solver?.timeBudgetMs !== undefined ? { timeBudgetMs: solver.timeBudgetMs } : {}),
      ...(planned ? { iterationsPlanned: planned.reduce((sum, n) => sum + n, 0) } : {}),
      ...(solver?.restartsStoppedByTime ? { restartsStoppedByTime: solver.restartsStoppedByTime } : {}),
    },
  };
}
