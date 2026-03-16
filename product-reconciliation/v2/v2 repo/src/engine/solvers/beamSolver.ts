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
  type DifficultyBreakdown,
} from '../../types/executionPlan';
import { buildNoteToPadIndex, buildVoiceIdToPadIndex, resolveEventToPad, hashLayout } from '../mapping/mappingResolver';
import { generateValidGripsWithTier } from '../prior/feasibility';
import {
  calculatePoseNaturalness,
  calculateAttractorCost,
  calculateTransitionCost,
  calculateFingerDominanceCost,
  calculatePerFingerHomeCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
  FALLBACK_GRIP_PENALTY,
  RELAXED_GRIP_PENALTY,
} from '../evaluation/costFunction';
import {
  type PerformabilityObjective,
  type ObjectiveComponents,
  combinePerformabilityComponents,
  combineComponents,
  objectiveToDifficultyBreakdown,
  objectiveToCanonicalFactors,
  objectiveToGripDetail,
  createZeroComponents,
} from '../evaluation/objective';
import {
  type DiagnosticsPayload,
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

/**
 * Weight for alternation cost in beam score.
 * Penalizes same-finger rapid repetition — critical for percussion playability.
 * Value 0.8: strong enough to influence finger choice on fast passages,
 * mild enough not to override transition/pose costs on slow passages.
 */
const ALTERNATION_BEAM_WEIGHT = 0.8;

/**
 * Weight for hand balance cost in beam score.
 * Prevents extreme single-hand dominance.
 * Value 0.3: mild bias toward balanced usage without overriding
 * legitimate one-hand-only passages.
 */
const HAND_BALANCE_BEAM_WEIGHT = 0.3;

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
  costComponents?: ObjectiveComponents;
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

function getDifficulty(cost: number): 'Easy' | 'Medium' | 'Hard' | 'Unplayable' {
  if (cost === Infinity || cost > 100) return 'Unplayable';
  if (cost > 10) return 'Hard';
  if (cost > 3) return 'Medium';
  return 'Easy';
}

function groupEventsByTimestamp(
  events: Array<{ event: PerformanceEvent; index: number; position: PadCoord | null }>
): PerformanceGroup[] {
  const TIME_EPSILON = 0.001;
  const groups: PerformanceGroup[] = [];
  let currentGroup: PerformanceGroup | null = null;

  for (const { event, index, position } of events) {
    if (!position) continue;

    const pad: PadCoord = { row: position.row, col: position.col };

    if (!currentGroup || event.startTime - currentGroup.timestamp > TIME_EPSILON) {
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
// Lookahead Helpers
// ============================================================================

/** Average centroid of a set of pads (for 1-step lookahead). */
function averagePadCentroid(pads: PadCoord[]): { x: number; y: number } {
  if (pads.length === 0) return { x: 3.5, y: 3.5 };
  let sumX = 0, sumY = 0;
  for (const pad of pads) {
    sumX += pad.col;
    sumY += pad.row;
  }
  return { x: sumX / pads.length, y: sumY / pads.length };
}

/**
 * Lookahead bonus: rewards grips that leave the hand close to the next group's pads.
 * Strengthened from original (10% cap, 3.0 range) to (20% cap, 4.0 range)
 * so the bonus can meaningfully influence beam ranking for phrase-level planning.
 */
function computeLookaheadBonus(
  gripCentroid: { x: number; y: number },
  nextGroup: PerformanceGroup,
  stepCost: number
): number {
  if (stepCost <= 0) return 0;
  const nextCentroid = averagePadCentroid(nextGroup.activePads);
  const dx = gripCentroid.x - nextCentroid.x;
  const dy = gripCentroid.y - nextCentroid.y;
  const distToNext = Math.sqrt(dx * dx + dy * dy);

  // Bonus proportional to proximity, capped at 20% of step cost
  const proximityBonus = Math.max(0, 4.0 - distToNext) * 0.6;
  return Math.min(stepCost * 0.2, proximityBonus);
}

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

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.layout = config.layout ?? null;
    this.sourceLayoutRole = config.sourceLayoutRole ?? config.layout?.role;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.mappingResolverMode = config.mappingResolverMode ?? 'strict';
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
    }];
  }

  private expandNodeForGroup(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    config: EngineConfiguration,
    neutralHandCenters?: NeutralHandCentersResult | null,
    nextGroup?: PerformanceGroup | null
  ): BeamNode[] {
    const children: BeamNode[] = [];
    const rawTimeDelta = group.timestamp - prevTimestamp;
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;
    const { stiffness, restingPose } = config;

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

      const prevPose = hand === 'left' ? node.leftPose : node.rightPose;
      const restPose = hand === 'left' ? restingPose.left : restingPose.right;

      const gripResults = generateValidGripsWithTier(uniquePads, hand);

      for (const gripResult of gripResults) {
        const { pose: grip, isFallback, tier } = gripResult;
        const transitionCost = calculateTransitionCost(prevPose, grip, timeDelta);

        if (transitionCost === Infinity && !isFirstGroup && !isFallback) continue;

        const effectiveTransitionCost = transitionCost === Infinity ? 0 : transitionCost;
        const attractorCost = calculateAttractorCost(grip, restPose, stiffness);
        const staticCost = calculateFingerDominanceCost(grip);
        const perFingerHomeCost = neutralHandCenters
          ? calculatePerFingerHomeCost(grip, hand, neutralHandCenters, 0.8)
          : 0;
        // Tier-based penalty: Tier 2 (relaxed) gets moderate penalty,
        // Tier 3 (fallback) gets severe penalty, Tier 1 (strict) gets none.
        const constraintPenalty = isFallback
          ? FALLBACK_GRIP_PENALTY
          : tier === 'relaxed'
            ? RELAXED_GRIP_PENALTY
            : 0;

        // Diagnostic-only costs (computed for display, not in beam score)
        const prevAssignments = node.assignments.map(a => ({ hand: a.hand, finger: a.finger }));
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

        const currentAssignments = resolvedFingers.map(finger => ({ hand, finger }));
        const alternationCost = calculateAlternationCost(prevAssignments, currentAssignments, rawTimeDelta);

        const newLeftCount = node.leftCount + (hand === 'left' ? group.notes.length : 0);
        const newRightCount = node.rightCount + (hand === 'right' ? group.notes.length : 0);
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        // === PRIMARY SCORE (3-component PerformabilityObjective) ===
        const poseNaturalness = calculatePoseNaturalness(
          grip, restPose, stiffness, hand, neutralHandCenters ?? null
        );
        const perfComponents: PerformabilityObjective = {
          poseNaturalness,
          transitionDifficulty: effectiveTransitionCost,
          constraintPenalty,
        };
        let stepCostForBeam = combinePerformabilityComponents(perfComponents);

        // === ALTERNATION COST (promotes finger variety on rapid passages) ===
        stepCostForBeam += alternationCost * ALTERNATION_BEAM_WEIGHT;

        // === HAND BALANCE COST (prevents single-hand dominance) ===
        stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;

        // === 1-STEP LOOKAHEAD BONUS ===
        if (nextGroup && stepCostForBeam > 0) {
          const bonus = computeLookaheadBonus(grip.centroid, nextGroup, stepCostForBeam);
          stepCostForBeam -= bonus;
        }

        const newTotalCost = node.totalCost + stepCostForBeam;

        // === LEGACY DISPLAY COMPONENTS (7-component, for UI backward compatibility) ===
        const stepComponents: ObjectiveComponents = {
          transition: effectiveTransitionCost,
          stretch: staticCost,
          poseAttractor: attractorCost,
          perFingerHome: perFingerHomeCost,
          alternation: alternationCost,
          handBalance: handBalanceCost,
          constraints: constraintPenalty,
        };
        const displayStepCost = combineComponents(stepComponents);

        if (gripFingers.length === 0 || gripFingers.length < uniquePads.length) continue;

        const assignments: NoteAssignment[] = [];
        const n = group.notes.length;
        const costPerNote = displayStepCost / n;
        const componentsPerNote: ObjectiveComponents = {
          transition: stepComponents.transition / n,
          stretch: stepComponents.stretch / n,
          poseAttractor: stepComponents.poseAttractor / n,
          perFingerHome: stepComponents.perFingerHome / n,
          alternation: stepComponents.alternation / n,
          handBalance: stepComponents.handBalance / n,
          constraints: stepComponents.constraints / n,
        };

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
            cost: costPerNote,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: componentsPerNote,
          });
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
        });
      }
    }

    return children;
  }

  private expandNodeForSplitChord(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    config: EngineConfiguration,
    neutralHandCenters?: NeutralHandCentersResult | null,
    nextGroup?: PerformanceGroup | null
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
    const { stiffness, restingPose } = config;

    const sortedPads = [...uniquePads].sort((a, b) => a.col - b.col);
    const midpoint = Math.ceil(sortedPads.length / 2);
    const leftPads = sortedPads.slice(0, midpoint);
    const rightPads = sortedPads.slice(midpoint);

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

        if ((leftTransition === Infinity || rightTransition === Infinity) && !isFirstGroup) continue;

        const effectiveLeftTransition = leftTransition === Infinity ? 0 : leftTransition;
        const effectiveRightTransition = rightTransition === Infinity ? 0 : rightTransition;
        const leftAttractor = calculateAttractorCost(leftResult.pose, restingPose.left, stiffness);
        const rightAttractor = calculateAttractorCost(rightResult.pose, restingPose.right, stiffness);
        const leftStatic = calculateFingerDominanceCost(leftResult.pose);
        const rightStatic = calculateFingerDominanceCost(rightResult.pose);
        const leftHome = neutralHandCenters ? calculatePerFingerHomeCost(leftResult.pose, 'left', neutralHandCenters, 0.8) : 0;
        const rightHome = neutralHandCenters ? calculatePerFingerHomeCost(rightResult.pose, 'right', neutralHandCenters, 0.8) : 0;
        // Tier-based penalties for each hand
        const leftConstraintPenalty = leftResult.isFallback
          ? FALLBACK_GRIP_PENALTY
          : leftResult.tier === 'relaxed'
            ? RELAXED_GRIP_PENALTY
            : 0;
        const rightConstraintPenalty = rightResult.isFallback
          ? FALLBACK_GRIP_PENALTY
          : rightResult.tier === 'relaxed'
            ? RELAXED_GRIP_PENALTY
            : 0;

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

        // Diagnostic-only costs
        const prevAssignments = node.assignments.map(a => ({ hand: a.hand, finger: a.finger }));
        const currentAssignments: Array<{ hand: 'left' | 'right'; finger: FingerType }> = [
          ...resolvedLeftFingers.map(finger => ({ hand: 'left' as const, finger })),
          ...resolvedRightFingers.map(finger => ({ hand: 'right' as const, finger })),
        ];
        const alternationCost = calculateAlternationCost(prevAssignments, currentAssignments, rawTimeDelta);

        const newLeftCount = node.leftCount + leftNoteIndices.length;
        const newRightCount = node.rightCount + rightNoteIndices.length;
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        // === PRIMARY SCORE (3-component PerformabilityObjective) ===
        const leftPoseNat = calculatePoseNaturalness(
          leftResult.pose, restingPose.left, stiffness, 'left', neutralHandCenters ?? null
        );
        const rightPoseNat = calculatePoseNaturalness(
          rightResult.pose, restingPose.right, stiffness, 'right', neutralHandCenters ?? null
        );
        const perfComponents: PerformabilityObjective = {
          poseNaturalness: leftPoseNat + rightPoseNat,
          transitionDifficulty: effectiveLeftTransition + effectiveRightTransition,
          constraintPenalty: leftConstraintPenalty + rightConstraintPenalty,
        };
        let stepCostForBeam = combinePerformabilityComponents(perfComponents);

        // === ALTERNATION COST (promotes finger variety on rapid passages) ===
        stepCostForBeam += alternationCost * ALTERNATION_BEAM_WEIGHT;

        // === HAND BALANCE COST (prevents single-hand dominance) ===
        stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;

        // === 1-STEP LOOKAHEAD BONUS ===
        if (nextGroup && stepCostForBeam > 0) {
          // Use average of both hand centroids for split-chord lookahead
          const avgCentroid = {
            x: (leftResult.pose.centroid.x + rightResult.pose.centroid.x) / 2,
            y: (leftResult.pose.centroid.y + rightResult.pose.centroid.y) / 2,
          };
          const bonus = computeLookaheadBonus(avgCentroid, nextGroup, stepCostForBeam);
          stepCostForBeam -= bonus;
        }

        // === LEGACY DISPLAY COMPONENTS (7-component) ===
        const stepComponents: ObjectiveComponents = {
          transition: effectiveLeftTransition + effectiveRightTransition,
          stretch: leftStatic + rightStatic,
          poseAttractor: leftAttractor + rightAttractor,
          perFingerHome: leftHome + rightHome,
          alternation: alternationCost,
          handBalance: handBalanceCost,
          constraints: leftConstraintPenalty + rightConstraintPenalty,
        };
        const displayStepCost = combineComponents(stepComponents);

        const assignments: NoteAssignment[] = [];
        const n = group.notes.length;
        const costPerNote = displayStepCost / n;
        const componentsPerNote: ObjectiveComponents = {
          transition: stepComponents.transition / n,
          stretch: stepComponents.stretch / n,
          poseAttractor: stepComponents.poseAttractor / n,
          perFingerHome: stepComponents.perFingerHome / n,
          alternation: stepComponents.alternation / n,
          handBalance: stepComponents.handBalance / n,
          constraints: stepComponents.constraints / n,
        };

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
            cost: costPerNote,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: componentsPerNote,
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
            cost: costPerNote,
            row: group.positions[i].row,
            col: group.positions[i].col,
            costComponents: componentsPerNote,
          });
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
        });
      }
    }

    return children;
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

  private buildResult(
    assignments: NoteAssignment[],
    totalEvents: number,
    unmappedIndices: Set<number>,
    config: EngineConfiguration,
    sortedEvents: Array<{ event: PerformanceEvent; originalIndex: number }>,
    coverage: { totalNotes: number; unmappedNotesCount: number; fallbackNotesCount: number }
  ): ExecutionPlanResult {
    const fingerAssignments: FingerAssignment[] = [];
    const fingerUsageStats: FingerUsageStats = {};
    const fatigueMap: FatigueMap = {};

    let totalCost = 0;
    let unplayableCount = unmappedIndices.size;
    let hardCount = 0;
    let totalDrift = 0;
    let driftCount = 0;

    const totalMetrics: DifficultyBreakdown = {
      movement: 0, stretch: 0, drift: 0, bounce: 0,
      fatigue: 0, crossover: 0, total: 0,
    };

    // Phase 3: Accumulate canonical ObjectiveComponents for diagnostics
    const totalObjectiveComponents = createZeroComponents();
    let fallbackGripCount = 0;

    const assignmentMap = new Map<number, NoteAssignment>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.eventIndex, assignment);
    }

    for (let i = 0; i < totalEvents; i++) {
      const assignment = assignmentMap.get(i);

      if (unmappedIndices.has(i)) {
        const ev = sortedEvents[i]?.event;
        fingerAssignments.push({
          noteNumber: ev?.noteNumber ?? 0,
          voiceId: ev?.voiceId,
          startTime: ev?.startTime ?? 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          costBreakdown: {
            movement: 0, stretch: 0, drift: 0, bounce: 0,
            fatigue: 0, crossover: 0, total: Infinity,
          },
          difficulty: 'Unplayable',
          eventIndex: i,
          eventKey: ev?.eventKey,
        });
        continue;
      }

      if (!assignment) {
        unplayableCount++;
        fingerAssignments.push({
          noteNumber: 0, startTime: 0,
          assignedHand: 'Unplayable', finger: null,
          cost: Infinity,
          costBreakdown: {
            movement: 0, stretch: 0, drift: 0, bounce: 0,
            fatigue: 0, crossover: 0, total: Infinity,
          },
          difficulty: 'Unplayable',
          eventIndex: i,
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

      const costBreakdown: DifficultyBreakdown = assignment.costComponents
        ? objectiveToDifficultyBreakdown(assignment.costComponents)
        : {
            movement: assignment.cost * 0.4,
            stretch: assignment.cost * 0.2,
            drift: assignment.cost * 0.2,
            bounce: 0,
            fatigue: assignment.cost * 0.1,
            crossover: assignment.cost * 0.1,
            total: assignment.cost,
          };

      totalMetrics.movement += costBreakdown.movement;
      totalMetrics.stretch += costBreakdown.stretch;
      totalMetrics.drift += costBreakdown.drift;
      totalMetrics.fatigue += costBreakdown.fatigue;
      totalMetrics.crossover += costBreakdown.crossover;
      totalMetrics.total += costBreakdown.total;
      totalCost += assignment.cost;

      // Phase 3: Accumulate canonical objective components
      if (assignment.costComponents) {
        totalObjectiveComponents.transition += assignment.costComponents.transition;
        totalObjectiveComponents.stretch += assignment.costComponents.stretch;
        totalObjectiveComponents.poseAttractor += assignment.costComponents.poseAttractor;
        totalObjectiveComponents.perFingerHome += assignment.costComponents.perFingerHome;
        totalObjectiveComponents.alternation += assignment.costComponents.alternation;
        totalObjectiveComponents.handBalance += assignment.costComponents.handBalance;
        totalObjectiveComponents.constraints += assignment.costComponents.constraints;
        if (assignment.costComponents.constraints > 0) fallbackGripCount++;
      }

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
    const averageMetrics: DifficultyBreakdown = eventCount > 0 ? {
      movement: totalMetrics.movement / eventCount,
      stretch: totalMetrics.stretch / eventCount,
      drift: totalMetrics.drift / eventCount,
      bounce: 0,
      fatigue: totalMetrics.fatigue / eventCount,
      crossover: totalMetrics.crossover / eventCount,
      total: totalMetrics.total / eventCount,
    } : {
      movement: 0, stretch: 0, drift: 0, bounce: 0,
      fatigue: 0, crossover: 0, total: 0,
    };

    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const finger of fingerTypes) {
      fatigueMap[`L-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
      fatigueMap[`R-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
    }

    let score = 100 - (5 * hardCount) - (20 * unplayableCount);
    if (score < 0) score = 0;

    // Phase 3: Build canonical diagnostics payload
    const canonicalFactors = objectiveToCanonicalFactors(totalObjectiveComponents);
    const gripDetail = objectiveToGripDetail(totalObjectiveComponents);
    const feasibility = deriveFeasibilityVerdict(
      unplayableCount,
      hardCount,
      unmappedIndices.size,
      fallbackGripCount,
      totalEvents,
    );
    const diagnostics: DiagnosticsPayload = {
      feasibility,
      factors: canonicalFactors,
      gripDetail,
      topContributors: computeTopContributors(canonicalFactors),
    };

    return {
      score,
      unplayableCount,
      hardCount,
      fingerAssignments,
      fingerUsageStats,
      fatigueMap,
      averageDrift: driftCount > 0 ? totalDrift / driftCount : 0,
      averageMetrics,
      // Layout binding: tracks which layout state this plan was computed against
      layoutBinding: this.layout ? {
        layoutId: this.layout.id,
        layoutHash: hashLayout(this.layout),
        layoutRole: this.sourceLayoutRole ?? this.layout.role ?? 'active',
      } as ExecutionPlanLayoutBinding : undefined,
      diagnostics,
      metadata: {
        layoutIdUsed: this.layout?.id,
        layoutHashUsed: this.layout ? hashLayout(this.layout) : undefined,
        layoutCoverage: coverage,
        strictMode: this.mappingResolverMode === 'strict',
        beamWidthUsed: config.beamWidth,
        objectiveTotal: averageMetrics.total,
        objectiveComponentsSummary: {
          transition: totalMetrics.movement,
          stretch: totalMetrics.stretch,
          poseAttractor: totalMetrics.drift,
          perFingerHome: totalMetrics.fatigue,
          alternation: totalMetrics.bounce,
          handBalance: 0,
          constraints: totalMetrics.crossover,
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

    // When Pose 0 override is present, use it as the resting pose.
    // Stiffness is no longer doubled — the original 2× multiplier over-constrained
    // the solver when Pose0 was defined, making it reluctant to deviate from rest
    // even when the music demanded it. The attractor + per-finger-home costs
    // already provide adequate pull toward the resting pose.
    const effectiveRestingPose = this.neutralPadPositionsOverride
      ? (restingPoseFromNeutralPadPositions(this.neutralPadPositionsOverride as RichNeutralPadPositions) ?? config.restingPose)
      : config.restingPose;
    const effectiveStiffness = config.stiffness;
    const effectiveConfig: EngineConfiguration = {
      ...config,
      restingPose: effectiveRestingPose,
      stiffness: effectiveStiffness,
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

    // Process each group (index-based for lookahead access)
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const nextGroup = gi + 1 < groups.length ? groups[gi + 1] : null;
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
            const matchingResult = gripResults.find(r =>
              Object.keys(r.pose.fingers).includes(override.finger)
            ) || gripResults[0];

            if (matchingResult) {
              const timeDelta = group.timestamp - prevTimestamp;
              const prevPose = override.hand === 'left' ? node.leftPose : node.rightPose;
              const restPose = override.hand === 'left'
                ? effectiveConfig.restingPose.left
                : effectiveConfig.restingPose.right;

              const transitionCost = calculateTransitionCost(prevPose, matchingResult.pose, timeDelta);
              const attractorCost = calculateAttractorCost(matchingResult.pose, restPose, effectiveConfig.stiffness);
              const staticCost = calculateFingerDominanceCost(matchingResult.pose);
              const perFingerHomeCost = neutralHandCenters
                ? calculatePerFingerHomeCost(matchingResult.pose, override.hand, neutralHandCenters, 0.8)
                : 0;
              const manualConstraintPenalty = matchingResult.isFallback
                ? FALLBACK_GRIP_PENALTY
                : matchingResult.tier === 'relaxed'
                  ? RELAXED_GRIP_PENALTY
                  : 0;
              const effectiveTransition = transitionCost === Infinity ? 100 : transitionCost;

              // Primary score (3-component) for beam
              const poseNat = calculatePoseNaturalness(
                matchingResult.pose, restPose, effectiveConfig.stiffness,
                override.hand, neutralHandCenters ?? null
              );
              const stepCostForBeam = combinePerformabilityComponents({
                poseNaturalness: poseNat,
                transitionDifficulty: effectiveTransition,
                constraintPenalty: manualConstraintPenalty,
              });

              // Legacy display components (7-component)
              const stepComponents: ObjectiveComponents = {
                transition: effectiveTransition,
                stretch: staticCost,
                poseAttractor: attractorCost,
                perFingerHome: perFingerHomeCost,
                alternation: 0,
                handBalance: 0,
                constraints: manualConstraintPenalty,
              };
              const displayStepCost = combineComponents(stepComponents);

              const assignments: NoteAssignment[] = [];
              const n = group.notes.length;
              const costPerNote = displayStepCost / n;
              const componentsPerNote: ObjectiveComponents = {
                transition: stepComponents.transition / n,
                stretch: stepComponents.stretch / n,
                poseAttractor: stepComponents.poseAttractor / n,
                perFingerHome: stepComponents.perFingerHome / n,
                alternation: 0, handBalance: 0,
                constraints: stepComponents.constraints / n,
              };
              const gripFingers = Object.keys(matchingResult.pose.fingers) as FingerType[];

              for (let i = 0; i < n; i++) {
                assignments.push({
                  eventIndex: group.eventIndices[i],
                  eventKey: group.eventKeys[i],
                  noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
                  startTime: group.notes[i].startTime,
                  hand: override.hand,
                  finger: gripFingers[i % gripFingers.length] || override.finger,
                  grip: matchingResult.pose,
                  cost: costPerNote,
                  row: group.positions[i].row,
                  col: group.positions[i].col,
                  costComponents: componentsPerNote,
                });
              }

              const newLeftCount = node.leftCount + (override.hand === 'left' ? n : 0);
              const newRightCount = node.rightCount + (override.hand === 'right' ? n : 0);

              newBeam.push({
                leftPose: override.hand === 'left' ? matchingResult.pose : node.leftPose,
                rightPose: override.hand === 'right' ? matchingResult.pose : node.rightPose,
                totalCost: node.totalCost + stepCostForBeam,
                parent: node,
                assignments,
                depth: node.depth + 1,
                leftCount: newLeftCount,
                rightCount: newRightCount,
              });
            }
            continue;
          }
        }

        // Standard expansion (with lookahead)
        const children = this.expandNodeForGroup(node, group, prevTimestamp, effectiveConfig, neutralHandCenters, nextGroup);
        newBeam.push(...children);

        // Split-hand approach for chords (with lookahead)
        if (group.activePads.length >= 2) {
          const splitChildren = this.expandNodeForSplitChord(node, group, prevTimestamp, config, neutralHandCenters, nextGroup);
          newBeam.push(...splitChildren);
        }
      }

      // Safety net: emergency fallback
      if (newBeam.length === 0) {
        const fallbackFingers: FingerType[] = ['index', 'middle', 'ring', 'thumb', 'pinky'];
        const emergencyComponentsPerNote: ObjectiveComponents = {
          transition: 0, stretch: 0, poseAttractor: 0,
          perFingerHome: 0, alternation: 0, handBalance: 0,
          constraints: FALLBACK_GRIP_PENALTY / group.notes.length,
        };

        for (const node of beam) {
          const assignments: NoteAssignment[] = [];
          const costPerNote = FALLBACK_GRIP_PENALTY / group.notes.length;

          const leftIndices: number[] = [];
          const rightIndices: number[] = [];
          for (let i = 0; i < group.notes.length; i++) {
            if (Math.abs(group.positions[i].col - 2) <= Math.abs(group.positions[i].col - 5)) {
              leftIndices.push(i);
            } else {
              rightIndices.push(i);
            }
          }

          for (let j = 0; j < Math.min(leftIndices.length, fallbackFingers.length); j++) {
            const i = leftIndices[j];
            const finger = fallbackFingers[j];
            const fallbackGrip: HandPose = {
              centroid: { x: group.positions[i].col, y: group.positions[i].row },
              fingers: { [finger]: { x: group.positions[i].col, y: group.positions[i].row } },
            };
            assignments.push({
              eventIndex: group.eventIndices[i],
              eventKey: group.eventKeys[i],
              noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
              startTime: group.notes[i].startTime,
              hand: 'left', finger,
              grip: fallbackGrip,
              cost: costPerNote,
              row: group.positions[i].row,
              col: group.positions[i].col,
              costComponents: emergencyComponentsPerNote,
            });
          }
          for (let j = 0; j < Math.min(rightIndices.length, fallbackFingers.length); j++) {
            const i = rightIndices[j];
            const finger = fallbackFingers[j];
            const fallbackGrip: HandPose = {
              centroid: { x: group.positions[i].col, y: group.positions[i].row },
              fingers: { [finger]: { x: group.positions[i].col, y: group.positions[i].row } },
            };
            assignments.push({
              eventIndex: group.eventIndices[i],
              eventKey: group.eventKeys[i],
              noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
              startTime: group.notes[i].startTime,
              hand: 'right', finger,
              grip: fallbackGrip,
              cost: costPerNote,
              row: group.positions[i].row,
              col: group.positions[i].col,
              costComponents: emergencyComponentsPerNote,
            });
          }

          const firstFallbackGrip: HandPose = {
            centroid: { x: group.positions[0].col, y: group.positions[0].row },
            fingers: { index: { x: group.positions[0].col, y: group.positions[0].row } },
          };
          const primaryHand = Math.abs(group.positions[0].col - 2) <= Math.abs(group.positions[0].col - 5) ? 'left' : 'right';

          newBeam.push({
            leftPose: primaryHand === 'left' ? firstFallbackGrip : node.leftPose,
            rightPose: primaryHand === 'right' ? firstFallbackGrip : node.rightPose,
            totalCost: node.totalCost + FALLBACK_GRIP_PENALTY,
            parent: node,
            assignments,
            depth: node.depth + 1,
            leftCount: node.leftCount + leftIndices.length,
            rightCount: node.rightCount + rightIndices.length,
          });
        }
      }

      beam = this.pruneBeam(newBeam, effectiveConfig.beamWidth);
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
      return this.buildResult([], performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage);
    }

    const bestNode = beam.reduce((best, node) =>
      node.totalCost < best.totalCost ? node : best
    );

    const assignments = this.backtrack(bestNode);
    return this.buildResult(assignments, performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage);
  }
}

/** Factory function to create a BeamSolver instance. */
export function createBeamSolver(config: SolverConfig): BeamSolver {
  return new BeamSolver(config);
}
