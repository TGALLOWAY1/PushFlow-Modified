/**
 * Constraint Explainer.
 *
 * Identifies which constraints bind in a solution and provides
 * human-readable explanations.
 *
 * NEW in PushFlow rebuild (not ported from Version1).
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type Section } from '../../types/performanceStructure';

// ============================================================================
// Types
// ============================================================================

export interface ConstraintExplanation {
  type: 'unplayable' | 'hard' | 'drift' | 'stretch' | 'crossover' | 'fatigue';
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

  // High average drift
  if (result.averageDrift > 2.5) {
    explanations.push({
      type: 'drift',
      severity: result.averageDrift > 4.0 ? 'warning' : 'info',
      message: `Average drift ${result.averageDrift.toFixed(1)} — hands frequently far from home positions`,
    });
  }

  // High movement cost
  if (result.averageMetrics.movement > 3.0) {
    explanations.push({
      type: 'crossover',
      severity: result.averageMetrics.movement > 6.0 ? 'warning' : 'info',
      message: `High average movement cost (${result.averageMetrics.movement.toFixed(1)}) — transitions require large hand movements`,
    });
  }

  // High stretch cost
  if (result.averageMetrics.stretch > 2.0) {
    explanations.push({
      type: 'stretch',
      severity: result.averageMetrics.stretch > 4.0 ? 'warning' : 'info',
      message: `High average stretch cost (${result.averageMetrics.stretch.toFixed(1)}) — fingers frequently extended beyond comfortable range`,
    });
  }

  // High fatigue
  if (result.averageMetrics.fatigue > 1.0) {
    explanations.push({
      type: 'fatigue',
      severity: result.averageMetrics.fatigue > 3.0 ? 'warning' : 'info',
      message: `Elevated fatigue cost (${result.averageMetrics.fatigue.toFixed(1)}) — repeated finger usage without sufficient recovery`,
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

    // High movement in section
    const playable = sectionAssignments.filter(a => a.costBreakdown);
    if (playable.length > 0) {
      const avgMovement = playable.reduce(
        (sum, a) => sum + (a.costBreakdown?.movement ?? 0), 0
      ) / playable.length;

      if (avgMovement > 4.0) {
        constraints.push({
          type: 'crossover',
          severity: 'warning',
          message: `High movement cost (${avgMovement.toFixed(1)}) in ${section.name}`,
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
