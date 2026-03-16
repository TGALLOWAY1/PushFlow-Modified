/**
 * Demo Projects.
 *
 * Built-in test fixtures derived from the golden test scenarios.
 * Always listed in the project library with a "Demo" badge.
 * Opening a demo creates a working copy — the original is never modified.
 */

import { type ProjectState, createEmptyProjectState, type SoundStream, type SoundEvent } from '../state/projectState';
import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type PerformanceEvent } from '../../types/performanceEvent';
import { createEmptyLayout } from '../../types/layout';
import { generateId } from '../../utils/idGenerator';
import { getFeasibilityDemos } from './feasibilityDemos';

// ============================================================================
// Helpers
// ============================================================================

const VOICE_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4',
  '#ec4899', '#f97316', '#84cc16', '#14b8a6',
];

function beatsToSeconds(beats: number, bpm: number = 120): number {
  return (beats / bpm) * 60;
}

function generateEventKey(noteNumber: number, startTime: number, ordinal: number = 1): string {
  const nominalTime = Math.round(startTime * 10000);
  return `${nominalTime}:${noteNumber}:1:${ordinal}`;
}

/**
 * Build sound streams from a Performance and a name map.
 */
function buildSoundStreams(
  performance: Performance,
  nameMap: Record<number, string>,
): SoundStream[] {
  // Group events by noteNumber
  const byNote = new Map<number, PerformanceEvent[]>();
  for (const e of performance.events) {
    const list = byNote.get(e.noteNumber) ?? [];
    list.push(e);
    byNote.set(e.noteNumber, list);
  }

  const sortedNotes = [...byNote.keys()].sort((a, b) => a - b);

  return sortedNotes.map((noteNumber, i) => {
    const events: SoundEvent[] = (byNote.get(noteNumber) ?? []).map(e => ({
      startTime: e.startTime,
      duration: e.duration ?? 0.25,
      velocity: e.velocity ?? 100,
      eventKey: e.eventKey ?? generateEventKey(noteNumber, e.startTime),
    }));

    return {
      id: `demo-stream-${noteNumber}`,
      name: nameMap[noteNumber] ?? `Note ${noteNumber}`,
      color: VOICE_COLORS[i % VOICE_COLORS.length],
      originalMidiNote: noteNumber,
      events,
      muted: false,
    };
  });
}

function makePerformance(
  notes: Array<{ noteNumber: number; startTime: number; duration?: number }>,
  name: string,
): Performance {
  const events: PerformanceEvent[] = notes.map(n => ({
    noteNumber: n.noteNumber,
    startTime: n.startTime,
    duration: n.duration ?? 0.25,
    velocity: 100,
    channel: 1,
    eventKey: generateEventKey(n.noteNumber, n.startTime),
  }));
  return { events, tempo: 120, name };
}

const DEFAULT_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'demo-inst',
  name: 'Push 3',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

function buildDemoProject(
  id: string,
  name: string,
  performance: Performance,
  nameMap: Record<number, string>,
): ProjectState {
  const base = createEmptyProjectState();

  return {
    ...base,
    id,
    name,
    isDemo: true,
    soundStreams: buildSoundStreams(performance, nameMap),
    tempo: performance.tempo ?? 120,
    instrumentConfig: DEFAULT_INSTRUMENT_CONFIG,
    activeLayout: createEmptyLayout(`${id}-layout`, 'Default', 'active'),
  };
}

// ============================================================================
// Scenario Generators
// ============================================================================

function createTwoNoteAlternation(): ProjectState {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let i = 0; i < 16; i++) {
    notes.push({
      noteNumber: i % 2 === 0 ? 36 : 38,
      startTime: i * beatsToSeconds(0.5),
    });
  }
  return buildDemoProject(
    'demo-two-note',
    'Two-Note Alternation',
    makePerformance(notes, 'Two-Note Alternation'),
    { 36: 'Kick', 38: 'Snare' },
  );
}

function createFastAlternation(): ProjectState {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let i = 0; i < 16; i++) {
    notes.push({
      noteNumber: i % 2 === 0 ? 36 : 38,
      startTime: i * beatsToSeconds(0.25),
    });
  }
  return buildDemoProject(
    'demo-fast-alt',
    'Fast Alternation',
    makePerformance(notes, 'Fast Alternation'),
    { 36: 'Kick', 38: 'Snare' },
  );
}

function createThreeNotePhrase(): ProjectState {
  const phrase = [36, 38, 42];
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let rep = 0; rep < 4; rep++) {
    for (let i = 0; i < phrase.length; i++) {
      notes.push({
        noteNumber: phrase[i],
        startTime: (rep * phrase.length + i) * beatsToSeconds(0.5),
      });
    }
  }
  return buildDemoProject(
    'demo-three-note',
    'Three-Note Phrase',
    makePerformance(notes, 'Three-Note Phrase'),
    { 36: 'Kick', 38: 'Snare', 42: 'Closed HH' },
  );
}

function createHandSplit(): ProjectState {
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (let bar = 0; bar < 4; bar++) {
    const barTime = bar * beatsToSeconds(2);
    // Low cluster
    notes.push({ noteNumber: 36, startTime: barTime });
    notes.push({ noteNumber: 38, startTime: barTime });
    // High cluster
    notes.push({ noteNumber: 45, startTime: barTime + beatsToSeconds(1) });
    notes.push({ noteNumber: 47, startTime: barTime + beatsToSeconds(1) });
  }
  return buildDemoProject(
    'demo-hand-split',
    'Hand Split',
    makePerformance(notes, 'Hand Split'),
    { 36: 'Kick', 38: 'Snare', 45: 'Mid Tom', 47: 'Mid Tom 2' },
  );
}

function createSimultaneousHits(): ProjectState {
  const groups: Array<{ time: number; noteNumbers: number[] }> = [
    { time: 0.0, noteNumbers: [36, 42] },
    { time: 0.5, noteNumbers: [38] },
    { time: 1.0, noteNumbers: [36, 38, 42] },
    { time: 1.5, noteNumbers: [36, 42] },
    { time: 2.0, noteNumbers: [38] },
    { time: 2.5, noteNumbers: [36, 38, 42] },
  ];
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (const g of groups) {
    for (const n of g.noteNumbers) {
      notes.push({ noteNumber: n, startTime: g.time });
    }
  }
  return buildDemoProject(
    'demo-simultaneous',
    'Simultaneous Hits',
    makePerformance(notes, 'Simultaneous Hits'),
    { 36: 'Kick', 38: 'Snare', 42: 'Closed HH' },
  );
}

function createDrumGroove(): ProjectState {
  const groups: Array<{ time: number; noteNumbers: number[] }> = [];
  for (let bar = 0; bar < 2; bar++) {
    const o = bar * beatsToSeconds(4);
    groups.push({ time: o, noteNumbers: [36, 42] });
    groups.push({ time: o + beatsToSeconds(0.5), noteNumbers: [42] });
    groups.push({ time: o + beatsToSeconds(1), noteNumbers: [38, 42] });
    groups.push({ time: o + beatsToSeconds(1.5), noteNumbers: [42] });
    groups.push({ time: o + beatsToSeconds(2), noteNumbers: [36, 42] });
    groups.push({ time: o + beatsToSeconds(2.5), noteNumbers: [42, 46] });
    groups.push({ time: o + beatsToSeconds(3), noteNumbers: [38, 42] });
    groups.push({ time: o + beatsToSeconds(3.5), noteNumbers: [42] });
  }
  const notes: Array<{ noteNumber: number; startTime: number }> = [];
  for (const g of groups) {
    for (const n of g.noteNumbers) {
      notes.push({ noteNumber: n, startTime: g.time });
    }
  }
  return buildDemoProject(
    'demo-drum-groove',
    'Simple Drum Groove',
    makePerformance(notes, 'Simple Drum Groove'),
    { 36: 'Kick', 38: 'Snare', 42: 'Closed HH', 46: 'Open HH' },
  );
}

// ============================================================================
// Public API
// ============================================================================

/** All demo project definitions. */
const DEMO_GENERATORS: Array<() => ProjectState> = [
  createTwoNoteAlternation,
  createFastAlternation,
  createThreeNotePhrase,
  createHandSplit,
  createSimultaneousHits,
  createDrumGroove,
];

/** Get all demo projects (including feasibility demos). Regenerated fresh on each call. */
export function getDemoProjects(): ProjectState[] {
  return [
    ...DEMO_GENERATORS.map(gen => gen()),
    ...getFeasibilityDemos(),
  ];
}

/** Create a working copy of a demo project with a unique ID. */
export function createDemoCopy(demo: ProjectState): ProjectState {
  const now = new Date().toISOString();
  return {
    ...demo,
    id: generateId('proj'),
    createdAt: now,
    updatedAt: now,
    isDemo: true,
  };
}
