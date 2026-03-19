/**
 * Finger Assignment for Rudiments.
 *
 * Lightweight per-event finger assigner for rudiment patterns.
 * Each lane maps to exactly one pad, so this is a direct lookup —
 * no need for the full BeamSolver.
 */

import {
  type LoopEvent,
  type LoopCellKey,
  type LoopConfig,
} from '../../types/loopEditor';
import { type LanePadAssignment, type RudimentFingerAssignment } from '../../types/rudiment';
import { type FingerType, type HandSide } from '../../types/fingerModel';
import { type PadCoord, gridDistance } from '../../types/padGrid';
import { type FingerId } from '../../types/ergonomicPrior';

// ============================================================================
// Pose0 Finger Positions (canonical from naturalHandPose.ts)
// ============================================================================

interface FingerPosition {
  fingerId: FingerId;
  hand: HandSide;
  finger: FingerType;
  pad: PadCoord;
}

const POSE0_FINGERS: FingerPosition[] = [
  { fingerId: 'L_THUMB',  hand: 'left',  finger: 'thumb',  pad: { row: 0, col: 3 } },
  { fingerId: 'L_INDEX',  hand: 'left',  finger: 'index',  pad: { row: 3, col: 3 } },
  { fingerId: 'L_MIDDLE', hand: 'left',  finger: 'middle', pad: { row: 4, col: 2 } },
  { fingerId: 'L_RING',   hand: 'left',  finger: 'ring',   pad: { row: 4, col: 1 } },
  { fingerId: 'L_PINKY',  hand: 'left',  finger: 'pinky',  pad: { row: 4, col: 0 } },
  { fingerId: 'R_THUMB',  hand: 'right', finger: 'thumb',  pad: { row: 0, col: 4 } },
  { fingerId: 'R_INDEX',  hand: 'right', finger: 'index',  pad: { row: 3, col: 4 } },
  { fingerId: 'R_MIDDLE', hand: 'right', finger: 'middle', pad: { row: 4, col: 5 } },
  { fingerId: 'R_RING',   hand: 'right', finger: 'ring',   pad: { row: 4, col: 6 } },
  { fingerId: 'R_PINKY',  hand: 'right', finger: 'pinky',  pad: { row: 4, col: 7 } },
];

const LEFT_FINGERS = POSE0_FINGERS.filter(f => f.hand === 'left');
const RIGHT_FINGERS = POSE0_FINGERS.filter(f => f.hand === 'right');

/** Finger priority for conflict resolution (higher priority = preferred). */
const FINGER_PRIORITY: Record<FingerType, number> = {
  index: 5,
  middle: 4,
  ring: 3,
  thumb: 2,
  pinky: 1,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Assign a finger to every event in the rudiment.
 *
 * Returns a flat array of assignments sorted by stepIndex then laneId.
 */
export function assignFingers(
  events: Map<LoopCellKey, LoopEvent>,
  padAssignments: LanePadAssignment[],
  _config: LoopConfig,
): RudimentFingerAssignment[] {
  // Build lane -> pad lookup
  const lanePadMap = new Map<string, LanePadAssignment>();
  for (const pa of padAssignments) {
    lanePadMap.set(pa.laneId, pa);
  }

  // Group events by stepIndex
  const stepGroups = new Map<number, Array<{ cellKey: LoopCellKey; event: LoopEvent }>>();
  for (const [cellKey, event] of events) {
    let group = stepGroups.get(event.stepIndex);
    if (!group) {
      group = [];
      stepGroups.set(event.stepIndex, group);
    }
    group.push({ cellKey, event });
  }

  const results: RudimentFingerAssignment[] = [];

  // Process each step group
  const sortedSteps = [...stepGroups.keys()].sort((a, b) => a - b);

  for (const stepIndex of sortedSteps) {
    const group = stepGroups.get(stepIndex)!;

    // Partition into left/right hand based on pad position
    const leftEvents: Array<{ cellKey: LoopCellKey; event: LoopEvent; pad: PadCoord }> = [];
    const rightEvents: Array<{ cellKey: LoopCellKey; event: LoopEvent; pad: PadCoord }> = [];

    for (const { cellKey, event } of group) {
      const pa = lanePadMap.get(event.laneId);
      if (!pa) continue;
      const pad = pa.pad;

      if (pad.col <= 2) {
        leftEvents.push({ cellKey, event, pad });
      } else if (pad.col >= 5) {
        rightEvents.push({ cellKey, event, pad });
      } else {
        // Shared zone (cols 3-4): assign to hand with fewer events
        if (leftEvents.length <= rightEvents.length) {
          leftEvents.push({ cellKey, event, pad });
        } else {
          rightEvents.push({ cellKey, event, pad });
        }
      }
    }

    // Assign fingers within each hand
    results.push(...assignHandFingers(leftEvents, 'left', LEFT_FINGERS));
    results.push(...assignHandFingers(rightEvents, 'right', RIGHT_FINGERS));
  }

  // Sort by stepIndex, then by laneId for stable ordering
  results.sort((a, b) => a.stepIndex - b.stepIndex || a.laneId.localeCompare(b.laneId));

  return results;
}

// ============================================================================
// Internal
// ============================================================================

function assignHandFingers(
  events: Array<{ cellKey: LoopCellKey; event: LoopEvent; pad: PadCoord }>,
  hand: HandSide,
  fingerPool: FingerPosition[],
): RudimentFingerAssignment[] {
  if (events.length === 0) return [];

  const results: RudimentFingerAssignment[] = [];
  const usedFingers = new Set<FingerType>();

  // Sort events by column for consistent ordering
  const sorted = [...events].sort((a, b) => a.pad.col - b.pad.col);

  for (const { cellKey, event, pad } of sorted) {
    // Find closest available finger
    let bestFinger: FingerPosition | null = null;
    let bestDist = Infinity;
    let bestPriority = -1;

    for (const fp of fingerPool) {
      if (usedFingers.has(fp.finger)) continue;
      const dist = gridDistance(pad, fp.pad);
      const priority = FINGER_PRIORITY[fp.finger];

      // Prefer closest finger; break ties by priority
      if (dist < bestDist || (dist === bestDist && priority > bestPriority)) {
        bestDist = dist;
        bestPriority = priority;
        bestFinger = fp;
      }
    }

    // Fallback: if all fingers used (rare — max 5 per hand), use closest regardless
    if (!bestFinger) {
      bestFinger = fingerPool.reduce((best, fp) => {
        const dist = gridDistance(pad, fp.pad);
        return dist < gridDistance(pad, best.pad) ? fp : best;
      });
      bestDist = gridDistance(pad, bestFinger.pad);
    }

    usedFingers.add(bestFinger.finger);

    results.push({
      cellKey,
      laneId: event.laneId,
      stepIndex: event.stepIndex,
      hand,
      finger: bestFinger.finger,
      pad,
      cost: bestDist,
    });
  }

  return results;
}
