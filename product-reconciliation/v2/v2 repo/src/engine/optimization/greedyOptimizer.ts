/**
 * Greedy / Hill-Climbing Optimizer.
 *
 * A highly interpretable optimization method that:
 * 1. Builds an initial layout by placing sounds one at a time (greedy init)
 * 2. Assigns fingers based on pad positions (column-based heuristic)
 * 3. Iteratively makes the single best local move (hill climbing)
 *
 * Each move is explainable in plain language:
 * - "Moved Snare from (3,4) to (3,3) because total cost decreased by 2.4"
 * - "Reassigned finger on pad (3,4) from R-Ix to R-Md because grip cost improved"
 *
 * The optimizer uses the canonical evaluator for all scoring,
 * ensuring cost consistency with other methods.
 */

import {
  type OptimizerMethod,
  type OptimizerInput,
  type OptimizerOutput,
  type OptimizerMove,
  type OptimizerTelemetry,
  type StopReason,
} from './optimizerInterface';
import { registerOptimizer } from './optimizerRegistry';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../structure/momentBuilder';
import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type Voice } from '../../types/voice';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type CostToggles } from '../../types/costToggles';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type PerformanceCostBreakdown } from '../../types/costBreakdown';
import { generateId } from '../../utils/idGenerator';
import {
  buildCooccurrenceMatrix,
  buildSoundFrequency,
  buildFingerAssignmentFromLayout,
  assignFingerForPad,
  getAdjacentPads,
  parsePadKey,
  getEmptyPadPositions,
  scorePlacement,
} from './greedyEvaluation';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 200;
const MAX_MOVES_PER_ITERATION = 500;

// ============================================================================
// Greedy Optimizer
// ============================================================================

class GreedyOptimizer implements OptimizerMethod {
  readonly key = 'greedy' as const;
  readonly name = 'Greedy Hill Climb';
  readonly description = 'Interpretable step-by-step optimizer. Builds layout greedily, then improves via local moves.';
  readonly supportsStepHistory = true;

  async optimize(input: OptimizerInput): Promise<OptimizerOutput> {
    const startTime = Date.now();
    const maxIterations = input.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const moveHistory: OptimizerMove[] = [];
    let movesEvaluated = 0;

    // Build moments from performance
    const moments = buildPerformanceMoments(input.performance.events);
    if (moments.length === 0) {
      return buildEmptyOutput(input, startTime);
    }

    // ── Phase A: Greedy Initial Layout ─────────────────────────
    let layout: Layout;
    const hasExistingLayout = Object.keys(input.layout.padToVoice).length > 0;

    if (hasExistingLayout) {
      // Use existing layout as starting point
      layout = deepCopyLayout(input.layout);
    } else {
      // Build layout from scratch using greedy placement
      layout = await this.greedyInitLayout(
        input, moments, moveHistory,
      );
    }

    // Yield to prevent UI freeze
    await yieldControl();

    // ── Phase B: Initial Finger Assignment ─────────────────────
    let assignment = buildFingerAssignmentFromLayout(layout);

    // Initial evaluation
    let currentCost = this.evaluateLayout(
      moments, layout, assignment, input.evaluationConfig, input.costToggles,
    );
    const initialCost = currentCost.total;

    moveHistory.push({
      iteration: -1,
      type: 'pad_move',
      description: `Initial layout: ${Object.keys(layout.padToVoice).length} sounds placed, cost = ${initialCost.toFixed(2)}`,
      costBefore: initialCost,
      costAfter: initialCost,
      costDelta: 0,
      reason: 'Initialization complete',
      phase: 'init-fingers',
    });

    // ── Phase C: Hill-Climbing Local Improvement ───────────────
    let stopReason: StopReason = 'iteration_cap';

    for (let iter = 0; iter < maxIterations; iter++) {
      // Enumerate all candidate moves
      const candidateMoves = this.enumerateMoves(layout, assignment, input);
      if (candidateMoves.length === 0) {
        stopReason = 'infeasible_neighborhood';
        break;
      }

      // Evaluate each move
      let bestMove: CandidateMove | null = null;
      let bestCost = currentCost.total;
      let movesChecked = 0;

      for (const move of candidateMoves) {
        if (movesChecked >= MAX_MOVES_PER_ITERATION) break;
        movesChecked++;
        movesEvaluated++;

        // Apply move tentatively
        const { newLayout, newAssignment } = this.applyMove(layout, assignment, move);

        // Evaluate
        const newCostResult = this.evaluateLayout(
          moments, newLayout, newAssignment, input.evaluationConfig, input.costToggles,
        );

        if (newCostResult.total < bestCost) {
          bestCost = newCostResult.total;
          bestMove = { ...move, newLayout, newAssignment, costResult: newCostResult };
        }
      }

      // No improving move found → local minimum
      if (!bestMove || bestCost >= currentCost.total) {
        stopReason = 'no_improving_move';
        break;
      }

      // Accept best move
      const costDelta = bestCost - currentCost.total;
      const moveRecord: OptimizerMove = {
        iteration: iter,
        type: bestMove.type,
        description: bestMove.description,
        costBefore: currentCost.total,
        costAfter: bestCost,
        costDelta,
        affectedVoice: bestMove.voiceName,
        affectedPad: bestMove.padKey,
        secondaryPad: bestMove.secondaryPadKey,
        reason: `Total cost decreased by ${Math.abs(costDelta).toFixed(3)}`,
        rejectedAlternatives: movesChecked - 1,
        phase: 'hill-climb',
      };
      moveHistory.push(moveRecord);

      layout = bestMove.newLayout!;
      assignment = bestMove.newAssignment!;
      currentCost = bestMove.costResult!;

      // Yield every 10 iterations
      if (iter % 10 === 0) await yieldControl();
    }

    // ── Final Evaluation ───────────────────────────────────────
    const finalDiagnostics = this.evaluateLayout(
      moments, layout, assignment, input.evaluationConfig, input.costToggles,
    );

    // Build ExecutionPlanResult for backward compatibility
    const executionPlan = this.buildExecutionPlan(moments, layout, assignment, finalDiagnostics);

    const wallClockMs = Date.now() - startTime;
    const telemetry: OptimizerTelemetry = {
      wallClockMs,
      iterationsCompleted: moveHistory.filter(m => m.phase === 'hill-climb').length,
      movesEvaluated,
      movesAccepted: moveHistory.filter(m => m.phase === 'hill-climb').length,
      movesRejected: movesEvaluated - moveHistory.filter(m => m.phase === 'hill-climb').length,
      initialCost,
      finalCost: finalDiagnostics.total,
      improvement: initialCost > 0 ? (initialCost - finalDiagnostics.total) / initialCost : 0,
    };

    return {
      layout,
      padFingerAssignment: assignment,
      executionPlan,
      diagnostics: finalDiagnostics,
      costTogglesUsed: input.costToggles,
      moveHistory,
      stopReason,
      telemetry,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // Phase A: Greedy Initial Layout
  // ════════════════════════════════════════════════════════════════

  private async greedyInitLayout(
    input: OptimizerInput,
    _moments: PerformanceMoment[],
    moveHistory: OptimizerMove[],
  ): Promise<Layout> {
    const layout: Layout = {
      ...input.layout,
      id: generateId('layout'),
      padToVoice: {},
      layoutMode: 'optimized' as const,
    };

    // Get all unique voices from the performance
    const voiceMap = new Map<string, Voice>();
    for (const [_pk, voice] of Object.entries(input.layout.padToVoice)) {
      voiceMap.set(voice.id ?? String(voice.originalMidiNote), voice);
    }

    // If no voices in layout, extract from performance events
    if (voiceMap.size === 0) {
      for (const event of input.performance.events) {
        const id = event.voiceId ?? String(event.noteNumber);
        if (!voiceMap.has(id)) {
          voiceMap.set(id, {
            id,
            name: `Sound ${event.noteNumber}`,
            sourceType: 'midi_track',
            sourceFile: '',
            originalMidiNote: event.noteNumber,
            color: '#888888',
          });
        }
      }
    }

    // Sort sounds by frequency (most used first)
    const frequency = buildSoundFrequency(input.performance.events);
    const sortedSounds = [...voiceMap.entries()]
      .sort((a, b) => (frequency.get(b[0]) ?? 0) - (frequency.get(a[0]) ?? 0));

    // Build co-occurrence matrix
    const cooccurrence = buildCooccurrenceMatrix(input.performance.events);

    // Place sounds one at a time
    for (const [soundId, voice] of sortedSounds) {
      const emptyPads = getEmptyPadPositions(
        layout,
        input.instrumentConfig.rows,
        input.instrumentConfig.cols,
      );
      if (emptyPads.length === 0) break;

      // Score each empty pad
      let bestPad = emptyPads[0];
      let bestScore = Infinity;

      for (const pad of emptyPads) {
        const score = scorePlacement(
          pad, soundId, layout, cooccurrence, input.costToggles,
        );
        if (score < bestScore) {
          bestScore = score;
          bestPad = pad;
        }
      }

      // Place the sound
      const padKey = `${bestPad.row},${bestPad.col}`;
      layout.padToVoice[padKey] = voice;

      moveHistory.push({
        iteration: moveHistory.length,
        type: 'pad_move',
        description: `Placed ${voice.name ?? soundId} at (${bestPad.row},${bestPad.col})`,
        costBefore: 0,
        costAfter: 0,
        costDelta: 0,
        affectedVoice: voice.name ?? soundId,
        affectedPad: padKey,
        reason: `Best placement score: ${bestScore.toFixed(2)} (${emptyPads.length} candidates)`,
        rejectedAlternatives: emptyPads.length - 1,
        phase: 'init-layout',
      });
    }

    return layout;
  }

  // ════════════════════════════════════════════════════════════════
  // Move Enumeration
  // ════════════════════════════════════════════════════════════════

  private enumerateMoves(
    layout: Layout,
    assignment: PadFingerAssignment,
    input: OptimizerInput,
  ): CandidateMove[] {
    const moves: CandidateMove[] = [];
    const rows = input.instrumentConfig.rows;
    const cols = input.instrumentConfig.cols;
    const lockedPads = new Set(Object.values(layout.placementLocks ?? {}));

    for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
      // Skip locked pads
      if (lockedPads.has(padKey)) continue;

      const pad = parsePadKey(padKey);
      const voiceName = voice.name ?? voice.id ?? String(voice.originalMidiNote);

      // Move type 1: Move to adjacent empty pad
      const neighbors = getAdjacentPads(pad.row, pad.col, rows, cols);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.row},${neighbor.col}`;
        if (!layout.padToVoice[neighborKey]) {
          moves.push({
            type: 'pad_move',
            description: `Move ${voiceName} from (${pad.row},${pad.col}) to (${neighbor.row},${neighbor.col})`,
            padKey,
            targetPadKey: neighborKey,
            voiceId: voice.id,
            voiceName,
          });
        }
      }

      // Move type 2: Swap with another occupied pad
      for (const [otherPadKey, otherVoice] of Object.entries(layout.padToVoice)) {
        if (otherPadKey === padKey) continue;
        if (lockedPads.has(otherPadKey)) continue;

        // Only enumerate swaps once (avoid A↔B and B↔A)
        if (padKey > otherPadKey) continue;

        const otherName = otherVoice.name ?? otherVoice.id ?? String(otherVoice.originalMidiNote);
        moves.push({
          type: 'pad_swap',
          description: `Swap ${voiceName} at (${pad.row},${pad.col}) with ${otherName} at ${otherPadKey}`,
          padKey,
          targetPadKey: otherPadKey,
          secondaryPadKey: otherPadKey,
          voiceId: voice.id,
          voiceName,
        });
      }

      // Move type 3: Finger reassignment
      const currentAssignment = assignment[padKey];
      if (currentAssignment) {
        // Try the other valid fingers for this pad's hand zone
        const availableFingers = getValidFingersForPad(pad.col);
        for (const { hand, finger } of availableFingers) {
          if (hand === currentAssignment.hand && finger === currentAssignment.finger) continue;
          moves.push({
            type: 'finger_reassignment',
            description: `Reassign ${voiceName} at (${pad.row},${pad.col}) from ${currentAssignment.hand[0].toUpperCase()}-${currentAssignment.finger} to ${hand[0].toUpperCase()}-${finger}`,
            padKey,
            targetPadKey: padKey,
            voiceId: voice.id,
            voiceName,
            newHand: hand,
            newFinger: finger,
          });
        }
      }
    }

    return moves;
  }

  // ════════════════════════════════════════════════════════════════
  // Move Application
  // ════════════════════════════════════════════════════════════════

  private applyMove(
    layout: Layout,
    assignment: PadFingerAssignment,
    move: CandidateMove,
  ): { newLayout: Layout; newAssignment: PadFingerAssignment } {
    const newLayout = deepCopyLayout(layout);
    let newAssignment = { ...assignment };

    switch (move.type) {
      case 'pad_move': {
        // Move voice from padKey to targetPadKey
        const voice = newLayout.padToVoice[move.padKey];
        delete newLayout.padToVoice[move.padKey];
        newLayout.padToVoice[move.targetPadKey] = voice;

        // Update finger assignment
        delete newAssignment[move.padKey];
        const target = parsePadKey(move.targetPadKey);
        newAssignment[move.targetPadKey] = assignFingerForPad(target.row, target.col);
        break;
      }

      case 'pad_swap': {
        // Swap voices between padKey and targetPadKey
        const voiceA = newLayout.padToVoice[move.padKey];
        const voiceB = newLayout.padToVoice[move.targetPadKey];
        newLayout.padToVoice[move.padKey] = voiceB;
        newLayout.padToVoice[move.targetPadKey] = voiceA;
        // Assignment stays the same (fingers tied to pad position, not voice)
        break;
      }

      case 'finger_reassignment': {
        if (move.newHand && move.newFinger) {
          newAssignment = { ...newAssignment };
          newAssignment[move.padKey] = { hand: move.newHand, finger: move.newFinger };
        }
        break;
      }
    }

    return { newLayout, newAssignment };
  }

  // ════════════════════════════════════════════════════════════════
  // Evaluation
  // ════════════════════════════════════════════════════════════════

  private evaluateLayout(
    moments: PerformanceMoment[],
    layout: Layout,
    assignment: PadFingerAssignment,
    evaluationConfig: EvaluationConfig,
    costToggles: CostToggles,
  ): PerformanceCostBreakdown {
    return evaluatePerformance({
      moments,
      layout,
      padFingerAssignment: assignment,
      config: evaluationConfig,
      costToggles,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // Build ExecutionPlanResult (backward compatibility)
  // ════════════════════════════════════════════════════════════════

  private buildExecutionPlan(
    moments: PerformanceMoment[],
    _layout: Layout,
    assignment: PadFingerAssignment,
    diagnostics: PerformanceCostBreakdown,
  ): import('../../types/executionPlan').ExecutionPlanResult {
    // Build per-event finger assignments from moments + assignment
    const fingerAssignments: import('../../types/executionPlan').FingerAssignment[] = [];
    let unplayableCount = 0;
    let hardCount = 0;

    for (const moment of moments) {
      for (const note of moment.notes) {
        const padKey = note.padId;
        const owner = assignment[padKey];

        if (!owner || !padKey) {
          fingerAssignments.push({
            noteNumber: note.noteNumber,
            voiceId: note.soundId,
            startTime: moment.startTime,
            assignedHand: 'Unplayable',
            finger: null,
            cost: 0,
            difficulty: 'Unplayable',
          });
          unplayableCount++;
          continue;
        }

        const pad = parsePadKey(padKey);
        fingerAssignments.push({
          noteNumber: note.noteNumber,
          voiceId: note.soundId,
          startTime: moment.startTime,
          assignedHand: owner.hand,
          finger: owner.finger,
          cost: 0,
          difficulty: 'Easy',
          row: pad.row,
          col: pad.col,
          padId: padKey,
        });
      }
    }

    // Build finger usage stats
    const fingerUsageStats: Record<string, number> = {};
    for (const fa of fingerAssignments) {
      if (fa.finger) {
        const key = `${fa.assignedHand}:${fa.finger}`;
        fingerUsageStats[key] = (fingerUsageStats[key] ?? 0) + 1;
      }
    }

    return {
      score: diagnostics.total,
      unplayableCount,
      hardCount,
      fingerAssignments,
      padFingerOwnership: assignment,
      fingerUsageStats,
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: {
        fingerPreference: diagnostics.dimensions.poseNaturalness,
        handShapeDeviation: 0,
        transitionCost: diagnostics.dimensions.transitionCost,
        handBalance: diagnostics.dimensions.handBalance,
        constraintPenalty: diagnostics.dimensions.constraintPenalty,
        total: diagnostics.total,
      },
      metadata: {
        layoutCoverage: {
          totalNotes: fingerAssignments.length,
          unmappedNotesCount: unplayableCount,
          fallbackNotesCount: 0,
        },
      },
    };
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface CandidateMove {
  type: 'pad_move' | 'pad_swap' | 'finger_reassignment';
  description: string;
  padKey: string;
  targetPadKey: string;
  secondaryPadKey?: string;
  voiceId?: string;
  voiceName?: string;
  newHand?: HandSide;
  newFinger?: FingerType;
  // Populated after evaluation
  newLayout?: Layout;
  newAssignment?: PadFingerAssignment;
  costResult?: PerformanceCostBreakdown;
}

// ============================================================================
// Helpers
// ============================================================================

function deepCopyLayout(layout: Layout): Layout {
  return {
    ...layout,
    padToVoice: { ...layout.padToVoice },
    fingerConstraints: { ...layout.fingerConstraints },
    placementLocks: { ...layout.placementLocks },
  };
}

function getValidFingersForPad(col: number): Array<{ hand: HandSide; finger: FingerType }> {
  const fingers: Array<{ hand: HandSide; finger: FingerType }> = [];
  if (col <= 3) {
    // Left hand
    for (const f of ['index', 'middle', 'ring', 'pinky'] as FingerType[]) {
      fingers.push({ hand: 'left', finger: f });
    }
  } else {
    // Right hand
    for (const f of ['index', 'middle', 'ring', 'pinky'] as FingerType[]) {
      fingers.push({ hand: 'right', finger: f });
    }
  }
  return fingers;
}

async function yieldControl(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function buildEmptyOutput(input: OptimizerInput, startTime: number): OptimizerOutput {
  return {
    layout: input.layout,
    padFingerAssignment: {},
    executionPlan: {
      score: 0,
      unplayableCount: 0,
      hardCount: 0,
      fingerAssignments: [],
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: {
        fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0,
        handBalance: 0, constraintPenalty: 0, total: 0,
      },
    },
    diagnostics: {
      total: 0,
      dimensions: { poseNaturalness: 0, transitionCost: 0, constraintPenalty: 0, alternation: 0, handBalance: 0, total: 0 },
      eventCosts: [],
      transitionCosts: [],
      aggregateMetrics: {
        averageDimensions: { poseNaturalness: 0, transitionCost: 0, constraintPenalty: 0, alternation: 0, handBalance: 0, total: 0 },
        peakDimensions: { poseNaturalness: 0, transitionCost: 0, constraintPenalty: 0, alternation: 0, handBalance: 0, total: 0 },
        peakMomentIndex: 0, hardMomentCount: 0, infeasibleMomentCount: 0, momentCount: 0, transitionCount: 0,
      },
      feasibility: { level: 'feasible', summary: 'No events to evaluate', reasons: [] },
      padFingerAssignment: {},
    },
    costTogglesUsed: input.costToggles,
    moveHistory: [],
    stopReason: 'completed',
    telemetry: {
      wallClockMs: Date.now() - startTime,
      iterationsCompleted: 0,
      initialCost: 0,
      finalCost: 0,
      improvement: 0,
    },
  };
}

// ============================================================================
// Registration
// ============================================================================

const greedyOptimizer = new GreedyOptimizer();
registerOptimizer(greedyOptimizer);

export { greedyOptimizer, GreedyOptimizer };
