/**
 * Part 2 — Candidate Solution Report Generator.
 *
 * generateCandidateReport(candidateSolution) produces a comprehensive
 * report summarizing:
 *   - Layout pad-to-voice assignments
 *   - Finger usage statistics (per hand and combined)
 *   - Aggregated cost totals and averages
 *   - Constraint violations
 *   - Full evaluation record timeline
 */

import { type CandidateSolution } from '../../types/candidateSolution';
import { type FingerType } from '../../types/fingerModel';
import { extractEvaluationRecords } from './evaluationRecorder';
import {
  type CandidateReport,
  type FingerUsageBreakdown,
  type HandUsageBreakdown,
  type CostTotals,
  type ConstraintViolationSummary,
  type OptimizationEvaluationRecord,
} from './types';

/**
 * Generates a comprehensive debugging report for a candidate solution.
 */
export function generateCandidateReport(
  candidate: CandidateSolution,
): CandidateReport {
  const plan = candidate.executionPlan;
  const records = extractEvaluationRecords(plan);

  // Layout summary: pad key -> voice name
  const layoutSummary: Record<string, string> = {};
  for (const [padKey, voice] of Object.entries(candidate.layout.padToVoice)) {
    layoutSummary[padKey] = voice.name ?? `MIDI ${voice.originalMidiNote ?? '?'}`;
  }

  // Finger usage
  const fingerUsage = computeFingerUsage(records);

  // Hand usage
  const handUsage = computeHandUsage(records);

  // Cost totals and averages
  const costTotals = computeCostTotals(records);
  const costAverages = computeCostAverages(costTotals, records.length);

  // Constraint violations
  const constraintViolations = detectViolationsFromRecords(records);

  return {
    candidateId: candidate.id,
    layoutSummary,
    fingerUsage,
    handUsage,
    costTotals,
    costAverages,
    constraintViolations,
    evaluationRecords: records,
    totalEvents: records.length,
    strategy: candidate.metadata.strategy,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Finger Usage Computation
// ============================================================================

function computeFingerUsage(records: OptimizationEvaluationRecord[]): {
  left: FingerUsageBreakdown;
  right: FingerUsageBreakdown;
  combined: FingerUsageBreakdown;
} {
  const leftCounts: Record<FingerType, number> = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
  const rightCounts: Record<FingerType, number> = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
  const combinedCounts: Record<FingerType, number> = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };

  let leftTotal = 0;
  let rightTotal = 0;

  for (const r of records) {
    if (r.hand === 'Unplayable' || !r.finger) continue;

    combinedCounts[r.finger]++;
    if (r.hand === 'left') {
      leftCounts[r.finger]++;
      leftTotal++;
    } else {
      rightCounts[r.finger]++;
      rightTotal++;
    }
  }

  const toBreakdown = (counts: Record<FingerType, number>, total: number): FingerUsageBreakdown => {
    if (total === 0) return { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
    return {
      thumb: (counts.thumb / total) * 100,
      index: (counts.index / total) * 100,
      middle: (counts.middle / total) * 100,
      ring: (counts.ring / total) * 100,
      pinky: (counts.pinky / total) * 100,
    };
  };

  return {
    left: toBreakdown(leftCounts, leftTotal),
    right: toBreakdown(rightCounts, rightTotal),
    combined: toBreakdown(combinedCounts, leftTotal + rightTotal),
  };
}

// ============================================================================
// Hand Usage Computation
// ============================================================================

function computeHandUsage(records: OptimizationEvaluationRecord[]): HandUsageBreakdown {
  const total = records.length;
  if (total === 0) return { left: 0, right: 0, unplayable: 0 };

  let left = 0, right = 0, unplayable = 0;
  for (const r of records) {
    if (r.hand === 'left') left++;
    else if (r.hand === 'right') right++;
    else unplayable++;
  }

  return {
    left: (left / total) * 100,
    right: (right / total) * 100,
    unplayable: (unplayable / total) * 100,
  };
}

// ============================================================================
// Cost Computation
// ============================================================================

function computeCostTotals(records: OptimizationEvaluationRecord[]): CostTotals {
  const totals: CostTotals = {
    travel: 0,
    transitionSpeed: 0,
    pose: 0,
    zoneViolation: 0,
    fingerPenalty: 0,
    repetitionPenalty: 0,
    collisionPenalty: 0,
    feasibilityPenalty: 0,
    total: 0,
  };

  for (const r of records) {
    totals.travel += r.costs.travel;
    totals.transitionSpeed += r.costs.transitionSpeed;
    totals.pose += r.costs.pose;
    totals.zoneViolation += r.costs.zoneViolation;
    totals.fingerPenalty += r.costs.fingerPenalty;
    totals.repetitionPenalty += r.costs.repetitionPenalty;
    totals.collisionPenalty += r.costs.collisionPenalty;
    totals.feasibilityPenalty += r.costs.feasibilityPenalty;
    totals.total += r.totalCost;
  }

  return totals;
}

function computeCostAverages(totals: CostTotals, count: number): CostTotals {
  if (count === 0) return { ...totals };
  return {
    travel: totals.travel / count,
    transitionSpeed: totals.transitionSpeed / count,
    pose: totals.pose / count,
    zoneViolation: totals.zoneViolation / count,
    fingerPenalty: totals.fingerPenalty / count,
    repetitionPenalty: totals.repetitionPenalty / count,
    collisionPenalty: totals.collisionPenalty / count,
    feasibilityPenalty: totals.feasibilityPenalty / count,
    total: totals.total / count,
  };
}

// ============================================================================
// Constraint Violation Detection from Records
// ============================================================================

function detectViolationsFromRecords(
  records: OptimizationEvaluationRecord[],
): ConstraintViolationSummary[] {
  const violations: ConstraintViolationSummary[] = [];

  for (const r of records) {
    // Zone violation
    if (r.costs.zoneViolation > 0 && r.hand !== 'Unplayable') {
      violations.push({
        eventIndex: r.eventIndex,
        constraintName: 'zone_violation',
        explanation: `${r.hand} hand used at pad [${r.pad[0]},${r.pad[1]}] outside preferred zone (violation distance: ${r.costs.zoneViolation.toFixed(1)})`,
        severity: r.costs.zoneViolation > 2 ? 'error' : 'warning',
      });
    }

    // Feasibility penalty (fallback/relaxed grip)
    if (r.costs.feasibilityPenalty > 0) {
      violations.push({
        eventIndex: r.eventIndex,
        constraintName: 'feasibility_penalty',
        explanation: `Event ${r.eventIndex} triggered feasibility penalty (${r.costs.feasibilityPenalty.toFixed(1)}) — possible fallback grip`,
        severity: r.costs.feasibilityPenalty >= 1000 ? 'error' : 'warning',
      });
    }

    // Unplayable event
    if (r.hand === 'Unplayable') {
      violations.push({
        eventIndex: r.eventIndex,
        constraintName: 'unplayable',
        explanation: `Event ${r.eventIndex} (note ${r.noteNumber}) classified as Unplayable`,
        severity: 'error',
      });
    }
  }

  return violations;
}
