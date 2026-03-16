/**
 * Pipeline Bridge — PatternCandidate → Existing Downstream Pipeline
 *
 * This is the ONLY file in the rudiment generator module that touches
 * downstream types (Performance, Layout, Voice, CandidateSolution).
 * It maintains boundary purity by converting abstract musical patterns
 * into the concrete types the existing pipeline expects.
 */

import { type PatternCandidate, type PatternEvent } from '../../types/patternCandidate';
import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type PerformanceEvent } from '../../types/performanceEvent';
import { type Voice } from '../../types/voice';
import { type Layout } from '../../types/layout';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type EngineConfiguration } from '../../types/engineConfig';
import { generateId } from '../../utils/idGenerator';
import {
  generateCandidates,
  type CandidateGenerationConfig,
} from '../optimization/multiCandidateGenerator';

// ============================================================================
// Sound Class → MIDI Mapping
// ============================================================================

/** Default mapping from sound_class strings to GM MIDI note numbers. */
export const SOUND_CLASS_MIDI_MAP: Record<string, number> = {
  kick: 36,
  snare: 38,
  closed_hat: 42,
  open_hat: 46,
  tom_1: 48,
  tom_2: 45,
  rim: 37,
  crash: 49,
  ride: 51,
  clap: 39,
  cowbell: 56,
};

/** Default colors for sound classes. */
const SOUND_CLASS_COLORS: Record<string, string> = {
  kick: '#E74C3C',
  snare: '#3498DB',
  closed_hat: '#F39C12',
  open_hat: '#E67E22',
  tom_1: '#9B59B6',
  tom_2: '#8E44AD',
  rim: '#1ABC9C',
  crash: '#2ECC71',
  ride: '#27AE60',
  clap: '#E91E63',
  cowbell: '#FF9800',
};

// ============================================================================
// Pipeline Configuration
// ============================================================================

/** Configuration for the pattern-to-pipeline bridge. */
export interface PipelineConfig {
  /** BPM for time conversion. Default: 120. */
  bpm?: number;
  /** Custom sound_class → MIDI note mapping. */
  midiMap?: Record<string, number>;
  /** Engine configuration for the solver. */
  engineConfig: EngineConfiguration;
  /** Instrument configuration. */
  instrumentConfig: InstrumentConfig;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a PatternCandidate to a Performance (PerformanceEvent[]).
 * Maps sound_class → MIDI note numbers and bar/slot/sub_offset → absolute time.
 */
export function patternToPerformance(
  pattern: PatternCandidate,
  bpm: number = 120,
  midiMap: Record<string, number> = SOUND_CLASS_MIDI_MAP,
): Performance {
  const beatsPerBar = 4; // 4/4 time
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = beatsPerBar * secondsPerBeat;
  // 8 slots per bar = eighth notes, so each slot = half a beat
  const secondsPerSlot = secondsPerBeat / 2;
  // Sub_offset=1 is a sixteenth between, so half of a slot
  const secondsPerSubOffset = secondsPerSlot / 2;

  const allEvents: PatternEvent[] = [
    ...pattern.left_hand.events,
    ...pattern.right_hand.events,
  ];

  // Sort by time
  const sorted = [...allEvents].sort((a, b) => {
    const timeA = a.bar * secondsPerBar + a.slot * secondsPerSlot + a.sub_offset * secondsPerSubOffset;
    const timeB = b.bar * secondsPerBar + b.slot * secondsPerSlot + b.sub_offset * secondsPerSubOffset;
    return timeA - timeB;
  });

  const performanceEvents: PerformanceEvent[] = sorted.map((e, i) => {
    const startTime =
      e.bar * secondsPerBar +
      e.slot * secondsPerSlot +
      e.sub_offset * secondsPerSubOffset;

    const noteNumber = midiMap[e.sound_class] ?? 60; // Default to middle C if unknown
    const velocity = e.accent ? 110 : e.role === 'ghost' ? 50 : 80;

    return {
      noteNumber,
      startTime,
      duration: e.duration_class === 'short' ? 0.05 : e.duration_class === 'long' ? 0.3 : 0.1,
      velocity,
      eventKey: `pattern:${startTime.toFixed(4)}:${noteNumber}:${i}`,
    };
  });

  return {
    events: performanceEvents,
    tempo: bpm,
    name: `Pattern ${pattern.id}`,
  };
}

/**
 * Extract the set of voices used in a PatternCandidate and build a Layout.
 * Each unique sound_class becomes a Voice assigned to a pad.
 */
export function patternToLayout(
  pattern: PatternCandidate,
  midiMap: Record<string, number> = SOUND_CLASS_MIDI_MAP,
): { voices: Voice[]; layout: Layout } {
  // Collect unique sound classes
  const allEvents = [
    ...pattern.left_hand.events,
    ...pattern.right_hand.events,
  ];
  const soundClasses = [...new Set(allEvents.map((e) => e.sound_class))];

  // Create voices
  const voices: Voice[] = soundClasses.map((sc) => ({
    id: generateId('voice'),
    name: sc,
    sourceType: 'midi_track' as const,
    sourceFile: 'pattern-generator',
    originalMidiNote: midiMap[sc] ?? 60,
    color: SOUND_CLASS_COLORS[sc] ?? '#95A5A6',
  }));

  // Assign voices to pads in a simple grid layout
  // Place voices in the middle rows for ergonomic reach
  const padToVoice: Record<string, Voice> = {};
  voices.forEach((voice, i) => {
    const row = 3 + Math.floor(i / 4); // Start at row 3
    const col = 2 + (i % 4); // Center columns
    if (row < 8 && col < 8) {
      padToVoice[`${row},${col}`] = voice;
    }
  });

  const layout: Layout = {
    id: generateId('layout'),
    name: `Pattern Layout ${pattern.id}`,
    padToVoice,
    fingerConstraints: {},
    scoreCache: null,
    layoutMode: 'auto',
  };

  return { voices, layout };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate CandidateSolutions from a PatternCandidate by feeding it through
 * the existing downstream pipeline.
 *
 * Converts the abstract pattern into Performance + Layout, then runs
 * the multi-candidate generator to produce full CandidateSolution objects
 * with layouts, execution plans, and difficulty analysis.
 */
export async function generateCandidateSolutions(
  pattern: PatternCandidate,
  config: PipelineConfig,
): Promise<CandidateSolution[]> {
  const bpm = config.bpm ?? 120;
  const midiMap = config.midiMap ?? SOUND_CLASS_MIDI_MAP;

  // Convert pattern to pipeline types
  const performance = patternToPerformance(pattern, bpm, midiMap);
  const { layout } = patternToLayout(pattern, midiMap);

  // Run through the existing multi-candidate generator
  const generationConfig: CandidateGenerationConfig = {
    count: 3,
    useAnnealing: false,
    engineConfig: config.engineConfig,
    instrumentConfig: config.instrumentConfig,
    baseLayout: layout,
  };

  return generateCandidates(performance, null, generationConfig);
}
