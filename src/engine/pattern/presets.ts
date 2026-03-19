/**
 * Pattern Presets.
 *
 * Includes the 6 legacy rudiments converted to PatternRecipe format,
 * plus new presets for broader test coverage across surface categories.
 *
 * Presets are tuned for 16th-note subdivision (stepsPerBar = 16, beatSize = 4).
 * They work at other subdivisions via tiling but may sound different.
 */

import {
  type PatternRecipe,
  type PatternLayer,
  type RhythmSpec,
  type AccentProfile,
  type VelocityRange,
} from '../../types/patternRecipe';

// ============================================================================
// Helpers
// ============================================================================

let layerCounter = 0;
function layerId(prefix: string): string {
  return `preset_layer_${prefix}_${layerCounter++}`;
}

function layer(
  id: string,
  surface: PatternLayer['surface'],
  rhythm: RhythmSpec,
  accent: AccentProfile,
  velocity: VelocityRange = { min: 60, max: 127 },
  density = 100,
  customName?: string,
): PatternLayer {
  return { id, surface, rhythm, accent, velocity, density, ...(customName ? { customName } : {}) };
}

const VEL_FULL: VelocityRange = { min: 60, max: 127 };
const VEL_GHOST: VelocityRange = { min: 30, max: 70 };

// ============================================================================
// Legacy Rudiment Presets
// ============================================================================

/**
 * Single Stroke Roll: alternating R-L on Snare and Tom 1.
 * Accented downbeats, hand_swap variation at midpoint.
 */
const singleStrokeRoll: PatternRecipe = {
  id: 'preset_single_stroke_roll',
  name: 'Single Stroke Roll',
  description: 'Alternating R-L strokes on two surfaces with downbeat accents',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'sticking'],
  variation: { type: 'hand_swap' },
  layers: [
    layer(
      layerId('ssr_snare'), 'snare',
      { type: 'sticking', pattern: ['R', 'L'], side: 'R' },
      { type: 'downbeat', accentVelocity: 110, ghostVelocity: 80 },
      VEL_FULL,
    ),
    layer(
      layerId('ssr_tom'), 'tom_1',
      { type: 'sticking', pattern: ['R', 'L'], side: 'L' },
      { type: 'downbeat', accentVelocity: 110, ghostVelocity: 80 },
      VEL_FULL,
    ),
  ],
};

/**
 * Double Stroke Roll: R-R-L-L pairs on Snare and Tom 1.
 * First hit of each pair accented.
 */
const doubleStrokeRoll: PatternRecipe = {
  id: 'preset_double_stroke_roll',
  name: 'Double Stroke Roll',
  description: 'R-R-L-L paired strokes with accent on pair start',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'sticking'],
  variation: { type: 'none' },
  layers: [
    layer(
      layerId('dsr_snare'), 'snare',
      { type: 'sticking', pattern: ['R', 'R', 'L', 'L'], side: 'R' },
      { type: 'pattern', velocities: [110, 75] },
      VEL_FULL,
    ),
    layer(
      layerId('dsr_tom'), 'tom_1',
      { type: 'sticking', pattern: ['R', 'R', 'L', 'L'], side: 'L' },
      { type: 'pattern', velocities: [110, 75] },
      VEL_FULL,
    ),
  ],
};

/**
 * Paradiddle: R-L-R-R / L-R-L-L sticking on Snare and Tom 1.
 * Closed hat accents on cycle boundaries (every 4 steps).
 * Inversion variation in second half.
 */
const paradiddle: PatternRecipe = {
  id: 'preset_paradiddle',
  name: 'Paradiddle',
  description: 'R-L-R-R / L-R-L-L sticking with hi-hat accents',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'sticking'],
  variation: { type: 'inversion' },
  layers: [
    layer(
      layerId('para_snare'), 'snare',
      { type: 'sticking', pattern: ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'], side: 'R' },
      { type: 'pattern', velocities: [110, 80, 80, 80] },
      VEL_FULL,
    ),
    layer(
      layerId('para_tom'), 'tom_1',
      { type: 'sticking', pattern: ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'], side: 'L' },
      { type: 'pattern', velocities: [110, 80, 80, 80] },
      VEL_FULL,
    ),
    layer(
      layerId('para_hat'), 'closed_hat',
      { type: 'interval', interval: 4, offset: 0 },
      { type: 'flat' },
      { min: 90, max: 110 },
    ),
  ],
};

/**
 * Flam Accent: grace notes + primary hits cycling through 3 surfaces.
 * Main hits cycle every 3 beats (12 steps at 16th subdivision).
 * Grace notes precede each main hit by 1 step, played by the next surface.
 *
 * Cycle per 12 steps:
 *   Step 0: Snare main (110)     Step 11: Tom 1 grace (55)
 *   Step 3: Tom 2 grace (55)     Step 4: Tom 1 main (110)
 *   Step 7: Snare grace (55)     Step 8: Tom 2 main (110)
 */
const flamAccent: PatternRecipe = {
  id: 'preset_flam_accent',
  name: 'Flam Accent',
  description: 'Grace notes with primary hits across three surfaces',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'grace'],
  variation: { type: 'none' },
  layers: [
    // Snare: main at step 0, grace at step 7 (before Tom 2 main)
    layer(
      layerId('flam_snare'), 'snare',
      { type: 'grid', pattern: [true, false, false, false, false, false, false, true, false, false, false, false] },
      { type: 'pattern', velocities: [110, 55] },
      VEL_FULL,
    ),
    // Tom 1: main at step 4, grace at step 11 (before Snare main)
    layer(
      layerId('flam_tom1'), 'tom_1',
      { type: 'grid', pattern: [false, false, false, false, true, false, false, false, false, false, false, true] },
      { type: 'pattern', velocities: [110, 55] },
      VEL_FULL,
    ),
    // Tom 2: grace at step 3 (before Tom 1 main), main at step 8
    layer(
      layerId('flam_tom2'), 'tom_2',
      { type: 'grid', pattern: [false, false, false, true, false, false, false, false, true, false, false, false] },
      { type: 'pattern', velocities: [55, 110] },
      VEL_FULL,
    ),
  ],
};

/**
 * Six Stroke Roll: R-l-l-R-r-L accent pattern (6-step cycle).
 *
 * Sticking with accent/ghost:
 *   Snare: R(accent), _, _, R(accent), r(ghost), _
 *   Tom 1: _, l(ghost), l(ghost), _, _, L(accent)
 */
const sixStrokeRoll: PatternRecipe = {
  id: 'preset_six_stroke_roll',
  name: 'Six Stroke Roll',
  description: 'R-L-L-R-R-L accent pattern on two surfaces',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'sticking'],
  variation: { type: 'none' },
  layers: [
    // Snare hits at 0 (accent), 3 (accent), 4 (ghost) in 6-step cycle
    layer(
      layerId('ssr6_snare'), 'snare',
      { type: 'grid', pattern: [true, false, false, true, true, false] },
      { type: 'pattern', velocities: [110, 110, 65] },
      VEL_FULL,
    ),
    // Tom 1 hits at 1 (ghost), 2 (ghost), 5 (accent) in 6-step cycle
    layer(
      layerId('ssr6_tom'), 'tom_1',
      { type: 'grid', pattern: [false, true, true, false, false, true] },
      { type: 'pattern', velocities: [65, 65, 110] },
      VEL_FULL,
    ),
  ],
};

/**
 * Basic Groove: kick, snare, closed hat, open hat.
 * Standard rock/pop groove tuned for 16th-note subdivision.
 */
const basicGroove: PatternRecipe = {
  id: 'preset_basic_groove',
  name: 'Basic Groove',
  description: 'Full kit groove with kick, snare, and hats',
  isPreset: true,
  tags: ['rudiment', 'percussion', 'groove'],
  variation: { type: 'density_ramp' },
  layers: [
    // Kick: beats 1 and 3 (steps 0, 8 in 16-step bar)
    layer(
      layerId('groove_kick'), 'kick',
      { type: 'grid', pattern: [
        true, false, false, false, false, false, false, false,
        true, false, false, false, false, false, false, false,
      ] },
      { type: 'flat' },
      { min: 100, max: 120 },
    ),
    // Snare: beats 2 and 4 (steps 4, 12)
    layer(
      layerId('groove_snare'), 'snare',
      { type: 'grid', pattern: [
        false, false, false, false, true, false, false, false,
        false, false, false, false, true, false, false, false,
      ] },
      { type: 'flat' },
      { min: 90, max: 110 },
    ),
    // Closed hat: every step except where open hat plays (steps 6, 14)
    layer(
      layerId('groove_ch'), 'closed_hat',
      { type: 'grid', pattern: [
        true, true, true, true, true, true, false, true,
        true, true, true, true, true, true, false, true,
      ] },
      { type: 'downbeat', accentVelocity: 90, ghostVelocity: 70 },
      VEL_FULL,
    ),
    // Open hat: offbeat 8ths (beat 2-and, beat 4-and → steps 6, 14)
    layer(
      layerId('groove_oh'), 'open_hat',
      { type: 'grid', pattern: [
        false, false, false, false, false, false, true, false,
        false, false, false, false, false, false, true, false,
      ] },
      { type: 'flat' },
      { min: 80, max: 100 },
    ),
  ],
};

// ============================================================================
// New Presets — Extended Surface Coverage
// ============================================================================

/**
 * Sparse Kick+Hat: minimal 2-layer pattern.
 * Tests low density and simple placement.
 */
const sparseKickHat: PatternRecipe = {
  id: 'preset_sparse_kick_hat',
  name: 'Sparse Kick+Hat',
  description: 'Minimal kick and hi-hat pattern at reduced density',
  isPreset: true,
  tags: ['simple', 'percussion'],
  variation: { type: 'none' },
  layers: [
    layer(
      layerId('sparse_kick'), 'kick',
      { type: 'interval', interval: 8, offset: 0 },
      { type: 'flat' },
      { min: 95, max: 115 },
    ),
    layer(
      layerId('sparse_hat'), 'closed_hat',
      { type: 'interval', interval: 2, offset: 0 },
      { type: 'downbeat', accentVelocity: 85, ghostVelocity: 65 },
      VEL_FULL,
      60,
    ),
  ],
};

/**
 * Dense Polyrhythm: 3 euclidean layers with coprime parameters.
 * Tests complex overlapping patterns and simultaneity.
 */
const densePolyrhythm: PatternRecipe = {
  id: 'preset_dense_polyrhythm',
  name: 'Dense Polyrhythm',
  description: 'Three coprime euclidean rhythms layered together',
  isPreset: true,
  tags: ['complex', 'percussion', 'euclidean'],
  variation: { type: 'accent_shift' },
  layers: [
    layer(
      layerId('poly_kick'), 'kick',
      { type: 'euclidean', hits: 3, steps: 8, rotation: 0 },
      { type: 'flat' },
      { min: 95, max: 115 },
    ),
    layer(
      layerId('poly_snare'), 'snare',
      { type: 'euclidean', hits: 5, steps: 8, rotation: 0 },
      { type: 'flat' },
      { min: 80, max: 100 },
    ),
    layer(
      layerId('poly_hat'), 'closed_hat',
      { type: 'euclidean', hits: 7, steps: 16, rotation: 0 },
      { type: 'flat' },
      { min: 70, max: 90 },
    ),
  ],
};

/**
 * Linear Groove: 4 surfaces, no overlaps.
 * Tests hand alternation when every event is on a different surface.
 */
const linearGroove: PatternRecipe = {
  id: 'preset_linear_groove',
  name: 'Linear Groove',
  description: 'Non-overlapping hits across four surfaces',
  isPreset: true,
  tags: ['linear', 'percussion'],
  variation: { type: 'density_thin' },
  layers: [
    layer(
      layerId('lin_kick'), 'kick',
      { type: 'grid', pattern: [
        true, false, false, false, false, false, true, false,
        false, false, false, false, false, false, false, false,
      ] },
      { type: 'flat' },
      { min: 100, max: 115 },
    ),
    layer(
      layerId('lin_snare'), 'snare',
      { type: 'grid', pattern: [
        false, false, false, false, true, false, false, false,
        false, false, false, false, true, false, false, false,
      ] },
      { type: 'flat' },
      { min: 90, max: 105 },
    ),
    layer(
      layerId('lin_hat'), 'closed_hat',
      { type: 'grid', pattern: [
        false, false, true, false, false, false, false, false,
        false, false, true, false, false, false, false, false,
      ] },
      { type: 'flat' },
      { min: 80, max: 95 },
    ),
    layer(
      layerId('lin_tom'), 'tom_1',
      { type: 'grid', pattern: [
        false, false, false, false, false, false, false, false,
        false, false, false, false, false, false, true, false,
      ] },
      { type: 'flat' },
      { min: 85, max: 100 },
    ),
  ],
};

/**
 * Ghost Note Exercise: emphasis on low-velocity dynamics.
 * Tests ghost note detection and velocity-sensitive playability scoring.
 */
const ghostNoteExercise: PatternRecipe = {
  id: 'preset_ghost_note_exercise',
  name: 'Ghost Note Exercise',
  description: 'Low-velocity dominated pattern for dynamic control',
  isPreset: true,
  tags: ['ghost', 'dynamics', 'percussion'],
  variation: { type: 'accent_shift' },
  layers: [
    layer(
      layerId('ghost_snare'), 'snare',
      { type: 'interval', interval: 1, offset: 0 },
      { type: 'downbeat', accentVelocity: 110, ghostVelocity: 40 },
      VEL_GHOST,
    ),
    layer(
      layerId('ghost_tom'), 'tom_1',
      { type: 'euclidean', hits: 3, steps: 16, rotation: 0 },
      { type: 'flat' },
      { min: 35, max: 55 },
    ),
  ],
};

/**
 * Four-on-the-Floor: classic dance pattern.
 * Kick on every beat, hat on every 8th, snare on 2 and 4.
 */
const fourOnTheFloor: PatternRecipe = {
  id: 'preset_four_on_the_floor',
  name: 'Four-on-the-Floor',
  description: 'Classic dance pattern with kick on every beat',
  isPreset: true,
  tags: ['dance', 'percussion', 'groove'],
  variation: { type: 'none' },
  layers: [
    layer(
      layerId('fotf_kick'), 'kick',
      { type: 'interval', interval: 4, offset: 0 },
      { type: 'flat' },
      { min: 100, max: 120 },
    ),
    layer(
      layerId('fotf_snare'), 'snare',
      { type: 'grid', pattern: [
        false, false, false, false, true, false, false, false,
        false, false, false, false, true, false, false, false,
      ] },
      { type: 'flat' },
      { min: 90, max: 105 },
    ),
    layer(
      layerId('fotf_hat'), 'closed_hat',
      { type: 'interval', interval: 2, offset: 0 },
      { type: 'downbeat', accentVelocity: 90, ghostVelocity: 70 },
      VEL_FULL,
    ),
  ],
};

/**
 * Bass + Drums: mixed percussion and pitched surfaces.
 * Tests category-based pad assignment with bass on separate zone.
 */
const bassPlusDrums: PatternRecipe = {
  id: 'preset_bass_plus_drums',
  name: 'Bass + Drums',
  description: 'Kick, snare, hat plus bass line for mixed-category testing',
  isPreset: true,
  tags: ['bass', 'percussion', 'mixed'],
  variation: { type: 'density_ramp' },
  layers: [
    layer(
      layerId('bd_kick'), 'kick',
      { type: 'interval', interval: 4, offset: 0 },
      { type: 'flat' },
      { min: 100, max: 115 },
    ),
    layer(
      layerId('bd_snare'), 'snare',
      { type: 'grid', pattern: [
        false, false, false, false, true, false, false, false,
        false, false, false, false, true, false, false, false,
      ] },
      { type: 'flat' },
      { min: 85, max: 100 },
    ),
    layer(
      layerId('bd_hat'), 'closed_hat',
      { type: 'interval', interval: 2, offset: 0 },
      { type: 'downbeat', accentVelocity: 80, ghostVelocity: 60 },
      VEL_FULL,
    ),
    layer(
      layerId('bd_bass'), 'bass_1',
      { type: 'euclidean', hits: 5, steps: 16, rotation: 0 },
      { type: 'flat' },
      { min: 80, max: 100 },
    ),
  ],
};

/**
 * Melodic Sequence: pitched-only pattern.
 * Tests melodic surface category pad placement.
 */
const melodicSequence: PatternRecipe = {
  id: 'preset_melodic_sequence',
  name: 'Melodic Sequence',
  description: 'Three melodic layers with offset interval patterns',
  isPreset: true,
  tags: ['melodic', 'pitched'],
  variation: { type: 'accent_shift' },
  layers: [
    layer(
      layerId('mel_hit'), 'melodic_hit',
      { type: 'interval', interval: 3, offset: 0 },
      { type: 'crescendo', startVelocity: 60, endVelocity: 110 },
      VEL_FULL,
    ),
    layer(
      layerId('mel_stab'), 'chord_stab',
      { type: 'interval', interval: 5, offset: 1 },
      { type: 'flat' },
      { min: 75, max: 95 },
    ),
    layer(
      layerId('mel_arp'), 'arp_note',
      { type: 'euclidean', hits: 7, steps: 16, rotation: 3 },
      { type: 'flat' },
      { min: 65, max: 85 },
    ),
  ],
};

/**
 * Full Kit + Chops: 5 layers across percussion and textural categories.
 * Tests 5+ lane diversity and mixed category pad assignment.
 */
const fullKitChops: PatternRecipe = {
  id: 'preset_full_kit_chops',
  name: 'Full Kit + Chops',
  description: 'Full drum kit with vocal chop layer for diverse testing',
  isPreset: true,
  tags: ['full', 'percussion', 'textural'],
  variation: { type: 'density_thin' },
  layers: [
    layer(
      layerId('fkc_kick'), 'kick',
      { type: 'grid', pattern: [
        true, false, false, false, false, false, true, false,
        true, false, false, false, false, false, false, false,
      ] },
      { type: 'flat' },
      { min: 100, max: 120 },
    ),
    layer(
      layerId('fkc_snare'), 'snare',
      { type: 'grid', pattern: [
        false, false, false, false, true, false, false, false,
        false, false, false, false, true, false, false, true,
      ] },
      { type: 'flat' },
      { min: 85, max: 105 },
    ),
    layer(
      layerId('fkc_hat'), 'closed_hat',
      { type: 'interval', interval: 2, offset: 0 },
      { type: 'downbeat', accentVelocity: 85, ghostVelocity: 65 },
      VEL_FULL,
    ),
    layer(
      layerId('fkc_ride'), 'ride',
      { type: 'euclidean', hits: 5, steps: 16, rotation: 0 },
      { type: 'flat' },
      { min: 70, max: 90 },
    ),
    layer(
      layerId('fkc_chop'), 'vocal_chop',
      { type: 'euclidean', hits: 3, steps: 16, rotation: 2 },
      { type: 'flat' },
      { min: 80, max: 100 },
    ),
  ],
};

// ============================================================================
// Exports
// ============================================================================

/** All pattern presets in display order: legacy rudiments first, then new. */
export const PATTERN_PRESETS: PatternRecipe[] = [
  // Legacy rudiments
  singleStrokeRoll,
  doubleStrokeRoll,
  paradiddle,
  flamAccent,
  sixStrokeRoll,
  basicGroove,
  // New presets
  sparseKickHat,
  densePolyrhythm,
  linearGroove,
  ghostNoteExercise,
  fourOnTheFloor,
  bassPlusDrums,
  melodicSequence,
  fullKitChops,
];

/** Map from legacy RudimentType to preset ID. */
export const RUDIMENT_TO_PRESET: Record<string, string> = {
  single_stroke_roll: 'preset_single_stroke_roll',
  double_stroke_roll: 'preset_double_stroke_roll',
  paradiddle: 'preset_paradiddle',
  flam_accent: 'preset_flam_accent',
  six_stroke_roll: 'preset_six_stroke_roll',
  basic_groove: 'preset_basic_groove',
};

/** Find a preset by ID. */
export function findPresetById(id: string): PatternRecipe | undefined {
  return PATTERN_PRESETS.find(p => p.id === id);
}

/** Find a preset by legacy rudiment type. */
export function findPresetByRudimentType(rudimentType: string): PatternRecipe | undefined {
  const presetId = RUDIMENT_TO_PRESET[rudimentType];
  return presetId ? findPresetById(presetId) : undefined;
}
