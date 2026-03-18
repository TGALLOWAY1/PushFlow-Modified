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
import { applyRandomMutation, applyZoneTransferMutation } from './mutationService';
import { computeMappingCoverage } from '../mapping/mappingCoverage';
import { createSeededRng } from '../../utils/seededRng';

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
  private bestLayout: Layout | null = null;
  private seed: number;
  private annealingConfig: AnnealingConfig;

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.initialLayout = config.layout ?? null;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.seed = config.seed ?? Math.floor(Math.random() * 0x7fffffff);
    this.annealingConfig = config.annealingConfig ?? FAST_ANNEALING_CONFIG;
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
  ): Promise<{ result: ExecutionPlanResult; cost: number; invalidReason?: string }> {
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
          fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0,
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
      mappingResolverMode: 'strict',
    };

    const beamSolver = createBeamSolver(solverConfig);

    const evaluationConfig: EngineConfiguration = {
      ...config,
      beamWidth,
    };

    const result = await beamSolver.solve(performance, evaluationConfig);

    return {
      result,
      cost: result.averageMetrics.total,
    };
  }

  /** Deep-copy a Layout to prevent shared mutation. */
  private deepCopyLayout(layout: Layout): Layout {
    return {
      ...layout,
      padToVoice: { ...layout.padToVoice },
      fingerConstraints: { ...layout.fingerConstraints },
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
   */
  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): Promise<ExecutionPlanResult> {
    if (!this.initialLayout) {
      throw new Error('AnnealingSolver requires an initial Layout. Cannot optimize an empty layout.');
    }

    const ac = this.annealingConfig;
    const iterations = Math.max(1, ac.iterations);
    const restartCount = Math.max(0, ac.restartCount);
    const startWallClock = Date.now();

    // Deep copy initial layout
    let currentLayout = this.deepCopyLayout(this.initialLayout);

    // Calculate initial cost
    const initialEvaluation = await this.evaluateLayoutCost(
      currentLayout, performance, config, ac.fastBeamWidth
    );
    let currentCost = initialEvaluation.cost;
    const initialCost = currentCost;

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

    const rng = createSeededRng(this.seed);
    const annealingTrace: AnnealingIterationSnapshot[] = [];

    // Telemetry counters
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalInvalid = 0;
    let improvementCount = 0;
    const restartBestCosts: number[] = [];
    const totalIterations = iterations * (restartCount + 1);
    const costAtMilestones = { pct25: 0, pct50: 0, pct75: 0, pct100: 0 };
    let globalStep = 0;

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

      // ================================================================
      // SA Iteration Loop
      // ================================================================
      for (let step = 0; step < iterations; step++) {
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
          restartIndex: restart,
        });

        // Cooling
        currentTemp *= ac.coolingRate;

        // Track cost at milestone iterations
        globalStep++;
        if (globalStep === Math.floor(totalIterations * 0.25)) costAtMilestones.pct25 = globalBestCost;
        if (globalStep === Math.floor(totalIterations * 0.50)) costAtMilestones.pct50 = globalBestCost;
        if (globalStep === Math.floor(totalIterations * 0.75)) costAtMilestones.pct75 = globalBestCost;

        // Yield to prevent UI freezing
        if (step % 50 === 0 && step > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      restartBestCosts.push(globalBestCost);

      // Yield between restarts
      if (restart < restartCount) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    costAtMilestones.pct100 = globalBestCost;

    // Store the best layout
    this.bestLayout = this.deepCopyLayout(globalBestLayout);

    // Final high-quality evaluation on best layout
    const finalSolverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      layout: globalBestLayout,
      neutralPadPositionsOverride: this.neutralPadPositionsOverride,
    };

    const finalBeamSolver = createBeamSolver(finalSolverConfig);
    const finalConfig: EngineConfiguration = {
      ...config,
      beamWidth: ac.finalBeamWidth,
    };

    const finalResult = await finalBeamSolver.solve(
      performance, finalConfig, manualAssignments
    );

    const wallClockMs = Date.now() - startWallClock;
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
      finalCostImprovement: initialCost > 0 ? (initialCost - globalBestCost) / initialCost : 0,
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
