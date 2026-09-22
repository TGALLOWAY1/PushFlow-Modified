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
  analyzeStructuralRules,
  countZoneViolations,
  enumerateHandPartitions,
} from './structuralLookahead';
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
import { summarizeConstraintRelaxation } from '../evaluation/constraintRelaxation';
import { evaluatePerformance } from '../evaluation/canonicalEvaluator';
import { type PerformanceCostBreakdown } from '../../types/costBreakdown';
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

// ============================================================================
// Structural Rules: Hand-Zone Separation and One Finger Per Sound
// ============================================================================
//
// Two rules shape every plan this solver produces, and both are HARD:
//
//   1. Hand-zone separation — the left hand plays columns 0–4 and the right hand
//      columns 3–7 (columns 3–4 are shared). See `isZoneValid`.
//   2. Finger ownership — every pad (and so every Sound) is played by one finger
//      for the whole performance. The first strike of a pad pins its owner.
//
// They are what make a plan learnable: a player memorises which hand covers
// which side and which finger plays which sound. So they are never traded away
// for a cheaper transition or a more natural grip.
//
// They are relaxed ONLY when the search finds no plan that keeps them — then as
// few strikes as possible break them. The beam ranks nodes lexicographically:
// fewer best-effort moments first, then fewer relaxed strikes, and only then
// lower cost (see `compareBeamNodes`). Relaxed children are generated only when
// the rule-keeping children cannot fill the beam, so a layout that can be played
// within the rules is always analysed within the rules.
//
// When a relaxation IS required, the costs below choose the least disruptive
// one: re-finger a pad on the same hand before handing it to the other hand, and
// reach just past the zone boundary before reaching far across it. They are
// tie-breakers between equally-relaxed options, never a price at which a rule
// can be bought.

/** Cost of playing a pad with a finger other than its owner, when unavoidable. */
const OWNERSHIP_DEVIATION_PENALTY = 25.0;

/** Extra cost when the unavoidable re-fingering also moves the pad to the other hand. */
const OWNERSHIP_HAND_SWITCH_PENALTY = 15.0;

/** Cost per pad a hand plays outside its zone, when unavoidable. */
const ZONE_REACH_PENALTY = 10.0;

/** Additional cost per column of reach beyond the zone boundary. */
const ZONE_REACH_PENALTY_PER_COL = 6.0;

/**
 * Cost of pinning a pad to a finger other than the one suggested by the natural
 * hand pose (`initialPadOwnership`).
 *
 * The pose-derived owner is a starting suggestion, not a user decision, so
 * departing from it is not a rule relaxation: the Sound still gets exactly one
 * finger, just a different one. It is charged once, on the pad's first strike,
 * and only to the search ranking — never to the reported cost of the strike,
 * since it makes nothing harder to play.
 */
const SEED_DEVIATION_PENALTY = 25.0;

/**
 * Cost applied to a best-effort assignment produced when no grip at all could be
 * formed for a moment. Large enough to rank last, finite so the moment still
 * receives a real assignment and an honest difficulty.
 */
const BEST_EFFORT_PENALTY = 40.0;



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
  /** This strike is played by a hand outside its zone (hand separation relaxed). */
  relaxedZone?: boolean;
  /** This strike uses a finger other than its pad's owner (one finger per sound relaxed). */
  relaxedOwnership?: boolean;
  /** This strike comes from a best-effort assignment: no grip could be formed. */
  bestEffort?: boolean;
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
   * Key: padKey ("row,col").
   * Invariant B: once a pad is struck, its finger is pinned, and every later
   * strike must use the same finger. Breaking that is a counted relaxation.
   */
  padOwnership: Map<string, PadOwner>;
  /**
   * Strikes on this path that break a structural rule (hand-zone separation or
   * one finger per sound). Ranked ahead of cost — see `compareBeamNodes`.
   */
  relaxations: number;
  /** Moments on this path that needed a best-effort assignment. */
  bestEffortMoments: number;
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

/** Which pad a (hand, finger) owns, and whether that owner is only a suggestion. */
interface PadOwner {
  hand: 'left' | 'right';
  finger: FingerType;
  /**
   * True while the owner comes from the natural hand pose and no strike has
   * confirmed it yet. A seeded owner is a suggestion: the first strike may pin a
   * different finger (at SEED_DEVIATION_PENALTY) without relaxing any rule.
   */
  seeded?: boolean;
}

/**
 * Whether an expansion should emit only children that keep both structural
 * rules ('strict'), or only children that break at least one ('relaxed').
 * Splitting the two lets the solver skip relaxed expansion entirely whenever
 * the rule-keeping children are enough to fill the beam.
 */
type ExpansionMode = 'strict' | 'relaxed';

/**
 * Tie-breaking cost for an unavoidable zone violation. Grows with how far past
 * the boundary the hand has to reach.
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
 * Checks a proposed fingering against the pads' owners.
 *
 * Returns the pads whose ESTABLISHED owner (pinned by an earlier strike) is
 * contradicted — each of those is one relaxation of the one-finger-per-sound
 * rule — plus the tie-breaking cost of those relaxations and the (separate,
 * non-relaxing) cost of departing from a merely suggested owner.
 */
function assessOwnership(
  ownership: Map<string, PadOwner>,
  entries: Array<{ padKey: string; hand: 'left' | 'right'; finger: FingerType }>,
): { violatingPads: Set<string>; relaxationCost: number; seedCost: number } {
  const violatingPads = new Set<string>();
  const seededCharged = new Set<string>();
  let relaxationCost = 0;
  let seedCost = 0;
  for (const entry of entries) {
    const owner = ownership.get(entry.padKey);
    if (!owner) continue;
    if (owner.hand === entry.hand && owner.finger === entry.finger) continue;
    const handSwitch = owner.hand !== entry.hand;
    if (owner.seeded) {
      if (seededCharged.has(entry.padKey)) continue;
      seededCharged.add(entry.padKey);
      seedCost += SEED_DEVIATION_PENALTY + (handSwitch ? OWNERSHIP_HAND_SWITCH_PENALTY : 0);
      continue;
    }
    if (violatingPads.has(entry.padKey)) continue;
    violatingPads.add(entry.padKey);
    relaxationCost += OWNERSHIP_DEVIATION_PENALTY + (handSwitch ? OWNERSHIP_HAND_SWITCH_PENALTY : 0);
  }
  return { violatingPads, relaxationCost, seedCost };
}

/**
 * Records the owner of every pad struck in this moment.
 *
 * A pad's first strike pins its owner (replacing a merely suggested one); an
 * established owner is never overwritten, so a relaxed strike stays the
 * exception it is rather than silently becoming the new rule.
 */
function pinOwnership(
  ownership: Map<string, PadOwner>,
  entries: Array<{ padKey: string; hand: 'left' | 'right'; finger: FingerType }>,
): Map<string, PadOwner> {
  const next = new Map(ownership);
  for (const entry of entries) {
    const owner = next.get(entry.padKey);
    if (!owner || owner.seeded) {
      next.set(entry.padKey, { hand: entry.hand, finger: entry.finger });
    }
  }
  return next;
}

/** True when some pad in `pads` is established as owned by the other hand. */
function ownedByOtherHand(
  ownership: Map<string, PadOwner>,
  pads: PadCoord[],
  hand: 'left' | 'right',
): boolean {
  for (const pad of pads) {
    const owner = ownership.get(`${pad.row},${pad.col}`);
    if (owner && !owner.seeded && owner.hand !== hand) return true;
  }
  return false;
}

/**
 * Beam ordering: fewer best-effort moments, then fewer relaxed strikes, then
 * lower cost. Rule-keeping plans therefore always outrank rule-breaking ones,
 * however much cheaper the rule-breaking plan would be.
 */
function compareBeamNodes(a: BeamNode, b: BeamNode): number {
  if (a.bestEffortMoments !== b.bestEffortMoments) return a.bestEffortMoments - b.bestEffortMoments;
  if (a.relaxations !== b.relaxations) return a.relaxations - b.relaxations;
  return a.totalCost - b.totalCost;
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
  private initialPadOwnership: Map<string, PadOwner>;
  /**
   * For each pad, the owners ("hand:finger") that can take part in a plan keeping
   * both structural rules. Computed once per solve by `analyzeStructuralRules`;
   * pads for which a rule break is unavoidable are absent (unfiltered).
   */
  private viableOwners: Map<string, Set<string>> = new Map();

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.layout = config.layout ?? null;
    this.sourceLayoutRole = config.sourceLayoutRole ?? config.layout?.role;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.mappingResolverMode = config.mappingResolverMode ?? 'strict';

    // Pre-seed pad ownership from config (e.g., natural hand pose finger
    // assignments). These are suggestions: the first strike of a pad may pin a
    // different finger without that counting as a rule relaxation.
    this.initialPadOwnership = new Map();
    if (config.initialPadOwnership) {
      for (const [key, assignment] of Object.entries(config.initialPadOwnership)) {
        this.initialPadOwnership.set(key, { hand: assignment.hand, finger: assignment.finger, seeded: true });
      }
    }
  }

  private createInitialBeam(
    config: EngineConfiguration,
    preferredOwners: Map<string, PadOwner>,
  ): BeamNode[] {
    const { restingPose } = config;
    // Pose-derived suggestions first, then the user's own choices on top: a
    // preferred finger is an established owner from the very first strike.
    const padOwnership = new Map(this.initialPadOwnership);
    for (const [key, owner] of preferredOwners) padOwnership.set(key, owner);
    return [{
      leftPose: { ...restingPose.left },
      rightPose: { ...restingPose.right },
      totalCost: 0,
      parent: null,
      assignments: [],
      depth: 0,
      leftCount: 0,
      rightCount: 0,
      padOwnership,
      relaxations: 0,
      bestEffortMoments: 0,
      prevFingers: [],
      prevTimestamp: 0,
    }];
  }

  private expandNodeForGroup(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    mode: ExpansionMode,
    naturalDistances?: { left: Map<string, number>; right: Map<string, number> },
  ): BeamNode[] {
    const children: BeamNode[] = [];
    const rawTimeDelta = group.timestamp - prevTimestamp;
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;

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
    if (uniquePads.length === 0 || uniquePads.length > 5) return children;

    for (const hand of ['left', 'right'] as const) {
      const zoneViolations = countZoneViolations(uniquePads, hand);

      // In strict mode a hand never leaves its zone, and never takes a pad another
      // hand already owns — both are rule breaks, so skip before generating grips.
      if (mode === 'strict' && (
        zoneViolations > 0 || ownedByOtherHand(node.padOwnership, uniquePads, hand)
      )) continue;

      const zoneCost = zoneReachCost(uniquePads, hand);
      const prevPose = hand === 'left' ? node.leftPose : node.rightPose;
      const gripResults = generateValidGripsWithTier(uniquePads, hand);

      for (const gripResult of gripResults) {
        const { pose: grip } = gripResult;
        const gripFingers = Object.keys(grip.fingers) as FingerType[];
        if (gripFingers.length === 0 || gripFingers.length < uniquePads.length) continue;

        // Reject transitions that exceed physiological hand speed. Everything
        // slower is merely expensive, and its cost is already finite.
        if (!isFirstGroup && exceedsHandSpeedLimit(prevPose, grip, timeDelta)) continue;

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

        const strikes = group.positions.map((pos, i) => ({
          padKey: `${pos.row},${pos.col}`,
          hand,
          finger: resolvedFingers[i],
        }));
        const ownership = assessOwnership(node.padOwnership, strikes);
        const relaxations = zoneViolations + ownership.violatingPads.size;
        const isStrict = relaxations === 0 && !this.pinsNonViableOwner(node.padOwnership, strikes);

        // Each mode emits only its own half, so a relaxed pass never duplicates
        // the strict one.
        if (mode === 'strict' ? !isStrict : isStrict) continue;

        const transitionCost = calculateTransitionCost(prevPose, grip, timeDelta);

        // V1 (D-05, D-20): Translation-invariant hand shape deviation + finger preference
        const handNaturalDist = naturalDistances
          ? (hand === 'left' ? naturalDistances.left : naturalDistances.right)
          : new Map<string, number>();
        const handShapeDeviation = calculateHandShapeDeviation(grip, handNaturalDist);
        const fingerPreferenceCost = calculateFingerPreferenceCost(grip);

        const newLeftCount = node.leftCount + (hand === 'left' ? group.notes.length : 0);
        const newRightCount = node.rightCount + (hand === 'right' ? group.notes.length : 0);
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        // === PRIMARY SCORE (V1: hand shape deviation + finger preference + transition) ===
        const poseNaturalness = handShapeDeviation + fingerPreferenceCost;
        // Unavoidable rule breaks are reported as the canonical `constraintPenalty`
        // factor. Departing from a merely suggested owner is NOT: it steers the
        // search (see totalCost below) but makes nothing harder to play, so it
        // must not surface as difficulty.
        const constraintPenalty = zoneCost + ownership.relaxationCost;

        // Same-finger repetition at speed — the commonest real-world reason a drum
        // layout is unplayable.
        const currentFingers = resolvedFingers.map(finger => ({ hand, finger }));
        const alternationCost = calculateAlternationCost(
          node.prevFingers, currentFingers, group.timestamp - node.prevTimestamp,
        );
        const perfComponents: PerformabilityObjective = {
          poseNaturalness,
          transitionDifficulty: transitionCost,
          constraintPenalty,
        };
        let stepCostForBeam = combinePerformabilityComponents(perfComponents);

        // === HAND BALANCE COST (prevents single-hand dominance) ===
        stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;
        stepCostForBeam += alternationCost;
        // constraintPenalty is already folded in by combinePerformabilityComponents.

        // === V1 COST BREAKDOWN (moment-level — NOT divided per-note) ===
        const stepComponents: V1CostBreakdown = {
          fingerPreference: fingerPreferenceCost,
          handShapeDeviation: handShapeDeviation,
          alternation: alternationCost,
          transitionCost,
          handBalance: handBalanceCost,
          constraintPenalty,
          total: stepCostForBeam,
        };

        // Build per-note assignments with FULL moment cost (Invariant E)
        const assignments: NoteAssignment[] = [];
        for (let i = 0; i < group.notes.length; i++) {
          const pos = group.positions[i];
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
            row: pos.row,
            col: pos.col,
            costComponents: stepComponents,
            relaxedZone: !isZoneValid(pos, hand),
            relaxedOwnership: ownership.violatingPads.has(strikes[i].padKey),
          });
        }

        children.push({
          leftPose: hand === 'left' ? grip : node.leftPose,
          rightPose: hand === 'right' ? grip : node.rightPose,
          totalCost: node.totalCost + stepCostForBeam + ownership.seedCost,
          parent: node,
          assignments,
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
          padOwnership: pinOwnership(node.padOwnership, strikes),
          relaxations: node.relaxations + relaxations,
          bestEffortMoments: node.bestEffortMoments,
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
    mode: ExpansionMode,
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

    // Every way of dividing the pads between the two hands is considered, rather
    // than a single midpoint split: a three-pad moment has three useful splits,
    // and trying only one of them dead-ended the search on ordinary material.
    for (const partition of enumerateHandPartitions(sortedPads)) {
      const { leftPads, rightPads, zoneViolations } = partition;
      // Strict mode keeps each hand in its zone and every established pad on its
      // owning hand, so those divisions are skipped before any grip is generated.
      if (mode === 'strict' && (
        zoneViolations > 0 ||
        ownedByOtherHand(node.padOwnership, leftPads, 'left') ||
        ownedByOtherHand(node.padOwnership, rightPads, 'right')
      )) continue;
      for (const child of this.expandSplitPartition(
        node, group, leftPads, rightPads, zoneViolations, timeDelta, isFirstGroup, mode,
        naturalDistances,
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
    zoneViolations: number,
    timeDelta: number,
    isFirstGroup: boolean,
    mode: ExpansionMode,
    naturalDistances?: { left: Map<string, number>; right: Map<string, number> },
  ): BeamNode[] {
    const children: BeamNode[] = [];

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
      if (!isFirstGroup && exceedsHandSpeedLimit(node.leftPose, leftResult.pose, timeDelta)) continue;

      // Map left notes to the exact finger standing on their pad.
      const resolvedLeftFingers: FingerType[] = [];
      for (const i of leftNoteIndices) {
        const pos = group.positions[i];
        let assignedFinger: FingerType | null = null;
        for (const [f, coord] of Object.entries(leftResult.pose.fingers)) {
          if (coord.x === pos.col && coord.y === pos.row) { assignedFinger = f as FingerType; break; }
        }
        resolvedLeftFingers.push(assignedFinger ?? leftFingers[0]);
      }

      for (const rightResult of rightGripResults) {
        const rightFingers = Object.keys(rightResult.pose.fingers) as FingerType[];
        if (rightFingers.length < rightPads.length) continue;
        if (!isFirstGroup && exceedsHandSpeedLimit(node.rightPose, rightResult.pose, timeDelta)) continue;

        const resolvedRightFingers: FingerType[] = [];
        for (const i of rightNoteIndices) {
          const pos = group.positions[i];
          let assignedFinger: FingerType | null = null;
          for (const [f, coord] of Object.entries(rightResult.pose.fingers)) {
            if (coord.x === pos.col && coord.y === pos.row) { assignedFinger = f as FingerType; break; }
          }
          resolvedRightFingers.push(assignedFinger ?? rightFingers[0]);
        }

        const strikes = [
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
        ];
        const ownership = assessOwnership(node.padOwnership, strikes);
        const relaxations = zoneViolations + ownership.violatingPads.size;
        const isStrict = relaxations === 0 && !this.pinsNonViableOwner(node.padOwnership, strikes);
        if (mode === 'strict' ? !isStrict : isStrict) continue;

        const leftTransition = calculateTransitionCost(node.leftPose, leftResult.pose, timeDelta);
        const rightTransition = calculateTransitionCost(node.rightPose, rightResult.pose, timeDelta);

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

        // Seed departures steer the search only (see totalCost below).
        const splitConstraintPenalty = zoneCost + ownership.relaxationCost;

        const splitFingers = strikes.map(({ hand, finger }) => ({ hand, finger }));
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
          transitionDifficulty: leftTransition + rightTransition,
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
          transitionCost: leftTransition + rightTransition,
          handBalance: handBalanceCost,
          constraintPenalty: splitConstraintPenalty,
          total: stepCostForBeam,
        };

        // Build per-note assignments with FULL moment cost (Invariant E)
        const assignments: NoteAssignment[] = [];
        const pushAssignment = (i: number, hand: 'left' | 'right', finger: FingerType, grip: HandPose) => {
          const pos = group.positions[i];
          assignments.push({
            eventIndex: group.eventIndices[i],
            eventKey: group.eventKeys[i],
            noteNumber: group.notes[i].noteNumber,
            voiceId: group.notes[i].voiceId,
            startTime: group.notes[i].startTime,
            hand,
            finger,
            grip,
            cost: stepComponents.total,
            row: pos.row,
            col: pos.col,
            costComponents: stepComponents,
            relaxedZone: !isZoneValid(pos, hand),
            relaxedOwnership: ownership.violatingPads.has(`${pos.row},${pos.col}`),
          });
        };
        leftNoteIndices.forEach((i, j) => pushAssignment(i, 'left', resolvedLeftFingers[j], leftResult.pose));
        rightNoteIndices.forEach((i, j) => pushAssignment(i, 'right', resolvedRightFingers[j], rightResult.pose));

        children.push({
          leftPose: leftResult.pose,
          rightPose: rightResult.pose,
          totalCost: node.totalCost + stepCostForBeam + ownership.seedCost,
          parent: node,
          assignments,
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
          padOwnership: pinOwnership(node.padOwnership, strikes),
          relaxations: node.relaxations + relaxations,
          bestEffortMoments: node.bestEffortMoments,
          prevFingers: splitFingers,
          prevTimestamp: group.timestamp,
        });
      }
    }

    return children;
  }

  /**
   * Produces a guaranteed assignment for a moment where no grip could be formed
   * at all — not even by relaxing the structural rules.
   *
   * The beam used to simply drop such moments, and the UI reported the resulting
   * gaps as "Unplayable" — telling the user a passage was physically impossible
   * when the truth was that the search had run out of options. A best-effort
   * assignment is produced instead, charged a large but finite penalty so the
   * moment ranks last and is surfaced as genuinely hard.
   *
   * It still honours the structural rules wherever it can: a pad keeps its owning
   * finger whenever that finger is free in this moment, and every other pad goes
   * to the hand whose zone it lies in. Only what cannot be placed that way breaks
   * a rule, and each such strike is counted like any other relaxation.
   *
   * Returns null when the moment is beyond any pair of hands — more simultaneous
   * pads than a player has fingers, or a move faster than a hand can travel.
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

    // Anatomical finger order, left-to-right across the grid.
    const LEFT_ORDER: FingerType[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];
    const RIGHT_ORDER: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    const padToOwner = new Map<string, { hand: 'left' | 'right'; finger: FingerType }>();
    const used = { left: new Set<FingerType>(), right: new Set<FingerType>() };
    const claim = (pad: PadCoord, hand: 'left' | 'right', finger: FingerType) => {
      padToOwner.set(`${pad.row},${pad.col}`, { hand, finger });
      used[hand].add(finger);
    };

    // 1. Keep every pad on its owner (established or suggested) while that finger is free.
    const unplaced: PadCoord[] = [];
    for (const pad of sorted) {
      const owner = node.padOwnership.get(`${pad.row},${pad.col}`);
      if (owner && !used[owner.hand].has(owner.finger)) claim(pad, owner.hand, owner.finger);
      else unplaced.push(pad);
    }

    // 2. Everything else goes to the hand whose zone it lies in (the left side of
    //    the grid to the left hand), taking free fingers in anatomical order; a
    //    hand with no finger left hands the pad to the other hand.
    const leftSide = unplaced.filter(pad => pad.col <= 3);
    const rightSide = unplaced.filter(pad => pad.col > 3);
    const place = (pads: PadCoord[], preferred: 'left' | 'right') => {
      const other = preferred === 'left' ? 'right' : 'left';
      const order = (hand: 'left' | 'right') => (hand === 'left' ? LEFT_ORDER : RIGHT_ORDER)
        .filter(f => !used[hand].has(f));
      const freePreferred = order(preferred);
      // Left pads take the fingers nearest the thumb side, right pads the thumb
      // side onward, so spatial order matches finger order.
      const chosen = preferred === 'left'
        ? freePreferred.slice(Math.max(0, freePreferred.length - pads.length))
        : freePreferred.slice(0, pads.length);
      pads.forEach((pad, i) => {
        const finger = chosen[i];
        if (finger) { claim(pad, preferred, finger); return; }
        const fallback = order(other)[0];
        if (fallback) claim(pad, other, fallback);
      });
    };
    place(leftSide, 'left');
    place(rightSide, 'right');
    if (padToOwner.size < uniquePads.length) return null;

    const leftFingers: Partial<Record<FingerType, { x: number; y: number }>> = {};
    const rightFingers: Partial<Record<FingerType, { x: number; y: number }>> = {};
    for (const [key, owner] of padToOwner) {
      const [row, col] = key.split(',').map(Number);
      (owner.hand === 'left' ? leftFingers : rightFingers)[owner.finger] = { x: col, y: row };
    }

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

    // A best-effort assignment must not launder a HARD physical rejection into a
    // merely-expensive one. If reaching this moment would need a hand to move
    // faster than physiologically possible, there is no fallback to offer: the
    // moment is genuinely unplayable, and saying otherwise would reintroduce the
    // over-optimism this whole change set exists to remove.
    const timeDelta = group.timestamp - prevTimestamp;
    if (
      exceedsHandSpeedLimit(node.leftPose, leftPose, timeDelta) ||
      exceedsHandSpeedLimit(node.rightPose, rightPose, timeDelta)
    ) {
      return null;
    }

    const strikes = group.positions.map(pos => {
      const key = `${pos.row},${pos.col}`;
      const owner = padToOwner.get(key)!;
      return { padKey: key, hand: owner.hand, finger: owner.finger };
    });
    const ownership = assessOwnership(node.padOwnership, strikes);
    let zoneViolations = 0;
    for (const [key, owner] of padToOwner) {
      const [row, col] = key.split(',').map(Number);
      if (!isZoneValid({ row, col }, owner.hand)) zoneViolations++;
    }

    const leftStrikes = strikes.filter(st => st.hand === 'left').length;
    const newLeftCount = node.leftCount + leftStrikes;
    const newRightCount = node.rightCount + (strikes.length - leftStrikes);
    const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);
    // Real movement cost, not zero — the hands genuinely travel to reach this pose.
    const transitionCost =
      calculateTransitionCost(node.leftPose, leftPose, timeDelta) +
      calculateTransitionCost(node.rightPose, rightPose, timeDelta);
    const constraintPenalty = BEST_EFFORT_PENALTY + ownership.relaxationCost;
    const stepCost =
      constraintPenalty + transitionCost + handBalanceCost * HAND_BALANCE_BEAM_WEIGHT;

    const stepComponents: V1CostBreakdown = {
      fingerPreference: 0,
      handShapeDeviation: 0,
      alternation: 0,
      transitionCost,
      handBalance: handBalanceCost,
      constraintPenalty,
      total: stepCost,
    };

    const assignments: NoteAssignment[] = group.notes.map((note, i) => {
      const pos = group.positions[i];
      const { hand, finger, padKey: key } = strikes[i];
      return {
        eventIndex: group.eventIndices[i],
        eventKey: group.eventKeys[i],
        noteNumber: note.noteNumber,
        voiceId: note.voiceId,
        startTime: note.startTime,
        hand,
        finger,
        grip: hand === 'left' ? leftPose : rightPose,
        cost: stepCost,
        row: pos.row,
        col: pos.col,
        costComponents: stepComponents,
        relaxedZone: !isZoneValid(pos, hand),
        relaxedOwnership: ownership.violatingPads.has(key),
        bestEffort: true,
      };
    });
    if (assignments.length === 0) return null;

    return {
      leftPose,
      rightPose,
      totalCost: node.totalCost + stepCost + ownership.seedCost,
      parent: node,
      assignments,
      depth: node.depth + 1,
      leftCount: newLeftCount,
      rightCount: newRightCount,
      padOwnership: pinOwnership(node.padOwnership, strikes),
      relaxations: node.relaxations + zoneViolations + ownership.violatingPads.size,
      bestEffortMoments: node.bestEffortMoments + 1,
      prevFingers: strikes.map(({ hand, finger }) => ({ hand, finger })),
      prevTimestamp: group.timestamp,
    };
  }

  /**
   * True when this moment would pin a pad to an owner that cannot keep the rules
   * at some later moment. Such a child is not strict even if it breaks nothing
   * yet: the break is merely deferred.
   */
  private pinsNonViableOwner(
    ownership: Map<string, PadOwner>,
    strikes: Array<{ padKey: string; hand: 'left' | 'right'; finger: FingerType }>,
  ): boolean {
    for (const strike of strikes) {
      const owner = ownership.get(strike.padKey);
      if (owner && !owner.seeded) continue; // already pinned — nothing new
      const viable = this.viableOwners.get(strike.padKey);
      if (viable && !viable.has(`${strike.hand}:${strike.finger}`)) return true;
    }
    return false;
  }

  private pruneBeam(beam: BeamNode[], beamWidth: number): BeamNode[] {
    beam.sort(compareBeamNodes);
    return beam.slice(0, beamWidth);
  }

  /**
   * Whether relaxed children could still earn a place in the next beam.
   *
   * A relaxed child always carries at least one more relaxation than its parent,
   * so it can never outrank a rule-keeping child of a best-ranked parent. When
   * there are already enough of those to fill the beam, relaxed expansion is
   * skipped: it could not change the result, and the common case — a layout
   * playable within the rules — then costs no more than a strict search.
   */
  private needsRelaxedExpansion(
    strictChildren: BeamNode[],
    parents: BeamNode[],
    beamWidth: number,
  ): boolean {
    if (parents.length === 0) return false;
    const best = parents.reduce((a, b) => (compareBeamNodes(a, b) <= 0 ? a : b));
    let bestRanked = 0;
    for (const child of strictChildren) {
      if (child.bestEffortMoments === best.bestEffortMoments && child.relaxations === best.relaxations) {
        bestRanked++;
        if (bestRanked >= beamWidth) return false;
      }
    }
    return true;
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
  private canonicalBreakdown(
    padFingerAssignment: PadFingerAssignment,
    sortedEvents: Array<{ event: PerformanceEvent; originalIndex: number }>,
    config: EngineConfiguration,
  ): PerformanceCostBreakdown | null {
    if (!this.layout || Object.keys(padFingerAssignment).length === 0) return null;
    try {
      const moments = buildPerformanceMoments(sortedEvents.map(e => e.event));
      if (moments.length === 0) return null;
      return evaluatePerformance({
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
    let mediumCount = 0;
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
      else if (difficulty === 'Medium') mediumCount++;

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
      // A fallback grip is a moment no grip could be formed for. Structural rule
      // relaxations are reported separately (constraintRelaxation), not here.
      if (assignment.bestEffort) fallbackGripCount++;
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
        ...(assignment.relaxedZone || assignment.relaxedOwnership
          ? {
              relaxedConstraints: [
                ...(assignment.relaxedZone ? ['hand-zone' as const] : []),
                ...(assignment.relaxedOwnership ? ['finger-ownership' as const] : []),
              ],
            }
          : {}),
      });
    }

    const constraintRelaxation = summarizeConstraintRelaxation(fingerAssignments);

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

    // === Build pad-to-finger ownership map (Invariant B) ===
    const padFingerOwnership: PadFingerAssignment = {};
    if (winningPadOwnership) {
      for (const [key, value] of winningPadOwnership) {
        padFingerOwnership[key] = { hand: value.hand, finger: value.finger };
      }
    }

    // Evaluate this result with the canonical evaluator so every user-facing
    // figure comes from one model, whichever path produced it.
    const canonical = this.canonicalBreakdown(padFingerOwnership, sortedEvents, config);
    const canonicalDims = canonical?.dimensions ?? null;

    // Publish the canonical dimensions rather than this solver's internal V1 cost.
    // The two are on different scales, so the same layout's Movement bar read 16
    // through Generate and 122 through auto-analysis under one label. Falls back
    // to the internal breakdown only when canonical evaluation is unavailable.
    const canonicalFactors = canonicalDims
      ? {
          transition: canonicalDims.transitionCost,
          gripNaturalness: canonicalDims.poseNaturalness,
          alternation: canonicalDims.alternation,
          handBalance: canonicalDims.handBalance,
          constraintPenalty: canonicalDims.constraintPenalty,
          total: canonicalDims.total,
        }
      : v1CostBreakdownToCanonicalFactors(totalV1Cost);
    const feasibility = deriveFeasibilityVerdict(
      unplayableCount,
      hardCount,
      unmappedIndices.size,
      fallbackGripCount,
      totalEvents,
      constraintRelaxation,
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
    const score = computePlanScore({
      hardCount: hardMomentCount,
      unplayableCount: unplayableMomentCount,
      avgErgonomicCost: canonical?.costPerMoment ?? averageMetrics.total,
    });

    // Post-hoc diagnostics for unplayable events
    const rejectionReasons = unplayableCount > 0 && eventsWithPositions
      ? this.diagnoseUnplayableEvents(assignments, totalEvents, unmappedIndices, sortedEvents, eventsWithPositions, groups, exhaustedGroupIndices)
      : undefined;

    return {
      score,
      unplayableCount,
      hardCount,
      mediumCount,
      fingerAssignments,
      padFingerOwnership,
      constraintRelaxation,
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

  /** Best node of a beam by the solver's ordering: rules first, then cost. */
  private bestOf(beam: BeamNode[]): BeamNode | null {
    if (beam.length === 0) return null;
    return beam.reduce((best, node) => (compareBeamNodes(node, best) < 0 ? node : best));
  }

  /**
   * Runs the beam over every moment from `initialBeam`.
   *
   * At each moment the beam is first filled with children that keep both
   * structural rules. Rule-breaking children are generated only if those cannot
   * fill it, and rank behind them regardless of cost. A moment no grip can be
   * formed for at all gets a best-effort assignment; one beyond any pair of
   * hands is recorded as exhausted.
   */
  private runBeamSearch(
    groups: PerformanceGroup[],
    initialBeam: BeamNode[],
    beamWidth: number,
    natDist: { left: Map<string, number>; right: Map<string, number> },
  ): { beam: BeamNode[]; exhaustedGroupIndices: Set<number> } {
    let beam = initialBeam;
    let prevTimestamp = 0;
    const exhaustedGroupIndices = new Set<number>();

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const strictChildren: BeamNode[] = [];

      for (const node of beam) {
        // One hand, then (for chords) every two-hand split — keeping hand-zone
        // separation and one finger per sound.
        strictChildren.push(...this.expandNodeForGroup(node, group, prevTimestamp, 'strict', natDist));
        if (group.activePads.length >= 2) {
          strictChildren.push(...this.expandNodeForSplitChord(node, group, prevTimestamp, 'strict', natDist));
        }
      }

      const newBeam: BeamNode[] = strictChildren;

      // Only when the rule-keeping options cannot fill the beam are rule-breaking
      // ones considered at all — and they still rank behind every rule-keeping
      // path, so a plan within the rules wins whenever one survives.
      if (this.needsRelaxedExpansion(strictChildren, beam, beamWidth)) {
        for (const node of beam) {
          newBeam.push(...this.expandNodeForGroup(node, group, prevTimestamp, 'relaxed', natDist));
          if (group.activePads.length >= 2) {
            newBeam.push(...this.expandNodeForSplitChord(node, group, prevTimestamp, 'relaxed', natDist));
          }
        }
      }

      // If no grip at all could be formed for this moment, fall back to a
      // best-effort assignment rather than dropping the notes. Dropped notes were
      // previously surfaced to the user as "Unplayable", which misreported a search
      // dead end as a physical impossibility.
      if (newBeam.length === 0) {
        for (const node of beam) {
          const child = this.buildBestEffortChild(node, group, prevTimestamp);
          if (child) newBeam.push(child);
        }
        // Genuinely beyond two hands — the one honest unplayable verdict.
        if (newBeam.length === 0) exhaustedGroupIndices.add(gi);
      }

      if (newBeam.length > 0) {
        beam = this.pruneBeam(newBeam, beamWidth);
      }
      prevTimestamp = group.timestamp;
    }

    return { beam, exhaustedGroupIndices };
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

    // A user's finger preference for a Sound names the finger that owns it. The
    // one-finger-per-sound rule then keeps it: the preferred pad is played with
    // that finger unless no plan can manage it, in which case the exception is
    // counted and flagged like any other relaxation. Only the preferred pad is
    // constrained — the rest of its moment is solved normally, so a preference
    // on the kick no longer drags a simultaneous right-side hi-hat onto the left
    // hand (the previous override forced every pad of the moment onto one hand).
    const preferredOwners = new Map<string, PadOwner>();
    if (manualAssignments) {
      for (const { event, index, position } of eventsWithPositions) {
        if (!position) continue;
        const preference =
          (event.eventKey !== undefined ? manualAssignments[event.eventKey] : undefined)
          ?? manualAssignments[index.toString()];
        if (!preference) continue;
        const key = `${position.row},${position.col}`;
        if (!preferredOwners.has(key)) {
          preferredOwners.set(key, { hand: preference.hand, finger: preference.finger });
        }
      }
    }

    const natDist = { left: leftNaturalDistances, right: rightNaturalDistances };

    // Lookahead: which fingers each pad can keep for the whole performance, and
    // (when one exists) a complete rule-keeping fingering to fall back on.
    const lookahead = analyzeStructuralRules(groups, preferredOwners);
    this.viableOwners = lookahead.viableOwners;

    let search = this.runBeamSearch(
      groups, this.createInitialBeam(effectiveConfig, preferredOwners), effectiveConfig.beamWidth, natDist,
    );
    let bestNode = this.bestOf(search.beam);

    // The beam commits fingers from local cost, so it can still miss a
    // rule-keeping plan that the lookahead has proved exists. Before accepting
    // a relaxation, search again with every pad held to that fingering, and keep
    // whichever plan ranks better. The rules give way only if this also fails
    // (for example because the proven fingering would need a hand to move
    // faster than it can).
    if (bestNode && bestNode.relaxations > 0 && lookahead.witness) {
      const held = new Map<string, PadOwner>(preferredOwners);
      for (const [key, owner] of lookahead.witness) {
        if (!held.has(key)) held.set(key, { hand: owner.hand, finger: owner.finger });
      }
      const retry = this.runBeamSearch(
        groups, this.createInitialBeam(effectiveConfig, held), effectiveConfig.beamWidth, natDist,
      );
      const retryBest = this.bestOf(retry.beam);
      if (retryBest && compareBeamNodes(retryBest, bestNode) < 0) {
        search = retry;
        bestNode = retryBest;
      }
    }
    const { exhaustedGroupIndices } = search;

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

    if (!bestNode) {
      return this.buildResult([], performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage, new Map(), eventsWithPositions, groups, exhaustedGroupIndices);
    }

    const assignments = this.backtrack(bestNode);
    return this.buildResult(assignments, performance.events.length, unmappedIndices, effectiveConfig, sortedEvents, coverage, bestNode.padOwnership, eventsWithPositions, groups, exhaustedGroupIndices);
  }
}

/** Factory function to create a BeamSolver instance. */
export function createBeamSolver(config: SolverConfig): BeamSolver {
  return new BeamSolver(config);
}
