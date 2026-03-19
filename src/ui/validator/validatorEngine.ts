/**
 * Validator Engine Bridge.
 *
 * Connects the validator UI to the canonical evaluator and feasibility checker.
 * Builds EvaluationConfig, calls evaluateEvent/validateAssignment, extracts
 * grip diagnostic evidence, and runs direct pairwise constraint checks.
 *
 * No solver dependency — pure evaluation only.
 */

import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type EvaluationConfig } from '../../types/evaluationConfig';
import { type InstrumentConfig, type RestingPose } from '../../types/performance';
import { type FingerType } from '../../types/fingerModel';
import { type PadCoord, parsePadKey } from '../../types/padGrid';
import { createZeroCostDimensions } from '../../types/costBreakdown';
import {
  evaluateEvent,
  validateAssignment,
} from '../../engine/evaluation/canonicalEvaluator';
import {
  generateValidGrips,
  type GripDiagnosticOptions,
} from '../../engine/prior/feasibility';
import {
  type GripRejection,
  type ConstraintRuleName,
  FINGER_PAIR_MAX_SPAN_STRICT,
  THUMB_DELTA,
  FINGER_ORDER,
} from '../../engine/prior/biomechanicalModel';
import {
  resolveNeutralPadPositions,
  computeNeutralHandCenters,
} from '../../engine/prior/handPose';
import {
  type ValidatorResult,
  type ConstraintViolationEvidence,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const VALIDATOR_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'validator',
  name: 'Push 3',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

const VALIDATOR_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 1, y: 1 },
      index: { x: 2, y: 2 },
      middle: { x: 3, y: 3 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 6, y: 1 },
      index: { x: 5, y: 2 },
      middle: { x: 4, y: 3 },
    },
  },
};

/**
 * Build an EvaluationConfig for the validator.
 * Uses the same pattern as test/engine/evaluation/canonicalEvaluator.test.ts.
 */
export function buildEvaluationConfig(layout: Layout): EvaluationConfig {
  const neutralPads = resolveNeutralPadPositions(layout, VALIDATOR_INSTRUMENT_CONFIG);
  const neutralHandCenters = computeNeutralHandCenters(neutralPads);
  return {
    restingPose: VALIDATOR_RESTING_POSE,
    stiffness: 0.3,
    instrumentConfig: VALIDATOR_INSTRUMENT_CONFIG,
    neutralHandCenters,
  };
}

// ============================================================================
// Pairwise Key Helper
// ============================================================================

function pairKey(a: FingerType, b: FingerType): string {
  // Keys in FINGER_PAIR_MAX_SPAN_STRICT are alphabetically sorted
  const ordered = [a, b].sort();
  return `${ordered[0]},${ordered[1]}`;
}

function fingerDistance(a: PadCoord, b: PadCoord): number {
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// Direct Pairwise Constraint Checks
// ============================================================================

/**
 * Run direct constraint checks against the user's exact finger assignment.
 *
 * The grip generator permutes all finger combinations, so some violations
 * specific to the user's exact assignment may not appear in grip diagnostics.
 * These direct checks catch those cases.
 */
function runDirectConstraintChecks(
  padFingerAssignment: PadFingerAssignment,
  activePadKeys: string[],
): ConstraintViolationEvidence[] {
  const evidence: ConstraintViolationEvidence[] = [];

  // Group active pads by hand
  const leftFingers: Array<{ finger: FingerType; coord: PadCoord; padKey: string }> = [];
  const rightFingers: Array<{ finger: FingerType; coord: PadCoord; padKey: string }> = [];

  for (const pk of activePadKeys) {
    const owner = padFingerAssignment[pk];
    if (!owner) continue;
    const coord = parsePadKey(pk);
    if (!coord) continue;
    const entry = { finger: owner.finger, coord, padKey: pk };
    if (owner.hand === 'left') leftFingers.push(entry);
    else rightFingers.push(entry);
  }

  // Check for same-finger collision (same finger assigned to 2+ active pads)
  const checkSameFingerCollision = (
    entries: typeof leftFingers,
    hand: 'left' | 'right',
  ) => {
    const fingerToPads = new Map<FingerType, string[]>();
    for (const e of entries) {
      const list = fingerToPads.get(e.finger) ?? [];
      list.push(e.padKey);
      fingerToPads.set(e.finger, list);
    }
    for (const [finger, pads] of fingerToPads) {
      if (pads.length > 1) {
        evidence.push({
          constraintId: 'collision',
          severity: 'hard',
          message: `${hand} ${finger} is assigned to ${pads.length} simultaneously active pads: ${pads.join(', ')}`,
          pads,
          fingers: [finger],
          hand,
        });
      }
    }
  };
  checkSameFingerCollision(leftFingers, 'left');
  checkSameFingerCollision(rightFingers, 'right');

  // Check pairwise span constraints
  const checkPairwiseSpan = (
    entries: typeof leftFingers,
    hand: 'left' | 'right',
  ) => {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const key = pairKey(a.finger, b.finger);
        const maxSpan = FINGER_PAIR_MAX_SPAN_STRICT[key] ?? 5.5;
        const dist = fingerDistance(a.coord, b.coord);
        if (dist > maxSpan) {
          evidence.push({
            constraintId: 'span',
            severity: 'hard',
            message: `${hand} ${a.finger} ↔ ${b.finger} distance = ${dist.toFixed(2)}, max = ${maxSpan.toFixed(1)}`,
            pads: [a.padKey, b.padKey],
            fingers: [a.finger, b.finger],
            hand,
            measuredValue: dist,
            threshold: maxSpan,
          });
        }
      }
    }
  };
  checkPairwiseSpan(leftFingers, 'left');
  checkPairwiseSpan(rightFingers, 'right');

  // Check finger ordering (topology)
  const checkOrdering = (
    entries: typeof leftFingers,
    hand: 'left' | 'right',
  ) => {
    const nonThumb = entries.filter(e => e.finger !== 'thumb');
    const sorted = [...nonThumb].sort(
      (a, b) => FINGER_ORDER.indexOf(a.finger) - FINGER_ORDER.indexOf(b.finger),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      // FINGER_ORDER = [pinky, ring, middle, index, thumb]
      // a comes earlier in FINGER_ORDER, b comes later
      if (hand === 'right') {
        // Right hand: pinky is rightmost (highest col), index is leftmost
        // Going pinky→ring→middle→index: columns should DECREASE
        // Violation when a.col <= b.col (a should be right of b)
        if (a.coord.col <= b.coord.col) {
          evidence.push({
            constraintId: 'ordering',
            severity: 'hard',
            message: `${hand} hand ordering violation: ${a.finger}(col ${a.coord.col}) should be right of ${b.finger}(col ${b.coord.col})`,
            pads: [a.padKey, b.padKey],
            fingers: [a.finger, b.finger],
            hand,
            measuredValue: a.coord.col,
            threshold: b.coord.col,
          });
        }
      } else {
        // Left hand: pinky is leftmost (lowest col), index is rightmost
        // Going pinky→ring→middle→index: columns should INCREASE
        // Violation when a.col >= b.col (a should be left of b)
        if (a.coord.col >= b.coord.col) {
          evidence.push({
            constraintId: 'ordering',
            severity: 'hard',
            message: `${hand} hand ordering violation: ${a.finger}(col ${a.coord.col}) should be left of ${b.finger}(col ${b.coord.col})`,
            pads: [a.padKey, b.padKey],
            fingers: [a.finger, b.finger],
            hand,
            measuredValue: a.coord.col,
            threshold: b.coord.col,
          });
        }
      }
    }
  };
  checkOrdering(leftFingers, 'left');
  checkOrdering(rightFingers, 'right');

  // Check thumb delta
  const checkThumbDelta = (
    entries: typeof leftFingers,
    hand: 'left' | 'right',
  ) => {
    const thumbEntry = entries.find(e => e.finger === 'thumb');
    if (!thumbEntry) return;
    for (const other of entries) {
      if (other.finger === 'thumb') continue;
      const delta = thumbEntry.coord.row - other.coord.row;
      if (delta > THUMB_DELTA) {
        evidence.push({
          constraintId: 'thumbDelta',
          severity: 'hard',
          message: `${hand} thumb row offset = ${delta.toFixed(1)}, max = ${THUMB_DELTA.toFixed(1)} (thumb row ${thumbEntry.coord.row}, ${other.finger} row ${other.coord.row})`,
          pads: [thumbEntry.padKey, other.padKey],
          fingers: ['thumb', other.finger],
          hand,
          measuredValue: delta,
          threshold: THUMB_DELTA,
        });
      }
    }
  };
  checkThumbDelta(leftFingers, 'left');
  checkThumbDelta(rightFingers, 'right');

  return evidence;
}

// ============================================================================
// Grip Evidence Extraction
// ============================================================================

/**
 * Extract grip diagnostic rejections by running generateValidGrips in
 * diagnostic mode for each hand's active pads.
 *
 * Only returns rejections for hands where NO valid grips exist (infeasible).
 * When valid grips exist, the rejections are for failed permutations during
 * enumeration and are noise — the hand configuration IS feasible.
 */
function extractGripEvidence(
  padFingerAssignment: PadFingerAssignment,
  activePadKeys: string[],
): GripRejection[] {
  const leftPads: PadCoord[] = [];
  const rightPads: PadCoord[] = [];

  for (const pk of activePadKeys) {
    const owner = padFingerAssignment[pk];
    if (!owner) continue;
    const coord = parsePadKey(pk);
    if (!coord) continue;
    if (owner.hand === 'left') leftPads.push(coord);
    else rightPads.push(coord);
  }

  const allRejections: GripRejection[] = [];

  if (leftPads.length > 0) {
    const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
    const validGrips = generateValidGrips(leftPads, 'left', diagnostics);
    // Only report rejections if no valid grip exists (infeasible)
    if (validGrips.length === 0) {
      allRejections.push(...diagnostics.rejections);
    }
  }

  if (rightPads.length > 0) {
    const diagnostics: GripDiagnosticOptions = { enabled: true, rejections: [] };
    const validGrips = generateValidGrips(rightPads, 'right', diagnostics);
    if (validGrips.length === 0) {
      allRejections.push(...diagnostics.rejections);
    }
  }

  return allRejections;
}

/**
 * Convert GripRejection to ConstraintViolationEvidence.
 */
function gripRejectionToEvidence(r: GripRejection): ConstraintViolationEvidence {
  const ruleMessages: Record<ConstraintRuleName, string> = {
    span: `Span violation: ${r.fingerA} ↔ ${r.fingerB} distance ${r.actual.toFixed(2)} > limit ${r.limit.toFixed(1)}`,
    ordering: `Ordering violation: ${r.fingerA} / ${r.fingerB} crossover (delta ${r.actual.toFixed(2)})`,
    collision: `Collision: ${r.fingerA} and ${r.fingerB} on same pad`,
    thumbDelta: `Thumb delta: ${r.fingerA} / ${r.fingerB} row offset ${r.actual.toFixed(1)} > limit ${r.limit.toFixed(1)}`,
    topology: `Topology violation: ${r.fingerA} / ${r.fingerB} hand shape invalid`,
    reachability: `Reachability: ${r.fingerA} / ${r.fingerB} distance ${r.actual.toFixed(2)} > reach ${r.limit.toFixed(1)}`,
    speed: `Speed violation: transition too fast (${r.actual.toFixed(2)} > ${r.limit.toFixed(1)})`,
    zone: `Zone violation: hand in wrong zone`,
  };

  return {
    constraintId: r.rule,
    severity: 'hard',
    message: ruleMessages[r.rule] ?? `${r.rule}: ${r.fingerA}-${r.fingerB}`,
    fingers: [r.fingerA, r.fingerB],
    measuredValue: r.actual,
    threshold: r.limit,
  };
}

// ============================================================================
// Main Validation Entry Point
// ============================================================================

/**
 * Run full validation on a layout + assignment + moment.
 *
 * 1. Build EvaluationConfig
 * 2. validateAssignment (consistency checks)
 * 3. evaluateEvent (cost evaluation)
 * 4. Extract grip diagnostic evidence
 * 5. Run direct pairwise constraint checks
 * 6. Assemble ValidatorResult
 */
export function runValidation(
  layout: Layout,
  padFingerAssignment: PadFingerAssignment,
  moment: PerformanceMoment,
): ValidatorResult {
  const config = buildEvaluationConfig(layout);

  // 1. Validate assignment consistency
  const assignmentValidation = validateAssignment({
    layout,
    padFingerAssignment,
    moments: [moment],
    config,
  });

  // 2. Evaluate event cost (may fail gracefully if assignment is invalid)
  let eventBreakdown;
  try {
    eventBreakdown = evaluateEvent({
      moment,
      layout,
      padFingerAssignment,
      config,
      includeDebug: true,
    });
  } catch {
    eventBreakdown = null;
  }

  // 3. Get active pad keys from moment
  const activePadKeys: string[] = [];
  for (const note of moment.notes) {
    if (note.padId) {
      activePadKeys.push(note.padId);
    } else {
      // Try to find pad from layout by voiceId/soundId
      const found = findPadForSound(note.soundId, layout);
      if (found) activePadKeys.push(found);
    }
  }

  // 4. Extract grip diagnostic evidence
  const gripRejections = extractGripEvidence(padFingerAssignment, activePadKeys);
  const gripEvidence = gripRejections.map(gripRejectionToEvidence);

  // 5. Direct pairwise constraint checks
  const directEvidence = runDirectConstraintChecks(padFingerAssignment, activePadKeys);

  // 6. Assignment issue evidence
  const assignmentEvidence: ConstraintViolationEvidence[] = assignmentValidation.issues.map(issue => ({
    constraintId: issue.type === 'unmapped_note' ? 'unmapped_note' as const
      : issue.type === 'ownership_conflict' ? 'ownership_conflict' as const
      : 'missing_assignment' as const,
    severity: 'hard' as const,
    message: issue.message,
    pads: issue.padKey ? [issue.padKey] : undefined,
  }));

  // 7. Check for pads with no finger assignment
  const missingAssignmentEvidence: ConstraintViolationEvidence[] = [];
  for (const pk of activePadKeys) {
    if (!padFingerAssignment[pk]) {
      missingAssignmentEvidence.push({
        constraintId: 'missing_assignment',
        severity: 'hard',
        message: `Active pad ${pk} has no finger assignment`,
        pads: [pk],
      });
    }
  }

  // Deduplicate evidence by constraintId + message
  const allEvidenceRaw = [...directEvidence, ...gripEvidence, ...assignmentEvidence, ...missingAssignmentEvidence];
  const seen = new Set<string>();
  const evidence: ConstraintViolationEvidence[] = [];
  for (const e of allEvidenceRaw) {
    const key = `${e.constraintId}:${e.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      evidence.push(e);
    }
  }

  // Determine overall status
  const hasViolation = evidence.length > 0 || !assignmentValidation.valid;

  return {
    status: hasViolation ? 'violation' : 'valid',
    feasibilityTier: eventBreakdown?.feasibilityTier ?? 'strict',
    dimensions: eventBreakdown?.dimensions ?? createZeroCostDimensions(),
    poseDetail: eventBreakdown?.poseDetail ?? { attractor: 0, perFingerHome: 0, fingerDominance: 0 },
    eventBreakdown: eventBreakdown ?? null,
    assignmentValidation,
    evidence,
    gripRejections,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find the pad key for a given soundId/voiceId in the layout.
 */
function findPadForSound(soundId: string, layout: Layout): string | null {
  for (const [pk, voice] of Object.entries(layout.padToVoice)) {
    if (voice.id === soundId) return pk;
  }
  return null;
}

/**
 * Update moment's NoteInstance padIds to match the current layout.
 * Called after pad moves to keep the moment consistent.
 */
export function updateMomentPadIds(
  moment: PerformanceMoment,
  layout: Layout,
): PerformanceMoment {
  return {
    ...moment,
    notes: moment.notes.map(note => {
      const newPadKey = findPadForSound(note.soundId, layout);
      return { ...note, padId: newPadKey ?? note.padId };
    }),
  };
}
