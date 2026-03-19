/**
 * Canonical Diagnostic Types.
 *
 * Phase 3: Unify feasibility, scoring, and diagnostics.
 *
 * These types define the stable naming contract for all engine outputs.
 * Every cost factor, feasibility verdict, and diagnostic payload uses
 * the names defined here. UI, compare mode, and event analysis should
 * consume DiagnosticsPayload rather than ad-hoc cost breakdowns.
 *
 * Factor names are self-documenting and map directly to the engine's
 * actual computations — no misleading aliases.
 */

// ============================================================================
// Canonical Factor Names
// ============================================================================

/**
 * DiagnosticFactors: Canonical cost factor breakdown.
 *
 * Five top-level factors with stable names. All values are raw costs
 * (lower = better, 0 = no cost). The engine computes exactly these
 * factors; no information is hidden or remapped.
 */
export interface DiagnosticFactors {
  /** Fitts's Law movement cost between consecutive pads. */
  transition: number;
  /** Combined grip quality: fingerPreference + handShapeDeviation. */
  gripNaturalness: number;
  /** Same-finger rapid repetition penalty. */
  alternation: number;
  /** Left/right hand distribution imbalance. */
  handBalance: number;
  /** Hard penalty for constraint-relaxed or fallback grips. */
  constraintPenalty: number;
  /** Weighted total (lower = better). */
  total: number;
}

// ============================================================================
// Feasibility Verdict
// ============================================================================

/**
 * FeasibilityLevel: Overall feasibility classification.
 *
 * - feasible: all events can be played with valid grips.
 * - degraded: playable but has hard events.
 * - infeasible: one or more events cannot be mapped or played.
 */
export type FeasibilityLevel = 'feasible' | 'degraded' | 'infeasible';

/**
 * FeasibilityReason: A named reason for degradation or infeasibility.
 */
export interface FeasibilityReason {
  /** Category of the issue. */
  type:
    | 'unplayable_event'    // Event classified as Unplayable
    | 'unmapped_note'       // Note has no pad mapping in the layout
    | 'fallback_grip'       // Grip required constraint relaxation (Tier 3)
    | 'extreme_stretch'     // Grip requires extreme finger spread
    | 'hard_event';         // Event classified as Hard
  /** Human-readable explanation. */
  message: string;
  /** Number of events affected (when applicable). */
  eventCount?: number;
}

/**
 * FeasibilityVerdict: Layout-level feasibility assessment.
 *
 * Tells the user whether a layout is a serious option, why it might not be,
 * and how many events are affected. Derived from the execution plan output.
 */
export interface FeasibilityVerdict {
  /** Overall classification. */
  level: FeasibilityLevel;
  /** One-line human-readable summary. */
  summary: string;
  /** Named reasons for degradation or infeasibility (empty if fully feasible). */
  reasons: FeasibilityReason[];
}

// ============================================================================
// Infeasibility Diagnostics (V1)
// ============================================================================

/**
 * Per-sound infeasibility diagnostic.
 *
 * V1 (D-03): When an event cannot be assigned (no valid grip or transition),
 * it is marked infeasible. This type aggregates infeasible events by sound/voiceId
 * so the user can identify which sounds need layout changes.
 */
export interface InfeasibilityDiagnostic {
  /** Sound identifier (voiceId or noteNumber string). */
  soundId: string;
  /** Number of events for this sound that are infeasible. */
  violationCount: number;
  /** Total events for this sound. */
  totalEvents: number;
}

// ============================================================================
// V1 Cost Model Types (Phase 8)
// ============================================================================

/**
 * V1 constraint violation at the event level.
 *
 * Each violation is a specific reason why an event or grip is infeasible.
 * Hard constraints are binary — they either pass or produce a violation.
 */
export interface ConstraintViolation {
  /** What kind of constraint was violated. */
  type:
    | 'zone_violation'    // Hand is playing outside its valid zone
    | 'span_exceeded'     // Finger spread exceeds biomechanical limit
    | 'no_valid_grip'     // No valid grip exists for this chord
    | 'unmapped_note'     // Note has no pad in the layout
    | 'speed_exceeded';   // Transition speed exceeds MAX_HAND_SPEED
  /** Human-readable explanation. */
  message: string;
}

/**
 * V1 event-level feasibility check (binary pass/fail).
 *
 * Replaces the old tiered system. An event is either feasible (has a valid
 * grip and transition) or infeasible (one or more constraint violations).
 */
export interface V1FeasibilityCheck {
  /** Whether this event can be played. */
  feasible: boolean;
  /** Specific violations (empty if feasible). */
  violations: ConstraintViolation[];
}

/**
 * V1 event cost: what it costs to play this grip.
 *
 * Two factors:
 * - fingerPreference: anatomical finger preference (weaker fingers cost more)
 * - handShapeDeviation: translation-invariant grip shape distortion
 *
 * Total = fingerPreference + handShapeDeviation.
 */
export interface V1EventCost {
  /** Anatomical finger preference cost. */
  fingerPreference: number;
  /** Translation-invariant grip shape deviation from natural hand shape. */
  handShapeDeviation: number;
  /** Sum of fingerPreference + handShapeDeviation. */
  total: number;
}

/**
 * V1 transition cost: what it costs to move to this grip.
 *
 * Based on Fitts's Law: distance + speed × weight.
 * Returns Infinity if speed exceeds MAX_HAND_SPEED (hard rejection).
 */
export interface V1TransitionCost {
  /** Fitts's Law movement cost. */
  movementCost: number;
  /** Same as movementCost (single-factor). */
  total: number;
}

/**
 * V1 performance cost: aggregate across all events in the performance.
 *
 * Provides the summary metrics for layout comparison and ranking.
 */
export interface V1PerformanceCost {
  /** Mean event cost (fingerPreference + handShapeDeviation) across all events. */
  meanEventCost: number;
  /** Mean transition cost across all events. */
  meanTransitionCost: number;
  /** Hand balance cost (left/right distribution penalty). */
  handBalance: number;
  /** Number of infeasible events (binary, not a cost). */
  infeasibleEventCount: number;
  /** Weighted total for ranking. */
  total: number;
}

/**
 * V1 diagnostic factors: the canonical cost breakdown for diagnostics.
 *
 * Replaces DiagnosticFactors with V1-aligned field names.
 * Every field maps directly to a single engine computation.
 * No misleading aliases or collapsed sub-components.
 */
export interface V1DiagnosticFactors {
  /** Anatomical finger preference cost. */
  fingerPreference: number;
  /** Translation-invariant grip shape deviation. */
  handShapeDeviation: number;
  /** Fitts's Law transition cost. */
  transitionCost: number;
  /** Left/right hand distribution penalty. */
  handBalance: number;
  /** Weighted total (lower = better). */
  total: number;
}

/**
 * V1 cost breakdown: replaces DifficultyBreakdown with V1-aligned names.
 *
 * Used on FingerAssignment, MomentAssignment, and ExecutionPlanResult
 * for per-event and aggregate cost breakdowns.
 */
export interface V1CostBreakdown {
  /** Anatomical finger preference cost. */
  fingerPreference: number;
  /** Translation-invariant grip shape deviation. */
  handShapeDeviation: number;
  /** Fitts's Law transition cost. */
  transitionCost: number;
  /** Left/right hand distribution penalty. */
  handBalance: number;
  /** Hard constraint penalty (always 0 for valid grips; non-zero = infeasible). */
  constraintPenalty: number;
  /** Weighted total. */
  total: number;
}

/** Creates a zero-valued V1CostBreakdown. */
export function createZeroV1CostBreakdown(): V1CostBreakdown {
  return {
    fingerPreference: 0,
    handShapeDeviation: 0,
    transitionCost: 0,
    handBalance: 0,
    constraintPenalty: 0,
    total: 0,
  };
}

/** Creates a zero-valued V1DiagnosticFactors. */
export function createZeroV1DiagnosticFactors(): V1DiagnosticFactors {
  return {
    fingerPreference: 0,
    handShapeDeviation: 0,
    transitionCost: 0,
    handBalance: 0,
    total: 0,
  };
}

/**
 * Compute top contributing factor names from V1DiagnosticFactors.
 * Returns factor names ordered by descending magnitude.
 */
export function computeV1TopContributors(factors: V1DiagnosticFactors): string[] {
  const entries: Array<[string, number]> = [
    ['fingerPreference', factors.fingerPreference],
    ['handShapeDeviation', factors.handShapeDeviation],
    ['transitionCost', factors.transitionCost],
    ['handBalance', factors.handBalance],
  ];

  return entries
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// ============================================================================
// Unified Diagnostics Payload
// ============================================================================

/**
 * DiagnosticsPayload: The single canonical diagnostics output.
 *
 * Carried on ExecutionPlanResult.diagnostics. Provides everything the UI
 * needs for summary, compare, and event analysis from one source:
 *
 * - feasibility: Is this layout viable?
 * - factors: What are the cost components?
 * - topContributors: Which factors dominate?
 * - bindingConstraints: What limits further optimization?
 */
export interface DiagnosticsPayload {
  /** Layout-level feasibility verdict. */
  feasibility: FeasibilityVerdict;
  /** Canonical cost factor breakdown (aggregate across all events). */
  factors: DiagnosticFactors;
  /** Top contributing factor names, ordered by magnitude (most impactful first). */
  topContributors: string[];
  /** Binding constraints — human-readable reasons this layout is hard to optimize further. */
  bindingConstraints?: string[];
  /** V1: Per-sound infeasibility breakdown (only present if there are infeasible events). */
  infeasibleSounds?: InfeasibilityDiagnostic[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Creates a zero-valued DiagnosticFactors. */
export function createZeroDiagnosticFactors(): DiagnosticFactors {
  return {
    transition: 0,
    gripNaturalness: 0,
    alternation: 0,
    handBalance: 0,
    constraintPenalty: 0,
    total: 0,
  };
}

/**
 * Compute top contributing factor names from a DiagnosticFactors object.
 * Returns factor names ordered by descending magnitude.
 * Only includes factors with non-zero values.
 */
export function computeTopContributors(factors: DiagnosticFactors): string[] {
  const entries: Array<[string, number]> = [
    ['transition', factors.transition],
    ['gripNaturalness', factors.gripNaturalness],
    ['alternation', factors.alternation],
    ['handBalance', factors.handBalance],
    ['constraintPenalty', factors.constraintPenalty],
  ];

  return entries
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/**
 * Derive a FeasibilityVerdict from execution plan summary stats.
 */
export function deriveFeasibilityVerdict(
  unplayableCount: number,
  hardCount: number,
  unmappedCount: number,
  fallbackGripCount: number,
  totalEvents: number,
): FeasibilityVerdict {
  const reasons: FeasibilityReason[] = [];

  if (unmappedCount > 0) {
    reasons.push({
      type: 'unmapped_note',
      message: `${unmappedCount} note${unmappedCount > 1 ? 's have' : ' has'} no pad mapping in the layout`,
      eventCount: unmappedCount,
    });
  }

  if (unplayableCount > 0) {
    reasons.push({
      type: 'unplayable_event',
      message: `${unplayableCount} event${unplayableCount > 1 ? 's are' : ' is'} unplayable`,
      eventCount: unplayableCount,
    });
  }

  if (fallbackGripCount > 0) {
    reasons.push({
      type: 'fallback_grip',
      message: `${fallbackGripCount} event${fallbackGripCount > 1 ? 's require' : ' requires'} fallback grip (constraint relaxation)`,
      eventCount: fallbackGripCount,
    });
  }

  if (hardCount > 0) {
    reasons.push({
      type: 'hard_event',
      message: `${hardCount} event${hardCount > 1 ? 's are' : ' is'} classified as Hard`,
      eventCount: hardCount,
    });
  }

  // Determine level
  let level: FeasibilityLevel;
  if (unplayableCount > 0 || unmappedCount > 0) {
    level = 'infeasible';
  } else if (fallbackGripCount > 0 || hardCount > 0) {
    level = 'degraded';
  } else {
    level = 'feasible';
  }

  // Generate summary
  let summary: string;
  if (level === 'feasible') {
    summary = `All ${totalEvents} events are playable with natural grips`;
  } else if (level === 'infeasible') {
    const issues: string[] = [];
    if (unmappedCount > 0) issues.push(`${unmappedCount} unmapped`);
    if (unplayableCount > 0) issues.push(`${unplayableCount} unplayable`);
    summary = `Layout is not fully playable: ${issues.join(', ')} of ${totalEvents} events`;
  } else {
    const issues: string[] = [];
    if (fallbackGripCount > 0) issues.push(`${fallbackGripCount} fallback grips`);
    if (hardCount > 0) issues.push(`${hardCount} hard events`);
    summary = `Layout is playable but degraded: ${issues.join(', ')}`;
  }

  return { level, summary, reasons };
}
