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
 *
 * For grip sub-breakdown, see GripNaturalnessDetail.
 */
export interface DiagnosticFactors {
  /** Fitts's Law movement cost between consecutive pads. */
  transition: number;
  /** Combined grip quality: attractor + per-finger home + finger dominance. */
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

/**
 * GripNaturalnessDetail: Sub-breakdown of the gripNaturalness factor.
 *
 * Optional — only provided when the solver tracks individual components.
 * Maps directly to the three sub-costs inside PerformabilityObjective.poseNaturalness.
 */
export interface GripNaturalnessDetail {
  /** Spring force pulling hands toward resting pose centroid. */
  attractor: number;
  /** Per-finger distance from neutral home positions. */
  perFingerHome: number;
  /** Anatomical finger preference cost (weaker fingers cost more). */
  fingerDominance: number;
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
 * - gripDetail: Where does grip difficulty come from?
 * - topContributors: Which factors dominate?
 * - bindingConstraints: What limits further optimization?
 */
export interface DiagnosticsPayload {
  /** Layout-level feasibility verdict. */
  feasibility: FeasibilityVerdict;
  /** Canonical cost factor breakdown (aggregate across all events). */
  factors: DiagnosticFactors;
  /** Optional sub-breakdown of gripNaturalness. */
  gripDetail?: GripNaturalnessDetail;
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
