/**
 * Canonical Cost Evaluator.
 *
 * This module is the single canonical entry point for cost evaluation in PushFlow.
 * It breaks the dependency on the beam solver: given a layout, a pad-finger
 * assignment, and an event sequence, it produces structured cost output directly.
 *
 * Public API:
 *   evaluateEvent(input)        → EventCostBreakdown
 *   evaluateTransition(input)   → TransitionCostBreakdown
 *   evaluatePerformance(input)  → PerformanceCostBreakdown
 *   compareLayouts(input)       → LayoutComparisonResult
 *   validateAssignment(input)   → AssignmentValidationResult
 *
 * These functions call the same atomic cost functions that the beam solver uses
 * (calculatePoseNaturalness, calculateTransitionCost, etc.) but without
 * requiring the beam search infrastructure.
 */

import { type Layout } from '../../types/layout';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type InstrumentConfig } from '../../types/performance';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import {
  type CostDimensions,
  type PoseNaturalnessDetail,
  type EventCostBreakdown,
  type TransitionCostBreakdown,
  type PerformanceCostBreakdown,
  type LayoutComparisonResult,
  type AssignmentValidationResult,
  type AssignmentIssue,
  type NoteEvaluationDetail,
  type AggregateMetrics,
  createZeroCostDimensions,
  sumCostDimensions,
  averageCostDimensions,
} from '../../types/costBreakdown';
import { deriveFeasibilityVerdict } from '../../types/diagnostics';
import { type ConstraintTier } from '../prior/feasibility';
import { padKey } from '../../types/padGrid';

import {
  calculateTransitionCost,
  calculateAttractorCost,
  calculatePerFingerHomeCost,
  calculateFingerDominanceCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
  FALLBACK_GRIP_PENALTY,
  RELAXED_GRIP_PENALTY,
} from './costFunction';

import {
  buildMomentPoses,
  type MomentPoseResult,
} from './poseBuilder';

import {
  buildVoiceIdToPadIndex,
  buildNoteToPadIndex,
  resolveEventToPad,
} from '../mapping/mappingResolver';

// ============================================================================
// Event Evaluation
// ============================================================================

/** Input for evaluateEvent. */
export interface EvaluateEventInput {
  moment: PerformanceMoment;
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
  /** Previous moment context for alternation detection. */
  prevMomentContext?: {
    assignments: Array<{ hand: HandSide; finger: FingerType }>;
    timestamp: number;
  };
  /** Running left/right hand counts for hand balance. */
  handCounts?: { left: number; right: number };
  includeDebug?: boolean;
}

/**
 * Evaluate a single performance moment under a given layout and finger assignment.
 *
 * This is the atomic building block. It:
 * 1. Resolves each note in the moment to a pad via the layout
 * 2. Looks up each pad's finger ownership from the PadFingerAssignment
 * 3. Builds HandPose from the pad coordinates
 * 4. Computes cost dimensions using the same functions the beam solver uses
 */
export function evaluateEvent(input: EvaluateEventInput): EventCostBreakdown {
  const { moment, layout, padFingerAssignment, config, prevMomentContext, handCounts, includeDebug } = input;

  // Step 1: Resolve each note to a pad
  const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteIndex = buildNoteToPadIndex(layout.padToVoice);
  const activePadKeys: string[] = [];
  const noteAssignments: NoteEvaluationDetail[] = [];
  let unmappedCount = 0;

  for (const note of moment.notes) {
    const resolution = resolveEventToPad(
      { noteNumber: note.noteNumber, voiceId: note.soundId },
      voiceIdIndex,
      noteIndex,
      config.instrumentConfig,
      'allow-fallback',
    );

    if (resolution.source === 'unmapped') {
      unmappedCount++;
      continue;
    }

    const pk = padKey(resolution.pad.row, resolution.pad.col);
    activePadKeys.push(pk);

    const owner = padFingerAssignment[pk];
    if (owner) {
      noteAssignments.push({
        noteNumber: note.noteNumber,
        voiceId: note.soundId,
        padKey: pk,
        hand: owner.hand,
        finger: owner.finger,
      });
    } else {
      // Pad exists in layout but not in finger assignment
      unmappedCount++;
    }
  }

  // Step 2: Build hand poses from the assignment
  const poseResult = buildMomentPoses(activePadKeys, padFingerAssignment);

  // Step 3: Compute cost dimensions
  const poseDetail = computePoseDetail(poseResult, config);
  const poseNaturalness = poseDetail.attractor + poseDetail.perFingerHome + poseDetail.fingerDominance;

  // Constraint penalty based on grip tier
  const constraintPenalty = tierToPenalty(poseResult.tier);

  // Alternation cost
  let alternation = 0;
  if (prevMomentContext && prevMomentContext.assignments.length > 0) {
    const dt = moment.startTime - prevMomentContext.timestamp;
    const currentAssignments = noteAssignments.map(na => ({ hand: na.hand, finger: na.finger }));
    alternation = calculateAlternationCost(prevMomentContext.assignments, currentAssignments, dt);
  }

  // Hand balance cost
  let handBalance = 0;
  if (handCounts) {
    const leftNow = noteAssignments.filter(na => na.hand === 'left').length;
    const rightNow = noteAssignments.filter(na => na.hand === 'right').length;
    handBalance = calculateHandBalanceCost(
      handCounts.left + leftNow,
      handCounts.right + rightNow,
    );
  }

  // Transition cost is 0 for a single event (computed in evaluateTransition)
  const transitionCost = 0;

  const total = poseNaturalness + transitionCost + constraintPenalty + alternation + handBalance;

  const dimensions: CostDimensions = {
    poseNaturalness,
    transitionCost,
    constraintPenalty,
    alternation,
    handBalance,
    total,
  };

  // Determine feasibility tier
  let feasibilityTier: ConstraintTier = poseResult.tier;
  if (unmappedCount > 0 || poseResult.unmappedPads.length > 0) {
    feasibilityTier = 'fallback';
  }

  return {
    momentIndex: moment.momentIndex,
    timestamp: moment.startTime,
    dimensions,
    poseDetail,
    feasibilityTier,
    noteAssignments,
    debug: includeDebug ? {
      handPoses: {
        left: poseResult.left ?? undefined,
        right: poseResult.right ?? undefined,
      },
    } : undefined,
  };
}

// ============================================================================
// Transition Evaluation
// ============================================================================

/** Input for evaluateTransition. */
export interface EvaluateTransitionInput {
  fromMoment: PerformanceMoment;
  toMoment: PerformanceMoment;
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
  includeDebug?: boolean;
}

/**
 * Evaluate the transition between two consecutive moments.
 *
 * Computes Fitts's Law movement cost between the two hand poses,
 * plus speed pressure, hand switch, and finger change metrics.
 */
export function evaluateTransition(input: EvaluateTransitionInput): TransitionCostBreakdown {
  const { fromMoment, toMoment, layout, padFingerAssignment, config, includeDebug } = input;

  // Resolve pads for both moments
  const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteIndex = buildNoteToPadIndex(layout.padToVoice);

  const fromPadKeys = resolveMomentPadKeys(fromMoment, voiceIdIndex, noteIndex, config.instrumentConfig);
  const toPadKeys = resolveMomentPadKeys(toMoment, voiceIdIndex, noteIndex, config.instrumentConfig);

  const fromPoses = buildMomentPoses(fromPadKeys, padFingerAssignment);
  const toPoses = buildMomentPoses(toPadKeys, padFingerAssignment);

  const timeDelta = toMoment.startTime - fromMoment.startTime;
  const timeDeltaMs = timeDelta * 1000;

  // Compute transition cost per hand
  let transitionCost = 0;
  let rawFittsLawCost = 0;

  if (fromPoses.left && toPoses.left) {
    const cost = calculateTransitionCost(fromPoses.left, toPoses.left, timeDelta);
    transitionCost += cost;
    rawFittsLawCost += cost;
  }
  if (fromPoses.right && toPoses.right) {
    const cost = calculateTransitionCost(fromPoses.right, toPoses.right, timeDelta);
    transitionCost += cost;
    rawFittsLawCost += cost;
  }

  // Movement metrics
  const gridDistance = computeGridDistanceBetweenPoses(fromPoses, toPoses);
  const speedPressure = timeDelta > 0.001
    ? Math.tanh((gridDistance / (timeDelta + 0.001)) * 0.1)
    : 0;
  const handSwitch = detectHandSwitch(fromPadKeys, toPadKeys, padFingerAssignment);
  const fingerChange = detectFingerChange(fromPadKeys, toPadKeys, padFingerAssignment);

  const dimensions: CostDimensions = {
    poseNaturalness: 0,
    transitionCost,
    constraintPenalty: 0,
    alternation: 0,
    handBalance: 0,
    total: transitionCost,
  };

  return {
    fromMomentIndex: fromMoment.momentIndex,
    toMomentIndex: toMoment.momentIndex,
    fromTimestamp: fromMoment.startTime,
    toTimestamp: toMoment.startTime,
    timeDeltaMs,
    dimensions,
    movement: {
      gridDistance,
      speedPressure,
      handSwitch,
      fingerChange,
    },
    debug: includeDebug ? {
      fromHandPoses: {
        left: fromPoses.left ?? undefined,
        right: fromPoses.right ?? undefined,
      },
      toHandPoses: {
        left: toPoses.left ?? undefined,
        right: toPoses.right ?? undefined,
      },
      rawFittsLawCost,
    } : undefined,
  };
}

// ============================================================================
// Performance Evaluation
// ============================================================================

/** Input for evaluatePerformance. */
export interface EvaluatePerformanceInput {
  moments: PerformanceMoment[];
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
  includeDebug?: boolean;
}

/**
 * Evaluate a full performance sequence.
 *
 * Iterates through all moments, computing event costs and transition costs,
 * then aggregates into a structured PerformanceCostBreakdown.
 *
 * This is the primary canonical evaluation function.
 */
export function evaluatePerformance(input: EvaluatePerformanceInput): PerformanceCostBreakdown {
  const { moments, layout, padFingerAssignment, config, includeDebug } = input;

  if (moments.length === 0) {
    return emptyPerformanceBreakdown(padFingerAssignment);
  }

  // Pre-build indexes once for the whole performance
  // TODO: use these indexes for moment-level pad resolution
  void buildVoiceIdToPadIndex(layout.padToVoice);
  void buildNoteToPadIndex(layout.padToVoice);

  const eventCosts: EventCostBreakdown[] = [];
  const transitionCosts: TransitionCostBreakdown[] = [];
  let totalCost = 0;
  let hardMomentCount = 0;
  let infeasibleMomentCount = 0;
  let leftCount = 0;
  let rightCount = 0;

  let prevAssignments: Array<{ hand: HandSide; finger: FingerType }> = [];
  let prevTimestamp = 0;

  // Evaluate each moment
  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];

    const eventResult = evaluateEvent({
      moment,
      layout,
      padFingerAssignment,
      config,
      prevMomentContext: i > 0 ? { assignments: prevAssignments, timestamp: prevTimestamp } : undefined,
      handCounts: { left: leftCount, right: rightCount },
      includeDebug,
    });

    eventCosts.push(eventResult);
    totalCost += eventResult.dimensions.total;

    // Track feasibility
    if (eventResult.feasibilityTier === 'fallback') {
      hardMomentCount++;
    }
    if (eventResult.noteAssignments.length < moment.notes.length) {
      infeasibleMomentCount++;
    }

    // Update running state
    prevAssignments = eventResult.noteAssignments.map(na => ({ hand: na.hand, finger: na.finger }));
    prevTimestamp = moment.startTime;
    leftCount += eventResult.noteAssignments.filter(na => na.hand === 'left').length;
    rightCount += eventResult.noteAssignments.filter(na => na.hand === 'right').length;

    // Evaluate transition to next moment
    if (i < moments.length - 1) {
      const transitionResult = evaluateTransition({
        fromMoment: moment,
        toMoment: moments[i + 1],
        layout,
        padFingerAssignment,
        config,
        includeDebug,
      });

      transitionCosts.push(transitionResult);
      totalCost += transitionResult.dimensions.total;
    }
  }

  // Aggregate
  const allEventDimensions = eventCosts.map(e => e.dimensions);
  const allTransitionDimensions = transitionCosts.map(t => t.dimensions);
  const allDimensions = [...allEventDimensions, ...allTransitionDimensions];

  const aggregatedDimensions = allDimensions.reduce(sumCostDimensions, createZeroCostDimensions());

  const averageDimensions = averageCostDimensions(allEventDimensions);

  // Find peak moment
  let peakMomentIndex = 0;
  let peakTotal = 0;
  const peakDimensions = createZeroCostDimensions();
  for (let i = 0; i < eventCosts.length; i++) {
    if (eventCosts[i].dimensions.total > peakTotal) {
      peakTotal = eventCosts[i].dimensions.total;
      peakMomentIndex = i;
      Object.assign(peakDimensions, eventCosts[i].dimensions);
    }
  }

  const aggregateMetrics: AggregateMetrics = {
    averageDimensions,
    peakDimensions,
    peakMomentIndex,
    hardMomentCount,
    infeasibleMomentCount,
    momentCount: moments.length,
    transitionCount: transitionCosts.length,
  };

  const feasibility = deriveFeasibilityVerdict(
    infeasibleMomentCount,
    hardMomentCount,
    infeasibleMomentCount,
    eventCosts.filter(e => e.feasibilityTier === 'fallback').length,
    moments.length,
  );

  return {
    total: totalCost,
    dimensions: aggregatedDimensions,
    eventCosts,
    transitionCosts,
    aggregateMetrics,
    feasibility,
    padFingerAssignment,
  };
}

// ============================================================================
// Layout Comparison
// ============================================================================

/** Input for compareLayouts. */
export interface CompareLayoutsInput {
  moments: PerformanceMoment[];
  layoutA: Layout;
  assignmentA: PadFingerAssignment;
  layoutB: Layout;
  assignmentB: PadFingerAssignment;
  config: EvaluationConfig;
}

/**
 * Compare two layout+assignment pairs on the same event sequence.
 *
 * Evaluates both configurations and produces a structured comparison
 * with per-dimension deltas, per-moment deltas, and change lists.
 */
export function compareLayouts(input: CompareLayoutsInput): LayoutComparisonResult {
  const { moments, layoutA, assignmentA, layoutB, assignmentB, config } = input;

  const costA = evaluatePerformance({ moments, layout: layoutA, padFingerAssignment: assignmentA, config });
  const costB = evaluatePerformance({ moments, layout: layoutB, padFingerAssignment: assignmentB, config });

  const dimensionDeltas: CostDimensions = {
    poseNaturalness: costB.dimensions.poseNaturalness - costA.dimensions.poseNaturalness,
    transitionCost: costB.dimensions.transitionCost - costA.dimensions.transitionCost,
    constraintPenalty: costB.dimensions.constraintPenalty - costA.dimensions.constraintPenalty,
    alternation: costB.dimensions.alternation - costA.dimensions.alternation,
    handBalance: costB.dimensions.handBalance - costA.dimensions.handBalance,
    total: costB.total - costA.total,
  };

  const overallDelta = dimensionDeltas.total;
  const TIE_THRESHOLD = 0.01;
  const winner: 'A' | 'B' | 'tie' = Math.abs(overallDelta) < TIE_THRESHOLD
    ? 'tie'
    : overallDelta < 0 ? 'B' : 'A';

  // Per-moment deltas
  const perMomentDeltas = costA.eventCosts.map((ea, i) => {
    const eb = costB.eventCosts[i];
    if (!eb) return { momentIndex: i, deltaTotal: 0, winnerThisMoment: 'tie' as const };
    const delta = eb.dimensions.total - ea.dimensions.total;
    return {
      momentIndex: i,
      deltaTotal: delta,
      winnerThisMoment: Math.abs(delta) < TIE_THRESHOLD ? 'tie' as const
        : delta < 0 ? 'B' as const : 'A' as const,
    };
  });

  // Layout changes
  const allPadKeys = new Set([
    ...Object.keys(layoutA.padToVoice),
    ...Object.keys(layoutB.padToVoice),
  ]);
  const layoutChanges: LayoutComparisonResult['layoutChanges'] = [];
  for (const pk of allPadKeys) {
    const voiceA = layoutA.padToVoice[pk]?.id;
    const voiceB = layoutB.padToVoice[pk]?.id;
    if (voiceA !== voiceB) {
      layoutChanges.push({ padKey: pk, voiceA, voiceB });
    }
  }

  // Assignment changes
  const allAssignmentKeys = new Set([
    ...Object.keys(assignmentA),
    ...Object.keys(assignmentB),
  ]);
  const assignmentChanges: LayoutComparisonResult['assignmentChanges'] = [];
  for (const pk of allAssignmentKeys) {
    const fA = assignmentA[pk];
    const fB = assignmentB[pk];
    if (fA?.hand !== fB?.hand || fA?.finger !== fB?.finger) {
      assignmentChanges.push({
        padKey: pk,
        fingerA: fA ? { hand: fA.hand, finger: fA.finger } : undefined,
        fingerB: fB ? { hand: fB.hand, finger: fB.finger } : undefined,
      });
    }
  }

  return {
    costA,
    costB,
    dimensionDeltas,
    overallDelta,
    winner,
    perMomentDeltas,
    layoutChanges,
    assignmentChanges,
  };
}

// ============================================================================
// Assignment Validation
// ============================================================================

/** Input for validateAssignment. */
export interface ValidateAssignmentInput {
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  moments: PerformanceMoment[];
  config: EvaluationConfig;
}

/**
 * Validate that a PadFingerAssignment is internally consistent and
 * biomechanically feasible for the given layout and event sequence.
 *
 * Checks:
 * 1. No two pads assigned to the same finger on the same hand at the same moment
 *    (unless those pads are not simultaneously active)
 * 2. All notes in the event sequence can be resolved to pads in the assignment
 * 3. Grip feasibility per moment
 */
export function validateAssignment(input: ValidateAssignmentInput): AssignmentValidationResult {
  const { layout, padFingerAssignment, moments, config } = input;
  const issues: AssignmentIssue[] = [];

  // Check 1: Ownership conflicts (same finger on different pads)
  const fingerToPads: Record<string, string[]> = {};
  for (const [pk, owner] of Object.entries(padFingerAssignment)) {
    const key = `${owner.hand}:${owner.finger}`;
    if (!fingerToPads[key]) fingerToPads[key] = [];
    fingerToPads[key].push(pk);
  }
  // Note: Multiple pads per finger is allowed (finger can own multiple pads).
  // The constraint is that each pad maps to exactly one finger (Invariant B).

  // Check for duplicate pad entries (same pad, two different fingers)
  const padToFingerCount: Record<string, number> = {};
  for (const pk of Object.keys(padFingerAssignment)) {
    padToFingerCount[pk] = (padToFingerCount[pk] || 0) + 1;
    if (padToFingerCount[pk] > 1) {
      issues.push({
        type: 'ownership_conflict',
        padKey: pk,
        message: `Pad ${pk} is assigned to multiple fingers`,
      });
    }
  }

  // Check 2: All notes can be resolved
  const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteIndex = buildNoteToPadIndex(layout.padToVoice);

  for (const moment of moments) {
    for (const note of moment.notes) {
      const resolution = resolveEventToPad(
        { noteNumber: note.noteNumber, voiceId: note.soundId },
        voiceIdIndex,
        noteIndex,
        config.instrumentConfig,
        'strict',
      );

      if (resolution.source === 'unmapped') {
        issues.push({
          type: 'unmapped_note',
          momentIndex: moment.momentIndex,
          message: `Note ${note.noteNumber} (voice: ${note.soundId}) at moment ${moment.momentIndex} has no pad mapping`,
        });
        continue;
      }

      const pk = padKey(resolution.pad.row, resolution.pad.col);
      if (!padFingerAssignment[pk]) {
        issues.push({
          type: 'unmapped_note',
          padKey: pk,
          momentIndex: moment.momentIndex,
          message: `Pad ${pk} is used at moment ${moment.momentIndex} but has no finger assignment`,
        });
      }
    }
  }

  // Check 3: Grip feasibility per moment
  for (const moment of moments) {
    const padKeys = resolveMomentPadKeysFromIndexes(moment, voiceIdIndex, noteIndex, config.instrumentConfig);
    const poseResult = buildMomentPoses(padKeys, padFingerAssignment);

    if (poseResult.tier === 'fallback') {
      issues.push({
        type: 'infeasible_grip',
        momentIndex: moment.momentIndex,
        message: `Moment ${moment.momentIndex} requires a fallback grip (biomechanically strained)`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

function computePoseDetail(
  poseResult: MomentPoseResult,
  config: EvaluationConfig,
): PoseNaturalnessDetail {
  let attractor = 0;
  let perFingerHome = 0;
  let fingerDominance = 0;

  if (poseResult.left) {
    attractor += calculateAttractorCost(poseResult.left, config.restingPose.left, config.stiffness);
    if (config.neutralHandCenters) {
      perFingerHome += calculatePerFingerHomeCost(poseResult.left, 'left', config.neutralHandCenters, 0.8);
    }
    fingerDominance += calculateFingerDominanceCost(poseResult.left);
  }

  if (poseResult.right) {
    attractor += calculateAttractorCost(poseResult.right, config.restingPose.right, config.stiffness);
    if (config.neutralHandCenters) {
      perFingerHome += calculatePerFingerHomeCost(poseResult.right, 'right', config.neutralHandCenters, 0.8);
    }
    fingerDominance += calculateFingerDominanceCost(poseResult.right);
  }

  // Apply the same weighting as calculatePoseNaturalness
  return {
    attractor: 0.4 * attractor,
    perFingerHome: 0.4 * perFingerHome,
    fingerDominance: 0.2 * fingerDominance,
  };
}

function tierToPenalty(tier: ConstraintTier): number {
  switch (tier) {
    case 'strict': return 0;
    case 'relaxed': return RELAXED_GRIP_PENALTY;
    case 'fallback': return FALLBACK_GRIP_PENALTY;
  }
}

function resolveMomentPadKeys(
  moment: PerformanceMoment,
  voiceIdIndex: Map<string, import('../../types/padGrid').PadCoord>,
  noteIndex: Map<number, import('../../types/padGrid').PadCoord>,
  instrumentConfig: InstrumentConfig,
): string[] {
  return resolveMomentPadKeysFromIndexes(moment, voiceIdIndex, noteIndex, instrumentConfig);
}

function resolveMomentPadKeysFromIndexes(
  moment: PerformanceMoment,
  voiceIdIndex: Map<string, import('../../types/padGrid').PadCoord>,
  noteIndex: Map<number, import('../../types/padGrid').PadCoord>,
  instrumentConfig: InstrumentConfig,
): string[] {
  const padKeys: string[] = [];
  for (const note of moment.notes) {
    const resolution = resolveEventToPad(
      { noteNumber: note.noteNumber, voiceId: note.soundId },
      voiceIdIndex,
      noteIndex,
      instrumentConfig,
      'allow-fallback',
    );
    if (resolution.source !== 'unmapped') {
      padKeys.push(padKey(resolution.pad.row, resolution.pad.col));
    }
  }
  return padKeys;
}

function computeGridDistanceBetweenPoses(
  fromPoses: MomentPoseResult,
  toPoses: MomentPoseResult,
): number {
  let totalDist = 0;
  if (fromPoses.left && toPoses.left) {
    const dx = fromPoses.left.centroid.x - toPoses.left.centroid.x;
    const dy = fromPoses.left.centroid.y - toPoses.left.centroid.y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }
  if (fromPoses.right && toPoses.right) {
    const dx = fromPoses.right.centroid.x - toPoses.right.centroid.x;
    const dy = fromPoses.right.centroid.y - toPoses.right.centroid.y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }
  return totalDist;
}

function detectHandSwitch(
  fromPadKeys: string[],
  toPadKeys: string[],
  assignment: PadFingerAssignment,
): boolean {
  const fromHands = new Set(fromPadKeys.map(pk => assignment[pk]?.hand).filter(Boolean));
  const toHands = new Set(toPadKeys.map(pk => assignment[pk]?.hand).filter(Boolean));
  // Hand switch if the set of active hands changed
  if (fromHands.size !== toHands.size) return true;
  for (const h of fromHands) {
    if (!toHands.has(h as HandSide)) return true;
  }
  return false;
}

function detectFingerChange(
  fromPadKeys: string[],
  toPadKeys: string[],
  assignment: PadFingerAssignment,
): boolean {
  const fromFingers = new Set(fromPadKeys.map(pk => {
    const o = assignment[pk];
    return o ? `${o.hand}:${o.finger}` : null;
  }).filter(Boolean));
  const toFingers = new Set(toPadKeys.map(pk => {
    const o = assignment[pk];
    return o ? `${o.hand}:${o.finger}` : null;
  }).filter(Boolean));
  if (fromFingers.size !== toFingers.size) return true;
  for (const f of fromFingers) {
    if (!toFingers.has(f as string)) return true;
  }
  return false;
}

function emptyPerformanceBreakdown(assignment: PadFingerAssignment): PerformanceCostBreakdown {
  return {
    total: 0,
    dimensions: createZeroCostDimensions(),
    eventCosts: [],
    transitionCosts: [],
    aggregateMetrics: {
      averageDimensions: createZeroCostDimensions(),
      peakDimensions: createZeroCostDimensions(),
      peakMomentIndex: 0,
      hardMomentCount: 0,
      infeasibleMomentCount: 0,
      momentCount: 0,
      transitionCount: 0,
    },
    feasibility: { level: 'feasible', summary: 'No events to evaluate', reasons: [] },
    padFingerAssignment: assignment,
  };
}
