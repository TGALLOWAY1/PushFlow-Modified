/**
 * Event Metrics Calculation Engine.
 *
 * Computes additional metrics for finger assignments, including
 * anatomical stretch scores and composite difficulty scores.
 *
 * Ported from Version1/src/engine/eventMetrics.ts with canonical terminology.
 */

import { type FingerAssignment, type ExecutionPlanResult } from '../../types/executionPlan';
import { type PadCoord, gridDistance, parsePadKey } from '../../types/padGrid';

// ============================================================================
// Types
// ============================================================================

/** Anatomical stretch table mapping finger pairs to stretch difficulty factors. */
export interface AnatomicalStretchTable {
  [key: string]: number;
}

/**
 * Analyzed event: a polyphonic moment with all simultaneous notes grouped.
 * Replaces Version1's AnalyzedEvent from eventAnalysis.ts.
 */
export interface AnalyzedMoment {
  eventIndex: number;
  timestamp: number;
  assignments: FingerAssignment[];
  pads: string[];
  metrics: MomentMetrics;
}

/** Per-moment metrics. */
export interface MomentMetrics {
  polyphony: number;
  spreadX?: number;
  spreadY?: number;
  anatomicalStretchScore: number;
  compositeDifficultyScore: number;
}

// ============================================================================
// Default Anatomical Stretch Table
// ============================================================================

export function createDefaultAnatomicalStretchTable(): AnatomicalStretchTable {
  return {
    'L_THUMB-L_INDEX': 0.5, 'L_INDEX-L_MIDDLE': 0.8, 'L_MIDDLE-L_RING': 1.3,
    'L_RING-L_PINKY': 1.8, 'L_THUMB-L_MIDDLE': 1.0, 'L_THUMB-L_RING': 1.5,
    'L_THUMB-L_PINKY': 2.0, 'L_INDEX-L_RING': 1.5, 'L_INDEX-L_PINKY': 2.2,
    'L_MIDDLE-L_PINKY': 2.0,
    'R_THUMB-R_INDEX': 0.5, 'R_INDEX-R_MIDDLE': 0.8, 'R_MIDDLE-R_RING': 1.3,
    'R_RING-R_PINKY': 1.8, 'R_THUMB-R_MIDDLE': 1.0, 'R_THUMB-R_RING': 1.5,
    'R_THUMB-R_PINKY': 2.0, 'R_INDEX-R_RING': 1.5, 'R_INDEX-R_PINKY': 2.2,
    'R_MIDDLE-R_PINKY': 2.0,
  };
}

// ============================================================================
// Stretch & Difficulty Scores
// ============================================================================

/** Home position for each hand on the Push 3. */
function getHomePosition(hand: 'left' | 'right'): PadCoord {
  return hand === 'left' ? { row: 0, col: 1 } : { row: 0, col: 5 };
}

/**
 * Computes the anatomical stretch score for a single assignment (0-1).
 */
export function computeEventAnatomicalStretchScore(assignment: FingerAssignment): number {
  if (assignment.assignedHand === 'Unplayable' || !assignment.finger ||
      assignment.row === undefined || assignment.col === undefined) {
    return 1.0;
  }

  if (assignment.costBreakdown?.fingerPreference !== undefined) {
    return Math.min(assignment.costBreakdown.fingerPreference / 10.0, 1.0);
  }

  const homePos = getHomePosition(assignment.assignedHand);
  const eventPos: PadCoord = { row: assignment.row, col: assignment.col };
  return Math.min(gridDistance(homePos, eventPos) / 4.0, 1.0);
}

/**
 * Computes the composite difficulty score for an assignment (0-1).
 */
export function computeCompositeDifficultyScore(
  assignment: FingerAssignment,
  anatomicalStretchScore: number
): number {
  if (assignment.difficulty === 'Unplayable' || assignment.assignedHand === 'Unplayable') return 1.0;

  let baseScore: number;
  switch (assignment.difficulty) {
    case 'Hard': baseScore = 0.7; break;
    case 'Medium': baseScore = 0.4; break;
    case 'Easy': baseScore = 0.1; break;
    default: baseScore = 0.5;
  }

  let costContribution = 0;
  if (assignment.cost !== undefined && assignment.cost !== Infinity && assignment.cost > 0) {
    costContribution = Math.min(assignment.cost / 20.0, 1.0) * 0.2;
  }

  const stretchContribution = anatomicalStretchScore * 0.1;

  let breakdownContribution = 0;
  if (assignment.costBreakdown) {
    const bd = assignment.costBreakdown;
    breakdownContribution =
      Math.min(bd.transitionCost / 10.0, 1.0) * 0.05 +
      Math.min(bd.handBalance / 5.0, 1.0) * 0.03 +
      Math.min(bd.constraintPenalty / 20.0, 1.0) * 0.02;
  }

  return Math.min(Math.max(baseScore + costContribution + stretchContribution + breakdownContribution, 0), 1);
}

// ============================================================================
// Moment Grouping
// ============================================================================

import { MOMENT_EPSILON } from '../../types/performanceEvent';

/**
 * @deprecated Use MOMENT_EPSILON from performanceEvent.ts.
 * Kept for backward compatibility; value now matches canonical epsilon.
 */
const EVENT_TIME_EPSILON = MOMENT_EPSILON;

/**
 * Groups finger assignments by timestamp into analyzed moments.
 */
export function groupAssignmentsIntoMoments(
  assignments: FingerAssignment[]
): AnalyzedMoment[] {
  const moments: AnalyzedMoment[] = [];
  let currentGroup: FingerAssignment[] = [];
  let currentTime: number | null = null;

  const flush = () => {
    if (!currentGroup.length || currentTime === null) return;

    const validAssignments = currentGroup.filter(a => a.row !== undefined && a.col !== undefined);
    if (validAssignments.length === 0) { currentGroup = []; currentTime = null; return; }

    const pads = [...new Set(validAssignments.map(a => `${a.row},${a.col}`))];
    const polyphony = validAssignments.length;

    let spreadX: number | undefined;
    let spreadY: number | undefined;
    if (pads.length > 1) {
      const positions = pads.map(p => parsePadKey(p)).filter((p): p is PadCoord => p !== null);
      if (positions.length > 1) {
        const cols = positions.map(p => p.col);
        const rows = positions.map(p => p.row);
        spreadX = Math.max(...cols) - Math.min(...cols);
        spreadY = Math.max(...rows) - Math.min(...rows);
      }
    }

    const stretchScores = validAssignments.map(computeEventAnatomicalStretchScore);
    const maxStretch = Math.max(...stretchScores, 0);
    const difficultyScores = validAssignments.map((a, i) =>
      computeCompositeDifficultyScore(a, stretchScores[i])
    );
    const maxDifficulty = Math.max(...difficultyScores, 0);

    moments.push({
      eventIndex: moments.length,
      timestamp: currentTime,
      assignments: validAssignments,
      pads,
      metrics: {
        polyphony, spreadX, spreadY,
        anatomicalStretchScore: maxStretch,
        compositeDifficultyScore: maxDifficulty,
      },
    });

    currentGroup = [];
    currentTime = null;
  };

  for (const a of assignments) {
    if (currentTime === null || Math.abs(a.startTime - currentTime) <= EVENT_TIME_EPSILON) {
      if (currentTime === null) currentTime = a.startTime;
      currentGroup.push(a);
    } else {
      flush();
      currentTime = a.startTime;
      currentGroup = [a];
    }
  }
  flush();

  return moments;
}

/**
 * Analyzes all assignments in an execution plan result into moments with metrics.
 */
export function analyzeAssignments(result: ExecutionPlanResult): AnalyzedMoment[] {
  return groupAssignmentsIntoMoments(result.fingerAssignments);
}

/**
 * Computes raw distance between two pads.
 */
export function computeRawDistance(fromPad: string, toPad: string): number {
  const from = parsePadKey(fromPad);
  const to = parsePadKey(toPad);
  if (!from || !to) return Infinity;
  return gridDistance(from, to);
}
