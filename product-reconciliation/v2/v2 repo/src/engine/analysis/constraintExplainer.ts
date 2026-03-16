/**
 * Constraint Explainer.
 *
 * Identifies which constraints bind in a solution and provides
 * human-readable explanations using canonical factor names.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 * Updated Phase 6: Normalized to canonical DiagnosticFactor terminology.
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section } from '../../types/performanceStructure';

// ============================================================================
// Types
// ============================================================================

/**
 * Canonical constraint types aligned with DiagnosticFactors.
 *
 * - unplayable / hard: event-level classifications (not factors)
 * - transition: movement cost between pads (was 'crossover' for movement checks)
 * - gripNaturalness: stretch / drift from resting position (was 'drift', 'stretch')
 * - alternation: same-finger repetition fatigue (was 'fatigue')
 * - constraintPenalty: fallback grip penalties
 */
export type ConstraintType =
  | 'unplayable'
  | 'hard'
  | 'transition'
  | 'gripNaturalness'
  | 'alternation'
  | 'constraintPenalty';

export interface ConstraintExplanation {
  type: ConstraintType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedEvents?: number;
  sectionName?: string;
}

export interface BottleneckInfo {
  sectionName: string;
  sectionIndex: number;
  constraintCount: number;
  constraints: ConstraintExplanation[];
}

// ============================================================================
// Constraint Explanation
// ============================================================================

/**
 * Explains which constraints bind in a solver result.
 */
export function explainConstraints(
  result: ExecutionPlanResult
): ConstraintExplanation[] {
  const explanations: ConstraintExplanation[] = [];
  const totalEvents = result.fingerAssignments.length;

  // Unplayable events
  if (result.unplayableCount > 0) {
    const pct = ((result.unplayableCount / Math.max(totalEvents, 1)) * 100).toFixed(0);
    explanations.push({
      type: 'unplayable',
      severity: result.unplayableCount > 3 ? 'critical' : 'warning',
      message: `${result.unplayableCount} event(s) (${pct}%) classified as Unplayable — layout may not cover all voices`,
      affectedEvents: result.unplayableCount,
    });
  }

  // Hard events
  if (result.hardCount > 0) {
    const pct = ((result.hardCount / Math.max(totalEvents, 1)) * 100).toFixed(0);
    explanations.push({
      type: 'hard',
      severity: result.hardCount > totalEvents * 0.2 ? 'warning' : 'info',
      message: `${result.hardCount} Hard event(s) (${pct}%) — grip or stretch limit reached`,
      affectedEvents: result.hardCount,
    });
  }

  // Grip naturalness: drift from home + stretch combined
  // Uses canonical DiagnosticFactors when available, falls back to legacy metrics
  const gripCost = result.diagnostics?.factors.gripNaturalness
    ?? (result.averageDrift + result.averageMetrics.stretch) / 2;
  if (gripCost > 2.0) {
    explanations.push({
      type: 'gripNaturalness',
      severity: gripCost > 4.0 ? 'warning' : 'info',
      message: `Grip naturalness cost ${gripCost.toFixed(1)} — hands frequently stretched or drifted from comfortable positions`,
    });
  }

  // Transition: movement cost between pads
  const transitionCost = result.diagnostics?.factors.transition
    ?? result.averageMetrics.movement;
  if (transitionCost > 3.0) {
    explanations.push({
      type: 'transition',
      severity: transitionCost > 6.0 ? 'warning' : 'info',
      message: `High transition cost (${transitionCost.toFixed(1)}) — large hand movements between consecutive events`,
    });
  }

  // Alternation: same-finger repetition / fatigue
  const alternationCost = result.diagnostics?.factors.alternation
    ?? result.averageMetrics.fatigue;
  if (alternationCost > 1.0) {
    explanations.push({
      type: 'alternation',
      severity: alternationCost > 3.0 ? 'warning' : 'info',
      message: `Alternation cost ${alternationCost.toFixed(1)} — repeated same-finger usage without sufficient recovery`,
    });
  }

  // Constraint penalty: fallback grips
  const constraintCost = result.diagnostics?.factors.constraintPenalty ?? 0;
  if (constraintCost > 0.5) {
    explanations.push({
      type: 'constraintPenalty',
      severity: constraintCost > 2.0 ? 'warning' : 'info',
      message: `Constraint penalty ${constraintCost.toFixed(1)} — some events require fallback or relaxed grips`,
    });
  }

  return explanations;
}

/**
 * Identifies which passages have the most binding constraints.
 */
export function identifyBottlenecks(
  result: ExecutionPlanResult,
  sections: Section[]
): BottleneckInfo[] {
  const bottlenecks: BottleneckInfo[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionAssignments = result.fingerAssignments.filter(
      a => a.startTime >= section.startTime && a.startTime < section.endTime
    );

    if (sectionAssignments.length === 0) continue;

    const constraints: ConstraintExplanation[] = [];

    // Count issues within this section
    const unplayable = sectionAssignments.filter(a => a.assignedHand === 'Unplayable').length;
    const hard = sectionAssignments.filter(a => a.difficulty === 'Hard').length;

    if (unplayable > 0) {
      constraints.push({
        type: 'unplayable',
        severity: 'critical',
        message: `${unplayable} unplayable event(s) in ${section.name}`,
        affectedEvents: unplayable,
        sectionName: section.name,
      });
    }

    if (hard > 0) {
      const pct = ((hard / sectionAssignments.length) * 100).toFixed(0);
      constraints.push({
        type: 'hard',
        severity: hard > sectionAssignments.length * 0.3 ? 'warning' : 'info',
        message: `${hard} hard event(s) (${pct}%) in ${section.name} — required fallback grips`,
        affectedEvents: hard,
        sectionName: section.name,
      });
    }

    // High transition cost in section (legacy: movement)
    const playable = sectionAssignments.filter(a => a.costBreakdown);
    if (playable.length > 0) {
      const avgTransition = playable.reduce(
        (sum, a) => sum + (a.costBreakdown?.movement ?? 0), 0
      ) / playable.length;

      if (avgTransition > 4.0) {
        constraints.push({
          type: 'transition',
          severity: 'warning',
          message: `High transition cost (${avgTransition.toFixed(1)}) in ${section.name}`,
          sectionName: section.name,
        });
      }
    }

    if (constraints.length > 0) {
      bottlenecks.push({
        sectionName: section.name,
        sectionIndex: i,
        constraintCount: constraints.length,
        constraints,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.constraintCount - a.constraintCount);
}
