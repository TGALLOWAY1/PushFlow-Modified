/**
 * Motif Library — Stage 1: Seed Sampling
 *
 * Provides a library of one-bar motif seeds for left and right hands.
 * Seeds live on the 8-slot eighth-note backbone only (no sixteenth insertions).
 * The phrase builder and transforms expand these into full multi-bar patterns.
 */

import { type PatternEvent } from '../../types/patternCandidate';

// ============================================================================
// Motif Seed Interface
// ============================================================================

/** A one-bar motif seed that can be expanded into a full phrase. */
export interface MotifSeed {
  /** Unique id for this seed instance. */
  motif_id: string;
  /** Which motif family this seed belongs to. */
  motif_family: string;
  /** Primary role profile. */
  role_profile: string;
  /** Target density (fraction of 8 slots filled). */
  density_target: number;
  /** Target syncopation (fraction of events on off-beat slots). */
  syncopation_target: number;
  /** How well this seed works for multi-bar phrases. */
  phrase_suitability: 'high' | 'medium' | 'low';
  /** Slots that should remain anchored during transforms (e.g. downbeats). */
  anchor_slots: number[];
  /** The one-bar event pattern (all on bar 0, slot 0–7, sub_offset 0). */
  events: PatternEvent[];
}

// ============================================================================
// Left-Hand Motif Families
// ============================================================================

const LEFT_FAMILIES = ['alternating', 'paradiddle_like', 'call_response', 'accent_cycle'] as const;
const RIGHT_FAMILIES = ['ostinato', 'anchor_pickup', 'syncopated_pulse', 'response_line'] as const;

type LeftFamily = (typeof LEFT_FAMILIES)[number];
type RightFamily = (typeof RIGHT_FAMILIES)[number];

/** Create a base PatternEvent with defaults. */
function makeEvent(
  slot: number,
  sound_class: string,
  role: PatternEvent['role'],
  accent: boolean,
  motif_id: string,
): PatternEvent {
  return {
    bar: 0,
    slot,
    sub_offset: 0,
    sound_class,
    role,
    accent,
    duration_class: 'normal',
    motif_id,
    transform_history: [],
  };
}

/** Build a left-hand alternating seed: steady pulse on alternating slots. */
function buildAlternatingSeed(motif_id: string, rng: () => number): MotifSeed {
  // Pick starting slot offset (0 or 1) for variety
  const offset = rng() < 0.5 ? 0 : 1;
  const sound = rng() < 0.5 ? 'snare' : 'tom_1';
  const events: PatternEvent[] = [];
  for (let s = offset; s < 8; s += 2) {
    events.push(makeEvent(s, sound, 'backbone', s === 0 || s === 4, motif_id));
  }
  return {
    motif_id,
    motif_family: 'alternating',
    role_profile: 'steady_pulse',
    density_target: 0.5,
    syncopation_target: offset === 1 ? 0.5 : 0.0,
    phrase_suitability: 'high',
    anchor_slots: [0],
    events,
  };
}

/** Build a paradiddle-like seed: R-L-R-R mapped to left hand perspective. */
function buildParadiddleLikeSeed(motif_id: string, rng: () => number): MotifSeed {
  const sounds = rng() < 0.5 ? ['snare', 'tom_1'] : ['tom_1', 'tom_2'];
  // Paradiddle pattern on slots: 0,1,2,3 or 0,2,4,6
  const spread = rng() < 0.5;
  const slots = spread ? [0, 2, 4, 6] : [0, 1, 2, 3];
  const pattern = [0, 1, 0, 0]; // stick pattern indices
  const events: PatternEvent[] = slots.map((s, i) =>
    makeEvent(s, sounds[pattern[i]], i === 0 ? 'accent' : 'backbone', i === 0 || i === 3, motif_id),
  );
  return {
    motif_id,
    motif_family: 'paradiddle_like',
    role_profile: 'pattern_cycle',
    density_target: 0.5,
    syncopation_target: spread ? 0.0 : 0.0,
    phrase_suitability: 'high',
    anchor_slots: [0],
    events,
  };
}

/** Build a call-response seed: events in first half then gap. */
function buildCallResponseSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.5 ? 'snare' : 'rim';
  const events: PatternEvent[] = [
    makeEvent(0, sound, 'accent', true, motif_id),
    makeEvent(1, sound, 'backbone', false, motif_id),
    makeEvent(2, sound, 'backbone', false, motif_id),
  ];
  // Sometimes add a ghost note pickup
  if (rng() < 0.4) {
    events.push(makeEvent(6, sound, 'ghost', false, motif_id));
  }
  return {
    motif_id,
    motif_family: 'call_response',
    role_profile: 'call',
    density_target: events.length / 8,
    syncopation_target: 0.15,
    phrase_suitability: 'high',
    anchor_slots: [0],
    events,
  };
}

/** Build an accent-cycle seed: accents on a rotating pattern. */
function buildAccentCycleSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.5 ? 'snare' : 'tom_1';
  // Accent every 3rd hit over 8 slots
  const accentInterval = rng() < 0.5 ? 3 : 5;
  const events: PatternEvent[] = [];
  for (let s = 0; s < 8; s += 2) {
    const isAccent = s % accentInterval === 0;
    events.push(makeEvent(s, sound, isAccent ? 'accent' : 'backbone', isAccent, motif_id));
  }
  return {
    motif_id,
    motif_family: 'accent_cycle',
    role_profile: 'accent_pattern',
    density_target: 0.5,
    syncopation_target: 0.0,
    phrase_suitability: 'medium',
    anchor_slots: [0],
    events,
  };
}

// ============================================================================
// Right-Hand Motif Families
// ============================================================================

/** Build an ostinato seed: steady repeating pattern. */
function buildOstinatoSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.6 ? 'closed_hat' : 'ride';
  // Steady eighth notes or quarter notes
  const step = rng() < 0.6 ? 1 : 2;
  const events: PatternEvent[] = [];
  for (let s = 0; s < 8; s += step) {
    events.push(makeEvent(s, sound, 'backbone', s === 0 || s === 4, motif_id));
  }
  return {
    motif_id,
    motif_family: 'ostinato',
    role_profile: 'timekeeping',
    density_target: events.length / 8,
    syncopation_target: 0.0,
    phrase_suitability: 'high',
    anchor_slots: [0, 4],
    events,
  };
}

/** Build an anchor-pickup seed: downbeat + pickup note. */
function buildAnchorPickupSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.5 ? 'closed_hat' : 'crash';
  const events: PatternEvent[] = [
    makeEvent(0, sound, 'accent', true, motif_id),
    makeEvent(4, sound, 'backbone', false, motif_id),
  ];
  // Add pickup before downbeat
  if (rng() < 0.6) {
    events.push(makeEvent(7, sound, 'ghost', false, motif_id));
  }
  return {
    motif_id,
    motif_family: 'anchor_pickup',
    role_profile: 'anchor',
    density_target: events.length / 8,
    syncopation_target: events.length === 3 ? 0.33 : 0.0,
    phrase_suitability: 'medium',
    anchor_slots: [0, 4],
    events,
  };
}

/** Build a syncopated-pulse seed: off-beat emphasis. */
function buildSyncopatedPulseSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.5 ? 'open_hat' : 'closed_hat';
  // Off-beat slots: 1, 3, 5, 7
  const slots = [1, 3, 5, 7];
  // Use 2-3 of the 4 off-beat slots
  const count = rng() < 0.5 ? 2 : 3;
  const selected = shuffle(slots, rng).slice(0, count).sort((a, b) => a - b);
  const events: PatternEvent[] = selected.map((s, i) =>
    makeEvent(s, sound, 'backbone', i === 0, motif_id),
  );
  return {
    motif_id,
    motif_family: 'syncopated_pulse',
    role_profile: 'syncopation',
    density_target: events.length / 8,
    syncopation_target: 1.0,
    phrase_suitability: 'medium',
    anchor_slots: [],
    events,
  };
}

/** Build a response-line seed: sparse events in the second half of the bar. */
function buildResponseLineSeed(motif_id: string, rng: () => number): MotifSeed {
  const sound = rng() < 0.5 ? 'tom_2' : 'crash';
  const events: PatternEvent[] = [
    makeEvent(4, sound, 'response', true, motif_id),
    makeEvent(5, sound, 'response', false, motif_id),
  ];
  if (rng() < 0.4) {
    events.push(makeEvent(7, sound, 'ghost', false, motif_id));
  }
  return {
    motif_id,
    motif_family: 'response_line',
    role_profile: 'response',
    density_target: events.length / 8,
    syncopation_target: 0.2,
    phrase_suitability: 'high',
    anchor_slots: [4],
    events,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Fisher-Yates shuffle using provided rng. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// Public API
// ============================================================================

const leftBuilders: Record<LeftFamily, (id: string, rng: () => number) => MotifSeed> = {
  alternating: buildAlternatingSeed,
  paradiddle_like: buildParadiddleLikeSeed,
  call_response: buildCallResponseSeed,
  accent_cycle: buildAccentCycleSeed,
};

const rightBuilders: Record<RightFamily, (id: string, rng: () => number) => MotifSeed> = {
  ostinato: buildOstinatoSeed,
  anchor_pickup: buildAnchorPickupSeed,
  syncopated_pulse: buildSyncopatedPulseSeed,
  response_line: buildResponseLineSeed,
};

/** Get all motif family names for a given hand bias. */
export function getAllMotifFamilies(bias: 'left' | 'right'): string[] {
  return bias === 'left' ? [...LEFT_FAMILIES] : [...RIGHT_FAMILIES];
}

/**
 * Retrieve a motif seed by family name.
 * The rng is used for per-seed variation within the family.
 */
export function getMotifSeed(family: string, rng: () => number): MotifSeed {
  const motif_id = `motif_${family}_${Math.floor(rng() * 100000)}`;
  const leftBuilder = leftBuilders[family as LeftFamily];
  if (leftBuilder) return leftBuilder(motif_id, rng);
  const rightBuilder = rightBuilders[family as RightFamily];
  if (rightBuilder) return rightBuilder(motif_id, rng);
  throw new Error(`Unknown motif family: ${family}`);
}
