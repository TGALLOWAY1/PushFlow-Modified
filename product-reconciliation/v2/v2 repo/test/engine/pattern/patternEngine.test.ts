/**
 * Pattern Engine Tests.
 *
 * Covers compilation, accent application, preset compilation,
 * and integration with the random generator.
 */

import { describe, it, expect } from 'vitest';
import { compilePattern } from '../../../src/engine/pattern/patternEngine';
import { applyAccent } from '../../../src/engine/pattern/accentApplicator';
import { applyVariation } from '../../../src/engine/pattern/variationApplicator';
import { PATTERN_PRESETS, findPresetById, findPresetByRudimentType } from '../../../src/engine/pattern/presets';
import { generateRandomRecipe } from '../../../src/engine/pattern/randomRecipeGenerator';
import { type LoopConfig } from '../../../src/types/loopEditor';
import { type PatternRecipe } from '../../../src/types/patternRecipe';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(barCount = 4, subdivision: LoopConfig['subdivision'] = '1/8'): LoopConfig {
  return { barCount, subdivision, bpm: 120 };
}

function emptyRecipe(): PatternRecipe {
  return {
    id: 'test_empty',
    name: 'Empty',
    description: '',
    layers: [],
    variation: { type: 'none' },
    isPreset: false,
    tags: [],
  };
}

// ============================================================================
// compilePattern
// ============================================================================

describe('compilePattern', () => {
  it('produces empty output for zero-layer recipe', () => {
    const { lanes, events } = compilePattern(emptyRecipe(), makeConfig());
    expect(lanes).toEqual([]);
    expect(events.size).toBe(0);
  });

  it('compiles a single euclidean layer', () => {
    const recipe: PatternRecipe = {
      ...emptyRecipe(),
      layers: [{
        id: 'l1',
        surface: 'kick',
        rhythm: { type: 'euclidean', hits: 3, steps: 8, rotation: 0 },
        accent: { type: 'flat' },
        velocity: { min: 80, max: 100 },
        density: 100,
      }],
    };

    const config = makeConfig(1, '1/8'); // 1 bar, 8 steps
    const { lanes, events } = compilePattern(recipe, config, 42);

    expect(lanes.length).toBe(1);
    expect(lanes[0].name).toBe('Kick');
    expect(lanes[0].midiNote).toBe(36);
    // E(3,8) tiled to 8 steps = 3 hits
    expect(events.size).toBe(3);
  });

  it('produces multiple lanes for multi-layer recipe', () => {
    const recipe: PatternRecipe = {
      ...emptyRecipe(),
      layers: [
        {
          id: 'l1', surface: 'kick',
          rhythm: { type: 'interval', interval: 4, offset: 0 },
          accent: { type: 'flat' }, velocity: { min: 90, max: 110 }, density: 100,
        },
        {
          id: 'l2', surface: 'snare',
          rhythm: { type: 'interval', interval: 8, offset: 4 },
          accent: { type: 'flat' }, velocity: { min: 80, max: 100 }, density: 100,
        },
      ],
    };

    const config = makeConfig(2, '1/8'); // 2 bars, 16 steps
    const { lanes, events } = compilePattern(recipe, config, 42);

    expect(lanes.length).toBe(2);
    expect(lanes[0].name).toBe('Kick');
    expect(lanes[1].name).toBe('Snare');
    // Kick: every 4 steps for 16 = 4 hits. Snare: every 8 steps from offset 4 = 2 hits.
    expect(events.size).toBe(6);
  });

  it('applies density thinning with seed determinism', () => {
    const recipe: PatternRecipe = {
      ...emptyRecipe(),
      layers: [{
        id: 'l1', surface: 'closed_hat',
        rhythm: { type: 'interval', interval: 1, offset: 0 },
        accent: { type: 'flat' }, velocity: { min: 70, max: 90 }, density: 50,
      }],
    };

    const config = makeConfig(1, '1/8'); // 8 steps
    const r1 = compilePattern(recipe, config, 123);
    const r2 = compilePattern(recipe, config, 123);
    const r3 = compilePattern(recipe, config, 456);

    // Same seed → same events
    expect(r1.events.size).toBe(r2.events.size);
    // Different seed → likely different events
    // Just check both have fewer than total (8)
    expect(r1.events.size).toBeLessThan(8);
    expect(r3.events.size).toBeLessThan(8);
  });

  it('uses custom lane names when specified', () => {
    const recipe: PatternRecipe = {
      ...emptyRecipe(),
      layers: [{
        id: 'l1', surface: 'snare', customName: 'My Snare',
        rhythm: { type: 'interval', interval: 4, offset: 0 },
        accent: { type: 'flat' }, velocity: { min: 80, max: 100 }, density: 100,
      }],
    };

    const { lanes } = compilePattern(recipe, makeConfig(), 42);
    expect(lanes[0].name).toBe('My Snare');
  });

  it('assigns lane colors cyclically', () => {
    const layers = Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`, surface: 'kick' as const,
      rhythm: { type: 'interval' as const, interval: 16, offset: i },
      accent: { type: 'flat' as const }, velocity: { min: 80, max: 100 }, density: 100,
    }));

    const recipe: PatternRecipe = { ...emptyRecipe(), layers };
    const { lanes } = compilePattern(recipe, makeConfig(), 42);

    // 10 lanes, 8 colors → first two repeat
    expect(lanes[0].color).toBe(lanes[8].color);
    expect(lanes[1].color).toBe(lanes[9].color);
  });

  it('assigns unique lane IDs', () => {
    const recipe: PatternRecipe = {
      ...emptyRecipe(),
      layers: [
        { id: 'l1', surface: 'kick', rhythm: { type: 'interval', interval: 4, offset: 0 }, accent: { type: 'flat' }, velocity: { min: 80, max: 100 }, density: 100 },
        { id: 'l2', surface: 'snare', rhythm: { type: 'interval', interval: 4, offset: 2 }, accent: { type: 'flat' }, velocity: { min: 80, max: 100 }, density: 100 },
      ],
    };

    const { lanes } = compilePattern(recipe, makeConfig(), 42);
    expect(lanes[0].id).not.toBe(lanes[1].id);
  });
});

// ============================================================================
// Accent Applicator
// ============================================================================

describe('applyAccent', () => {
  const allHit = [true, true, true, true, true, true, true, true];
  const SPB = 8;

  it('flat accent gives uniform velocity', () => {
    const vel = applyAccent(allHit, { type: 'flat' }, { min: 60, max: 100 }, SPB);
    const unique = new Set(vel);
    expect(unique.size).toBe(1);
    expect(vel[0]).toBe(80); // midpoint of 60-100
  });

  it('downbeat accent differentiates beats vs ghosts', () => {
    const vel = applyAccent(allHit, { type: 'downbeat', accentVelocity: 110, ghostVelocity: 50 }, { min: 50, max: 110 }, SPB);
    // SPB=8, beatSize=2. Steps 0,2,4,6 are on-beat.
    expect(vel[0]).toBe(110);
    expect(vel[1]).toBe(50);
    expect(vel[2]).toBe(110);
    expect(vel[3]).toBe(50);
  });

  it('crescendo produces monotonically increasing velocities', () => {
    const vel = applyAccent(allHit, { type: 'crescendo', startVelocity: 40, endVelocity: 120 }, { min: 40, max: 120 }, SPB);
    for (let i = 1; i < vel.length; i++) {
      expect(vel[i]).toBeGreaterThanOrEqual(vel[i - 1]);
    }
    expect(vel[0]).toBe(40);
    expect(vel[vel.length - 1]).toBe(120);
  });

  it('non-hit steps always get velocity 0', () => {
    const mask = [true, false, true, false, true, false, true, false];
    const vel = applyAccent(mask, { type: 'flat' }, { min: 60, max: 100 }, SPB);
    expect(vel[1]).toBe(0);
    expect(vel[3]).toBe(0);
    expect(vel[0]).toBeGreaterThan(0);
  });

  it('pattern accent cycles velocities across hits', () => {
    const mask = [true, true, true, true, false, false, false, false];
    const vel = applyAccent(mask, { type: 'pattern', velocities: [100, 60] }, { min: 60, max: 100 }, SPB);
    expect(vel[0]).toBe(100);
    expect(vel[1]).toBe(60);
    expect(vel[2]).toBe(100);
    expect(vel[3]).toBe(60);
  });
});

// ============================================================================
// Variation Applicator
// ============================================================================

describe('applyVariation', () => {
  it('type none returns input unchanged', () => {
    const hitMask = [true, false, true, false];
    const velocities = [100, 0, 80, 0];
    const result = applyVariation({ hitMask, velocities }, { type: 'none' }, 4, 1);
    expect(result.hitMask).toBe(hitMask); // Same reference
  });

  it('hand_swap inverts hits in variation region', () => {
    // 2 bars × 4 steps = 8 steps. Variation starts at bar 1 (step 4).
    const hitMask = [true, false, true, false, true, false, true, false];
    const velocities = [100, 0, 80, 0, 100, 0, 80, 0];
    const result = applyVariation({ hitMask, velocities }, { type: 'hand_swap' }, 4, 2);
    // First bar unchanged, second bar inverted
    expect(result.hitMask.slice(0, 4)).toEqual([true, false, true, false]);
    expect(result.hitMask.slice(4, 8)).toEqual([false, true, false, true]);
  });

  it('inversion inverts hits in variation region', () => {
    const hitMask = [true, false, true, false, true, false, true, false];
    const velocities = [100, 0, 80, 0, 100, 0, 80, 0];
    const result = applyVariation({ hitMask, velocities }, { type: 'inversion' }, 4, 2);
    expect(result.hitMask.slice(4, 8)).toEqual([false, true, false, true]);
  });

  it('does nothing if startBar >= barCount', () => {
    const hitMask = [true, false, true, false];
    const velocities = [100, 0, 80, 0];
    const result = applyVariation(
      { hitMask, velocities },
      { type: 'hand_swap', startBar: 5 },
      4, 1,
    );
    expect(result.hitMask).toEqual([true, false, true, false]);
  });
});

// ============================================================================
// Presets
// ============================================================================

describe('presets', () => {
  it('exports at least 14 presets (6 legacy + 8 new)', () => {
    expect(PATTERN_PRESETS.length).toBeGreaterThanOrEqual(14);
  });

  it('all presets have unique IDs', () => {
    const ids = PATTERN_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have at least one layer', () => {
    for (const preset of PATTERN_PRESETS) {
      expect(preset.layers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('finds preset by rudiment type', () => {
    const preset = findPresetByRudimentType('single_stroke_roll');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('Single Stroke Roll');
  });

  it('finds preset by ID', () => {
    const preset = findPresetById('preset_basic_groove');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('Basic Groove');
  });

  it('every preset compiles without errors', () => {
    const config = makeConfig(4, '1/8');
    for (const preset of PATTERN_PRESETS) {
      const { lanes, events } = compilePattern(preset, config, 42);
      expect(lanes.length).toBe(preset.layers.length);
      expect(events.size).toBeGreaterThan(0);
    }
  });

  it('legacy rudiment presets produce expected lane counts', () => {
    const config = makeConfig(4, '1/8');
    const expectations: Record<string, number> = {
      single_stroke_roll: 2,
      double_stroke_roll: 2,
      paradiddle: 3,
      flam_accent: 3,
      six_stroke_roll: 2,
      basic_groove: 4,
    };

    for (const [rudimentType, expectedLanes] of Object.entries(expectations)) {
      const preset = findPresetByRudimentType(rudimentType);
      expect(preset).toBeDefined();
      const { lanes } = compilePattern(preset!, config, 42);
      expect(lanes.length).toBe(expectedLanes);
    }
  });

  it('presets produce events at various bar counts', () => {
    for (const barCount of [1, 2, 4, 8, 16]) {
      const config = makeConfig(barCount, '1/8');
      for (const preset of PATTERN_PRESETS) {
        const { events } = compilePattern(preset, config, 42);
        expect(events.size).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// Random Generator
// ============================================================================

describe('generateRandomRecipe', () => {
  it('same seed produces same recipe', () => {
    const r1 = generateRandomRecipe(42);
    const r2 = generateRandomRecipe(42);
    expect(r1.id).toBe(r2.id);
    expect(r1.layers.length).toBe(r2.layers.length);
    for (let i = 0; i < r1.layers.length; i++) {
      expect(r1.layers[i].surface).toBe(r2.layers[i].surface);
      expect(r1.layers[i].rhythm).toEqual(r2.layers[i].rhythm);
    }
  });

  it('different seeds produce different recipes', () => {
    const r1 = generateRandomRecipe(1);
    const r2 = generateRandomRecipe(2);
    // Not guaranteed to be different in every field, but ID should differ
    expect(r1.id).not.toBe(r2.id);
  });

  it('honors layer count constraints', () => {
    const r = generateRandomRecipe(99, { minLayers: 3, maxLayers: 3 });
    expect(r.layers.length).toBe(3);
  });

  it('honors surface constraints', () => {
    const r = generateRandomRecipe(99, {
      allowedSurfaces: ['kick', 'snare'],
      minLayers: 2,
      maxLayers: 2,
    });
    const surfaces = r.layers.map(l => l.surface);
    expect(surfaces).toContain('kick');
    expect(surfaces).toContain('snare');
  });

  it('honors requireEuclidean constraint', () => {
    const r = generateRandomRecipe(42, { requireEuclidean: true });
    for (const layer of r.layers) {
      expect(layer.rhythm.type).toBe('euclidean');
    }
  });

  it('all random recipes compile without errors (100 seeds)', () => {
    const config = makeConfig(4, '1/8');
    for (let seed = 0; seed < 100; seed++) {
      const recipe = generateRandomRecipe(seed);
      expect(recipe.layers.length).toBeGreaterThanOrEqual(2);
      const { lanes, events } = compilePattern(recipe, config, seed);
      expect(lanes.length).toBe(recipe.layers.length);
      // Events can be 0 for very sparse patterns, but shouldn't crash
    }
  });

  it('respects density constraints', () => {
    const r = generateRandomRecipe(42, { minDensity: 80, maxDensity: 100 });
    for (const layer of r.layers) {
      expect(layer.density).toBeGreaterThanOrEqual(80);
      expect(layer.density).toBeLessThanOrEqual(100);
    }
  });

  it('isPreset is false for random recipes', () => {
    const r = generateRandomRecipe(42);
    expect(r.isPreset).toBe(false);
  });
});
