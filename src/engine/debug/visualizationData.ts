/**
 * Part 5 — Cost Visualization Data.
 *
 * Produces structured datasets suitable for visualization (charts, timelines).
 * Consumers include the optimizer-debug dashboard and any external tooling.
 *
 * Datasets:
 *   - eventCostTimeline: per-event cost stacked breakdown
 *   - fingerUsageTimeline: windowed finger usage counts
 *   - movementDistanceTimeline: per-transition movement distances
 *   - zoneViolationEvents: all zone violations with location
 */

import { type FingerType } from '../../types/fingerModel';
import {
  type OptimizationEvaluationRecord,
  type VisualizationData,
  type EventCostTimelinePoint,
  type FingerUsageTimelinePoint,
  type MovementDistanceTimelinePoint,
  type ZoneViolationEvent,
} from './types';

/**
 * Generates complete visualization data from evaluation records.
 *
 * @param records - OptimizationEvaluationRecord[] from the evaluation recorder
 * @param windowSize - Time window for finger usage timeline (seconds)
 */
export function generateVisualizationData(
  records: OptimizationEvaluationRecord[],
  windowSize: number = 1.0,
): VisualizationData {
  return {
    eventCostTimeline: buildEventCostTimeline(records),
    fingerUsageTimeline: buildFingerUsageTimeline(records, windowSize),
    movementDistanceTimeline: buildMovementDistanceTimeline(records),
    zoneViolationEvents: buildZoneViolationEvents(records),
  };
}

// ============================================================================
// Event Cost Timeline
// ============================================================================

function buildEventCostTimeline(
  records: OptimizationEvaluationRecord[],
): EventCostTimelinePoint[] {
  return records.map(r => ({
    eventIndex: r.eventIndex,
    timestamp: r.timestamp,
    totalCost: r.totalCost,
    travel: r.costs.travel,
    pose: r.costs.pose,
    fingerPenalty: r.costs.fingerPenalty,
    zoneViolation: r.costs.zoneViolation,
    repetitionPenalty: r.costs.repetitionPenalty,
    feasibilityPenalty: r.costs.feasibilityPenalty,
  }));
}

// ============================================================================
// Finger Usage Timeline
// ============================================================================

function buildFingerUsageTimeline(
  records: OptimizationEvaluationRecord[],
  windowSize: number,
): FingerUsageTimelinePoint[] {
  if (records.length === 0) return [];

  const start = records[0].timestamp;
  const end = records[records.length - 1].timestamp;
  const points: FingerUsageTimelinePoint[] = [];

  let windowStart = start;
  while (windowStart <= end) {
    const windowEnd = windowStart + windowSize;

    const counts: Record<FingerType, number> = {
      thumb: 0,
      index: 0,
      middle: 0,
      ring: 0,
      pinky: 0,
    };

    for (const r of records) {
      if (r.timestamp >= windowStart && r.timestamp < windowEnd && r.finger) {
        counts[r.finger]++;
      }
    }

    points.push({ windowStart, windowEnd, counts });
    windowStart = windowEnd;
  }

  return points;
}

// ============================================================================
// Movement Distance Timeline
// ============================================================================

function buildMovementDistanceTimeline(
  records: OptimizationEvaluationRecord[],
): MovementDistanceTimelinePoint[] {
  const points: MovementDistanceTimelinePoint[] = [];

  for (const r of records) {
    if (r.movementDistance > 0 && r.previousPad && r.hand !== 'Unplayable') {
      points.push({
        eventIndex: r.eventIndex,
        timestamp: r.timestamp,
        distance: r.movementDistance,
        fromPad: r.previousPad,
        toPad: r.pad,
        hand: r.hand,
      });
    }
  }

  return points;
}

// ============================================================================
// Zone Violation Events
// ============================================================================

function buildZoneViolationEvents(
  records: OptimizationEvaluationRecord[],
): ZoneViolationEvent[] {
  return records
    .filter(r => r.costs.zoneViolation > 0 && r.hand !== 'Unplayable')
    .map(r => ({
      eventIndex: r.eventIndex,
      timestamp: r.timestamp,
      pad: r.pad,
      hand: r.hand as 'left' | 'right',
      violationDistance: r.costs.zoneViolation,
    }));
}
