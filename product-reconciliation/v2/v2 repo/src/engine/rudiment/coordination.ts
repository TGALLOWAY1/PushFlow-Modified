/**
 * Coordination — Stage 3: Two-Hand Coordination
 *
 * Generates a companion hand stream conditioned on the primary stream.
 * Handles anchor alignment, interlock, collision pressure, burst protection,
 * and phrase agreement.
 */

import {
  type PatternEvent,
  type GeneratorConfig,
  type HandSequence,
} from '../../types/patternCandidate';
import { type MotifSeed } from './motifLibrary';
import { buildPhrase } from './phraseBuilder';

// ============================================================================
// Coordination Scores
// ============================================================================

/** Detailed coordination quality scores. */
export interface CoordinationScores {
  anchorAlignment: number;
  interlock: number;
  collisionPressure: number;
  independence: number;
  phraseCoherence: number;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Get the set of occupied time positions from an event list. */
function positionSet(events: PatternEvent[]): Set<string> {
  return new Set(events.map((e) => `${e.bar}:${e.slot}:${e.sub_offset}`));
}

/** Count collisions between two event streams. */
function countCollisions(
  primary: PatternEvent[],
  companion: PatternEvent[],
): number {
  const primaryPos = positionSet(primary);
  let collisions = 0;
  for (const e of companion) {
    if (primaryPos.has(`${e.bar}:${e.slot}:${e.sub_offset}`)) {
      collisions++;
    }
  }
  return collisions;
}

/**
 * Resolve collisions by shifting companion events to adjacent empty slots.
 * Uses a scored approach: try shift +1, -1, +2, -2 and pick the best option.
 */
function resolveCollisions(
  companion: PatternEvent[],
  primaryPositions: Set<string>,
): PatternEvent[] {
  return companion.map((e) => {
    const pos = `${e.bar}:${e.slot}:${e.sub_offset}`;
    if (!primaryPositions.has(pos)) return e;

    // Try shifting to nearby slots
    const shifts = [1, -1, 2, -2];
    for (const shift of shifts) {
      const newSlot = e.slot + shift;
      if (newSlot >= 0 && newSlot <= 7) {
        const newPos = `${e.bar}:${newSlot}:${e.sub_offset}`;
        if (!primaryPositions.has(newPos)) {
          return { ...e, slot: newSlot };
        }
      }
    }
    // If no shift works and event is on sub_offset=1, try flipping to 0
    if (e.sub_offset === 1) {
      const flipPos = `${e.bar}:${e.slot}:0`;
      if (!primaryPositions.has(flipPos)) {
        return { ...e, sub_offset: 0 as const };
      }
    }
    // Last resort: remove this event (never create sub_offset=1 here)
    return null;
  }).filter((e): e is PatternEvent => e !== null);
}

/**
 * Apply burst protection: when the primary stream has high density in a bar,
 * simplify the companion stream for that bar.
 */
function applyBurstProtection(
  companion: PatternEvent[],
  primary: PatternEvent[],
  bars: number,
): PatternEvent[] {
  const result: PatternEvent[] = [];
  for (let b = 0; b < bars; b++) {
    const primaryBarDensity =
      primary.filter((e) => e.bar === b).length / 8;
    const companionBar = companion.filter((e) => e.bar === b);

    if (primaryBarDensity > 0.6) {
      // High density in primary — keep only anchor events in companion
      const anchors = companionBar.filter(
        (e) => e.slot === 0 || e.slot === 4 || e.accent,
      );
      result.push(...(anchors.length > 0 ? anchors : companionBar.slice(0, 1)));
    } else {
      result.push(...companionBar);
    }
  }
  return result;
}

/**
 * Ensure anchor alignment: both hands should have events on slot 0 of each bar
 * and at phrase starts/returns.
 */
function ensureAnchorAlignment(
  companion: PatternEvent[],
  primary: PatternEvent[],
  bars: number,
): PatternEvent[] {
  const result = [...companion];
  const companionPositions = positionSet(result);

  for (let b = 0; b < bars; b++) {
    const anchorPos = `${b}:0:0`;
    const primaryHasAnchor = primary.some(
      (e) => e.bar === b && e.slot === 0 && e.sub_offset === 0,
    );
    const companionHasAnchor = companionPositions.has(anchorPos);

    if (primaryHasAnchor && !companionHasAnchor && result.length > 0) {
      // Add an anchor event mirroring the primary's sound
      const templateEvent = result.find((e) => e.bar === b) ?? result[0];
      result.push({
        ...templateEvent,
        bar: b,
        slot: 0,
        sub_offset: 0,
        role: 'backbone',
        accent: true,
      });
    }
  }
  return result;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/** Score anchor alignment: fraction of primary anchors matched in companion. */
export function anchorAlignmentScore(
  primary: PatternEvent[],
  companion: PatternEvent[],
  bars: number,
): number {
  let matched = 0;
  let total = 0;
  for (let b = 0; b < bars; b++) {
    const primaryAnchor = primary.some(
      (e) => e.bar === b && e.slot === 0 && e.sub_offset === 0,
    );
    if (primaryAnchor) {
      total++;
      const companionAnchor = companion.some(
        (e) => e.bar === b && e.slot === 0 && e.sub_offset === 0,
      );
      if (companionAnchor) matched++;
    }
  }
  return total > 0 ? matched / total : 1;
}

/** Score interlock: fraction of companion events on different slots from primary. */
export function interlockScore(
  primary: PatternEvent[],
  companion: PatternEvent[],
): number {
  if (companion.length === 0) return 1;
  const primaryPos = positionSet(primary);
  let interlocked = 0;
  for (const e of companion) {
    if (!primaryPos.has(`${e.bar}:${e.slot}:${e.sub_offset}`)) {
      interlocked++;
    }
  }
  return interlocked / companion.length;
}

/** Score collision pressure (inverted: 1 = no collisions). */
export function collisionPressureScore(
  primary: PatternEvent[],
  companion: PatternEvent[],
): number {
  if (companion.length === 0) return 1;
  const collisions = countCollisions(primary, companion);
  return 1 - collisions / companion.length;
}

/** Score independence: how different the rhythm patterns are. */
export function independenceScore(
  primary: PatternEvent[],
  companion: PatternEvent[],
): number {
  const pSlots = new Set(primary.map((e) => `${e.bar}:${e.slot}`));
  const cSlots = new Set(companion.map((e) => `${e.bar}:${e.slot}`));
  if (pSlots.size === 0 && cSlots.size === 0) return 1;

  let shared = 0;
  for (const s of pSlots) {
    if (cSlots.has(s)) shared++;
  }
  const total = new Set([...pSlots, ...cSlots]).size;
  return total > 0 ? 1 - shared / total : 1;
}

/** Score phrase coherence: check that phrase structures align. */
export function phraseCoherenceScore(
  primary: PatternEvent[],
  companion: PatternEvent[],
  bars: number,
): number {
  // Both streams should have events covering all bars
  const companionBars = new Set(companion.map((e) => e.bar));
  let covered = 0;
  for (let b = 0; b < bars; b++) {
    const primaryHasBar = primary.some((e) => e.bar === b);
    if (primaryHasBar && companionBars.has(b)) covered++;
  }
  const primaryBarCount = new Set(primary.map((e) => e.bar)).size;
  return primaryBarCount > 0 ? covered / primaryBarCount : 1;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Coordinate two hands: generate a companion stream conditioned on the primary.
 *
 * @param primary - The primary hand sequence (already built)
 * @param companionSeed - Motif seed for the companion hand
 * @param bars - Number of bars
 * @param config - Generator configuration
 * @param rng - Seeded random number generator
 * @returns Both hand sequences and coordination scores
 */
export function coordinateHands(
  primary: HandSequence,
  companionSeed: MotifSeed,
  bars: number,
  config: GeneratorConfig,
  rng: () => number,
): { left: HandSequence; right: HandSequence; scores: CoordinationScores } {
  // Build the companion phrase from its seed
  const { events: rawCompanionEvents } = buildPhrase(
    companionSeed,
    bars,
    config,
    rng,
  );

  const primaryPositions = positionSet(primary.events);

  // Apply coordination pipeline
  let companionEvents = rawCompanionEvents;

  // 1. Resolve collisions
  companionEvents = resolveCollisions(companionEvents, primaryPositions);

  // 2. Apply burst protection
  companionEvents = applyBurstProtection(companionEvents, primary.events, bars);

  // 3. Ensure anchor alignment
  companionEvents = ensureAnchorAlignment(
    companionEvents,
    primary.events,
    bars,
  );

  // Determine which hand is which
  const isPrimaryLeft = primary.hand === 'left';
  const companionHand: 'left' | 'right' = isPrimaryLeft ? 'right' : 'left';

  const companion: HandSequence = {
    hand: companionHand,
    role_profile: companionSeed.role_profile,
    motif_family: companionSeed.motif_family,
    events: companionEvents,
  };

  const left = isPrimaryLeft ? primary : companion;
  const right = isPrimaryLeft ? companion : primary;

  // Compute coordination scores
  const scores: CoordinationScores = {
    anchorAlignment: anchorAlignmentScore(
      primary.events,
      companionEvents,
      bars,
    ),
    interlock: interlockScore(primary.events, companionEvents),
    collisionPressure: 1 - collisionPressureScore(primary.events, companionEvents),
    independence: independenceScore(primary.events, companionEvents),
    phraseCoherence: phraseCoherenceScore(primary.events, companionEvents, bars),
  };

  return { left, right, scores };
}
