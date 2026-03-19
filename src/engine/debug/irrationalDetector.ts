/**
 * Part 3 — Irrational Finger Assignment Detector.
 *
 * Detects clearly irrational finger assignments using a rule-based system.
 * Each rule encodes a biomechanical expectation that, when violated without
 * good reason, suggests a scoring bug or mis-weighted cost function.
 *
 * Rules:
 *   1. Pinky Misuse — pinky used when index/middle would clearly work
 *   2. Thumb Abuse — thumb used for non-low-row pads without reason
 *   3. Dominant Finger Preference — index > middle > ring > pinky
 *   4. Same-Finger Streak — same finger used for 3+ consecutive events
 *   5. Cross-Hand When Unnecessary — hand used far outside its zone
 */

import { type FingerType } from '../../types/fingerModel';
import { getPreferredHand } from '../surface/handZone';
import {
  type OptimizationEvaluationRecord,
  type IrrationalAssignment,
  type IrrationalSeverity,
} from './types';

/** Finger preference order (best to worst for percussion). */
const FINGER_PREFERENCE: FingerType[] = ['index', 'middle', 'ring', 'pinky', 'thumb'];

/**
 * Runs all irrational assignment detection rules on a set of evaluation records.
 * Returns all flagged assignments sorted by severity (worst first).
 */
export function detectIrrationalAssignments(
  records: OptimizationEvaluationRecord[],
): IrrationalAssignment[] {
  const flags: IrrationalAssignment[] = [];

  flags.push(...detectPinkyMisuse(records));
  flags.push(...detectThumbAbuse(records));
  flags.push(...detectSameFingerStreak(records));
  flags.push(...detectCrossHandUnnecessary(records));

  // Sort by severity (definitely > likely > suspicious), then by event index
  const severityOrder: Record<IrrationalSeverity, number> = {
    definitely_irrational: 0,
    likely_irrational: 1,
    suspicious: 2,
  };

  flags.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.eventIndex - b.eventIndex;
  });

  return flags;
}

// ============================================================================
// Rule 1: Pinky Misuse
// ============================================================================

/**
 * Flags events where pinky is used but index or middle finger would be
 * clearly reachable (pad is in a position comfortable for stronger fingers).
 */
function detectPinkyMisuse(
  records: OptimizationEvaluationRecord[],
): IrrationalAssignment[] {
  const flags: IrrationalAssignment[] = [];

  for (const r of records) {
    if (r.finger !== 'pinky' || r.hand === 'Unplayable') continue;

    // Pinky on pads in the central zone (cols 2-5) is suspicious
    // because index/middle can easily reach these pads.
    const col = r.pad[1];
    const isCentralPad = col >= 2 && col <= 5;

    // Pinky not at the edge of the hand zone is suspicious
    const isEdgePad = (r.hand === 'left' && col === 0) || (r.hand === 'right' && col === 7);

    if (isCentralPad && !isEdgePad) {
      flags.push({
        eventIndex: r.eventIndex,
        assignedFinger: 'pinky',
        betterAlternatives: ['index', 'middle'],
        ruleName: 'pinky_misuse',
        explanation: `Pinky assigned at central pad [${r.pad[0]},${r.pad[1]}] where index/middle would be natural`,
        severity: 'likely_irrational',
        assignedCost: r.totalCost,
      });
    } else if (!isEdgePad) {
      flags.push({
        eventIndex: r.eventIndex,
        assignedFinger: 'pinky',
        betterAlternatives: ['index', 'middle', 'ring'],
        ruleName: 'pinky_misuse',
        explanation: `Pinky assigned at pad [${r.pad[0]},${r.pad[1]}] — consider stronger finger`,
        severity: 'suspicious',
        assignedCost: r.totalCost,
      });
    }
  }

  return flags;
}

// ============================================================================
// Rule 2: Thumb Abuse
// ============================================================================

/**
 * Flags events where thumb is used on upper rows (rows 4-7) where it
 * would be anatomically awkward. Thumbs naturally sit lower on the grid.
 */
function detectThumbAbuse(
  records: OptimizationEvaluationRecord[],
): IrrationalAssignment[] {
  const flags: IrrationalAssignment[] = [];

  for (const r of records) {
    if (r.finger !== 'thumb' || r.hand === 'Unplayable') continue;

    const row = r.pad[0];

    // Thumb on upper rows is unusual
    if (row >= 5) {
      flags.push({
        eventIndex: r.eventIndex,
        assignedFinger: 'thumb',
        betterAlternatives: ['index', 'middle'],
        ruleName: 'thumb_abuse',
        explanation: `Thumb assigned at high pad [${r.pad[0]},${r.pad[1]}] (row ${row}) — thumbs naturally sit lower`,
        severity: 'likely_irrational',
        assignedCost: r.totalCost,
      });
    } else if (row >= 3) {
      flags.push({
        eventIndex: r.eventIndex,
        assignedFinger: 'thumb',
        betterAlternatives: ['index', 'middle', 'ring'],
        ruleName: 'thumb_abuse',
        explanation: `Thumb assigned at pad [${r.pad[0]},${r.pad[1]}] (row ${row}) — consider other fingers`,
        severity: 'suspicious',
        assignedCost: r.totalCost,
      });
    }
  }

  return flags;
}

// ============================================================================
// Rule 3: Same-Finger Streak
// ============================================================================

/**
 * Flags sequences of 3+ consecutive events using the same finger on
 * the same hand, especially at fast tempos where alternation is preferred.
 */
function detectSameFingerStreak(
  records: OptimizationEvaluationRecord[],
): IrrationalAssignment[] {
  const flags: IrrationalAssignment[] = [];
  const MIN_STREAK = 3;
  const FAST_TEMPO_THRESHOLD = 0.2; // seconds between events

  let streakStart = 0;
  for (let i = 1; i <= records.length; i++) {
    const current = i < records.length ? records[i] : null;
    const prev = records[i - 1];

    const sameFingerHand =
      current &&
      current.finger === prev.finger &&
      current.hand === prev.hand &&
      current.hand !== 'Unplayable' &&
      current.finger !== null;

    if (!sameFingerHand) {
      const streakLen = i - streakStart;
      if (streakLen >= MIN_STREAK) {
        // Check if the events are fast
        const firstEvent = records[streakStart];
        const lastEvent = records[i - 1];
        const avgDt = (lastEvent.timestamp - firstEvent.timestamp) / (streakLen - 1);
        const isFast = avgDt < FAST_TEMPO_THRESHOLD;

        const severity: IrrationalSeverity = isFast
          ? 'definitely_irrational'
          : streakLen >= 5
            ? 'likely_irrational'
            : 'suspicious';

        flags.push({
          eventIndex: streakStart,
          assignedFinger: records[streakStart].finger!,
          betterAlternatives: FINGER_PREFERENCE.filter(
            f => f !== records[streakStart].finger,
          ).slice(0, 2),
          ruleName: 'same_finger_streak',
          explanation: `${records[streakStart].hand} ${records[streakStart].finger} used ${streakLen} times consecutively (events ${streakStart}-${i - 1}, avg dt: ${(avgDt * 1000).toFixed(0)}ms)`,
          severity,
          assignedCost: records[streakStart].totalCost,
        });
      }
      streakStart = i;
    }
  }

  return flags;
}

// ============================================================================
// Rule 4: Cross-Hand When Unnecessary
// ============================================================================

/**
 * Flags events where a hand is used far outside its preferred zone
 * when the other hand would be the natural choice.
 */
function detectCrossHandUnnecessary(
  records: OptimizationEvaluationRecord[],
): IrrationalAssignment[] {
  const flags: IrrationalAssignment[] = [];

  for (const r of records) {
    if (r.hand === 'Unplayable') continue;

    const preferredHand = getPreferredHand({ row: r.pad[0], col: r.pad[1] });

    // Only flag if the pad strongly prefers the other hand
    if (preferredHand === 'shared') continue;
    if (preferredHand === r.hand) continue;

    // The pad prefers the opposite hand — flag if zone violation is large
    if (r.costs.zoneViolation >= 2) {
      flags.push({
        eventIndex: r.eventIndex,
        assignedFinger: r.finger!,
        betterAlternatives: [],
        ruleName: 'cross_hand_unnecessary',
        explanation: `${r.hand} hand used at pad [${r.pad[0]},${r.pad[1]}] which prefers ${preferredHand} hand (zone violation: ${r.costs.zoneViolation.toFixed(1)})`,
        severity: 'likely_irrational',
        assignedCost: r.totalCost,
      });
    }
  }

  return flags;
}
