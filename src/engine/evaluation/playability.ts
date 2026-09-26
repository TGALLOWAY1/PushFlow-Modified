/**
 * Playability: the one yardstick every layout is shown with (decision Q5,
 * roadmap P3 "One yardstick", T21).
 *
 * A layout's Playability depends only on the layout, the performance, the
 * evaluation settings and the cost toggles — never on which optimizer proposed
 * the layout. It scores the fingering of the layout's own analysis plan, and
 * all three inputs of computePlanScore come from the canonical evaluator run on
 * that fingering: its hard events (fallback grips), its unplayable events (a
 * note with no pad or finger, one finger on two pads, a move faster than a hand
 * can go) and its average cost per event. Each solver's own `plan.score`, which
 * classifies hard and unplayable its own way, stays internal to that solver.
 *
 * Pure: no state, no I/O, safe to run in a worker.
 */

import { type Layout } from '../../types/layout';
import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type PerformanceEvent, type PerformanceMoment, MOMENT_EPSILON } from '../../types/performanceEvent';
import { type ExecutionPlanResult, type FingerAssignment, type PadFingerAssignment } from '../../types/executionPlan';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type CostToggles } from '../../types/costToggles';
import { type DiagnosticFactors, type FeasibilityVerdict } from '../../types/diagnostics';
import { evaluatePerformance } from './canonicalEvaluator';
import { computePlanScore } from './planScore';
import { buildPerformanceMoments, extractPadOwnership } from '../structure/momentBuilder';
import { getNeutralHandCenters } from '../prior/handPose';

/** Names this yardstick in caches and on every score. Change it when the formula changes. */
export const PLAYABILITY_EVALUATOR_ID = 'canonical-v1';

/** One layout's score on the one yardstick. */
export interface LayoutScore {
  /** The yardstick that produced it (PLAYABILITY_EVALUATOR_ID). */
  evaluatorId: string;
  /** 0–100, higher = easier (computePlanScore). Displays round it to an integer. */
  playability: number;
  /** Events scored: everything struck at one instant is one event. */
  events: number;
  /** Events whose grip breaks the strict hand-geometry rules (canonical fallback grips). */
  hardEvents: number;
  /** Events that can't be played: a note with no pad or finger, one finger on two pads, or a move too fast for a hand. */
  unplayableEvents: number;
  /** The five canonical factor totals and their sum, for each factor's share of the burden. */
  factors: DiagnosticFactors;
  /** Average cost per event: the ergonomic term of the score. */
  costPerEvent: number;
  /** The canonical feasibility verdict for the same evaluation. */
  feasibility: FeasibilityVerdict;
}

export interface ScoreLayoutPlayabilityInput {
  /** The performance to score. To score only part of it (placed material, say), pass a filtered copy. */
  performance: Pick<Performance, 'events'>;
  layout: Layout;
  /** The plan whose fingering is scored: the layout's own analysis plan. */
  plan: Pick<ExecutionPlanResult, 'fingerAssignments' | 'padFingerOwnership'>;
  config: EvaluationConfig;
  /** Disabled cost families contribute nothing (all enabled when omitted). */
  costToggles?: CostToggles;
}

/** The evaluation settings for a layout, as Calculate Cost and the solvers build them. */
export function evaluationConfigFor(
  layout: Layout,
  engineConfig: Pick<EngineConfiguration, 'restingPose' | 'stiffness'>,
  instrumentConfig: InstrumentConfig,
): EvaluationConfig {
  return {
    restingPose: engineConfig.restingPose,
    stiffness: engineConfig.stiffness,
    instrumentConfig,
    neutralHandCenters: getNeutralHandCenters(layout, instrumentConfig),
  };
}

/** Events in the beam solver's order (time, channel, pitch, key), so input order never matters. */
function sortedForScoring(events: readonly PerformanceEvent[]): PerformanceEvent[] {
  return [...events].sort((a, b) =>
    a.startTime - b.startTime
    || (a.channel ?? 0) - (b.channel ?? 0)
    || a.noteNumber - b.noteNumber
    || (a.eventKey ?? '').localeCompare(b.eventKey ?? ''));
}

/**
 * The fingering a plan plays: each pad's usual finger, plus the moments where
 * the plan re-fingers a pad (because a rule had to give way there), scored with
 * the finger it actually plays. Mirrors the beam solver's canonicalBreakdown.
 */
function planFingering(
  plan: ScoreLayoutPlayabilityInput['plan'],
  moments: readonly PerformanceMoment[],
): { padFingerAssignment: PadFingerAssignment; momentFingerOverrides: Map<number, PadFingerAssignment> } {
  const played = plan.fingerAssignments.filter(
    (a): a is FingerAssignment & { assignedHand: 'left' | 'right'; finger: NonNullable<FingerAssignment['finger']>; row: number; col: number } =>
      a.assignedHand !== 'Unplayable' && !!a.finger && a.row !== undefined && a.col !== undefined,
  );
  const padFingerAssignment = plan.padFingerOwnership
    ?? extractPadOwnership(played.map(a => ({ ...a, padId: a.padId ?? `${a.row},${a.col}` }))).ownership;

  const byEventKey = new Map<string, (typeof played)[number]>();
  const bySound = new Map<string, (typeof played)[number][]>();
  for (const a of played) {
    if (a.eventKey !== undefined) byEventKey.set(a.eventKey, a);
    const soundKey = `${a.noteNumber}|${a.voiceId ?? ''}`;
    if (!bySound.has(soundKey)) bySound.set(soundKey, []);
    bySound.get(soundKey)!.push(a);
  }
  const findStrike = (moment: PerformanceMoment, note: PerformanceMoment['notes'][number]) =>
    (note.noteKey !== undefined ? byEventKey.get(note.noteKey) : undefined)
    ?? bySound.get(`${note.noteNumber}|${note.voiceId ?? ''}`)
      ?.find(a => Math.abs(a.startTime - moment.startTime) <= MOMENT_EPSILON + 1e-9);

  const momentFingerOverrides = new Map<number, PadFingerAssignment>();
  moments.forEach((moment, index) => {
    for (const note of moment.notes) {
      const a = findStrike(moment, note);
      if (!a) continue;
      const pad = `${a.row},${a.col}`;
      const usual = padFingerAssignment[pad];
      if (usual && usual.hand === a.assignedHand && usual.finger === a.finger) continue;
      if (!momentFingerOverrides.has(index)) momentFingerOverrides.set(index, {});
      momentFingerOverrides.get(index)![pad] = { hand: a.assignedHand, finger: a.finger };
    }
  });
  return { padFingerAssignment, momentFingerOverrides };
}

/**
 * Scores a layout played with a plan's fingering on the one yardstick.
 * Deterministic: the same layout, events, fingering, settings and toggles
 * always give the same score.
 */
export function scoreLayoutPlayability(input: ScoreLayoutPlayabilityInput): LayoutScore {
  const { performance, layout, plan, config, costToggles } = input;
  const moments = buildPerformanceMoments(sortedForScoring(performance.events));
  const { padFingerAssignment, momentFingerOverrides } = planFingering(plan, moments);
  const breakdown = evaluatePerformance({ moments, layout, padFingerAssignment, momentFingerOverrides, config, costToggles });

  const hardEvents = breakdown.aggregateMetrics.hardMomentCount;
  const unplayableEvents = breakdown.aggregateMetrics.infeasibleMomentCount;
  const d = breakdown.dimensions;
  return {
    evaluatorId: PLAYABILITY_EVALUATOR_ID,
    playability: computePlanScore({ hardCount: hardEvents, unplayableCount: unplayableEvents, avgErgonomicCost: breakdown.costPerMoment }),
    events: moments.length,
    hardEvents,
    unplayableEvents,
    factors: {
      transition: d.transitionCost,
      gripNaturalness: d.poseNaturalness,
      alternation: d.alternation,
      handBalance: d.handBalance,
      constraintPenalty: d.constraintPenalty,
      total: d.total,
    },
    costPerEvent: breakdown.costPerMoment,
    feasibility: breakdown.feasibility,
  };
}
