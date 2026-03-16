/**
 * Transforms — Stage 2: Pattern Event Transforms
 *
 * Each transform is a pure function: PatternEvent[] → PatternEvent[]
 * Only `subdivisionInsertion` is allowed to create sub_offset=1 events.
 * Each transform appends its name to transform_history.
 */

import { type PatternEvent } from '../../types/patternCandidate';

// ============================================================================
// Transform Helpers
// ============================================================================

/** Deep-clone an event array, appending a transform name to history. */
function cloneEvents(events: PatternEvent[], transformName: string): PatternEvent[] {
  return events.map((e) => ({
    ...e,
    transform_history: [...e.transform_history, transformName],
  }));
}

// ============================================================================
// Transforms
// ============================================================================

/**
 * Mirror: Reverse the slot positions within the bar.
 * Slot s → slot (7 - s). Preserves sub_offset.
 */
export function mirror(events: PatternEvent[]): PatternEvent[] {
  return cloneEvents(events, 'mirror').map((e) => ({
    ...e,
    slot: 7 - e.slot,
  }));
}

/**
 * Rotate: Shift all events forward by a number of slots (cyclic).
 * Default shift is 1 slot.
 */
export function rotate(events: PatternEvent[], shift: number = 1): PatternEvent[] {
  return cloneEvents(events, 'rotate').map((e) => ({
    ...e,
    slot: (e.slot + shift) % 8,
  }));
}

/**
 * Accent Shift: Move accents to different positions within the pattern.
 * Accents shift forward by the given offset (cyclic among event positions).
 */
export function accentShift(events: PatternEvent[], offset: number = 1): PatternEvent[] {
  const result = cloneEvents(events, 'accentShift');
  // Gather indices of accented events
  const accentIndices = result.reduce<number[]>((acc, e, i) => {
    if (e.accent) acc.push(i);
    return acc;
  }, []);
  if (accentIndices.length === 0) return result;

  // Remove all accents
  for (const e of result) {
    e.accent = false;
    if (e.role === 'accent') e.role = 'backbone';
  }
  // Apply accents at shifted positions (cyclic within event list)
  for (const idx of accentIndices) {
    const newIdx = (idx + offset) % result.length;
    result[newIdx].accent = true;
    if (result[newIdx].role === 'backbone') result[newIdx].role = 'accent';
  }
  return result;
}

/**
 * Subdivision Insertion: Insert sixteenth-note ghost events between existing events.
 * This is the ONLY transform allowed to create sub_offset=1 events.
 */
export function subdivisionInsertion(
  events: PatternEvent[],
  rng: () => number,
  insertionProbability: number = 0.3,
): PatternEvent[] {
  const result = cloneEvents(events, 'subdivisionInsertion');
  const additions: PatternEvent[] = [];
  for (const e of result) {
    if (e.sub_offset === 0 && rng() < insertionProbability) {
      additions.push({
        ...e,
        sub_offset: 1,
        role: 'ghost',
        accent: false,
        duration_class: 'short',
        transform_history: [...e.transform_history, 'subdivisionInsertion'],
      });
    }
  }
  return [...result, ...additions];
}

/**
 * Density Lift: Double the density by filling empty even/odd slots.
 * Only fills slots that don't already have events.
 */
export function densityLift(events: PatternEvent[], rng: () => number): PatternEvent[] {
  const result = cloneEvents(events, 'densityLift');
  const occupiedSlots = new Set(result.map((e) => e.slot));
  const additions: PatternEvent[] = [];

  // Fill gaps between existing events
  for (let s = 0; s < 8; s++) {
    if (!occupiedSlots.has(s) && rng() < 0.4) {
      // Use the sound class of the nearest existing event
      const nearest = result.reduce((best, e) =>
        Math.abs(e.slot - s) < Math.abs(best.slot - s) ? e : best,
      );
      additions.push({
        bar: result[0]?.bar ?? 0,
        slot: s,
        sub_offset: 0,
        sound_class: nearest.sound_class,
        role: 'ghost',
        accent: false,
        duration_class: 'normal',
        motif_id: nearest.motif_id,
        transform_history: [...nearest.transform_history, 'densityLift'],
      });
    }
  }
  return [...result, ...additions];
}

/**
 * Sparse Reduction: Remove non-anchor, non-accent events to reduce density.
 * Keeps at least 2 events.
 */
export function sparseReduction(events: PatternEvent[], rng: () => number): PatternEvent[] {
  const result = cloneEvents(events, 'sparseReduction');
  if (result.length <= 2) return result;

  return result.filter((e) => {
    // Always keep accented events and events on anchor slots (0, 4)
    if (e.accent || e.slot === 0 || e.slot === 4) return true;
    // Probabilistically remove others
    return rng() > 0.5;
  });
}

/**
 * Call-Response Swap: Move first-half events to second half and vice versa.
 * Events in slots 0–3 → slots 4–7, and slots 4–7 → slots 0–3.
 */
export function callResponseSwap(events: PatternEvent[]): PatternEvent[] {
  return cloneEvents(events, 'callResponseSwap').map((e) => ({
    ...e,
    slot: (e.slot + 4) % 8,
  }));
}

// ============================================================================
// Transform Registry
// ============================================================================

export type TransformName =
  | 'mirror'
  | 'rotate'
  | 'accentShift'
  | 'subdivisionInsertion'
  | 'densityLift'
  | 'sparseReduction'
  | 'callResponseSwap';

/** All available transform names. */
export const ALL_TRANSFORMS: TransformName[] = [
  'mirror',
  'rotate',
  'accentShift',
  'subdivisionInsertion',
  'densityLift',
  'sparseReduction',
  'callResponseSwap',
];

/** Apply a named transform. For transforms needing rng, pass it in. */
export function applyTransform(
  name: TransformName,
  events: PatternEvent[],
  rng: () => number,
): PatternEvent[] {
  switch (name) {
    case 'mirror':
      return mirror(events);
    case 'rotate':
      return rotate(events);
    case 'accentShift':
      return accentShift(events);
    case 'subdivisionInsertion':
      return subdivisionInsertion(events, rng);
    case 'densityLift':
      return densityLift(events, rng);
    case 'sparseReduction':
      return sparseReduction(events, rng);
    case 'callResponseSwap':
      return callResponseSwap(events);
  }
}
