/**
 * Event Explainer (Phase 5).
 *
 * Explains difficult moments and transitions using canonical diagnostics.
 * Replaces ad-hoc cost breakdown labels with the stable canonical factor
 * names from Phase 3.
 *
 * Provides:
 * - Per-event difficulty explanations using canonical factors
 * - Transition explanations between consecutive events
 * - Identification of hardest moments against a specific layout state
 */

import { type FingerAssignment, type ExecutionPlanResult } from '../../types/executionPlan';
import { type V1CostBreakdown } from '../../types/diagnostics';
import { type AnalyzedMoment } from '../evaluation/eventMetrics';
import { groupAssignmentsIntoMoments } from '../evaluation/eventMetrics';
import { analyzeTransition, type Transition } from '../evaluation/transitionAnalyzer';

// ============================================================================
// Types
// ============================================================================

/**
 * EventExplanation: A human-readable explanation of why a single
 * event is easy or difficult, using canonical factor names.
 */
export interface EventExplanation {
  /** Index of the event in the finger assignments array. */
  eventIndex: number;
  /** Time position of the event. */
  startTime: number;
  /** Note number. */
  noteNumber: number;
  /** Assigned hand/finger. */
  assignedHand: string;
  finger: string | null;
  /** Difficulty classification. */
  difficulty: string;
  /** Cost of this event. */
  cost: number;
  /** Canonical factor breakdown (mapped from DifficultyBreakdown). */
  canonicalFactors: {
    factor: string;
    label: string;
    value: number;
  }[];
  /** Dominant factor (highest cost). */
  dominantFactor: string;
  /** Human-readable explanation. */
  explanation: string;
}

/**
 * TransitionExplanation: Explains why a transition between two moments
 * is difficult.
 */
export interface TransitionExplanation {
  fromTime: number;
  toTime: number;
  timeDeltaMs: number;
  gridDistance: number;
  handSwitch: boolean;
  fingerChange: boolean;
  speedPressure: number;
  compositeDifficulty: number;
  /** Human-readable explanation of why this transition is hard. */
  explanation: string;
  /** List of contributing difficulty factors. */
  contributors: string[];
}

/**
 * HardMomentReport: Groups hard events and transitions together
 * for a specific time range in the performance.
 */
export interface HardMomentReport {
  /** Timestamp of the hard moment. */
  timestamp: number;
  /** Events at this moment. */
  events: EventExplanation[];
  /** Transition leading into this moment (if any). */
  incomingTransition?: TransitionExplanation;
  /** Overall difficulty of this moment (0–1). */
  momentDifficulty: number;
  /** Summary explanation. */
  summary: string;
}

// ============================================================================
// Canonical Factor Mapping
// ============================================================================

/**
 * Maps V1CostBreakdown fields to canonical factor names.
 */
const V1_FACTOR_MAP: Array<{ key: keyof V1CostBreakdown; factor: string; label: string }> = [
  { key: 'transitionCost', factor: 'transition', label: 'Transition difficulty (Fitts\'s Law)' },
  { key: 'fingerPreference', factor: 'fingerPreference', label: 'Finger preference cost' },
  { key: 'handShapeDeviation', factor: 'handShapeDeviation', label: 'Hand shape deviation' },
  { key: 'handBalance', factor: 'handBalance', label: 'Hand balance' },
  { key: 'constraintPenalty', factor: 'constraintPenalty', label: 'Constraint penalty' },
];

/**
 * Maps a V1CostBreakdown into canonical factor contributions.
 */
function mapToCanonicalFactors(
  breakdown: V1CostBreakdown,
): { factor: string; label: string; value: number }[] {
  const factors: { factor: string; label: string; value: number }[] = [];

  for (const { key, factor, label } of V1_FACTOR_MAP) {
    const value = breakdown[key];
    if (typeof value === 'number' && value > 0.001) {
      factors.push({ factor, label, value });
    }
  }

  // Sort by value descending
  return factors.sort((a, b) => b.value - a.value);
}

// ============================================================================
// Event Explanation
// ============================================================================

/**
 * Explains a single finger assignment using canonical factor names.
 */
export function explainEvent(
  assignment: FingerAssignment,
  eventIndex: number,
): EventExplanation {
  const canonicalFactors = assignment.costBreakdown
    ? mapToCanonicalFactors(assignment.costBreakdown)
    : [];

  const dominantFactor = canonicalFactors.length > 0
    ? canonicalFactors[0].factor
    : 'unknown';

  const explanation = buildEventExplanation(assignment, canonicalFactors);

  return {
    eventIndex,
    startTime: assignment.startTime,
    noteNumber: assignment.noteNumber,
    assignedHand: assignment.assignedHand,
    finger: assignment.finger,
    difficulty: assignment.difficulty,
    cost: assignment.cost,
    canonicalFactors,
    dominantFactor,
    explanation,
  };
}

function buildEventExplanation(
  assignment: FingerAssignment,
  canonicalFactors: { factor: string; label: string; value: number }[],
): string {
  if (assignment.assignedHand === 'Unplayable') {
    return `Note ${assignment.noteNumber} at ${assignment.startTime.toFixed(2)}s is unplayable — no valid grip found.`;
  }

  if (assignment.difficulty === 'Easy') {
    return `Note ${assignment.noteNumber}: easy (${assignment.assignedHand} ${assignment.finger}).`;
  }

  const parts: string[] = [
    `Note ${assignment.noteNumber} at ${assignment.startTime.toFixed(2)}s: ${assignment.difficulty.toLowerCase()}`,
    `(${assignment.assignedHand} ${assignment.finger}, cost ${assignment.cost.toFixed(2)})`,
  ];

  if (canonicalFactors.length > 0) {
    const topFactors = canonicalFactors.slice(0, 2).map(f => f.label);
    parts.push(`— driven by ${topFactors.join(' and ')}`);
  }

  return parts.join(' ');
}

// ============================================================================
// Transition Explanation
// ============================================================================

/**
 * Explains a transition between two moments.
 */
export function explainTransition(transition: Transition): TransitionExplanation {
  const m = transition.metrics;
  const contributors: string[] = [];

  if (m.speedPressure > 0.5) contributors.push('high speed pressure');
  if (m.gridDistance > 3) contributors.push('large hand movement');
  if (m.handSwitch) contributors.push('hand switch');
  if (m.fingerChange) contributors.push('finger change');
  if (m.anatomicalStretchScore > 0.5) contributors.push('finger stretch');

  const explanation = buildTransitionExplanation(transition, contributors);

  return {
    fromTime: transition.fromMoment.timestamp,
    toTime: transition.toMoment.timestamp,
    timeDeltaMs: m.timeDeltaMs,
    gridDistance: m.gridDistance,
    handSwitch: m.handSwitch,
    fingerChange: m.fingerChange,
    speedPressure: m.speedPressure,
    compositeDifficulty: m.compositeDifficultyScore,
    explanation,
    contributors,
  };
}

function buildTransitionExplanation(
  transition: Transition,
  contributors: string[],
): string {
  const m = transition.metrics;
  const fromTime = transition.fromMoment.timestamp.toFixed(2);
  const toTime = transition.toMoment.timestamp.toFixed(2);

  if (m.compositeDifficultyScore < 0.2) {
    return `Transition ${fromTime}s → ${toTime}s: easy.`;
  }

  const diffLabel = m.compositeDifficultyScore > 0.7 ? 'very hard'
    : m.compositeDifficultyScore > 0.4 ? 'moderately hard'
    : 'slightly difficult';

  const parts = [`Transition ${fromTime}s → ${toTime}s: ${diffLabel}`];

  if (contributors.length > 0) {
    parts.push(`(${contributors.join(', ')})`);
  }

  return parts.join(' ');
}

// ============================================================================
// Hard Moment Identification
// ============================================================================

/**
 * Identifies the hardest moments in an execution plan and explains them
 * using canonical diagnostics.
 *
 * Returns the top-K hardest moments, each with event explanations and
 * the incoming transition.
 */
export function identifyHardMoments(
  plan: ExecutionPlanResult,
  topK: number = 5,
): HardMomentReport[] {
  const moments = groupAssignmentsIntoMoments(plan.fingerAssignments);
  if (moments.length === 0) return [];

  // Build transitions
  const transitions: (Transition | null)[] = [null]; // No incoming for first moment
  for (let i = 0; i < moments.length - 1; i++) {
    const t = analyzeTransition(moments[i], moments[i + 1]);
    t.fromIndex = i;
    t.toIndex = i + 1;
    transitions.push(t);
  }

  // Score each moment
  const reports: HardMomentReport[] = moments.map((moment, idx) => {
    const events = moment.assignments.map((a, aIdx) =>
      explainEvent(a, moment.eventIndex + aIdx),
    );

    const incomingTransition = transitions[idx]
      ? explainTransition(transitions[idx]!)
      : undefined;

    // Combined difficulty: moment difficulty + incoming transition difficulty
    const momentDiff = moment.metrics.compositeDifficultyScore;
    const transitionDiff = transitions[idx]?.metrics.compositeDifficultyScore ?? 0;
    const combined = Math.max(momentDiff, transitionDiff * 0.8 + momentDiff * 0.2);

    const summary = buildMomentSummary(moment, events, incomingTransition, combined);

    return {
      timestamp: moment.timestamp,
      events,
      incomingTransition,
      momentDifficulty: combined,
      summary,
    };
  });

  // Sort by difficulty and return top K
  return reports
    .sort((a, b) => b.momentDifficulty - a.momentDifficulty)
    .slice(0, topK);
}

function buildMomentSummary(
  moment: AnalyzedMoment,
  events: EventExplanation[],
  incomingTransition: TransitionExplanation | undefined,
  difficulty: number,
): string {
  const time = moment.timestamp.toFixed(2);

  if (difficulty < 0.2) {
    return `Moment at ${time}s: easy.`;
  }

  const parts: string[] = [`Moment at ${time}s:`];

  // Count hard events
  const hardEvents = events.filter(e => e.difficulty === 'Hard' || e.difficulty === 'Unplayable');
  if (hardEvents.length > 0) {
    parts.push(`${hardEvents.length} hard/unplayable event(s)`);
  }

  // Note polyphony
  if (moment.metrics.polyphony > 1) {
    parts.push(`(${moment.metrics.polyphony}-note chord)`);
  }

  // Incoming transition
  if (incomingTransition && incomingTransition.compositeDifficulty > 0.3) {
    parts.push(`with difficult incoming transition`);
    if (incomingTransition.contributors.length > 0) {
      parts.push(`(${incomingTransition.contributors.slice(0, 2).join(', ')})`);
    }
  }

  return parts.join(' ');
}
