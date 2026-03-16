/**
 * Pattern Recipe Types.
 *
 * Declarative, serializable descriptions of rhythmic patterns.
 * A PatternRecipe is compiled by the PatternEngine into LoopLanes + LoopEvents.
 */

// ============================================================================
// Surface Roles & Categories
// ============================================================================

/** Surface category for ergonomic pad placement. */
export type SurfaceCategory = 'percussion' | 'bass' | 'melodic' | 'textural' | 'custom';

/** Canonical sound surface identifiers. */
export type SurfaceRole =
  // Percussion
  | 'kick' | 'snare' | 'closed_hat' | 'open_hat'
  | 'tom_1' | 'tom_2' | 'rim' | 'crash'
  | 'clap' | 'shaker' | 'ride' | 'floor_tom'
  // Bass / Pitched
  | 'bass_1' | 'bass_2' | 'bass_3' | 'bass_4'
  // Melodic
  | 'melodic_hit' | 'chord_stab' | 'arp_note'
  // Textural
  | 'vocal_chop' | 'fx_riser' | 'noise_sweep'
  // Generic
  | 'custom';

export interface SurfaceInfo {
  name: string;
  midiNote: number;
  category: SurfaceCategory;
}

export const SURFACE_DEFAULTS: Record<SurfaceRole, SurfaceInfo> = {
  // Percussion
  kick:       { name: 'Kick',       midiNote: 36, category: 'percussion' },
  snare:      { name: 'Snare',      midiNote: 38, category: 'percussion' },
  closed_hat: { name: 'Closed Hat', midiNote: 42, category: 'percussion' },
  open_hat:   { name: 'Open Hat',   midiNote: 46, category: 'percussion' },
  tom_1:      { name: 'Tom 1',      midiNote: 48, category: 'percussion' },
  tom_2:      { name: 'Tom 2',      midiNote: 45, category: 'percussion' },
  rim:        { name: 'Rim',        midiNote: 37, category: 'percussion' },
  crash:      { name: 'Crash',      midiNote: 49, category: 'percussion' },
  clap:       { name: 'Clap',       midiNote: 39, category: 'percussion' },
  shaker:     { name: 'Shaker',     midiNote: 70, category: 'percussion' },
  ride:       { name: 'Ride',       midiNote: 51, category: 'percussion' },
  floor_tom:  { name: 'Floor Tom',  midiNote: 43, category: 'percussion' },
  // Bass
  bass_1:     { name: 'Bass 1',     midiNote: 36, category: 'bass' },
  bass_2:     { name: 'Bass 2',     midiNote: 38, category: 'bass' },
  bass_3:     { name: 'Bass 3',     midiNote: 40, category: 'bass' },
  bass_4:     { name: 'Bass 4',     midiNote: 41, category: 'bass' },
  // Melodic
  melodic_hit: { name: 'Melodic Hit', midiNote: 60, category: 'melodic' },
  chord_stab:  { name: 'Chord Stab',  midiNote: 62, category: 'melodic' },
  arp_note:    { name: 'Arp Note',    midiNote: 64, category: 'melodic' },
  // Textural
  vocal_chop:  { name: 'Vocal Chop',  midiNote: 72, category: 'textural' },
  fx_riser:    { name: 'FX Riser',    midiNote: 74, category: 'textural' },
  noise_sweep: { name: 'Noise Sweep', midiNote: 76, category: 'textural' },
  // Generic
  custom:     { name: 'Custom',     midiNote: 60, category: 'custom' },
};

export const ALL_SURFACE_ROLES: SurfaceRole[] = Object.keys(SURFACE_DEFAULTS) as SurfaceRole[];

// ============================================================================
// Rhythm Specification
// ============================================================================

/** Euclidean rhythm: distribute hits evenly across steps using Bjorklund's algorithm. */
export interface EuclideanRhythm {
  type: 'euclidean';
  hits: number;
  steps: number;
  rotation: number;
}

/** Explicit grid: per-step on/off pattern, tiled across the loop. */
export interface GridRhythm {
  type: 'grid';
  pattern: boolean[];
}

/** Interval: hit every N steps, starting at offset. */
export interface IntervalRhythm {
  type: 'interval';
  interval: number;
  offset: number;
}

/** Sticking: R/L hand sequence. Layer filters to its assigned side. */
export interface StickingRhythm {
  type: 'sticking';
  pattern: ('R' | 'L')[];
  side: 'R' | 'L';
}

export type RhythmSpec = EuclideanRhythm | GridRhythm | IntervalRhythm | StickingRhythm;

// ============================================================================
// Accent / Velocity Profiles
// ============================================================================

export interface FlatAccent { type: 'flat'; }
export interface DownbeatAccent { type: 'downbeat'; accentVelocity: number; ghostVelocity: number; }
export interface OffbeatAccent { type: 'offbeat'; accentVelocity: number; ghostVelocity: number; }
export interface CrescendoAccent { type: 'crescendo'; startVelocity: number; endVelocity: number; }
export interface DecrescendoAccent { type: 'decrescendo'; startVelocity: number; endVelocity: number; }
export interface PatternAccent { type: 'pattern'; velocities: number[]; }

export type AccentProfile =
  | FlatAccent
  | DownbeatAccent
  | OffbeatAccent
  | CrescendoAccent
  | DecrescendoAccent
  | PatternAccent;

export interface VelocityRange {
  min: number;  // 0-127
  max: number;  // 0-127
}

// ============================================================================
// Variation
// ============================================================================

export type VariationType =
  | 'none'
  | 'hand_swap'
  | 'density_ramp'
  | 'density_thin'
  | 'inversion'
  | 'accent_shift';

export interface VariationConfig {
  type: VariationType;
  /** Bar at which variation begins (0-based). Default: halfway through loop. */
  startBar?: number;
}

// ============================================================================
// Pattern Layer
// ============================================================================

export interface PatternLayer {
  id: string;
  surface: SurfaceRole;
  /** Optional custom display name (overrides SURFACE_DEFAULTS.name). */
  customName?: string;
  rhythm: RhythmSpec;
  accent: AccentProfile;
  velocity: VelocityRange;
  /** 0-100 density modifier. 100 = use rhythm as-is. Lower values stochastically thin hits. */
  density: number;
}

// ============================================================================
// Pattern Recipe
// ============================================================================

export interface PatternRecipe {
  id: string;
  name: string;
  description: string;
  layers: PatternLayer[];
  variation: VariationConfig;
  isPreset: boolean;
  tags: string[];
}

// ============================================================================
// Pattern Source & Result (replaces RudimentResult)
// ============================================================================

import { type RudimentType } from './rudiment';
import { type LanePadAssignment, type RudimentFingerAssignment, type RudimentComplexity } from './rudiment';

/** Describes what produced the current pattern. */
export type PatternSource =
  | { type: 'legacy_rudiment'; rudimentType: RudimentType }
  | { type: 'recipe'; recipeId: string; recipeName: string };

/** Complete pattern generation result, stored on LoopState. */
export interface PatternResult {
  source: PatternSource;
  recipe: PatternRecipe;
  padAssignments: LanePadAssignment[];
  fingerAssignments: RudimentFingerAssignment[];
  complexity: RudimentComplexity;
}

// ============================================================================
// Random Recipe Constraints
// ============================================================================

export interface RandomRecipeConstraints {
  minLayers?: number;
  maxLayers?: number;
  allowedSurfaces?: SurfaceRole[];
  requireEuclidean?: boolean;
  minDensity?: number;
  maxDensity?: number;
  variation?: VariationType | 'random';
}
