/**
 * Part 8 — Optimization Sanity Checks.
 *
 * Automatic assertions that detect when optimizer output violates
 * expected invariants. Run these after any optimization to catch
 * obvious problems immediately.
 *
 * Checks:
 *   - Pinky usage below threshold
 *   - Thumb usage below threshold
 *   - Zone violation rate below threshold
 *   - No impossible moves (Infinity cost)
 *   - Hand balance within range
 *   - Average cost below extreme threshold
 *   - No same-finger rapid repetition above threshold
 */

import { type ExecutionPlanResult } from '../../types/executionPlan';
import { type SanityCheckResult, type SanityCheckReport } from './types';

/**
 * Default thresholds for sanity checks.
 * Can be overridden for specific use cases.
 */
export interface SanityCheckThresholds {
  maxPinkyUsagePercent: number;
  maxThumbUsagePercent: number;
  maxZoneViolationPercent: number;
  maxImpossibleMoves: number;
  maxHandImbalancePercent: number;
  maxAverageCost: number;
  maxSameFingerRepeatPercent: number;
}

export const DEFAULT_THRESHOLDS: SanityCheckThresholds = {
  maxPinkyUsagePercent: 20,
  maxThumbUsagePercent: 15,
  maxZoneViolationPercent: 10,
  maxImpossibleMoves: 0,
  maxHandImbalancePercent: 80,
  maxAverageCost: 25,
  maxSameFingerRepeatPercent: 30,
};

/**
 * Runs all sanity checks on an execution plan result.
 * Returns a report with pass/fail for each check and aggregate status.
 */
export function runSanityChecks(
  result: ExecutionPlanResult,
  thresholds: Partial<SanityCheckThresholds> = {},
): SanityCheckReport {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const checks: SanityCheckResult[] = [];

  checks.push(checkPinkyUsage(result, t.maxPinkyUsagePercent));
  checks.push(checkThumbUsage(result, t.maxThumbUsagePercent));
  checks.push(checkZoneViolations(result, t.maxZoneViolationPercent));
  checks.push(checkImpossibleMoves(result, t.maxImpossibleMoves));
  checks.push(checkHandBalance(result, t.maxHandImbalancePercent));
  checks.push(checkAverageCost(result, t.maxAverageCost));
  checks.push(checkSameFingerRepeat(result, t.maxSameFingerRepeatPercent));

  const allPassed = checks.every(c => c.passed);
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
  const errors = checks.filter(c => !c.passed && c.severity === 'error').length;

  return { checks, allPassed, warnings, errors };
}

/**
 * Runs sanity checks and logs warnings to console.
 * Use this in development/debug builds for immediate feedback.
 */
export function runSanityChecksWithLogging(
  result: ExecutionPlanResult,
  thresholds?: Partial<SanityCheckThresholds>,
): SanityCheckReport {
  const report = runSanityChecks(result, thresholds);

  if (!report.allPassed) {
    console.warn('[PushFlow Sanity Check] Failures detected:');
    for (const check of report.checks) {
      if (!check.passed) {
        const prefix = check.severity === 'error' ? 'ERROR' : 'WARNING';
        console.warn(`  [${prefix}] ${check.name}: ${check.message}`);
      }
    }
  }

  return report;
}

// ============================================================================
// Individual Checks
// ============================================================================

function checkPinkyUsage(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const assignments = result.fingerAssignments;
  const playable = assignments.filter(a => a.assignedHand !== 'Unplayable' && a.finger);
  const pinkyCount = playable.filter(a => a.finger === 'pinky').length;
  const pct = playable.length > 0 ? (pinkyCount / playable.length) * 100 : 0;

  return {
    name: 'pinky_usage',
    passed: pct <= threshold,
    actual: pct,
    threshold,
    message: pct <= threshold
      ? `Pinky usage ${pct.toFixed(1)}% is within threshold (${threshold}%)`
      : `Pinky usage ${pct.toFixed(1)}% exceeds ${threshold}% — possible irrational finger assignment`,
    severity: pct > threshold * 1.5 ? 'error' : 'warning',
  };
}

function checkThumbUsage(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const assignments = result.fingerAssignments;
  const playable = assignments.filter(a => a.assignedHand !== 'Unplayable' && a.finger);
  const thumbCount = playable.filter(a => a.finger === 'thumb').length;
  const pct = playable.length > 0 ? (thumbCount / playable.length) * 100 : 0;

  return {
    name: 'thumb_usage',
    passed: pct <= threshold,
    actual: pct,
    threshold,
    message: pct <= threshold
      ? `Thumb usage ${pct.toFixed(1)}% is within threshold (${threshold}%)`
      : `Thumb usage ${pct.toFixed(1)}% exceeds ${threshold}% — thumbs should be used sparingly for percussion`,
    severity: pct > threshold * 1.5 ? 'error' : 'warning',
  };
}

function checkZoneViolations(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const assignments = result.fingerAssignments;
  const playable = assignments.filter(a => a.assignedHand !== 'Unplayable');

  let violationCount = 0;
  for (const a of playable) {
    if (a.row === undefined || a.col === undefined) continue;
    // Left hand in columns >= 5 or Right hand in columns <= 2
    if (
      (a.assignedHand === 'left' && a.col >= 5) ||
      (a.assignedHand === 'right' && a.col <= 2)
    ) {
      violationCount++;
    }
  }

  const pct = playable.length > 0 ? (violationCount / playable.length) * 100 : 0;

  return {
    name: 'zone_violations',
    passed: pct <= threshold,
    actual: pct,
    threshold,
    message: pct <= threshold
      ? `Zone violation rate ${pct.toFixed(1)}% is within threshold (${threshold}%)`
      : `Zone violation rate ${pct.toFixed(1)}% exceeds ${threshold}% — hands frequently crossing zones`,
    severity: pct > threshold * 2 ? 'error' : 'warning',
  };
}

function checkImpossibleMoves(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const impossibleCount = result.fingerAssignments.filter(
    a => a.cost === Infinity,
  ).length;

  return {
    name: 'impossible_moves',
    passed: impossibleCount <= threshold,
    actual: impossibleCount,
    threshold,
    message: impossibleCount <= threshold
      ? `No impossible moves detected`
      : `${impossibleCount} impossible moves detected — these transitions exceed physical limits`,
    severity: 'error',
  };
}

function checkHandBalance(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const assignments = result.fingerAssignments;
  let leftCount = 0, rightCount = 0;

  for (const a of assignments) {
    if (a.assignedHand === 'left') leftCount++;
    else if (a.assignedHand === 'right') rightCount++;
  }

  const total = leftCount + rightCount;
  const dominantPct = total > 0 ? (Math.max(leftCount, rightCount) / total) * 100 : 50;
  const dominantHand = leftCount > rightCount ? 'left' : 'right';

  return {
    name: 'hand_balance',
    passed: dominantPct <= threshold,
    actual: dominantPct,
    threshold,
    message: dominantPct <= threshold
      ? `Hand balance OK — ${dominantHand} hand at ${dominantPct.toFixed(1)}%`
      : `${dominantHand} hand dominates at ${dominantPct.toFixed(1)}% (threshold: ${threshold}%) — possible imbalance`,
    severity: dominantPct > 90 ? 'error' : 'warning',
  };
}

function checkAverageCost(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const finiteCosts = result.fingerAssignments
    .filter(a => a.cost !== Infinity && a.cost > 0)
    .map(a => a.cost);
  const avg = finiteCosts.length > 0
    ? finiteCosts.reduce((s, c) => s + c, 0) / finiteCosts.length
    : 0;

  return {
    name: 'average_cost',
    passed: avg <= threshold,
    actual: avg,
    threshold,
    message: avg <= threshold
      ? `Average cost ${avg.toFixed(2)} is within threshold (${threshold})`
      : `Average cost ${avg.toFixed(2)} exceeds ${threshold} — solution quality may be poor`,
    severity: avg > threshold * 2 ? 'error' : 'warning',
  };
}

function checkSameFingerRepeat(
  result: ExecutionPlanResult,
  threshold: number,
): SanityCheckResult {
  const assignments = result.fingerAssignments;
  let repeatCount = 0;

  for (let i = 1; i < assignments.length; i++) {
    const prev = assignments[i - 1];
    const curr = assignments[i];

    if (
      prev.assignedHand !== 'Unplayable' &&
      curr.assignedHand !== 'Unplayable' &&
      prev.finger === curr.finger &&
      prev.assignedHand === curr.assignedHand &&
      prev.finger !== null &&
      // Only count if events are close in time (rapid repetition)
      curr.startTime - prev.startTime < 0.25
    ) {
      repeatCount++;
    }
  }

  const total = assignments.length;
  const pct = total > 0 ? (repeatCount / total) * 100 : 0;

  return {
    name: 'same_finger_rapid_repeat',
    passed: pct <= threshold,
    actual: pct,
    threshold,
    message: pct <= threshold
      ? `Same-finger rapid repeat rate ${pct.toFixed(1)}% is within threshold (${threshold}%)`
      : `Same-finger rapid repeat rate ${pct.toFixed(1)}% exceeds ${threshold}% — alternation not working properly`,
    severity: pct > threshold * 1.5 ? 'error' : 'warning',
  };
}
