/**
 * BeamSolver - Beam Search optimization algorithm.
 *
 * Assigns fingers to notes based on biomechanical constraints and cost optimization.
 * The Beam Search approach maintains K best candidates at each step, allowing
 * for more globally optimal solutions compared to greedy approaches.
 *
 * Ported from Version1/src/engine/solvers/BeamSolver.ts with canonical terminology:
 * - GridMapping → Layout, .cells → .padToVoice, cellKey → padKey
 * - NoteEvent → PerformanceEvent
 * - EngineResult → ExecutionPlanResult
 * - EngineDebugEvent → FingerAssignment
 * - CostBreakdown → DifficultyBreakdown
 */

import { type Performance, type HandPose, type InstrumentConfig } from '../../types/performance';
import { type PerformanceEvent } from '../../types/performanceEvent';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type FingerType } from '../../types/fingerModel';
import { type Layout } from '../../types/layout';
import { type PadCoord, padKey } from '../../types/padGrid';
import {
  type ExecutionPlanResult,
  type ExecutionPlanLayoutBinding,
  type FingerAssignment,
  type FingerUsageStats,
  type FatigueMap,
  type PadFingerAssignment,
  type MomentAssignment,
  type NoteAssignmentInfo,
} from '../../types/executionPlan';
import { MOMENT_EPSILON } from '../../types/performanceEvent';
import { buildNoteToPadIndex, buildVoiceIdToPadIndex, resolveEventToPad, hashLayout } from '../mapping/mappingResolver';
import { isZoneValid } from '../surface/handZone';
import { generateValidGripsWithTier } from '../prior/feasibility';
import {
  calculateHandShapeDeviation,
  buildNaturalPairwiseDistances,
  calculateTransitionCost,
  exceedsHandSpeedLimit,
  calculateFingerPreferenceCost,
  calculateHandBalanceCost,
  calculateAlternationCost,
} from '../evaluation/costFunction';
import { computePlanScore } from '../evaluation/planScore';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../structure/momentBuilder';
import {
  type PerformabilityObjective,
  combinePerformabilityComponents,
  v1CostBreakdownToCanonicalFactors,
} from '../evaluation/objective';
import {
  type V1CostBreakdown,
  createZeroV1CostBreakdown,
} from '../../types/diagnostics';
import {
  type DiagnosticsPayload,
  type InfeasibilityDiagnostic,
  computeTopContributors,
  deriveFeasibilityVerdict,
} from '../../types/diagnostics';
import {
  type NeutralHandCentersResult,
  type NeutralPadPositions as RichNeutralPadPositions,
  computeNeutralHandCenters,
  getNeutralHandCenters,
  restingPoseFromNeutralPadPositions,
} from '../prior/handPose';
import { type SolverStrategy, type SolverType } from './types';
import { type SolverConfig, type NeutralPadPositions } from '../../types/engineConfig';

// ============================================================================
// Beam Score Weights for Previously Diagnostic-Only Costs
// ============================================================================

// Alternation (same-finger repetition at speed) is part of the beam score and is
// reported as its own canonical factor. It was previously excluded entirely, which
// made the Alternation bar read zero for every layout the beam analysed.

/**
 * Weight for hand balance cost in beam score.
 * Prevents extreme single-hand dominance.
 * Value 0.3: mild bias toward balanced usage without overriding
 * legitimate one-hand-only passages.
 */
const HAND_BALANCE_BEAM_WEIGHT = 0.3;

/**
 * Cost of deviating from a pad's established (hand, finger) ownership.
 *
 * Consistent fingering is what makes a layout learnable — the same pad should be
 * struck by the same finger every time, because that stable mapping is what the
 * player memorises and what PushFlow ultimately delivers. It is also what the
 * product's own PadFingerAssignment can represent: one finger per pad.
 *
 * It is a strong PREFERENCE rather than a law of physics — a player can re-finger
 * a pad when the context demands it — so it is priced, not forbidden. Treating it
 * as a hard constraint (the previous behaviour) made the beam dead-end on ordinary
 * material and report the dead end to the user as "Unplayable", a false physical
 * claim. Pricing it below BEST_EFFORT_PENALTY keeps the ordering right: re-finger
 * if you must, rather than give up on the moment.
 */
const OWNERSHIP_DEVIATION_PENALTY = 25.0;

/** Extra cost when the deviation also switches the pad to the other hand. */
const OWNERSHIP_HAND_SWITCH_PENALTY = 15.0;

/**
 * Cost per pad played outside a hand's comfortable column zone.
 *
 * The Push 3 playing surface is only ~17cm wide, so either hand can physically
 * reach any column; crossing the midline is awkward, not impossible. Modelling
 * this as cost (rather than the previous hard rejection) keeps the distinction
 * the product canon requires: impossible vs merely awkward.
 */
const ZONE_REACH_PENALTY = 10.0;

/**
 * Additional cost per column of reach beyond the hand's zone boundary.
 *
 * Steep on purpose. Crossing the hands mid-groove is a real commitment, and a
 * shallow ramp had the solver casually sending a far-left pad to the right hand
 * to dodge a re-fingering penalty — which then cost far more in hand travel than
 * it saved.
 */
const ZONE_REACH_PENALTY_PER_COL = 6.0;

/**
 * Cost applied to a best-effort assignment produced when every ergonomically
 * preferred option for a moment was rejected. Large enough to rank last, finite
 * so the moment still receives a real assignment and an honest difficulty.
 */
const BEST_EFFORT_PENALTY = 40.0;

/** Maximum number of hand partitions enumerated for a simultaneous group. */
const MAX_SPLIT_PARTITIONS = 64;


// ============================================================================
// Beam Search Internal Types
// ============================================================================

interface NoteAssignment {
  eventIndex: number;
  eventKey?: string;
  voiceId?: string;
  noteNumber: number;
  startTime: number;
  hand: 'left' | 'right';
  finger: FingerType;
  grip: HandPose;
  cost: number;
  row: number;
  col: number;
  costComponents?: V1CostBreakdown;
}

interface BeamNode {
  leftPose: HandPose;
  rightPose: HandPose;
  totalCost: number;
  parent: BeamNode | null;
  assignments: NoteAssignment[];
  depth: number;
  leftCount: number;
  rightCount: number;
  /**
   * Tracks pad-to-finger ownership across the entire solve.
   * Key: padKey ("row,col"), Value: { hand, finger }.
   * Invariant B: once a pad is assigned a finger, all future groups
   * must use the same finger for that pad.
   */
  padOwnership: Map<string, { hand: 'left' | 'right'; finger: FingerType }>;
  /**
   * The (hand, finger) pairs used at the previous moment, and when that was.
   * Needed to charge same-finger repetition — the canonical `alternation` factor,
   * which the beam score previously omitted entirely.
   */
  prevFingers: Array<{ hand: 'left' | 'right'; finger: FingerType }>;
  prevTimestamp: number;
}

interface PerformanceGroup {
  timestamp: number;
  notes: PerformanceEvent[];
  eventIndices: number[];
  eventKeys: (string | undefined)[];
  activePads: PadCoord[];
  positions: PadCoord[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Soft zone cost for playing `pads` with `hand`.
 *
 * Returns 0 while every pad sits inside the hand's comfortable zone, and grows
 * with how far past the midline the hand has to reach.
 */
function zoneReachCost(pads: PadCoord[], hand: 'left' | 'right'): number {
  let cost = 0;
  for (const pad of pads) {
    if (isZoneValid(pad, hand)) continue;
    const overshoot = hand === 'left' ? pad.col - 4 : 3 - pad.col;
    cost += ZONE_REACH_PENALTY + Math.max(0, overshoot) * ZONE_REACH_PENALTY_PER_COL;
  }
  return cost;
}

/**
 * Soft cost for re-fingering pads that already have an established owner.
 */
function ownershipDeviationCost(
  ownership: Map<string, { hand: 'left' | 'right'; finger: FingerType }>,
  entries: Array<{ padKey: string; hand: 'left' | 'right'; finger: FingerType }>,
): number {
  let cost = 0;
  for (const entry of entries) {
    const existing = ownership.get(entry.padKey);
    if (!existing) continue;
    if (existing.hand !== entry.hand) {
      cost += OWNERSHIP_DEVIATION_PENALTY + OWNERSHIP_HAND_SWITCH_PENALTY;
    } else if (existing.finger !== entry.finger) {
      cost += OWNERSHIP_DEVIATION_PENALTY;
    }
  }
  return cost;
}

/**
 * Enumerates every non-empty two-hand division of a simultaneous pad group.
 *
 * Both hands must receive at least one pad, and neither may receive more than
 * five (a hand has five fingers). Partitions are produced in a deterministic
 * order and capped at MAX_SPLIT_PARTITIONS so a dense moment cannot blow up the
 * beam; the cap is far above the realistic case (a 5-pad moment yields 30).
 */
function enumerateHandPartitions(
  pads: PadCoord[],
): Array<{ leftPads: PadCoord[]; rightPads: PadCoord[] }> {
  const partitions: Array<{ leftPads: PadCoord[]; rightPads: PadCoord[] }> = [];
  const n = pads.length;
  if (n < 2 || n > 10) return partitions;

  const combinations = 1 << n;
  for (let mask = 1; mask < combinations - 1; mask++) {
    const leftPads: PadCoord[] = [];
    const rightPads: PadCoord[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) leftPads.push(pads[i]);
      else rightPads.push(pads[i]);
    }
    if (leftPads.length > 5 || rightPads.length > 5) continue;
    partitions.push({ leftPads, rightPads });
    if (partitions.length >= MAX_SPLIT_PARTITIONS) break;
  }
  return partitions;
}

function getDifficulty(cost: number): 'Easy' | 'Medium' | 'Hard' | 'Unplayable' {
  // "Unplayable" means there is no assignment at all. A finite cost means the
  // solver found a way to play the moment, however strained — reporting that as
  // Unplayable made the difficulty label contradict the headline counters.
  if (!Number.isFinite(cost)) return 'Unplayable';
  if (cost > 10) return 'Hard';
  if (cost > 3) return 'Medium';
  return 'Easy';
}

function groupEventsByTimestamp(
  events: Array<{ event: PerformanceEvent; index: number; position: PadCoord | null }>
): PerformanceGroup[] {
  const groups: PerformanceGroup[] = [];
  let currentGroup: PerformanceGroup | null = null;

  for (const { event, index, position } of events) {
    if (!position) continue;

    const pad: PadCoord = { row: position.row, col: position.col };

    if (!currentGroup || event.startTime - currentGroup.timestamp > MOMENT_EPSILON) {
      currentGroup = {
        timestamp: event.startTime,
        notes: [event],
        eventIndices: [index],
        eventKeys: [event.eventKey],
        activePads: [pad],
        positions: [position],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.notes.push(event);
      currentGroup.eventIndices.push(index);
      currentGroup.eventKeys.push(event.eventKey);
      currentGroup.activePads.push(pad);
      currentGroup.positions.push(position);
    }
  }

  return groups;
}

// ============================================================================
// ============================================================================
// BeamSolver Implementation
// ============================================================================

export class BeamSolver implements SolverStrategy {
  public readonly name = 'Beam Search';
  public readonly type: SolverType = 'beam';
  public readonly isSynchronous = true;

  private instrumentConfig: InstrumentConfig;
  private layout: Layout | null;
  private sourceLayoutRole: import('../../types/layout').LayoutRole | undefined;
  private neutralPadPositionsOverride: NeutralPadPositions | null;
  private mappingResolverMode: 'strict' | 'allow-fallback';
  private initialPadOwnership: Map<string, { hand: 'left' | 'right'; finger: FingerType }>;

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.layout = config.layout ?? null;
    this.sourceLayoutRole = config.sourceLayoutRole ?? config.layout?.role;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.mappingResolverMode = config.mappingResolverMode ?? 'strict';

    // Pre-seed pad ownership from config (e.g., natural hand pose finger assignments)
    this.initialPadOwnership = new Map();
    if (config.initialPadOwnership) {
      for (const [key, assignment] of Object.entries(config.initialPadOwnership)) {
        this.initialPadOwnership.set(key, assignment);
      }
    }
  }

  private createInitialBeam(config: EngineConfiguration): BeamNode[] {
    const { restingPose } = config;
    return [{
      leftPose: { ...restingPose.left },
      rightPose: { ...restingPose.right },
      totalCost: 0,
      parent: null,
      assignments: [],
      depth: 0,
      leftCount: 0,
      rightCount: 0,
      padOwnership: new Map(this.initialPadOwnership),
      prevFingers: [],
      prevTimestamp: 0,
    }];
  }

  private expandNodeForGroup(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    _config: EngineConfiguration,
    _neutralHandCenters?: NeutralHandCentersResult | null,
    naturalDistances?: { left: Map<string, number>; right: Map<string, number> },
  ): BeamNode[] {
    const children: BeamNode[] = [];
    const rawTimeDelta = group.timestamp - prevTimestamp;
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;

    for (const hand of ['left', 'right'] as const) {
      // Deduplicate pads to prevent multiple fingers on the same pad
      const uniquePads: PadCoord[] = [];
      const seenPads = new Set<string>();
      for (const pad of group.activePads) {
        const key = `${pad.row},${pad.col}`;
        if (!seenPads.has(key)) {
          seenPads.add(key);
          uniquePads.push(pad);
        }
      }

      if (uniquePads.length === 0 || uniquePads.length > 5) continue;

      // Consistent fingering is a strong preference, not a hard rule. Pads already
      // owned by the other hand stay playable here, they just cost more (see
      // ownershipDeviationCost below, applied once the exact fingers are known).

      // Reaching outside the hand's comfortable zone is awkward, not impossible.
      const zoneCost = zoneReachCost(uniquePads, hand);

      const prevPose = hand === 'left' ? node.leftPose : node.rightPose;

      const gripResults = generateValidGripsWithTier(uniquePads, hand);

      for (const gripResult of gripResults) {
        const { pose: grip } = gripResult;
        const transitionCost = calculateTransitionCost(prevPose, grip, timeDelta);

        // Reject transitions that exceed physiological hand speed. Everything
        // slower is merely expensive, and its cost is already finite.
        if (!isFirstGroup && exceedsHandSpeedLimit(prevPose, grip, timeDelta)) continue;

        const effectiveTransitionCost = transitionCost;

        // V1 (D-05, D-20): Translation-invariant hand shape deviation + finger preference
        const handNaturalDist = naturalDistances
          ? (hand === 'left' ? naturalDistances.left : naturalDistances.right)
          : new Map<string, number>();
        const handShapeDeviation = calculateHandShapeDeviation(grip, handNaturalDist);
        const fingerPreferenceCost = calculateFingerPreferenceCost(grip);

        const gripFingers = Object.keys(grip.fingers) as FingerType[];

        // Map notes to the exact finger assigned to their target pad
        const resolvedFingers: FingerType[] = [];
        for (const pos of group.positions) {
          let assignedFinger: FingerType | null = null;
          for (const [f, coord] of Object.entries(grip.fingers)) {
            if (coord.x === pos.col && coord.y === pos.row) {
              assignedFinger = f as FingerType;
              break;
            }
          }
          resolvedFingers.push(assignedFinger ?? gripFingers[0]);
        }

        // Re-fingering an already-established pad is allowed but penalised, so the
        // solver keeps fingering stable unless the context genuinely requires a change.
        const ownershipCost = ownershipDeviationCost(
          node.padOwnership,
          group.positions.map((pos, i) => ({
            padKey: `${pos.row},${pos.col}`,
            hand,
            finger: resolvedFingers[i],
          })),
        );

        const newLeftCount = node.leftCount + (hand === 'left' ? group.notes.length : 0);
        const newRightCount = node.rightCount + (hand === 'right' ? group.notes.length : 0);
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        // === PRIMARY SCORE (V1: hand shape deviation + finger preference + transition) ===
        const poseNaturalness = handShapeDeviation + fingerPreferenceCost;
        // Soft ergonomic constraints (zone reach + fingering consistency) are reported
        // as the canonical `constraintPenalty` factor rather than silently rejecting
        // the option. This is what keeps "awkward" distinguishable from "impossible".
        const constraintPenalty = zoneCost + ownershipCost;

        // Same-finger repetition at speed — the commonest real-world reason a drum
        // layout is unplayable. Previously absent from the beam score entirely.
        const currentFingers = resolvedFingers.map(finger => ({ hand, finger }));
        const alternationCost = calculateAlternationCost(
          node.prevFingers, currentFingers, group.timestamp - node.prevTimestamp,
        );
        const perfComponents: PerformabilityObjective = {
          poseNaturalness,
          transitionDifficulty: effectiveTransitionCost,
          constraintPenalty,
        };
        let stepCostForBeam = combinePerformabilityComponents(perfComponents);

        // === HAND BALANCE COST (prevents single-hand dominance) ===
        stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;
        stepCostForBeam += alternationCost;
        // constraintPenalty is already folded in by combinePerformabilityComponents.

        const newTotalCost = node.totalCost + stepCostForBeam;

        // === V1 COST BREAKDOWN (moment-level — NOT divided per-note) ===
        const stepComponents: V1CostBreakdown = {
          fingerPreference: fingerPreferenceCost,
          handShapeDeviation: handShapeDeviation,
          alternation: alternationCost,
          transitionCost: effectiveTransitionCost,
          handBalance: handBalanceCost,
          constraintPenalty,
          total: stepCostForBeam,
        };

        if (gripFingers.length === 0 || gripFingers.length < uniquePads.length) continue;

        // Build per-note assignments with FULL moment cost (Invariant E)
        const assignments: NoteAssignment[] = [];
        const n = group.notes.length;

        for (let i = 0; i < n; i++) {
          assignments.push({
            eventIndex: group.eventIndices[i],
            eventKey: group.eventKeys[i],
            noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
            startTime: group.notes[i].startTime,
            hand,
            finger: resolvedFingers[i],
            grip,
            cost: stepComponents.total,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: stepComponents,
          });
        }

        // === Update pad ownership for newly touched pads ===
        const newPadOwnership = new Map(node.padOwnership);
        for (let i = 0; i < group.positions.length; i++) {
          const pKey = `${group.positions[i].row},${group.positions[i].col}`;
          if (!newPadOwnership.has(pKey)) {
            newPadOwnership.set(pKey, { hand, finger: resolvedFingers[i] });
          }
        }

        children.push({
          leftPose: hand === 'left' ? grip : node.leftPose,
          rightPose: hand === 'right' ? grip : node.rightPose,
          totalCost: newTotalCost,
          parent: node,
          assignments,
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
          padOwnership: newPadOwnership,
          prevFingers: currentFingers,
          prevTimestamp: group.timestamp,
        });
      }
    }

    return children;
  }

  private expandNodeForSplitChord(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    _config: EngineConfiguration,
    _neutralHandCenters?: NeutralHandCentersResult | null,
    naturalDistances?: { left: Map<string, number>; right: Map<string, number> },
  ): BeamNode[] {
    const children: BeamNode[] = [];

    // Deduplicate pads
    const uniquePads: PadCoord[] = [];
    const seenPads = new Set<string>();
    for (const pad of group.activePads) {
      const key = `${pad.row},${pad.col}`;
      if (!seenPads.has(key)) {
        seenPads.add(key);
        uniquePads.push(pad);
      }
    }

    if (uniquePads.length < 2) return children;

    const rawTimeDelta = group.timestamp - prevTimestamp;
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;

    // Sort left-to-right so partitions are enumerated in a stable, deterministic order.
    const sortedPads = [...uniquePads].sort((a, b) =>
      a.col !== b.col ? a.col - b.col : a.row - b.row);

    // Enumerate every way of dividing the pads between the two hands, rather than the
    // single midpoint split used previously. A three-pad moment has three useful
    // splits; trying only one of them was a common source of "no valid expansion",
    // which the solver then reported to the user as an unplayable moment.
    for (const partition of enumerateHandPartitions(sortedPads)) {
      const { leftPads, rightPads } = partition;
      for (const child of this.expandSplitPartition(
        node, group, leftPads, rightPads, timeDelta, isFirstGroup, naturalDistances,
      )) {
        children.push(child);
      }
    }

    return children;
  }

  /**
   * Builds beam children for one specific left/right division of a simultaneous group.
   */
  private expandSplitPartition(
    node: BeamNode,
    group: PerformanceGroup,
    leftPads: PadCoord[],
    rightPads: PadCoord[],
    timeDelta: number,
    isFirstGroup: boolean,
    naturalDistances?: { left: Map<string, number>; right: Map<string, number> },
  ): BeamNode[] {
    const children: BeamNode[] = [];

    // Reaching across the midline is awkward, not impossible — charge for it.
    const zoneCost = zoneReachCost(leftPads, 'left') + zoneReachCost(rightPads, 'right');

    const leftPadKeys = new Set(leftPads.map(p => `${p.row},${p.col}`));
    const leftNoteIndices: number[] = [];
    const rightNoteIndices: number[] = [];
    for (let i = 0; i < group.positions.length; i++) {
      const key = `${group.positions[i].row},${group.positions[i].col}`;
      if (leftPadKeys.has(key)) leftNoteIndices.push(i);
      else rightNoteIndices.push(i);
    }

    const leftGripResults = generateValidGripsWithTier(leftPads, 'left');
    const rightGripResults = generateValidGripsWithTier(rightPads, 'right');

    for (const leftResult of leftGripResults) {
      const leftFingers = Object.keys(leftResult.pose.fingers) as FingerType[];
      if (leftFingers.length < leftPads.length) continue;

      for (const rightResult of rightGripResults) {
        const rightFingers = Object.keys(rightResult.pose.fingers) as FingerType[];
        if (rightFingers.length < rightPads.length) continue;

        const leftTransition = calculateTransitionCost(node.leftPose, leftResult.pose, timeDelta);
        const rightTransition = calculateTransitionCost(node.rightPose, rightResult.pose, timeDelta);

        if (!isFirstGroup && (
          exceedsHandSpeedLimit(node.leftPose, leftResult.pose, timeDelta) ||
          exceedsHandSpeedLimit(node.rightPose, rightResult.pose, timeDelta)
        )) continue;

        const effectiveLeftTransition = leftTransition;
        const effectiveRightTransition = rightTransition;

        // V1 (D-05, D-20): Translation-invariant hand shape deviation
        const leftShapeDev = calculateHandShapeDeviation(
          leftResult.pose,
          naturalDistances ? naturalDistances.left : new Map<string, number>()
        );
        const rightShapeDev = calculateHandShapeDeviation(
          rightResult.pose,
          naturalDistances ? naturalDistances.right : new Map<string, number>()
        );
        const leftFingerPref = calculateFingerPreferenceCost(leftResult.pose);
        const rightFingerPref = calculateFingerPreferenceCost(rightResult.pose);

        // Soft ergonomic cost is split evenly across the two hands for reporting.
        const leftConstraintPenalty = zoneCost / 2;
        const rightConstraintPenalty = zoneCost / 2;

        // Map notes to exact fingers based on their target pad coordinates
        const resolvedLeftFingers: FingerType[] = [];
        for (const i of leftNoteIndices) {
          const pos = group.positions[i];
          let assignedFinger: FingerType | null = null;
          for (const [f, coord] of Object.entries(leftResult.pose.fingers)) {
            if (coord.x === pos.col && coord.y === pos.row) { assignedFinger = f as FingerType; break; }
          }
          resolvedLeftFingers.push(assignedFinger ?? Object.keys(leftResult.pose.fingers)[0] as FingerType);
        }

        const resolvedRightFingers: FingerType[] = [];
        for (const i of rightNoteIndices) {
          const pos = group.positions[i];
          let assignedFinger: FingerType | null = null;
          for (const [f, coord] of Object.entries(rightResult.pose.fingers)) {
            if (coord.x === pos.col && coord.y === pos.row) { assignedFinger = f as FingerType; break; }
          }
          resolvedRightFingers.push(assignedFinger ?? Object.keys(rightResult.pose.fingers)[0] as FingerType);
        }

        // Re-fingering an established pad is penalised, not forbidden.
        const ownershipCost = ownershipDeviationCost(node.padOwnership, [
          ...leftNoteIndices.map((i, j) => ({
            padKey: `${group.positions[i].row},${group.positions[i].col}`,
            hand: 'left' as const,
            finger: resolvedLeftFingers[j],
          })),
          ...rightNoteIndices.map((i, j) => ({
            padKey: `${group.positions[i].row},${group.positions[i].col}`,
            hand: 'right' as const,
            finger: resolvedRightFingers[j],
          })),
        ]);

        const splitConstraintPenalty =
          leftConstraintPenalty + rightConstraintPenalty + ownershipCost;

        const splitFingers = [
          ...resolvedLeftFingers.map(finger => ({ hand: 'left' as const, finger })),
          ...resolvedRightFingers.map(finger => ({ hand: 'right' as const, finger })),
        ];
        const alternationCost = calculateAlternationCost(
          node.prevFingers, splitFingers, group.timestamp - node.prevTimestamp,
        );

        const newLeftCount = node.leftCount + leftNoteIndices.length;
        const newRightCount = node.rightCount + rightNoteIndices.length;
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        // === PRIMARY SCORE (V1: hand shape deviation + finger preference + transition) ===
        const totalPoseNat = (leftShapeDev + leftFingerPref) + (rightShapeDev + rightFingerPref);
        const perfComponents: PerformabilityObjective = {
          poseNaturalness: totalPoseNat,
          transitionDifficulty: effectiveLeftTransition + effectiveRightTransition,
          constraintPenalty: splitConstraintPenalty,
        };
        let stepCostForBeam = combinePerformabilityComponents(perfComponents);

        stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;
        stepCostForBeam += alternationCost;

        // === V1 COST BREAKDOWN (moment-level — NOT divided per-note) ===
        const stepComponents: V1CostBreakdown = {
          fingerPreference: leftFingerPref + rightFingerPref,
          handShapeDeviation: leftShapeDev + rightShapeDev,
          alternation: alternationCost,
          transitionCost: effectiveLeftTransition + effectiveRightTransition,
          handBalance: handBalanceCost,
          constraintPenalty: splitConstraintPenalty,
          total: stepCostForBeam,
        };

        // Build per-note assignments with FULL moment cost (Invariant E)
        const assignments: NoteAssignment[] = [];

        for (let j = 0; j < leftNoteIndices.length; j++) {
          const i = leftNoteIndices[j];
          assignments.push({
            eventIndex: group.eventIndices[i],
            eventKey: group.eventKeys[i],
            noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
            startTime: group.notes[i].startTime,
            hand: 'left',
            finger: resolvedLeftFingers[j],
            grip: leftResult.pose,
            cost: stepComponents.total,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: stepComponents,
          });
        }
        for (let j = 0; j < rightNoteIndices.length; j++) {
          const i = rightNoteIndices[j];
          assignments.push({
            eventIndex: group.eventIndices[i],
            eventKey: group.eventKeys[i],
            noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
            startTime: group.notes[i].startTime,
            hand: 'right',
            finger: resolvedRightFingers[j],
            grip: rightResult.pose,
            cost: stepComponents.total,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: stepComponents,
          });
        }

        // === Update pad ownership for newly touched pads ===
        const newPadOwnership = new Map(node.padOwnership);
        for (let j = 0; j < leftNoteIndices.length; j++) {
          const i = leftNoteIndices[j];
          const pKey = `${group.positions[i].row},${group.positions[i].col}`;
          if (!newPadOwnership.has(pKey)) {
            newPadOwnership.set(pKey, { hand: 'left', finger: resolvedLeftFingers[j] });
          }
        }
        for (let j = 0; j < rightNoteIndices.length; j++) {
          const i = rightNoteIndices[j];
          const pKey = `${group.positions[i].row},${group.positions[i].col}`;
          if (!newPadOwnership.has(pKey)) {
            newPadOwnership.set(pKey, { hand: 'right', finger: resolvedRightFingers[j] });
          }
        }

        children.push({
          leftPose: leftResult.pose,
          rightPose: rightResult.pose,
          totalCost: node.totalCost + stepCostForBeam,
          parent: node,
          assignments,
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
          padOwnership: newPadOwnership,
          prevFingers: splitFingers,
          prevTimestamp: group.timestamp,
        });
      }
    }

    return children;
  }

  /**
   * Produces a guaranteed assignment for a moment whose ergonomically preferred
   * options were all rejected.
   *
   * The beam used to simply drop such moments, and the UI reported the resulting
   * gaps as "Unplayable" — telling the user a passage was physically impossible
   * when the truth was that the search had run out of options. A best-effort
   * assignment is always produced instead: pads are divided at the grid midline,
   * fingers are laid out in anatomical order, and a large but finite penalty is
   * charged so the moment ranks last and is surfaced as genuinely hard.
   *
   * Returns null only when the moment is beyond any pair of hands — more
   * simultaneous pads than a player has fingers. That is the one honest
   * "unplayable" verdict this solver can make.
   */
  private buildBestEffortChild(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
  ): BeamNode | null {
    const uniquePads: PadCoord[] = [];
    const seen = new Set<string>();
    for (const pad of group.activePads) {
      const key = `${pad.row},${pad.col}`;
      if (!seen.has(key)) { seen.add(key); uniquePads.push(pad); }
    }
    if (uniquePads.length === 0 || uniquePads.length > 10) return null;

    const sorted = [...uniquePads].sort((a, b) =>
      a.col !== b.col ? a.col - b.col : a.row - b.row);

    // Divide at the midline, then rebalance so neither hand exceeds five fingers.
    let splitAt = sorted.findIndex(pad => pad.col > 3);
    if (splitAt === -1) splitAt = sorted.length;
    splitAt = Math.min(Math.max(splitAt, sorted.length - 5), 5);
    const leftPads = sorted.slice(0, splitAt);
    const rightPads = sorted.slice(splitAt);

    // Anatomical finger order, left-to-right across the grid.
    const LEFT_ORDER: FingerType[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];
    const RIGHT_ORDER: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    const padToOwner = new Map<string, { hand: 'left' | 'right'; finger: FingerType }>();
    const leftFingers: Partial<Record<FingerType, { x: number; y: number }>> = {};
    const rightFingers: Partial<Record<FingerType, { x: number; y: number }>> = {};

    leftPads.forEach((pad, i) => {
      const finger = LEFT_ORDER[LEFT_ORDER.length - leftPads.length + i] ?? LEFT_ORDER[i];
      padToOwner.set(`${pad.row},${pad.col}`, { hand: 'left', finger });
      leftFingers[finger] = { x: pad.col, y: pad.row };
    });
    rightPads.forEach((pad, i) => {
      const finger = RIGHT_ORDER[i] ?? RIGHT_ORDER[RIGHT_ORDER.length - 1];
      padToOwner.set(`${pad.row},${pad.col}`, { hand: 'right', finger });
      rightFingers[finger] = { x: pad.col, y: pad.row };
    });

    const centroidOf = (fingers: Partial<Record<FingerType, { x: number; y: number }>>) => {
      const coords = Object.values(fingers) as Array<{ x: number; y: number }>;
      if (coords.length === 0) return null;
      return {
        x: coords.reduce((a, c) => a + c.x, 0) / coords.length,
        y: coords.reduce((a, c) => a + c.y, 0) / coords.length,
      };
    };
    const leftCentroid = centroidOf(leftFingers);
    const rightCentroid = centroidOf(rightFingers);
    const leftPose: HandPose = leftCentroid
      ? { centroid: leftCentroid, fingers: leftFingers }
      : node.leftPose;
    const rightPose: HandPose = rightCentroid
      ? { centroid: rightCentroid, fingers: rightFingers }
      : node.rightPose;

    const newLeftCount = node.leftCount + leftPads.length;
    const newRightCount = node.rightCount + rightPads.length;
    const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);
    const stepCost = BEST_EFFORT_PENALTY + handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;

    const stepComponents: V1CostBreakdown = {
      fingerPreference: 0,
      handShapeDeviation: 0,
      alternation: 0,
      transitionCost: 0,
      handBalance: handBalanceCost,
      constraintPenalty: BEST_EFFORT_PENALTY,
      total: stepCost,
    };

    const assignments: NoteAssignment[] = [];
    for (let i = 0; i < group.notes.length; i++) {
      const pos = group.positions[i];
      const owner = padToOwner.get(`${pos.row},${pos.col}`);
      if (!owner) continue;
      assignments.push({
        eventIndex: group.eventIndices[i],
        eventKey: group.eventKeys[i],
        noteNumber: group.notes[i].noteNumber,
        voiceId: group.notes[i].voiceId,
        startTime: group.notes[i].startTime,
        hand: owner.hand,
        finger: owner.finger,
        grip: owner.hand === 'left' ? leftPose : rightPose,
        cost: stepCost,
        row: pos.row,
        col: pos.col,
        costComponents: stepComponents,
      });
    }
    if (assignments.length === 0) return null;

    const newPadOwnership = new Map(node.padOwnership);
    for (const [key, owner] of padToOwner) {
      if (!newPadOwnership.has(key)) newPadOwnership.set(key, owner);
    }

    void prevTimestamp;

    return {
      leftPose,
      rightPose,
      totalCost: node.totalCost + stepCost,
      parent: node,
      assignments,
      depth: node.depth + 1,
      leftCount: newLeftCount,
      rightCount: newRightCount,
      padOwnership: newPadOwnership,
      prevFingers: [...padToOwner.values()],
      prevTimestamp: group.timestamp,
    };
  }

  private pruneBeam(beam: BeamNode[], beamWidth: number): BeamNode[] {
    beam.sort((a, b) => a.totalCost - b.totalCost);
    return beam.slice(0, beamWidth);
  }

  private backtrack(node: BeamNode): NoteAssignment[] {
    const path: NoteAssignment[] = [];
    let current: BeamNode | null = node;
    while (current !== null) {
      if (current.assignments.length > 0) {
        path.unshift(...current.assignments);
      }
      current = current.parent;
    }
    return path;
  }

  /**
   * Post-hoc diagnostics: for each unplayable event, determine WHY it failed.
   * Runs after the beam search completes, checking the same constraints the
   * solver uses but collecting rejection reasons instead of discarding.
   */
  private diagnoseUnplayableEvents(
    assignments: NoteAssignment[],
    totalEvents: number,
    unmappedIndices: Set<number>,
    _sortedEvents: Array<{ event: PerformanceEvent; originalIndex: number }>,
    eventsWithPositions: Array<{ event: PerformanceEvent; index: number; position: PadCoord | null }>,
    groups?: PerformanceGroup[],
    exhaustedGroupIndices?: Set<number>,
  ): Record<number, string[]> {
    const assignedIndices = new Set(assignments.map(a => a.eventIndex));
    const reasons: Record<number, string[]> = {};

    // Build a set of event indices that belonged to beam-exhausted groups
    const beamExhaustedEventIndices = new Set<number>();
    if (groups && exhaustedGroupIndices) {
      for (const gi of exhaustedGroupIndices) {
        const group = groups[gi];
        for (const idx of group.eventIndices) {
          beamExhaustedEventIndices.add(idx);
        }
      }
    }

    for (let i = 0; i < totalEvents; i++) {
      // Skip events that were successfully assigned
      if (assignedIndices.has(i)) continue;

      const eventReasons: string[] = [];

      if (unmappedIndices.has(i)) {
        eventReasons.push('unmapped');
      } else if (beamExhaustedEventIndices.has(i)) {
        // This event was in a group where beam expansion produced zero children.
        // Do additional post-hoc checks to explain WHY the beam exhausted.
        const ewp = eventsWithPositions.find(e => e.index === i);
        if (ewp?.position) {
          const pad = ewp.position;
          const leftZone = isZoneValid(pad, 'left');
          const rightZone = isZoneValid(pad, 'right');
          if (!leftZone && !rightZone) {
            eventReasons.push('zone_conflict');
          }
          const leftGrips = leftZone ? generateValidGripsWithTier([pad], 'left') : [];
          const rightGrips = rightZone ? generateValidGripsWithTier([pad], 'right') : [];
          if (leftGrips.length === 0 && rightGrips.length === 0) {
            eventReasons.push('no_valid_grip');
          }
        }
        // Always include beam_exhausted as the proximate cause
        eventReasons.push('beam_exhausted');
      } else {
        // Event had a position but wasn't assigned — check why
        const ewp = eventsWithPositions.find(e => e.index === i);
        if (!ewp || !ewp.position) {
          eventReasons.push('unmapped');
        } else {
          const pad = ewp.position;

          // Check zone: is this pad reachable by at least one hand?
          const leftZone = isZoneValid(pad, 'left');
          const rightZone = isZoneValid(pad, 'right');
          if (!leftZone && !rightZone) {
            eventReasons.push('zone_conflict');
          }

          // Check grip: can any hand form a valid grip on this pad?
          const leftGrips = leftZone ? generateValidGripsWithTier([pad], 'left') : [];
          const rightGrips = rightZone ? generateValidGripsWithTier([pad], 'right') : [];
          if (leftGrips.length === 0 && rightGrips.length === 0) {
            eventReasons.push('no_valid_grip');
          }

          // If we still haven't found a reason, it's likely a cascading
          // beam exhaustion — the beam carried forward stale states from
          // an earlier group failure, so this group had no viable parents.
          if (eventReasons.length === 0) {
            eventReasons.push('beam_exhausted');
          }
        }
      }

      if (eventReasons.length > 0) {
        reasons[i] = eventReasons;
      }
    }

    return reasons;
  }

  /**
   * Scores this solver's own result with the canonical evaluator.
   *
   * Every user-facing figure should come from one model. The beam solver's
   * internal cost exists to guide its search and is not on the same scale as the
   * canonical evaluator that the greedy path, Compare and Calculate Cost all use.
   * Returns null when the layout or events are unavailable, in which case the
   * caller falls back to the internal average.
   */
  private canonicalPerMomentCost(
    padFingerAssignment: PadFingerAssignment,
    sortedEvents: Array<{ event: PerformanceEvent; originalIndex: number }>,
    config: EngineConfiguration,
  ): number | null {
    if (!this.layout || Object.keys(padFingerAssignment).length === 0) return null;
    try {
      const moments = buildPerformanceMoments(sortedEvents.map(e => e.event));
      if (moments.length === 0) return null;
      const breakdown = evaluatePerformance({
        moments,
        layout: this.layout,
        padFingerAssignment,
        config: {
          restingPose: config.restingPose,
          stiffness: config.stiffness,
          instrumentConfig: this.instrumentConfig,
          neutralHandCenters: getNeutralHandCenters(this.layout, this.instrumentConfig),
        },
      });
      return breakdown.costPerMoment;
    } catch {
      // Scoring must never break solving.
      return null;
    }
  }

  private buildResult(
    assignments: NoteAssignment[],
    totalEvents: number,
    unmappedIndices: Set<number>,
    config: EngineConfiguration,
    sortedEvents: Array<{ event: PerformanceEvent; originalIndex: number }>,
    coverage: { totalNotes: number; unmappedNotesCount: number; fallbackNotesCount: number },
    winningPadOwnership?: Map<string, { hand: 'left' | 'right'; finger: FingerType }>,
    eventsWithPositions?: Array<{ event: PerformanceEvent; index: number; position: PadCoord | null }>,
    groups?: PerformanceGroup[],
    exhaustedGroupIndices?: Set<number>,
  ): ExecutionPlanResult {
    const fingerAssignments: FingerAssignment[] = [];
    const fingerUsageStats: FingerUsageStats = {};
    const fatigueMap: FatigueMap = {};

    let totalCost = 0;
    let unplayableCount = unmappedIndices.size;
    let hardCount = 0;
    let totalDrift = 0;
    let driftCount = 0;

    // V1: Accumulate V1CostBreakdown for averageMetrics and diagnostics
    const totalV1Cost = createZeroV1CostBreakdown();
    let fallbackGripCount = 0;

    const assignmentMap = new Map<number, NoteAssignment>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.eventIndex, assignment);
    }

    // Build lookup from originalIndex → event for correct metadata on unplayable events
    const eventByOriginalIndex = new Map<number, PerformanceEvent>();
    for (const { event, originalIndex } of sortedEvents) {
      eventByOriginalIndex.set(originalIndex, event);
    }

    for (let i = 0; i < totalEvents; i++) {
      const assignment = assignmentMap.get(i);
      const ev = eventByOriginalIndex.get(i);

      if (unmappedIndices.has(i)) {
        fingerAssignments.push({
          noteNumber: ev?.noteNumber ?? 0,
          voiceId: ev?.voiceId,
          startTime: ev?.startTime ?? 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          costBreakdown: { ...createZeroV1CostBreakdown(), total: Infinity },
          difficulty: 'Unplayable',
          eventIndex: i,
          eventKey: ev?.eventKey,
        });
        continue;
      }

      if (!assignment) {
        unplayableCount++;
        fingerAssignments.push({
          noteNumber: ev?.noteNumber ?? 0,
          voiceId: ev?.voiceId,
          startTime: ev?.startTime ?? 0,
          assignedHand: 'Unplayable', finger: null,
          cost: Infinity,
          costBreakdown: { ...createZeroV1CostBreakdown(), total: Infinity },
          difficulty: 'Unplayable',
          eventIndex: i,
          eventKey: ev?.eventKey,
        });
        continue;
      }

      const difficulty = getDifficulty(assignment.cost);
      if (difficulty === 'Hard') hardCount++;

      const fingerKey = `${assignment.hand === 'left' ? 'L' : 'R'}-${assignment.finger.charAt(0).toUpperCase() + assignment.finger.slice(1)}`;
      fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] || 0) + 1;

      const { restingPose } = config;
      const homeCentroid = assignment.hand === 'left'
        ? restingPose.left.centroid
        : restingPose.right.centroid;
      const drift = Math.sqrt(
        Math.pow(assignment.col - homeCentroid.x, 2) +
        Math.pow(assignment.row - homeCentroid.y, 2)
      );
      totalDrift += drift;
      driftCount++;

      // V1: Use V1CostBreakdown directly on FingerAssignment
      const costBreakdown: V1CostBreakdown = assignment.costComponents
        ?? { ...createZeroV1CostBreakdown(), total: assignment.cost };

      // Accumulate V1CostBreakdown for averageMetrics and diagnostics
      totalV1Cost.fingerPreference += costBreakdown.fingerPreference;
      totalV1Cost.handShapeDeviation += costBreakdown.handShapeDeviation;
      totalV1Cost.alternation += costBreakdown.alternation;
      totalV1Cost.transitionCost += costBreakdown.transitionCost;
      totalV1Cost.handBalance += costBreakdown.handBalance;
      totalV1Cost.constraintPenalty += costBreakdown.constraintPenalty;
      totalV1Cost.total += costBreakdown.total;
      if (costBreakdown.constraintPenalty > 0) fallbackGripCount++;
      totalCost += assignment.cost;

      const padId = padKey(assignment.row, assignment.col);

      fingerAssignments.push({
        noteNumber: assignment.noteNumber,
        voiceId: assignment.voiceId,
        startTime: assignment.startTime,
        assignedHand: assignment.hand,
        finger: assignment.finger,
        cost: assignment.cost,
        costBreakdown,
        difficulty,
        row: assignment.row,
        col: assignment.col,
        eventIndex: assignment.eventIndex,
        eventKey: assignment.eventKey,
        padId,
      });
    }

    const eventCount = fingerAssignments.length - unplayableCount;
    const averageMetrics: V1CostBreakdown = eventCount > 0 ? {
      fingerPreference: totalV1Cost.fingerPreference / eventCount,
      handShapeDeviation: totalV1Cost.handShapeDeviation / eventCount,
      alternation: totalV1Cost.alternation / eventCount,
      transitionCost: totalV1Cost.transitionCost / eventCount,
      handBalance: totalV1Cost.handBalance / eventCount,
      constraintPenalty: totalV1Cost.constraintPenalty / eventCount,
      total: totalV1Cost.total / eventCount,
    } : createZeroV1CostBreakdown();

    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const finger of fingerTypes) {
      fatigueMap[`L-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
      fatigueMap[`R-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
    }

    // V1: Build canonical diagnostics payload from V1CostBreakdown
    const canonicalFactors = v1CostBreakdownToCanonicalFactors(totalV1Cost);
    const feasibility = deriveFeasibilityVerdict(
      unplayableCount,
      hardCount,
      unmappedIndices.size,
      fallbackGripCount,
      totalEvents,
    );
    // V1 (D-03): Aggregate infeasible events by sound/voiceId
    let infeasibleSounds: InfeasibilityDiagnostic[] | undefined;
    if (unplayableCount > 0) {
      const soundCounts = new Map<string, { infeasible: number; total: number }>();
      for (const fa of fingerAssignments) {
        const soundId = fa.voiceId ?? String(fa.noteNumber);
        const entry = soundCounts.get(soundId) ?? { infeasible: 0, total: 0 };
        entry.total++;
        if (fa.assignedHand === 'Unplayable') entry.infeasible++;
        soundCounts.set(soundId, entry);
      }
      infeasibleSounds = [...soundCounts.entries()]
        .filter(([_, v]) => v.infeasible > 0)
        .map(([soundId, v]) => ({
          soundId,
          violationCount: v.infeasible,
          totalEvents: v.total,
        }))
        .sort((a, b) => b.violationCount - a.violationCount);
    }

    const diagnostics: DiagnosticsPayload = {
      feasibility,
      factors: canonicalFactors,
      topContributors: computeTopContributors(canonicalFactors),
      infeasibleSounds,
    };

    // === Build pad-to-finger ownership map (Invariant B) ===
    const padFingerOwnership: PadFingerAssignment = {};
    if (winningPadOwnership) {
      for (const [key, value] of winningPadOwnership) {
        padFingerOwnership[key] = { hand: value.hand, finger: value.finger };
      }
    }

    // === Build moment assignments (Invariant E: full moment cost) ===
    const momentAssignments: MomentAssignment[] = [];
    let unplayableMomentCount = 0;
    let hardMomentCount = 0;

    // Group fingerAssignments by startTime into moments
    const momentGroups = new Map<number, FingerAssignment[]>();
    for (const fa of fingerAssignments) {
      const timeKey = Math.round(fa.startTime * 1000); // ms resolution
      if (!momentGroups.has(timeKey)) momentGroups.set(timeKey, []);
      momentGroups.get(timeKey)!.push(fa);
    }

    const sortedTimeKeys = [...momentGroups.keys()].sort((a, b) => a - b);
    for (let mIdx = 0; mIdx < sortedTimeKeys.length; mIdx++) {
      const timeKey = sortedTimeKeys[mIdx];
      const groupAssignments = momentGroups.get(timeKey)!;
      const startTime = groupAssignments[0].startTime;

      // Use the first non-unplayable assignment's cost as the moment cost,
      // since cost is now moment-level (all assignments in the group share it)
      const playableAssignment = groupAssignments.find(a => a.assignedHand !== 'Unplayable');
      const momentCost = playableAssignment?.cost ?? Infinity;
      const momentDifficulty = getDifficulty(momentCost);
      const momentBreakdown = playableAssignment?.costBreakdown ?? {
        ...createZeroV1CostBreakdown(), total: Infinity,
      };

      if (momentDifficulty === 'Unplayable') unplayableMomentCount++;
      else if (momentDifficulty === 'Hard') hardMomentCount++;

      const noteAssignments: NoteAssignmentInfo[] = groupAssignments.map(fa => ({
        noteNumber: fa.noteNumber,
        soundId: fa.voiceId ?? String(fa.noteNumber),
        padId: fa.padId ?? (fa.row !== undefined && fa.col !== undefined ? `${fa.row},${fa.col}` : ''),
        row: fa.row ?? 0,
        col: fa.col ?? 0,
        hand: fa.assignedHand,
        finger: fa.finger,
        noteKey: fa.eventKey,
      }));

      momentAssignments.push({
        momentIndex: mIdx,
        startTime,
        noteAssignments,
        cost: momentCost,
        difficulty: momentDifficulty,
        costBreakdown: momentBreakdown,
      });
    }

    // computePlanScore is calibrated in MOMENTS (see planScore.ts), so it must be
    // fed the moment counters, not the per-event ones. Passing event counts here
    // made the beam path report 0/100 for layouts the greedy path scored 96, even
    // though both claim to produce the same comparable 0-100 "Score".
    //
    // The ergonomic term comes from the canonical evaluator rather than this
    // solver's own internal cost. The two are on different scales, so feeding
    // each path its own number left the same layout scoring 94 through Generate
    // and 82 through auto-analysis — the engine contract asks for ONE coherent
    // cost story, and this is where the user reads it.
    const canonicalPerMomentCost = this.canonicalPerMomentCost(
      padFingerOwnership, sortedEvents, config,
    );
    const score = computePlanScore({
      hardCount: hardMomentCount,
      unplayableCount: unplayableMomentCount,
      avgErgonomicCost: canonicalPerMomentCost ?? averageMetrics.total,
    });

    // Post-hoc diagnostics for unplayable events
    const rejectionReasons = unplayableCount > 0 && eventsWithPositions
      ? this.diagnoseUnplayableEvents(assignments, totalEvents, unmappedIndices, sortedEvents, eventsWithPositions, groups, exhaustedGroupIndices)
      : undefined;

    return {
      score,
      unplayableCount,
      hardCount,
      fingerAssignments,
      padFingerOwnership,
      momentAssignments,
      unplayableMomentCount,
      hardMomentCount,
      fingerUsageStats,
      fatigueMap,
      averageDrift: driftCount > 0 ? totalDrift / driftCount : 0,
      averageMetrics,
      layoutBinding: this.layout ? {
        layoutId: this.layout.id,
        layoutHash: hashLayout(this.layout),
        layoutRole: this.sourceLayoutRole ?? this.layout.role ?? 'active',
      } as ExecutionPlanLayoutBinding : undefined,
      diagnostics,
      rejectionReasons,
      metadata: {
        layoutIdUsed: this.layout?.id,
        layoutHashUsed: this.layout ? hashLayout(this.layout) : undefined,
        layoutCoverage: coverage,
        strictMode: this.mappingResolverMode === 'strict',
        beamWidthUsed: config.beamWidth,
        objectiveTotal: averageMetrics.total,
        objectiveComponentsSummary: {
          transition: totalV1Cost.transitionCost,
          fingerPreference: totalV1Cost.fingerPreference,
          handShapeDeviation: totalV1Cost.handShapeDeviation,
          alternation: 0,
          handBalance: totalV1Cost.handBalance,
          constraintPenalty: totalV1Cost.constraintPenalty,
        },
      },
    };
  }

  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): Promise<ExecutionPlanResult> {
    return Promise.resolve(this.solveSync(performance, config, manualAssignments));
  }

  public solveSync(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: FingerType }>
  ): ExecutionPlanResult {
    // Compute neutral hand centers
    let neutralHandCenters: NeutralHandCentersResult | null = null;
    if (this.neutralPadPositionsOverride) {
      try {
        const result = computeNeutralHandCenters(this.neutralPadPositionsOverride as RichNeutralPadPositions);
        neutralHandCenters = result;
      } catch {
        // Fall back to layout-based centers
      }
    }

    if (!neutralHandCenters && this.layout) {
      try {
        const result = getNeutralHandCenters(this.layout, this.instrumentConfig);
        neutralHandCenters = result;
      } catch {
        // Continue without neutral centers
      }
    }

    // V1 (D-05, D-20): Precompute natural pairwise distances for hand shape deviation
    const naturalPads = neutralHandCenters?.neutralPads;
    const leftNaturalDistances = naturalPads
      ? buildNaturalPairwiseDistances(naturalPads, 'left')
      : new Map<string, number>();
    const rightNaturalDistances = naturalPads
      ? buildNaturalPairwiseDistances(naturalPads, 'right')
      : new Map<string, number>();

    // When Pose 0 override is present, use it as the resting pose.
    const effectiveRestingPose = this.neutralPadPositionsOverride
      ? (restingPoseFromNeutralPadPositions(this.neutralPadPositionsOverride as RichNeutralPadPositions) ?? config.restingPose)
      : config.restingPose;
    const effectiveConfig: EngineConfiguration = {
      ...config,
      restingPose: effectiveRestingPose,
    };

    // Sort events by time
    const sortedEvents = [...performance.events]
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => {
        const dt = a.event.startTime - b.event.startTime;
        if (dt !== 0) return dt;
        const ch = (a.event.channel ?? 0) - (b.event.channel ?? 0);
        if (ch !== 0) return ch;
        const nn = a.event.noteNumber - b.event.noteNumber;
        if (nn !== 0) return nn;
        return (a.event.eventKey ?? '').localeCompare(b.event.eventKey ?? '');
      });

    // Build pad lookup indices — voiceId-first, noteNumber-fallback
    const padToVoice = this.layout?.padToVoice ?? {};
    const noteToPadIndex = buildNoteToPadIndex(padToVoice);
    const voiceIdToPadIndex = buildVoiceIdToPadIndex(padToVoice);
    const effectiveMode = this.layout === null ? 'allow-fallback' : this.mappingResolverMode;
    const eventsWithPositions = sortedEvents.map(({ event, originalIndex }) => {
      const res = resolveEventToPad(event, voiceIdToPadIndex, noteToPadIndex, this.instrumentConfig, effectiveMode);
      const position: PadCoord | null =
        res.source === 'mapping' || res.source === 'fallback'
          ? { row: res.pad.row, col: res.pad.col }
          : null;
      return { event, index: originalIndex, position, resolutionSource: res.source };
    });

    // Track unmapped notes and fallback count
    const unmappedIndices = new Set<number>();
    let fallbackCount = 0;
    eventsWithPositions.forEach(({ index, position, resolutionSource }) => {
      if (!position) unmappedIndices.add(index);
      else if (resolutionSource === 'fallback') fallbackCount++;
    });

    // Group events by timestamp
    const groups = groupEventsByTimestamp(eventsWithPositions);

    // Initialize beam
    let beam = this.createInitialBeam(effectiveConfig);
    let prevTimestamp = 0;

    // Track which groups had beam exhaustion (no valid expansions at all)
    const exhaustedGroupIndices = new Set<number>();
    // Track which groups needed a best-effort assignment (playable, but strained)
    const bestEffortGroupIndices = new Set<number>();

    // Process each group
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const newBeam: BeamNode[] = [];

      for (const node of beam) {
        // Check for manual override
        const overrideIdx = group.eventIndices.findIndex((idx, i) => {
          const key = group.eventKeys[i];
          if (key !== undefined && manualAssignments && manualAssignments[key]) return true;
          if (manualAssignments && manualAssignments[idx.toString()]) return true;
          return false;
        });

        const hasManualOverride = overrideIdx !== -1;

        if (hasManualOverride && manualAssignments) {
          const idx = group.eventIndices[overrideIdx];
          const key = group.eventKeys[overrideIdx];
          const override = (key !== undefined && manualAssignments[key])
            ? manualAssignments[key]
            : manualAssignments[idx.toString()];

          if (override) {
            const gripResults = generateValidGripsWithTier(group.activePads, override.hand);
            // The user's preference is about ONE pad, so pick a grip that puts the
            // requested finger on THAT pad. Previously any grip merely containing
            // the finger was accepted, and the finger then landed on whichever note
            // happened to share its index — so the panels showed a fingering the
            // user never asked for.
            const overridePos = group.positions[overrideIdx];
            const matchingResult =
              gripResults.find(r => {
                const coord = r.pose.fingers[override.finger];
                return coord !== undefined
                  && coord.x === overridePos.col
                  && coord.y === overridePos.row;
              })
              ?? gripResults.find(r => Object.keys(r.pose.fingers).includes(override.finger))
              ?? gripResults[0];

            if (matchingResult) {
              const timeDelta = group.timestamp - prevTimestamp;
              const prevPose = override.hand === 'left' ? node.leftPose : node.rightPose;
              const transitionCost = calculateTransitionCost(prevPose, matchingResult.pose, timeDelta);

              // V1 (D-05, D-20): Translation-invariant hand shape deviation
              const manualNaturalDist = override.hand === 'left' ? leftNaturalDistances : rightNaturalDistances;
              const manualShapeDev = calculateHandShapeDeviation(matchingResult.pose, manualNaturalDist);
              const manualFingerPref = calculateFingerPreferenceCost(matchingResult.pose);

              // V1 (D-01): No tier penalties — all grips are strict tier
              const manualConstraintPenalty = 0;
              const effectiveTransition = transitionCost;

              // Primary score (V1: shape deviation + finger preference + transition)
              const poseNat = manualShapeDev + manualFingerPref;
              const stepCostForBeam = combinePerformabilityComponents({
                poseNaturalness: poseNat,
                transitionDifficulty: effectiveTransition,
                constraintPenalty: manualConstraintPenalty,
              });

              // V1 cost breakdown (moment-level — NOT divided per-note)
              const stepComponents: V1CostBreakdown = {
                fingerPreference: manualFingerPref,
                handShapeDeviation: manualShapeDev,
                alternation: 0,
                transitionCost: effectiveTransition,
                handBalance: 0,
                constraintPenalty: manualConstraintPenalty,
                total: stepCostForBeam,
              };

              const assignments: NoteAssignment[] = [];
              const n = group.notes.length;
              const gripFingers = Object.keys(matchingResult.pose.fingers) as FingerType[];

              // Match each note to the finger standing on that note's pad — the same
              // resolution the normal expansion paths use.
              const overrideFingers: FingerType[] = group.positions.map((pos) => {
                for (const [f, coord] of Object.entries(matchingResult.pose.fingers)) {
                  if (coord.x === pos.col && coord.y === pos.row) return f as FingerType;
                }
                return gripFingers[0] ?? override.finger;
              });

              for (let i = 0; i < n; i++) {
                assignments.push({
                  eventIndex: group.eventIndices[i],
                  eventKey: group.eventKeys[i],
                  noteNumber: group.notes[i].noteNumber,
                  voiceId: group.notes[i].voiceId,
                  startTime: group.notes[i].startTime,
                  hand: override.hand,
                  finger: overrideFingers[i],
                  grip: matchingResult.pose,
                  cost: stepComponents.total,
                  row: group.positions[i].row,
                  col: group.positions[i].col,
                  costComponents: stepComponents,
                });
              }

              const newLeftCount = node.leftCount + (override.hand === 'left' ? n : 0);
              const newRightCount = node.rightCount + (override.hand === 'right' ? n : 0);

              // Update pad ownership for manually overridden pads
              const newPadOwnership = new Map(node.padOwnership);
              for (let i = 0; i < n; i++) {
                const pKey = `${group.positions[i].row},${group.positions[i].col}`;
                if (!newPadOwnership.has(pKey)) {
                  newPadOwnership.set(pKey, {
                    hand: override.hand,
                    finger: overrideFingers[i],
                  });
                }
              }

              newBeam.push({
                leftPose: override.hand === 'left' ? matchingResult.pose : node.leftPose,
                rightPose: override.hand === 'right' ? matchingResult.pose : node.rightPose,
                totalCost: node.totalCost + stepCostForBeam,
                parent: node,
                assignments,
                depth: node.depth + 1,
                leftCount: newLeftCount,
                rightCount: newRightCount,
                padOwnership: newPadOwnership,
                prevFingers: overrideFingers.map(finger => ({ hand: override.hand, finger })),
                prevTimestamp: group.timestamp,
              });
            }
            continue;
          }
        }

        // Standard expansion
        const natDist = { left: leftNaturalDistances, right: rightNaturalDistances };
        const children = this.expandNodeForGroup(node, group, prevTimestamp, effectiveConfig, neutralHandCenters, natDist);
        newBeam.push(...children);

        // Split-hand approach for chords
        if (group.activePads.length >= 2) {
          const splitChildren = this.expandNodeForSplitChord(node, group, prevTimestamp, config, neutralHandCenters, natDist);
          newBeam.push(...splitChildren);
        }
      }

      // If no ergonomically preferred option survived for this moment, fall back to
      // a best-effort assignment rather than dropping the notes. Dropped notes were
      // previously surfaced to the user as "Unplayable", which misreported a search
      // dead end as a physical impossibility.
      if (newBeam.length === 0) {
        for (const node of beam) {
          const child = this.buildBestEffortChild(node, group, prevTimestamp);
          if (child) newBeam.push(child);
        }
        if (newBeam.length > 0) {
          bestEffortGroupIndices.add(gi);
        } else {
          // Genuinely beyond two hands — the one honest unplayable verdict.
          exhaustedGroupIndices.add(gi);
        }
      }

      if (newBeam.length > 0) {
        beam = this.pruneBeam(newBeam, effectiveConfig.beamWidth);
      }
      prevTimestamp = group.timestamp;
    }

    // Find best node
    const requiredNotes = new Set(performance.events.map(e => e.noteNumber));
    const unmappedNoteNumbers = new Set(
      eventsWithPositions.filter(e => !e.position).map(e => e.event.noteNumber)
    );
    const coverage = {
      totalNotes: requiredNotes.size,
      unmappedNotesCount: unmappedNoteNumbers.size,
      fallbackNotesCount: fallbackCount,
    };

    if (beam.length === 0) {
      return this.buildResult([], performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage, new Map(), eventsWithPositions, groups, exhaustedGroupIndices);
    }

    const bestNode = beam.reduce((best, node) =>
      node.totalCost < best.totalCost ? node : best
    );

    const assignments = this.backtrack(bestNode);
    return this.buildResult(assignments, performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage, bestNode.padOwnership, eventsWithPositions, groups, exhaustedGroupIndices);
  }
}

/** Factory function to create a BeamSolver instance. */
export function createBeamSolver(config: SolverConfig): BeamSolver {
  return new BeamSolver(config);
}
