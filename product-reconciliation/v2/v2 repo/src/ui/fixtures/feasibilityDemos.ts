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

  const activeLayout: Layout = {
    id: `${projectId}-layout`,
    name: 'Feasibility Test Layout',
    padToVoice,
    fingerConstraints: scenario.fingerConstraints ?? {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'manual',
    role: 'active',
  };

  return {
    ...base,
    id: projectId,
    name: scenario.name,
    isDemo: true,
    soundStreams,
    tempo: 120,
    activeLayout,
  };
}

// ============================================================================
// Public API
// ============================================================================

/** Get a specific feasibility demo by scenario ID (e.g., "A1"). */
export function getFeasibilityDemo(scenarioId: string): ProjectState | null {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return null;
  return buildFeasibilityDemo(scenario);
}
