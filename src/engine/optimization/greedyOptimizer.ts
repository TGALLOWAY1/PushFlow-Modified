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
  type OptimizationIteration,
  type CandidateMoveRecord,
  type OptimizerTelemetry,
  type StopReason,
} from './optimizerInterface';
import { registerOptimizer } from './optimizerRegistry';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../structure/momentBuilder';
import { type Layout } from '../../types/layout';
import {
  type DifficultyLevel,
  type ExecutionPlanResult,
  type FingerAssignment,
  type FingerUsageStats,
  type MomentAssignment,
  type NoteAssignmentInfo,
  type PadFingerAssignment,
} from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type Voice } from '../../types/voice';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type CostToggles } from '../../types/costToggles';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type CostDimensions, type PerformanceCostBreakdown } from '../../types/costBreakdown';
import { generateId } from '../../utils/idGenerator';
import { createSeededRng } from '../../utils/seededRng';
import {
  type DiagnosticsPayload,
  computeTopContributors,
} from '../../types/diagnostics';
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
import {
  buildVoiceIdToPadIndex,
  buildNoteToPadIndex,
  hashLayout,
  resolveEventToPad,
} from '../mapping/mappingResolver';
import { analyzePhraseStructure } from '../structure/phraseStructure';
import {
  type UpdatePolicy,
  type EvaluatedMove,
  type UpdateContext,
  strictGreedy,
} from './updatePolicies';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 200;
const MAX_MOVES_PER_ITERATION = 500;

// ============================================================================
// Greedy Optimizer
// ============================================================================

/**
 * Options for running the greedy optimizer with custom seed and update policy.
 * Used by the greedy candidate pipeline for diverse candidate generation.
 */
export interface GreedyRunOptions {
  /** Pre-built seed layout to use instead of greedyInitLayout(). */
  seedLayout?: Layout;
  /** Update policy for hill-climb move selection (defaults to strictGreedy). */
  updatePolicy?: UpdatePolicy;
}

class GreedyOptimizer implements OptimizerMethod {
  readonly key = 'greedy' as const;
  readonly name = 'Greedy Hill Climb';
  readonly description = 'Interpretable step-by-step optimizer. Builds layout greedily, then improves via local moves.';
  readonly supportsStepHistory = true;

  async optimize(input: OptimizerInput, options?: GreedyRunOptions): Promise<OptimizerOutput> {
    const startTime = Date.now();
    const restartCount = input.config.restartCount ?? 0;

    // Build moments from performance
    const moments = buildPerformanceMoments(input.performance.events);
    if (moments.length === 0) {
      return buildEmptyOutput(input, startTime);
    }

    // Run the initial attempt plus any restarts, keeping the best result
    let bestResult = await this.runSingleAttempt(input, moments, 0, options);

    for (let attempt = 1; attempt <= restartCount; attempt++) {
      await yieldControl();
      // Each restart uses a different seed derived from the base seed
      const restartInput: OptimizerInput = {
        ...input,
        config: {
          ...input.config,
          seed: (input.config.seed ?? 0) + attempt * 7919, // Prime offset for diversity
        },
      };
      // Only use seedLayout for the first attempt; restarts use greedy init with different seeds
      const restartOptions: GreedyRunOptions | undefined = options?.updatePolicy
        ? { updatePolicy: options.updatePolicy }
        : undefined;
      const result = await this.runSingleAttempt(restartInput, moments, attempt, restartOptions);

      if (result.diagnostics.total < bestResult.diagnostics.total) {
        // Keep the better result but merge trace from all attempts
        const mergedHistory = [
          ...(bestResult.moveHistory ?? []),
          ...(result.moveHistory ?? []),
        ];
        bestResult = { ...result, moveHistory: mergedHistory };
      } else {
        // Keep existing best but append this attempt's trace
        bestResult = {
          ...bestResult,
          moveHistory: [
            ...(bestResult.moveHistory ?? []),
            ...(result.moveHistory ?? []),
          ],
          iterationTrace: [
            ...(bestResult.iterationTrace ?? []),
            ...(result.iterationTrace ?? []),
          ],
        };
      }
    }

    // Update telemetry with total wall clock
    bestResult = {
      ...bestResult,
      telemetry: {
        ...bestResult.telemetry,
        wallClockMs: Date.now() - startTime,
      },
    };

    return bestResult;
  }

  /**
   * Run a single greedy optimization attempt.
   * Each attempt has its own init, finger assignment, and hill-climbing phases.
   */
  private async runSingleAttempt(
    input: OptimizerInput,
    moments: PerformanceMoment[],
    attemptIndex: number,
    options?: GreedyRunOptions,
  ): Promise<OptimizerOutput> {
    const startTime = Date.now();
    const maxIterations = input.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const moveHistory: OptimizerMove[] = [];
    const iterationTrace: OptimizationIteration[] = [];
    let movesEvaluated = 0;

    // Analyze phrase structure once for rhythm-aware placement and hill climbing
    const phraseStructure = analyzePhraseStructure(
      input.performance.events, input.performance.tempo,
    );
    const hasRhythmStructure = phraseStructure.confidence > 0.4
      && phraseStructure.roleGroups.length > 0;
    const rhythmPeers = hasRhythmStructure
      ? phraseStructure.voicePeers
      : new Map<string, string[]>();

    // ── Phase A: Greedy Initial Layout ─────────────────────────
    let layout: Layout;

    if (options?.seedLayout && attemptIndex === 0) {
      // Use externally-provided seed layout (from candidate pipeline)
      layout = deepCopyLayout(options.seedLayout);
    } else {
      const hasExistingLayout = Object.keys(input.layout.padToVoice).length > 0;
      if (hasExistingLayout && attemptIndex === 0) {
        // Use existing layout as starting point (only for first attempt)
        layout = deepCopyLayout(input.layout);
      } else {
        // Build layout from scratch using greedy placement
        layout = await this.greedyInitLayout(
          input, moments, moveHistory, iterationTrace, attemptIndex, rhythmPeers,
        );
      }
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
      description: `[Attempt ${attemptIndex + 1}] Initial layout: ${Object.keys(layout.padToVoice).length} sounds placed, cost = ${initialCost.toFixed(2)}`,
      costBefore: initialCost,
      costAfter: initialCost,
      costDelta: 0,
      reason: 'Initialization complete',
      phase: 'init-fingers',
      attemptIndex,
    });

    // ── Phase C: Hill-Climbing Local Improvement ───────────────
    let stopReason: StopReason = 'iteration_cap';
    const updatePolicy = options?.updatePolicy ?? strictGreedy;
    const seed = input.config.seed ?? 0;
    const hillClimbRng = createSeededRng(seed + 31337); // Separate RNG for policy

    // Track rhythm peer alignment cost separately (not part of canonical evaluation)
    let currentPeerCost = computeRhythmPeerCost(layout, rhythmPeers);

    for (let iter = 0; iter < maxIterations; iter++) {
      // Enumerate all candidate moves
      const candidateMoves = this.enumerateMoves(layout, assignment, input);
      if (candidateMoves.length === 0) {
        stopReason = 'infeasible_neighborhood';
        break;
      }

      // Evaluate each move
      const evaluatedMoves: EvaluatedMove[] = [];
      const moveMap: CandidateMove[] = [];
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

        // Include rhythm peer alignment cost in move comparison
        const newPeerCost = (move.type === 'pad_move' || move.type === 'pad_swap')
          ? computeRhythmPeerCost(newLayout, rhythmPeers)
          : currentPeerCost;
        const effectiveCost = newCostResult.total + newPeerCost;
        const effectiveDelta = effectiveCost - (currentCost.total + currentPeerCost);

        const idx = evaluatedMoves.length;
        evaluatedMoves.push({
          index: idx,
          cost: effectiveCost,
          costDelta: effectiveDelta,
          breakdown: newCostResult,
          moveType: move.type,
          padKey: move.padKey,
          targetPadKey: move.targetPadKey,
        });
        moveMap.push({ ...move, newLayout, newAssignment, costResult: newCostResult });
      }

      // Use update policy to select a move
      const updateCtx: UpdateContext = {
        currentCost: currentCost.total,
        currentBreakdown: currentCost,
        iteration: iter,
        rng: hillClimbRng,
        maxIterations,
      };

      const selected = updatePolicy.selectMove(evaluatedMoves, updateCtx);

      if (!selected) {
        stopReason = 'no_improving_move';
        break;
      }

      // Accept selected move
      const stateBefore = { layout: deepCopyLayout(layout), assignment: { ...assignment } };

      const bestMove = moveMap[selected.index];
      const costDelta = selected.costDelta;
      const moveRecord: OptimizerMove = {
        iteration: iter,
        type: bestMove.type,
        description: bestMove.description,
        costBefore: currentCost.total,
        costAfter: selected.cost,
        costDelta,
        affectedVoice: bestMove.voiceName,
        affectedPad: bestMove.padKey,
        secondaryPad: bestMove.secondaryPadKey,
        reason: `Total cost ${costDelta < 0 ? 'decreased' : 'changed'} by ${Math.abs(costDelta).toFixed(3)}`,
        rejectedAlternatives: movesChecked - 1,
        phase: 'hill-climb',
        attemptIndex,
      };
      moveHistory.push(moveRecord);

      // Build CandidateMoveRecords for the Visual Debugger
      const candidateMovesRecords: CandidateMoveRecord[] = evaluatedMoves.map(em => {
        const mappedOrig = moveMap[em.index];
        return {
          moveType: em.moveType as any,
          description: mappedOrig.description,
          fromPadKey: em.padKey ?? null,
          toPadKey: em.targetPadKey ?? null,
          secondaryPadKey: mappedOrig.secondaryPadKey,
          targetId: mappedOrig.voiceId,
          voiceName: mappedOrig.voiceName,
          deltaTotal: em.costDelta,
          costBreakdown: em.breakdown,
          accepted: em.index === selected.index,
          reason: em.index === selected.index ? moveRecord.reason : undefined,
        };
      });

      iterationTrace.push({
        iterationIndex: iterationTrace.length,
        phase: 'hill-climb',
        attemptIndex,
        scoreBefore: currentCost.total,
        scoreAfter: selected.cost,
        netDelta: costDelta,
        stateBefore,
        stateAfter: { layout: bestMove.newLayout!, assignment: bestMove.newAssignment! },
        candidateMoves: candidateMovesRecords,
        chosenMove: candidateMovesRecords.find(m => m.accepted) ?? null,
        summary: moveRecord.description,
      });

      layout = bestMove.newLayout!;
      assignment = bestMove.newAssignment!;
      currentCost = bestMove.costResult!;
      currentPeerCost = computeRhythmPeerCost(layout, rhythmPeers);

      // Yield every 10 iterations
      if (iter % 10 === 0) await yieldControl();
    }

    // ── Final Evaluation ───────────────────────────────────────
    const finalDiagnostics = this.evaluateLayout(
      moments, layout, assignment, input.evaluationConfig, input.costToggles,
    );

    // Build ExecutionPlanResult for backward compatibility
    const executionPlan = this.buildExecutionPlan(
      moments,
      layout,
      assignment,
      finalDiagnostics,
      input.instrumentConfig,
    );

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
      iterationTrace,
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
    iterationTrace: OptimizationIteration[],
    attemptIndex: number = 0,
    rhythmPeersFromParent?: Map<string, string[]>,
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

    // Rhythm-aware placement: use pre-computed peer data from parent,
    // or compute fresh if not provided
    const phraseStructure = analyzePhraseStructure(
      input.performance.events, input.performance.tempo,
    );
    const hasRhythmStructure = phraseStructure.confidence > 0.4
      && phraseStructure.roleGroups.length > 0;

    const rhythmPeers = rhythmPeersFromParent
      ?? (hasRhythmStructure ? phraseStructure.voicePeers : new Map<string, string[]>());

    // Build phrasemate lookup: voiceId → other voiceIds in same phrase iteration
    const phrasemates = new Map<string, string[]>();
    if (hasRhythmStructure) {
      const phraseGroups = new Map<number, Set<string>>();
      for (const mapping of phraseStructure.roleMappings) {
        if (!phraseGroups.has(mapping.role.phraseIndex)) {
          phraseGroups.set(mapping.role.phraseIndex, new Set());
        }
        phraseGroups.get(mapping.role.phraseIndex)!.add(mapping.voiceId);
      }
      for (const voices of phraseGroups.values()) {
        for (const v of voices) {
          phrasemates.set(v, [...voices].filter(x => x !== v));
        }
      }
    }

    // Seeded RNG for placement diversity (different seeds produce different layouts)
    const seed = input.config.seed ?? 0;
    const rng = createSeededRng(seed);
    // Noise scale: seed 0 = no noise (baseline), seed > 0 = add randomness
    const noiseScale = seed === 0 ? 0 : 0.3;

    // Place sounds one at a time
    for (const [soundId, voice] of sortedSounds) {
      const emptyPads = getEmptyPadPositions(
        layout,
        input.instrumentConfig.rows,
        input.instrumentConfig.cols,
      );
      if (emptyPads.length === 0) break;

      // Score each empty pad with optional noise for diversity
      let bestPad = emptyPads[0];
      let bestScore = Infinity;

      const stateBefore = { layout: deepCopyLayout(layout), assignment: {} };
      const candidateMoves: CandidateMoveRecord[] = [];

      for (const pad of emptyPads) {
        let score = scorePlacement(
          pad, soundId, layout, cooccurrence, input.costToggles,
        );

        // Rhythm peer affinity: same hand zone + adjacent columns (different fingers)
        // Sounds that play in quick succession should be on different fingers
        // of the same hand — not the same column (same finger).
        const peers = rhythmPeers.get(soundId);
        if (peers) {
          for (const peerId of peers) {
            for (const [pk, v] of Object.entries(layout.padToVoice)) {
              if ((v.id ?? String(v.originalMidiNote)) === peerId) {
                const peerPad = parsePadKey(pk);
                const peerIsLeft = peerPad.col <= 3;
                const candidateIsLeft = pad.col <= 3;

                // Reward same hand zone (penalty for cross-hand placement)
                if (peerIsLeft !== candidateIsLeft) {
                  score += 3.0;
                }

                // Penalize same column (same finger) — rapid alternation on one finger is hard
                if (pad.col === peerPad.col) {
                  score += 4.0;
                }

                // Mild proximity within hand zone (adjacent columns are ideal)
                const colDist = Math.abs(pad.col - peerPad.col);
                if (candidateIsLeft === peerIsLeft && colDist > 0) {
                  // Within same hand: prefer adjacent columns (1 apart), mildly penalize far
                  score += Math.max(0, colDist - 1) * 0.8;
                }

                // Mild row proximity preference
                score += Math.abs(pad.row - peerPad.row) * 0.3;
                break;
              }
            }
          }
        }

        // Phrasemate hand cohesion: prefer same hand zone as already-placed phrasemates
        const mates = phrasemates.get(soundId);
        if (mates) {
          let mateLeftCount = 0;
          let mateRightCount = 0;
          for (const mateId of mates) {
            for (const [pk, v] of Object.entries(layout.padToVoice)) {
              if ((v.id ?? String(v.originalMidiNote)) === mateId) {
                const matePad = parsePadKey(pk);
                if (matePad.col <= 3) mateLeftCount++;
                else mateRightCount++;
                break;
              }
            }
          }
          if (mateLeftCount + mateRightCount > 0) {
            const padIsLeft = pad.col <= 3;
            if (padIsLeft && mateRightCount > mateLeftCount) {
              score += (mateRightCount - mateLeftCount) * 1.5;
            } else if (!padIsLeft && mateLeftCount > mateRightCount) {
              score += (mateLeftCount - mateRightCount) * 1.5;
            }
          }
        }

        // Add seeded noise for non-zero seeds to explore different placements
        if (noiseScale > 0) {
          score += (rng() - 0.5) * noiseScale * Math.max(1, Math.abs(score));
        }

        const padKey = `${pad.row},${pad.col}`;
        candidateMoves.push({
          moveType: 'pad_move',
          description: `Place ${voice.name ?? soundId} at (${pad.row},${pad.col})`,
          fromPadKey: null,
          toPadKey: padKey,
          targetId: voice.id,
          voiceName: voice.name ?? soundId,
          deltaTotal: score, // greedy init score proxy
          accepted: false,
        });

        if (score < bestScore) {
          bestScore = score;
          bestPad = pad;
        }
      }

      // Place the sound
      const padKey = `${bestPad.row},${bestPad.col}`;
      layout.padToVoice[padKey] = voice;
      
      const chosenMove = candidateMoves.find(m => m.toPadKey === padKey);
      if (chosenMove) {
        chosenMove.accepted = true;
        chosenMove.reason = `Best placement score: ${bestScore.toFixed(2)}`;
      }

      iterationTrace.push({
        iterationIndex: iterationTrace.length,
        phase: 'init-layout',
        attemptIndex,
        scoreBefore: 0,
        scoreAfter: 0, // In init, we don't eval full performance yet
        netDelta: bestScore,
        stateBefore,
        stateAfter: { layout: deepCopyLayout(layout), assignment: {} },
        candidateMoves,
        chosenMove: chosenMove ?? null,
        summary: `Placed ${voice.name ?? soundId} at (${bestPad.row},${bestPad.col})`
      });

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
        attemptIndex,
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
    layout: Layout,
    assignment: PadFingerAssignment,
    diagnostics: PerformanceCostBreakdown,
    instrumentConfig?: import('../../types/performance').InstrumentConfig,
  ): ExecutionPlanResult {
    // Build per-event finger assignments from moments + assignment
    const fingerAssignments: FingerAssignment[] = [];
    const momentAssignments: MomentAssignment[] = [];
    let unplayableCount = 0;
    let hardCount = 0;

    // Build pad resolution indices from layout (handles voiceId and noteNumber lookups)
    const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);
    const noteIndex = buildNoteToPadIndex(layout.padToVoice);
    const transitionByMoment = new Map(
      diagnostics.transitionCosts.map(transition => [transition.toMomentIndex, transition.dimensions]),
    );
    const fingerUsageStats: FingerUsageStats = {};
    let unplayableMomentCount = 0;
    let hardMomentCount = 0;
    let totalDrift = 0;
    let driftCount = 0;

    for (const moment of moments) {
      const eventDimensions = diagnostics.eventCosts[moment.momentIndex]?.dimensions;
      const transitionDimensions = transitionByMoment.get(moment.momentIndex);
      const momentDimensions = combineMomentDimensions(eventDimensions, transitionDimensions);
      const momentCostBreakdown = canonicalDimensionsToV1Breakdown(momentDimensions);
      const momentCost = momentCostBreakdown.total;
      const momentDifficulty = getDifficulty(momentCost);
      const noteAssignments: NoteAssignmentInfo[] = [];

      for (const note of moment.notes) {
        // Resolve pad from layout when padId is missing (seed layouts don't pre-populate padId)
        let padKeyStr = note.padId;
        if (!padKeyStr) {
          const resolveConfig = instrumentConfig ?? { rows: 8, cols: 8, bottomLeftNote: 36, id: '', name: '', layoutMode: 'drum_64' as const };
          const resolution = resolveEventToPad(
            { noteNumber: note.noteNumber, voiceId: note.soundId },
            voiceIdIndex,
            noteIndex,
            resolveConfig,
            'allow-fallback',
          );
          if (resolution.source !== 'unmapped') {
            padKeyStr = `${resolution.pad.row},${resolution.pad.col}`;
          }
        }

        const owner = padKeyStr ? assignment[padKeyStr] : undefined;

        if (!owner || !padKeyStr) {
          fingerAssignments.push({
            noteNumber: note.noteNumber,
            voiceId: note.soundId,
            startTime: moment.startTime,
            assignedHand: 'Unplayable',
            finger: null,
            cost: Infinity,
            costBreakdown: { ...momentCostBreakdown, total: Infinity },
            difficulty: 'Unplayable',
            eventIndex: moment.momentIndex,
            eventKey: note.noteKey,
          });
          unplayableCount++;
          continue;
        }

        const pad = parsePadKey(padKeyStr);
        const fingerKey = `${owner.hand === 'left' ? 'L' : 'R'}-${capitalizeFinger(owner.finger)}`;
        fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] ?? 0) + 1;
        totalDrift += computePadDrift(owner.hand, pad.row, pad.col);
        driftCount++;

        noteAssignments.push({
          noteNumber: note.noteNumber,
          soundId: note.soundId,
          padId: padKeyStr,
          row: pad.row,
          col: pad.col,
          hand: owner.hand,
          finger: owner.finger,
          noteKey: note.noteKey,
        });

        fingerAssignments.push({
          noteNumber: note.noteNumber,
          voiceId: note.soundId,
          startTime: moment.startTime,
          assignedHand: owner.hand,
          finger: owner.finger,
          cost: momentCost,
          costBreakdown: momentCostBreakdown,
          difficulty: momentDifficulty,
          row: pad.row,
          col: pad.col,
          padId: padKeyStr,
          eventIndex: moment.momentIndex,
          eventKey: note.noteKey,
        });
      }

      if (momentDifficulty === 'Unplayable') {
        unplayableMomentCount++;
      } else if (momentDifficulty === 'Hard') {
        hardMomentCount++;
      }

      if (momentDifficulty === 'Hard') {
        hardCount += noteAssignments.length;
      }

      momentAssignments.push({
        momentIndex: moment.momentIndex,
        startTime: moment.startTime,
        noteAssignments,
        cost: momentDifficulty === 'Unplayable' ? Infinity : momentCost,
        difficulty: momentDifficulty,
        costBreakdown: momentDifficulty === 'Unplayable'
          ? { ...momentCostBreakdown, total: Infinity }
          : momentCostBreakdown,
      });
    }

    const score = clampScore(100 - (5 * hardMomentCount) - (20 * unplayableMomentCount));
    const diagnosticsPayload = buildDiagnosticsPayload(diagnostics);

    return {
      score,
      unplayableCount,
      hardCount,
      fingerAssignments,
      padFingerOwnership: assignment,
      momentAssignments,
      unplayableMomentCount,
      hardMomentCount,
      fingerUsageStats,
      fatigueMap: {},
      averageDrift: driftCount > 0 ? totalDrift / driftCount : 0,
      averageMetrics: {
        fingerPreference: diagnostics.dimensions.poseNaturalness,
        handShapeDeviation: 0,
        transitionCost: diagnostics.dimensions.transitionCost + diagnostics.dimensions.alternation,
        handBalance: diagnostics.dimensions.handBalance,
        constraintPenalty: diagnostics.dimensions.constraintPenalty,
        total: diagnostics.total,
      },
      layoutBinding: {
        layoutId: layout.id,
        layoutHash: hashLayout(layout),
        layoutRole: layout.role ?? 'active',
      },
      diagnostics: diagnosticsPayload,
      metadata: {
        layoutIdUsed: layout.id,
        layoutHashUsed: hashLayout(layout),
        layoutCoverage: {
          totalNotes: fingerAssignments.length,
          unmappedNotesCount: unplayableCount,
          fallbackNotesCount: 0,
        },
        objectiveTotal: diagnostics.total,
        objectiveComponentsSummary: {
          transition: diagnostics.dimensions.transitionCost,
          gripNaturalness: diagnostics.dimensions.poseNaturalness,
          alternation: diagnostics.dimensions.alternation,
          handBalance: diagnostics.dimensions.handBalance,
          constraintPenalty: diagnostics.dimensions.constraintPenalty,
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

function getDifficulty(cost: number): DifficultyLevel {
  if (!Number.isFinite(cost) || cost > 100) return 'Unplayable';
  if (cost > 10) return 'Hard';
  if (cost > 3) return 'Medium';
  return 'Easy';
}

function combineMomentDimensions(
  eventDimensions?: CostDimensions,
  transitionDimensions?: CostDimensions,
): CostDimensions {
  const poseNaturalness = (eventDimensions?.poseNaturalness ?? 0) + (transitionDimensions?.poseNaturalness ?? 0);
  const transitionCost = (eventDimensions?.transitionCost ?? 0) + (transitionDimensions?.transitionCost ?? 0);
  const constraintPenalty = (eventDimensions?.constraintPenalty ?? 0) + (transitionDimensions?.constraintPenalty ?? 0);
  const alternation = (eventDimensions?.alternation ?? 0) + (transitionDimensions?.alternation ?? 0);
  const handBalance = (eventDimensions?.handBalance ?? 0) + (transitionDimensions?.handBalance ?? 0);
  return {
    poseNaturalness,
    transitionCost,
    constraintPenalty,
    alternation,
    handBalance,
    total: poseNaturalness + transitionCost + constraintPenalty + alternation + handBalance,
  };
}

function canonicalDimensionsToV1Breakdown(dimensions: CostDimensions) {
  return {
    fingerPreference: dimensions.poseNaturalness,
    handShapeDeviation: 0,
    transitionCost: dimensions.transitionCost + dimensions.alternation,
    handBalance: dimensions.handBalance,
    constraintPenalty: dimensions.constraintPenalty,
    total: dimensions.total,
  };
}

function buildDiagnosticsPayload(diagnostics: PerformanceCostBreakdown): DiagnosticsPayload {
  const factors = {
    transition: diagnostics.dimensions.transitionCost,
    gripNaturalness: diagnostics.dimensions.poseNaturalness,
    alternation: diagnostics.dimensions.alternation,
    handBalance: diagnostics.dimensions.handBalance,
    constraintPenalty: diagnostics.dimensions.constraintPenalty,
    total: diagnostics.total,
  };

  return {
    feasibility: diagnostics.feasibility,
    factors,
    topContributors: computeTopContributors(factors),
  };
}

function capitalizeFinger(finger: FingerType): string {
  return finger.charAt(0).toUpperCase() + finger.slice(1);
}

function computePadDrift(hand: 'left' | 'right', row: number, col: number): number {
  const home = hand === 'left' ? { x: 2, y: 2 } : { x: 5, y: 2 };
  return Math.sqrt(
    Math.pow(col - home.x, 2) + Math.pow(row - home.y, 2),
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
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
      momentAssignments: [],
      unplayableMomentCount: 0,
      hardMomentCount: 0,
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: {
        fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0,
        handBalance: 0, constraintPenalty: 0, total: 0,
      },
      layoutBinding: {
        layoutId: input.layout.id,
        layoutHash: hashLayout(input.layout),
        layoutRole: input.layout.role ?? 'active',
      },
      diagnostics: {
        feasibility: {
          level: 'feasible',
          summary: 'No events to evaluate',
          reasons: [],
        },
        factors: {
          transition: 0,
          gripNaturalness: 0,
          alternation: 0,
          handBalance: 0,
          constraintPenalty: 0,
          total: 0,
        },
        topContributors: [],
      },
      metadata: {
        layoutIdUsed: input.layout.id,
        layoutHashUsed: hashLayout(input.layout),
        layoutCoverage: {
          totalNotes: 0,
          unmappedNotesCount: 0,
          fallbackNotesCount: 0,
        },
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
// Rhythm Peer Alignment Cost
// ============================================================================

/**
 * Compute a cost penalty for rhythm peer column misalignment.
 * Sounds that share a rhythmic role across phrase iterations (peers) should
 * ideally be on the same grid column (same hand + finger assignment).
 *
 * Each pair is counted once. Weight: 2.0 per column of distance.
 */
function computeRhythmPeerCost(
  layout: Layout,
  rhythmPeers: Map<string, string[]>,
): number {
  if (rhythmPeers.size === 0) return 0;

  // Build voice → pad column map
  const voiceCol = new Map<string, number>();
  for (const [pk, v] of Object.entries(layout.padToVoice)) {
    const vid = v.id ?? String(v.originalMidiNote);
    const col = parseInt(pk.split(',')[1], 10);
    voiceCol.set(vid, col);
  }

  let cost = 0;
  const counted = new Set<string>();
  for (const [voiceId, peers] of rhythmPeers) {
    const col = voiceCol.get(voiceId);
    if (col === undefined) continue;
    for (const peerId of peers) {
      const pairKey = voiceId < peerId ? `${voiceId}:${peerId}` : `${peerId}:${voiceId}`;
      if (counted.has(pairKey)) continue;
      counted.add(pairKey);
      const peerCol = voiceCol.get(peerId);
      if (peerCol === undefined) continue;
      cost += Math.abs(col - peerCol) * 2.0;
    }
  }

  return cost;
}

// ============================================================================
// Registration
// ============================================================================

const greedyOptimizer = new GreedyOptimizer();
registerOptimizer(greedyOptimizer);

export { greedyOptimizer, GreedyOptimizer };
