/**
 * Canonical moment builder utilities.
 *
 * Provides the single canonical way to:
 * 1. Group flat PerformanceEvent[] into PerformanceMoment[]
 * 2. Extract pad-to-finger ownership from solver output
 * 3. Validate pad ownership consistency (Invariant B)
 *
 * All grouping uses MOMENT_EPSILON from performanceEvent.ts.
 */

import {
  type PerformanceEvent,
  type PerformanceMoment,
  type NoteInstance,
  MOMENT_EPSILON,
} from '../../types/performanceEvent';
import { type FingerAssignment, type PadFingerAssignment } from '../../types/executionPlan';
import { type FingerType } from '../../types/fingerModel';

// ============================================================================
// Moment Construction
// ============================================================================

/**
 * Groups a flat array of PerformanceEvents into PerformanceMoments.
 *
 * Events within MOMENT_EPSILON of each other are grouped into a single moment.
 * The input array should be sorted by startTime.
 *
 * @param events - Sorted array of performance events
 * @param padLookup - Optional function to resolve noteNumber/voiceId to padId
 * @returns Array of PerformanceMoments in chronological order
 */
export function buildPerformanceMoments(
  events: PerformanceEvent[],
  padLookup?: (event: PerformanceEvent) => string | null,
): PerformanceMoment[] {
  if (events.length === 0) return [];

  const moments: PerformanceMoment[] = [];
  let currentNotes: NoteInstance[] = [];
  let currentTime = events[0].startTime;

  const flush = () => {
    if (currentNotes.length > 0) {
      moments.push({
        momentIndex: moments.length,
        startTime: currentTime,
        notes: currentNotes,
      });
      currentNotes = [];
    }
  };

  for (const event of events) {
    if (Math.abs(event.startTime - currentTime) > MOMENT_EPSILON) {
      flush();
      currentTime = event.startTime;
    }

    currentNotes.push({
      soundId: event.voiceId ?? String(event.noteNumber),
      padId: padLookup ? (padLookup(event) ?? '') : '',
      noteNumber: event.noteNumber,
      velocity: event.velocity,
      duration: event.duration,
      noteKey: event.eventKey,
    });
  }

  flush();
  return moments;
}

// ============================================================================
// Pad Ownership Extraction
// ============================================================================

/**
 * Ownership violation: a pad assigned to multiple different fingers.
 */
export interface PadOwnershipViolation {
  padKey: string;
  fingers: Array<{ hand: 'left' | 'right'; finger: FingerType }>;
}

/**
 * Extracts the pad-to-finger ownership map from solver output.
 *
 * Walks all assignments and builds a map of padKey → { hand, finger }.
 * If a pad appears with two different fingers, records it as a violation.
 *
 * @param assignments - Flat array of FingerAssignment from solver output
 * @returns The ownership map and any violations found
 */
export function extractPadOwnership(
  assignments: FingerAssignment[],
): { ownership: PadFingerAssignment; violations: PadOwnershipViolation[] } {
  const ownership: PadFingerAssignment = {};
  const violations: PadOwnershipViolation[] = [];
  const violationSet = new Set<string>();
  // Track all unique (hand, finger) seen per pad
  const padFingerSeen = new Map<string, Array<{ hand: 'left' | 'right'; finger: FingerType }>>();

  for (const a of assignments) {
    if (a.assignedHand === 'Unplayable' || !a.finger || !a.padId) continue;

    const key = a.padId;
    const hand = a.assignedHand as 'left' | 'right';
    const finger = a.finger;
    const fingerKey = `${hand}:${finger}`;

    if (!padFingerSeen.has(key)) {
      padFingerSeen.set(key, [{ hand, finger }]);
      ownership[key] = { hand, finger };
    } else {
      const seen = padFingerSeen.get(key)!;
      const existing = seen[0];
      const existingKey = `${existing.hand}:${existing.finger}`;

      if (existingKey !== fingerKey) {
        // Violation: same pad, different finger
        if (!seen.some(s => `${s.hand}:${s.finger}` === fingerKey)) {
          seen.push({ hand, finger });
        }
        if (!violationSet.has(key)) {
          violationSet.add(key);
          violations.push({ padKey: key, fingers: [...seen] });
        } else {
          // Update existing violation entry
          const existing = violations.find(v => v.padKey === key);
          if (existing && !existing.fingers.some(f => `${f.hand}:${f.finger}` === fingerKey)) {
            existing.fingers.push({ hand, finger });
          }
        }
      }
    }
  }

  return { ownership, violations };
}

// ============================================================================
// Pad Ownership Validation
// ============================================================================

/**
 * Validates that no pad is assigned to multiple different fingers across
 * all assignments (Invariant B).
 *
 * @param assignments - Flat array of FingerAssignment from solver output
 * @returns Whether all pads have consistent ownership, plus any violations
 */
export function validatePadOwnershipConsistency(
  assignments: FingerAssignment[],
): { valid: boolean; violations: PadOwnershipViolation[] } {
  const { violations } = extractPadOwnership(assignments);
  return { valid: violations.length === 0, violations };
}
