/**
 * Pattern Engine.
 *
 * Compiles a PatternRecipe + LoopConfig into LoopLanes and LoopEvents.
 * Pure function. No side effects. Synchronous.
 */

import {
  type PatternRecipe,
  SURFACE_DEFAULTS,
} from '../../types/patternRecipe';
import {
  type LoopConfig,
  type LoopLane,
  type LoopEvent,
  type LoopCellKey,
  loopCellKey,
  stepsPerBar as getStepsPerBar,
  totalSteps as getTotalSteps,
} from '../../types/loopEditor';
import { resolveRhythm } from './rhythmResolvers';
import { applyAccent } from './accentApplicator';
import { applyVariation } from './variationApplicator';
import { generateId } from '../../utils/idGenerator';
import { createSeededRng } from '../../utils/seededRng';

const LANE_COLORS = [
  '#ef4444', '#f97316', '#22c55e', '#eab308',
  '#3b82f6', '#a855f7', '#ec4899', '#14b8a6',
];

/**
 * Compile a PatternRecipe into LoopLanes and LoopEvents.
 *
 * @param recipe  The pattern recipe to compile
 * @param config  Current loop config (barCount, subdivision, bpm)
 * @param seed    Optional seed for deterministic density thinning
 * @returns       Lanes and events ready for the step sequencer
 */
export function compilePattern(
  recipe: PatternRecipe,
  config: LoopConfig,
  seed?: number,
): { lanes: LoopLane[]; events: Map<LoopCellKey, LoopEvent> } {
  const steps = getTotalSteps(config);
  const spb = getStepsPerBar(config.subdivision);
  const rng = createSeededRng(seed ?? Date.now());
  const events = new Map<LoopCellKey, LoopEvent>();
  const lanes: LoopLane[] = [];

  for (let layerIndex = 0; layerIndex < recipe.layers.length; layerIndex++) {
    const layer = recipe.layers[layerIndex];
    const surfaceInfo = SURFACE_DEFAULTS[layer.surface];
    const laneName = layer.customName ?? surfaceInfo.name;

    // 1. Resolve rhythm to hit mask
    let hitMask = resolveRhythm(layer.rhythm, steps, spb);

    // 2. Apply density thinning
    hitMask = applyDensity(hitMask, layer.density, rng);

    // 3. Compute velocities from accent profile
    let velocities = applyAccent(hitMask, layer.accent, layer.velocity, spb);

    // 4. Apply variation
    const varied = applyVariation(
      { hitMask, velocities },
      recipe.variation,
      spb,
      config.barCount,
    );
    hitMask = varied.hitMask;
    velocities = varied.velocities;

    // 5. Create lane
    const lane: LoopLane = {
      id: generateId('plane'),
      name: laneName,
      color: LANE_COLORS[layerIndex % LANE_COLORS.length],
      midiNote: surfaceInfo.midiNote,
      orderIndex: layerIndex,
      isMuted: false,
      isSolo: false,
    };
    lanes.push(lane);

    // 6. Create events
    for (let step = 0; step < steps; step++) {
      if (!hitMask[step] || velocities[step] <= 0) continue;
      const key = loopCellKey(lane.id, step);
      events.set(key, {
        laneId: lane.id,
        stepIndex: step,
        velocity: velocities[step],
      });
    }
  }

  return { lanes, events };
}

/**
 * Apply density thinning to a hit mask.
 * density=100 keeps all hits. Lower values remove hits stochastically.
 */
function applyDensity(
  hitMask: boolean[],
  density: number,
  rng: () => number,
): boolean[] {
  if (density >= 100) return hitMask;
  if (density <= 0) return new Array(hitMask.length).fill(false);

  const threshold = density / 100;
  return hitMask.map(hit => {
    if (!hit) return false;
    return rng() < threshold;
  });
}
