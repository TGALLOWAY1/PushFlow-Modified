/**
 * Pattern Candidate Types.
 *
 * Data models for the Rudiment & Ostinato Candidate Generator.
 * These types represent musically coherent two-hand performance patterns
 * at an abstract level — no pad coordinates, finger types, or layout concerns.
 *
 * The bridge module (patternToPipeline.ts) translates these into the existing
 * downstream pipeline types (Performance, Layout, CandidateSolution).
 */

// ============================================================================
// Pattern Events
// ============================================================================

/**
 * A single musical event within a pattern.
 * Positions are described by bar/slot/sub_offset on an eighth-note backbone
 * with optional sixteenth insertions.
 */
export interface PatternEvent {
  /** Bar number (0-indexed). */
  bar: number;
  /** Slot within the bar (0–7, eighth-note backbone). */
  slot: number;
  /** Sub-offset for sixteenth insertions: 0 = on the eighth, 1 = sixteenth between. */
  sub_offset: 0 | 1;
  /** Instrument/sound class (e.g. "kick", "snare", "closed_hat"). */
  sound_class: string;
  /** Musical role of this event. */
  role: 'backbone' | 'accent' | 'ghost' | 'fill' | 'response';
  /** Whether this event is accented. */
  accent: boolean;
  /** Duration classification. */
  duration_class: 'normal' | 'short' | 'long';
  /** ID of the originating motif seed. */
  motif_id: string;
  /** History of transforms applied to produce this event from the seed. */
  transform_history: string[];
}

// ============================================================================
// Hand Sequences
// ============================================================================

/** A sequence of events assigned to one hand. */
export interface HandSequence {
  /** Which hand performs this sequence. */
  hand: 'left' | 'right';
  /** Primary role profile for this hand. */
  role_profile: string;
  /** Motif family that seeded this sequence. */
  motif_family: string;
  /** Ordered events for this hand. */
  events: PatternEvent[];
}

// ============================================================================
// Pattern Candidate
// ============================================================================

/** Generator-side coherence and quality metrics. */
export interface PatternCandidateMetadata {
  /** Event density: fraction of available slots filled (0–1). */
  density: number;
  /** Fraction of events on off-beat positions (0–1). */
  syncopation_ratio: number;
  /** Independence between left/right streams (0 = mirrored, 1 = fully independent). */
  independence_score: number;
  /** Repetition across bars (0 = no repetition, 1 = all bars identical). */
  repetition_score: number;
  /** Coherence of phrase structure (0–1). */
  phrase_coherence_score: number;
  /** Collision pressure between hands (0 = no collisions, higher = more pressure). */
  collision_pressure_score: number;
}

/**
 * A complete pattern candidate: two-hand musical pattern at the abstract level.
 * Contains no pad, finger, or layout information — boundary purity is maintained.
 */
export interface PatternCandidate {
  /** Unique identifier. */
  id: string;
  /** Number of bars in the pattern. */
  bars: number;
  /** Grid type descriptor. */
  grid_type: 'eighth_backbone_with_optional_sixteenth_insertions';
  /** Phrase plan labels (e.g. ["A", "A_prime", "B", "A_return"]). */
  phrase_plan: string[];
  /** Left-hand event sequence. */
  left_hand: HandSequence;
  /** Right-hand event sequence. */
  right_hand: HandSequence;
  /** Generator-computed quality metrics. */
  metadata: PatternCandidateMetadata;
}

// ============================================================================
// Generator Configuration
// ============================================================================

/** Configuration for the RudimentGenerator. */
export interface GeneratorConfig {
  /** Random seed for deterministic generation. */
  seed: number;
  /** Number of bars to generate (2, 4, or 8). */
  bars: 2 | 4 | 8;
  /** Maximum transforms applied per bar during phrase expansion. */
  max_transforms_per_bar: number;
  /** Target density range [min, max] (0–1). */
  density_range: [number, number];
  /** Target syncopation range [min, max] (0–1). */
  syncopation_range: [number, number];
  /** Minimum independence score to accept. */
  min_independence: number;
  /** Maximum collision pressure to accept. */
  max_collision_pressure: number;
  /** Minimum repetition score to accept (ensures some structure). */
  min_repetition: number;
  /** Maximum repetition score to accept (prevents monotony). */
  max_repetition: number;
  /** Over-generation multiplier (e.g. 3 = generate 3x target count). */
  over_generation_factor: number;
}

/** Sensible defaults for generator configuration. */
export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  seed: 42,
  bars: 4,
  max_transforms_per_bar: 2,
  density_range: [0.15, 0.70],
  syncopation_range: [0.1, 0.6],
  min_independence: 0.3,
  max_collision_pressure: 0.5,
  min_repetition: 0.35,
  max_repetition: 0.85,
  over_generation_factor: 3,
};
