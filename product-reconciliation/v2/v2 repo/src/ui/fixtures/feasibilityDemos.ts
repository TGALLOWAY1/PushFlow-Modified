/**
 * Feasibility Demo Projects.
 *
 * Generates loadable ProjectState objects for feasibility scenarios:
 *   A1–A8: Atomic chord-level constraint tests (shared with CI fixtures)
 *   F1–F6: Temporal sequence layout violation demos
 *
 * Users can open these in the grid editor to:
 *   1. See the pre-assigned pads on the 8×8 grid
 *   2. See MIDI events in the timeline
 *   3. Click Generate → observe feasibility inspector results
 *   4. Verify that infeasibility is correctly determined
 */

import {
  type ProjectState,
  createEmptyProjectState,
  type SoundStream,
  type SoundEvent,
} from '../state/projectState';
import { type Voice } from '../../types/voice';
import { type Layout } from '../../types/layout';

// ============================================================================
// Voice Colors
// ============================================================================

const VOICE_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4',
  '#ec4899', '#f97316', '#84cc16', '#14b8a6',
];

// ============================================================================
// Scenario Data (inlined from fixture definitions)
// ============================================================================

interface FeasibilityDemoScenario {
  id: string;
  name: string;
  description: string;
  pads: Array<{ row: number; col: number }>;
  hand: 'left' | 'right';
  noteNumbers: number[];
  voiceNames: string[];
  /** Optional per-pad finger constraints (e.g., "L-Ix" for left index). */
  fingerConstraints?: Record<string, string>;
  /** Custom event start times per voice index. If omitted, uses default 4 uniform events at 0.5s intervals. */
  eventTimesPerVoice?: number[][];
}

const SCENARIOS: FeasibilityDemoScenario[] = [
  {
    id: 'A1',
    name: 'A1: Finger Ordering Violation',
    description: 'Four pads spanning cols 0–7 force a right-hand ordering violation',
    pads: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 7 }],
    hand: 'right',
    noteNumbers: [60, 61, 62, 67],
    voiceNames: ['Pad A', 'Pad B', 'Pad C', 'Pad D'],
  },
  {
    id: 'A2',
    name: 'A2: Local Span Overflow',
    description: 'Two pads at maximum grid distance exceed all per-pair span limits',
    pads: [{ row: 0, col: 0 }, { row: 7, col: 7 }],
    hand: 'right',
    noteNumbers: [36, 99],
    voiceNames: ['Low Pad', 'High Pad'],
  },
  {
    id: 'A3',
    name: 'A3: Thumb Above Other Fingers',
    description: 'Pad configuration forcing thumb 5 rows above index (violates thumbDelta)',
    pads: [{ row: 7, col: 2 }, { row: 2, col: 3 }],
    hand: 'left',
    noteNumbers: [76, 55],
    voiceNames: ['High Pad', 'Low Pad'],
  },
  {
    id: 'A4',
    name: 'A4: Impossible Chord Shape',
    description: 'Five-finger chord spanning 7 columns — too wide for one hand',
    pads: [{ row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 3, col: 7 }],
    hand: 'right',
    noteNumbers: [60, 62, 64, 66, 67],
    voiceNames: ['V1', 'V2', 'V3', 'V4', 'V5'],
  },
  {
    id: 'A5',
    name: 'A5: Reachability Failure',
    description: 'Two pads 6 grid units apart — outside reach for any finger',
    pads: [{ row: 0, col: 0 }, { row: 0, col: 6 }],
    hand: 'right',
    noteNumbers: [36, 42],
    voiceNames: ['Anchor', 'Far Pad'],
  },
  {
    id: 'A6',
    name: 'A6: Transition Too Fast',
    description: 'Events on distant pads close in time — speed exceeds physiological limit',
    pads: [{ row: 0, col: 0 }, { row: 7, col: 0 }],
    hand: 'right',
    noteNumbers: [36, 92],
    voiceNames: ['Bottom', 'Top'],
  },
  {
    id: 'A7',
    name: 'A7: Hand Crossover',
    description: 'Three adjacent pads — valid orderings exist for right hand',
    pads: [{ row: 3, col: 6 }, { row: 3, col: 4 }, { row: 3, col: 5 }],
    hand: 'right',
    noteNumbers: [66, 64, 65],
    voiceNames: ['Pad Right', 'Pad Middle', 'Pad Center'],
  },
  {
    id: 'A8',
    name: 'A8: Zone Violation',
    description: 'Left hand forced to play in right-hand territory (cols 5-6) via finger constraints',
    pads: [{ row: 3, col: 5 }, { row: 3, col: 6 }],
    hand: 'left',
    noteNumbers: [65, 66],
    voiceNames: ['Right-Zone Pad 1', 'Right-Zone Pad 2'],
    fingerConstraints: {
      '3,5': 'L-Ix',  // Force left index on right-territory pad
      '3,6': 'L-Md',  // Force left middle on right-territory pad
    },
  },

  // ==========================================================================
  // F1–F6: Temporal Sequence Layout Violation Demos
  // ==========================================================================

  {
    id: 'F1',
    name: 'F1: Wide Layout – Excessive Hand Span',
    description: 'Four voices spread across the full grid width. Interleaved events force hand traversal across an impossible single-hand span.',
    pads: [{ row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 5 }, { row: 3, col: 7 }],
    hand: 'right',
    noteNumbers: [60, 62, 65, 67],
    voiceNames: ['Far Left', 'Inner Left', 'Inner Right', 'Far Right'],
    // Interleaved: left-right-left-right pattern forcing full-width traversal
    eventTimesPerVoice: [
      [0.0, 1.0, 2.0, 3.0],          // Far Left: beats 1, 3, 5, 7
      [0.5, 1.5, 2.5, 3.5],          // Inner Left: beats 2, 4, 6, 8
      [0.25, 1.25, 2.25, 3.25],      // Inner Right: offbeats
      [0.75, 1.75, 2.75, 3.75],      // Far Right: offbeats
    ],
  },
  {
    id: 'F2',
    name: 'F2: Crossed Topology – Thumb Over Fingers',
    description: 'Three voices arranged so a naive right-hand grip puts the thumb above other fingers. Alternating sequence forces repeated grip formation.',
    pads: [{ row: 5, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }],
    hand: 'right',
    noteNumbers: [75, 64, 65],
    voiceNames: ['High Pad', 'Mid Pad', 'Low Pad'],
    // Alternating pattern: high-mid-low-high-mid-low
    eventTimesPerVoice: [
      [0.0, 0.75, 1.5, 2.25, 3.0],   // High pad (row 5): every 0.75s
      [0.25, 1.0, 1.75, 2.5, 3.25],  // Mid pad (row 3): offset
      [0.5, 1.25, 2.0, 2.75, 3.5],   // Low pad (row 3): offset
    ],
  },
  {
    id: 'F3',
    name: 'F3: Speed Violation – Fast Distant Transitions',
    description: 'Two voices 7 rows apart with rapid alternation (50ms gaps). Transition speed exceeds physiological MAX_HAND_SPEED.',
    pads: [{ row: 0, col: 3 }, { row: 7, col: 3 }],
    hand: 'right',
    noteNumbers: [39, 95],
    voiceNames: ['Bottom', 'Top'],
    // Rapid alternation: 50ms between events on pads 7 rows apart
    eventTimesPerVoice: [
      [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
      [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
    ],
  },
  {
    id: 'F4',
    name: 'F4: Finger Bottleneck – Single Finger Overuse',
    description: 'Five voices in a tight cluster. One voice has 4× the events of others, forcing finger overuse in a single hand zone.',
    pads: [
      { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 },
      { row: 4, col: 4 }, { row: 4, col: 5 },
    ],
    hand: 'right',
    noteNumbers: [64, 65, 66, 72, 73],
    voiceNames: ['Melody', 'Harmony 1', 'Harmony 2', 'Bass 1', 'Bass 2'],
    // Melody (voice 0) plays 4× as often as accompaniment
    eventTimesPerVoice: [
      [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75],
      [0.0, 1.0, 2.0, 3.0],
      [0.5, 1.5, 2.5, 3.5],
      [0.0, 1.0, 2.0, 3.0],
      [0.5, 1.5, 2.5, 3.5],
    ],
  },
  {
    id: 'F5',
    name: 'F5: Forced Split Hand – Distant Clusters',
    description: 'Four voices split into two distant clusters (cols 0–1 and cols 6–7). Simultaneous events require both hands.',
    pads: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 6 }, { row: 3, col: 7 }],
    hand: 'right',
    noteNumbers: [60, 61, 66, 67],
    voiceNames: ['Left Cluster A', 'Left Cluster B', 'Right Cluster A', 'Right Cluster B'],
    // Simultaneous events across clusters force split-hand
    eventTimesPerVoice: [
      [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
      [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
      [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
      [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
    ],
  },
  {
    id: 'F6',
    name: 'F6: Comfortable Baseline – Natural Layout',
    description: 'Four voices in a compact right-hand cluster. Well-spaced events at moderate tempo. Positive control — should produce low difficulty.',
    pads: [{ row: 3, col: 4 }, { row: 3, col: 5 }, { row: 4, col: 4 }, { row: 4, col: 5 }],
    hand: 'right',
    noteNumbers: [64, 65, 72, 73],
    voiceNames: ['Voice A', 'Voice B', 'Voice C', 'Voice D'],
    // Well-spaced sequential pattern
    eventTimesPerVoice: [
      [0.0, 1.0, 2.0, 3.0],
      [0.25, 1.25, 2.25, 3.25],
      [0.5, 1.5, 2.5, 3.5],
      [0.75, 1.75, 2.75, 3.75],
    ],
  },
];

// ============================================================================
// Demo Project Builder
// ============================================================================

function buildFeasibilityDemo(scenario: FeasibilityDemoScenario): ProjectState {
  const base = createEmptyProjectState();
  const projectId = `feasibility-${scenario.id.toLowerCase()}`;

  // Build sound streams — each pad gets a stream with test events
  const soundStreams: SoundStream[] = scenario.noteNumbers.map((noteNum, i) => {
    const voiceTimes = scenario.eventTimesPerVoice?.[i];
    const events: SoundEvent[] = voiceTimes
      ? voiceTimes.map(t => ({
          startTime: t,
          duration: 0.25,
          velocity: 100,
          eventKey: `${Math.round(t * 10000)}:${noteNum}:1:1`,
        }))
      : Array.from({ length: 4 }, (_, t) => ({
          startTime: t * 0.5,
          duration: 0.25,
          velocity: 100,
          eventKey: `${Math.round(t * 0.5 * 10000)}:${noteNum}:1:1`,
        }));

    return {
      id: `${projectId}-stream-${noteNum}`,
      name: scenario.voiceNames[i] ?? `Voice ${i + 1}`,
      color: VOICE_COLORS[i % VOICE_COLORS.length],
      originalMidiNote: noteNum,
      events,
      muted: false,
    };
  });

  // Build layout with pre-assigned pads
  const padToVoice: Record<string, Voice> = {};
  for (let i = 0; i < scenario.pads.length; i++) {
    const pad = scenario.pads[i];
    const padKey = `${pad.row},${pad.col}`;
    const noteNum = scenario.noteNumbers[i];
    const stream = soundStreams[i];

    padToVoice[padKey] = {
      id: stream.id,
      name: stream.name,
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: noteNum,
      color: stream.color,
    };
  }

  const layout: Layout = {
    id: `${projectId}-layout`,
    name: 'Feasibility Test Layout',
    padToVoice,
    fingerConstraints: scenario.fingerConstraints ?? {},
    scoreCache: null,
    layoutMode: 'manual',
  };

  return {
    ...base,
    id: projectId,
    name: scenario.name,
    isDemo: true,
    soundStreams,
    tempo: 120,
    layouts: [layout],
    activeLayoutId: layout.id,
  };
}

// ============================================================================
// Public API
// ============================================================================

/** All feasibility demo project generators. */
const FEASIBILITY_DEMOS = SCENARIOS.map(s => () => buildFeasibilityDemo(s));

/** Get all feasibility demo projects. Regenerated fresh on each call. */
export function getFeasibilityDemos(): ProjectState[] {
  return FEASIBILITY_DEMOS.map(gen => gen());
}

/** Get a specific feasibility demo by scenario ID (e.g., "A1"). */
export function getFeasibilityDemo(scenarioId: string): ProjectState | null {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return null;
  return buildFeasibilityDemo(scenario);
}
