/**
 * Loop Editor Types.
 *
 * Data model for the Loop Editor step-sequencer feature.
 * Lanes represent named sound/trigger sources. Events are placed
 * on a fixed-length grid at a chosen subdivision. The loop produces
 * structured performance data for downstream layout and analysis systems.
 */

import { type RudimentResult } from './rudiment';
import { type PatternResult } from './patternRecipe';

// ============================================================================
// Loop Configuration
// ============================================================================

/** Grid subdivision options. */
export type LoopSubdivision = '1/1' | '1/2' | '1/4' | '1/8';

/** Top-level loop configuration. */
export interface LoopConfig {
  /** Number of bars in the loop. */
  barCount: 4 | 8 | 16;
  /** Grid subdivision — determines columns per bar. */
  subdivision: LoopSubdivision;
  /** Tempo in BPM. */
  bpm: number;
  /** Time signature numerator (4/4 for MVP). */
  beatsPerBar: 4;
}

// ============================================================================
// Loop Lane
// ============================================================================

/** A single lane in the loop editor grid. */
export interface LoopLane {
  id: string;
  name: string;
  color: string;
  /** Optional MIDI note number for downstream mapping. */
  midiNote: number | null;
  /** Ordering index for display. */
  orderIndex: number;
  /** Muted lanes are excluded from export. */
  isMuted: boolean;
  /** Solo lanes: if any lane is soloed, only soloed lanes export. */
  isSolo: boolean;
}

// ============================================================================
// Loop Event
// ============================================================================

/** A single event in the loop grid — addressed by lane + step index. */
export interface LoopEvent {
  /** ID of the lane this event belongs to. */
  laneId: string;
  /** Step index within the loop (0-based). */
  stepIndex: number;
  /** Velocity 0–127. */
  velocity: number;
}

/** Composite key for a loop event. */
export type LoopCellKey = `${string}:${number}`;

/** Create a cell key from lane ID and step index. */
export function loopCellKey(laneId: string, stepIndex: number): LoopCellKey {
  return `${laneId}:${stepIndex}`;
}

// ============================================================================
// Loop State
// ============================================================================

/** Complete state for the loop editor. */
export interface LoopState {
  config: LoopConfig;
  lanes: LoopLane[];
  /** Event map keyed by "laneId:stepIndex". */
  events: Map<LoopCellKey, LoopEvent>;
  /** Whether playback is active. */
  isPlaying: boolean;
  /** Current playhead position (step index, fractional). */
  playheadStep: number;
  /** Rudiment analysis results (present after Generate Rudiment). */
  rudimentResult?: RudimentResult | null;
  /** Pattern generation result (present after Generate Pattern). */
  patternResult?: PatternResult | null;
}

// ============================================================================
// Pure Helpers
// ============================================================================

/** Number of steps per bar for a given subdivision. */
export function stepsPerBar(subdivision: LoopSubdivision): number {
  switch (subdivision) {
    case '1/1': return 1;
    case '1/2': return 2;
    case '1/4': return 4;
    case '1/8': return 8;
  }
}

/** Total number of columns (steps) in the loop grid. */
export function totalSteps(config: LoopConfig): number {
  return config.barCount * stepsPerBar(config.subdivision);
}

/** Duration of one step in seconds. */
export function stepDuration(config: LoopConfig): number {
  const beatsPerStep = config.beatsPerBar / stepsPerBar(config.subdivision);
  return (60 / config.bpm) * beatsPerStep;
}

/** Total loop duration in seconds. */
export function loopDuration(config: LoopConfig): number {
  return totalSteps(config) * stepDuration(config);
}
