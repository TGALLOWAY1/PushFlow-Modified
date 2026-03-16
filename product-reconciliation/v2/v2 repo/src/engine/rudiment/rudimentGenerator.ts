/**
 * Rudiment Pattern Generator.
 *
 * Generates template-based drum rudiment patterns as loop editor lanes and events.
 * Each rudiment type has a codified sticking/accent pattern, not random placement.
 */

import {
  type LoopConfig,
  type LoopLane,
  type LoopEvent,
  type LoopCellKey,
  loopCellKey,
  stepsPerBar,
  totalSteps,
} from '../../types/loopEditor';
import { type RudimentType } from '../../types/rudiment';
import { generateId } from '../../utils/idGenerator';

// ============================================================================
// Constants
// ============================================================================

const LANE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

const DEFAULT_MIDI_MAP: Record<string, number> = {
  Kick: 36,
  Snare: 38,
  'Closed Hat': 42,
  'Open Hat': 46,
  'Tom 1': 48,
  'Tom 2': 45,
  Rim: 37,
  Crash: 49,
};

// ============================================================================
// Internal Types
// ============================================================================

interface StepEvent {
  stepIndex: number;
  velocity: number;
}

interface LanePattern {
  name: string;
  steps: StepEvent[];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a rudiment pattern for the loop editor.
 *
 * Returns lanes and events compatible with the existing loop editor state.
 * The pattern uses the current config (barCount, subdivision, bpm).
 */
export function generateRudiment(
  rudimentType: RudimentType,
  config: LoopConfig,
): { lanes: LoopLane[]; events: Map<LoopCellKey, LoopEvent> } {
  const spb = stepsPerBar(config.subdivision);
  const total = totalSteps(config);

  const patterns = buildPatterns(rudimentType, spb, total, config.barCount);

  // Create lanes
  const lanes: LoopLane[] = patterns.map((p, i) => ({
    id: generateId('llane'),
    name: p.name,
    color: LANE_COLORS[i % LANE_COLORS.length],
    midiNote: DEFAULT_MIDI_MAP[p.name] ?? null,
    orderIndex: i,
    isMuted: false,
    isSolo: false,
  }));

  // Create events
  const events = new Map<LoopCellKey, LoopEvent>();
  for (let i = 0; i < patterns.length; i++) {
    const lane = lanes[i];
    for (const step of patterns[i].steps) {
      if (step.stepIndex >= 0 && step.stepIndex < total) {
        const key = loopCellKey(lane.id, step.stepIndex);
        events.set(key, { laneId: lane.id, stepIndex: step.stepIndex, velocity: step.velocity });
      }
    }
  }

  return { lanes, events };
}

// ============================================================================
// Pattern Builders
// ============================================================================

function buildPatterns(
  type: RudimentType,
  spb: number,
  total: number,
  barCount: number,
): LanePattern[] {
  switch (type) {
    case 'single_stroke_roll': return buildSingleStrokeRoll(spb, total, barCount);
    case 'double_stroke_roll': return buildDoubleStrokeRoll(spb, total, barCount);
    case 'paradiddle': return buildParadiddle(spb, total, barCount);
    case 'flam_accent': return buildFlamAccent(spb, total, barCount);
    case 'six_stroke_roll': return buildSixStrokeRoll(spb, total, barCount);
    case 'basic_groove': return buildBasicGroove(spb, total, barCount);
  }
}

/**
 * Single Stroke Roll: alternating R-L on Snare and Tom 1.
 * Accented downbeats. 8+ bar variations add ghost notes.
 */
function buildSingleStrokeRoll(spb: number, total: number, barCount: number): LanePattern[] {
  const snare: StepEvent[] = [];
  const tom: StepEvent[] = [];
  const beatSize = Math.max(1, spb / 4);

  for (let step = 0; step < total; step++) {
    const isRight = step % 2 === 0;
    const posInBar = step % spb;
    const isDownbeat = posInBar % beatSize === 0;
    const barIndex = Math.floor(step / spb);

    // Variation: bars 5-8 swap hands (in 8+ bar patterns)
    const swapped = barCount >= 8 && barIndex >= barCount / 2;
    const effectiveRight = swapped ? !isRight : isRight;

    const velocity = isDownbeat ? 110 : 80;

    if (effectiveRight) {
      snare.push({ stepIndex: step, velocity });
    } else {
      tom.push({ stepIndex: step, velocity });
    }
  }

  return [
    { name: 'Snare', steps: snare },
    { name: 'Tom 1', steps: tom },
  ];
}

/**
 * Double Stroke Roll: R-R-L-L pairs on Snare and Tom 1.
 * Accented first hit of each pair.
 */
function buildDoubleStrokeRoll(spb: number, total: number, barCount: number): LanePattern[] {
  const snare: StepEvent[] = [];
  const tom: StepEvent[] = [];

  for (let step = 0; step < total; step++) {
    const pairIndex = Math.floor(step / 2) % 2; // 0 = right pair, 1 = left pair
    const isFirstOfPair = step % 2 === 0;
    const barIndex = Math.floor(step / spb);

    // Variation: 16-bar adds crescendo in last 4 bars
    const inCrescendo = barCount === 16 && barIndex >= 12;
    const accent = isFirstOfPair ? 110 : (inCrescendo ? 95 : 75);

    if (pairIndex === 0) {
      snare.push({ stepIndex: step, velocity: accent });
    } else {
      tom.push({ stepIndex: step, velocity: accent });
    }
  }

  return [
    { name: 'Snare', steps: snare },
    { name: 'Tom 1', steps: tom },
  ];
}

/**
 * Paradiddle: R-L-R-R / L-R-L-L cycle on Snare, Tom 1, Hi-Hat.
 * Accent on hi-hat at cycle boundaries.
 */
function buildParadiddle(spb: number, total: number, barCount: number): LanePattern[] {
  const snare: StepEvent[] = [];
  const tom: StepEvent[] = [];
  const hihat: StepEvent[] = [];

  // Pattern: R-L-R-R-L-R-L-L (8 steps per cycle)
  // R = Snare, L = Tom 1, accent first of each half-cycle on Hi-Hat
  const cycleLength = 8;
  const sticking = ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'];

  for (let step = 0; step < total; step++) {
    const posInCycle = step % cycleLength;
    const stick = sticking[posInCycle];
    const barIndex = Math.floor(step / spb);

    // Variation in second half: invert sticking
    const invert = barCount >= 8 && barIndex >= barCount / 2;
    const effectiveStick = invert ? (stick === 'R' ? 'L' : 'R') : stick;

    const isAccent = posInCycle === 0 || posInCycle === 4;
    const velocity = isAccent ? 110 : 80;

    if (effectiveStick === 'R') {
      snare.push({ stepIndex: step, velocity });
    } else {
      tom.push({ stepIndex: step, velocity });
    }

    // Hi-hat accent on cycle boundaries
    if (isAccent) {
      hihat.push({ stepIndex: step, velocity: 100 });
    }
  }

  return [
    { name: 'Snare', steps: snare },
    { name: 'Tom 1', steps: tom },
    { name: 'Closed Hat', steps: hihat },
  ];
}

/**
 * Flam Accent: grace notes (low velocity) + primary hits across 3 surfaces.
 * Pattern works in groups of 3 beats.
 */
function buildFlamAccent(spb: number, total: number, barCount: number): LanePattern[] {
  const snare: StepEvent[] = [];
  const tom1: StepEvent[] = [];
  const tom2: StepEvent[] = [];

  const beatSize = Math.max(1, spb / 4);
  // Grace note is one subdivision before the main hit
  // Main hits cycle through surfaces: Snare, Tom1, Tom2

  const surfaces = [snare, tom1, tom2];
  let surfaceIdx = 0;

  for (let step = 0; step < total; step++) {
    const posInBar = step % spb;
    const isOnBeat = posInBar % beatSize === 0;
    const barIndex = Math.floor(step / spb);

    if (isOnBeat) {
      // Variation: reverse surface order in second half
      const reversed = barCount >= 8 && barIndex >= barCount / 2;
      const idx = reversed ? (2 - (surfaceIdx % 3)) : (surfaceIdx % 3);

      // Main hit
      surfaces[idx].push({ stepIndex: step, velocity: 110 });

      // Grace note one step before (if in bounds)
      if (step > 0) {
        const graceIdx = (idx + 1) % 3;
        surfaces[graceIdx].push({ stepIndex: step - 1, velocity: 55 });
      }

      surfaceIdx++;
    }
  }

  return [
    { name: 'Snare', steps: snare },
    { name: 'Tom 1', steps: tom1 },
    { name: 'Tom 2', steps: tom2 },
  ];
}

/**
 * Six Stroke Roll: R-L-L-R-R-L accent pattern on 2 surfaces.
 */
function buildSixStrokeRoll(spb: number, total: number, barCount: number): LanePattern[] {
  const snare: StepEvent[] = [];
  const tom: StepEvent[] = [];

  // Sticking: R-l-l-R-r-L (accented R, L; ghost l, r)
  const cycleLength = 6;
  const sticking: Array<{ surface: 'snare' | 'tom'; accent: boolean }> = [
    { surface: 'snare', accent: true },   // R (accent)
    { surface: 'tom', accent: false },     // l (ghost)
    { surface: 'tom', accent: false },     // l (ghost)
    { surface: 'snare', accent: true },    // R (accent)
    { surface: 'snare', accent: false },   // r (ghost)
    { surface: 'tom', accent: true },      // L (accent)
  ];

  for (let step = 0; step < total; step++) {
    const posInCycle = step % cycleLength;
    const barIndex = Math.floor(step / spb);
    const { surface, accent } = sticking[posInCycle];

    // Variation: increase ghost note velocity in later bars
    const lateBoost = barCount >= 16 && barIndex >= 12 ? 15 : 0;
    const velocity = accent ? 110 : (65 + lateBoost);

    if (surface === 'snare') {
      snare.push({ stepIndex: step, velocity });
    } else {
      tom.push({ stepIndex: step, velocity });
    }
  }

  return [
    { name: 'Snare', steps: snare },
    { name: 'Tom 1', steps: tom },
  ];
}

/**
 * Basic Groove: full kit pattern (kick, snare, closed hat, open hat).
 * Standard rock/pop groove with variation across bars.
 */
function buildBasicGroove(spb: number, total: number, barCount: number): LanePattern[] {
  const kick: StepEvent[] = [];
  const snare: StepEvent[] = [];
  const closedHat: StepEvent[] = [];
  const openHat: StepEvent[] = [];

  const beatSize = Math.max(1, spb / 4);

  for (let step = 0; step < total; step++) {
    const posInBar = step % spb;
    const barIndex = Math.floor(step / spb);

    // Kick: beats 1 and 3, plus syncopated 16th before beat 4 in later bars
    if (posInBar === 0 || posInBar === 2 * beatSize) {
      kick.push({ stepIndex: step, velocity: 110 });
    } else if (barCount >= 8 && barIndex >= barCount / 2 && spb >= 8 && posInBar === 3 * beatSize - 1) {
      kick.push({ stepIndex: step, velocity: 95 });
    }

    // Snare: beats 2 and 4
    if (posInBar === beatSize || posInBar === 3 * beatSize) {
      snare.push({ stepIndex: step, velocity: 100 });
    }

    // Closed hat: every subdivision step (except where open hat plays)
    const isOpenHatStep = spb >= 8 && (posInBar === beatSize + beatSize / 2 || posInBar === 3 * beatSize + beatSize / 2);
    if (!isOpenHatStep) {
      // Vary velocity for groove feel
      const isOnBeat = posInBar % beatSize === 0;
      const vel = isOnBeat ? 90 : 70;
      closedHat.push({ stepIndex: step, velocity: vel });
    }

    // Open hat: offbeat 8ths (beat 2-and, 4-and)
    if (isOpenHatStep) {
      openHat.push({ stepIndex: step, velocity: 90 });
    }
  }

  return [
    { name: 'Kick', steps: kick },
    { name: 'Snare', steps: snare },
    { name: 'Closed Hat', steps: closedHat },
    { name: 'Open Hat', steps: openHat },
  ];
}
