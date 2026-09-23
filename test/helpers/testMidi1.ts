/**
 * TEST MIDI 1 through the app's own paths.
 *
 * Sounds come from the import path (parseMidiProject → buildLanesFromMidiProject
 * → IMPORT_LANES), so their ids are the ids the app would create, and nothing
 * here is keyed by MIDI pitch. The starting layout is the user's one-click
 * "Suggest a starting layout" (SUGGEST_STARTING_LAYOUT). The generate helpers
 * call the engine exactly as useAutoAnalysis.generateFull does for each method.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseMidiProject } from '../../src/import/midiImport';
import { buildLanesFromMidiProject } from '../../src/import/midiToLanes';
import {
  createEmptyProjectState,
  projectReducer,
  getActivePerformance,
  getDisplayedLayout,
  type ProjectState,
} from '../../src/ui/state/projectState';
import { generateCandidates } from '../../src/engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../src/engine/optimization/greedyCandidatePipeline';
import { createDefaultPose0 } from '../../src/engine/prior/naturalHandPose';
import { getNeutralHandCenters } from '../../src/engine/prior/handPose';
import { type OptimizationMode } from '../../src/types/engineConfig';
import { type CandidateSolution } from '../../src/types/candidateSolution';
import { type Layout } from '../../src/types/layout';
import { countHandUsage } from './testHelpers';

export const TEST_MIDI_1_PATH = path.resolve(__dirname, '../fixtures/midi/TEST MIDI 1.mid');

/** The pad the lock cases pin a Sound to (roadmap P0: "a lock at [7,0]"). */
export const LOCK_PAD = '7,0';

/** A fresh project with TEST MIDI 1 imported and nothing placed. */
export async function importTestMidi1(): Promise<ProjectState> {
  const buffer = fs.readFileSync(TEST_MIDI_1_PATH);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const fileName = path.basename(TEST_MIDI_1_PATH);
  const projectData = await parseMidiProject(arrayBuffer, fileName);
  const { lanes, sourceFile } = buildLanesFromMidiProject(projectData, fileName, {
    currentMaxOrder: -1,
    color: '#f59e0b',
  });
  let state = createEmptyProjectState();
  state = projectReducer(state, { type: 'IMPORT_LANES', payload: { lanes, sourceFile } });
  if (projectData.performance.tempo) {
    state = projectReducer(state, { type: 'SET_TEMPO', payload: projectData.performance.tempo });
  }
  return state;
}

/** TEST MIDI 1 imported, then "Suggest a starting layout". */
export async function suggestedTestMidi1(): Promise<ProjectState> {
  const state = await importTestMidi1();
  return projectReducer(state, { type: 'SUGGEST_STARTING_LAYOUT' });
}

/** Moves the busiest Sound to [7,0] and locks it there, through the reducer. Returns its id. */
export function lockBusiestSoundAt7_0(state: ProjectState): { state: ProjectState; lockedId: string } {
  const busiest = [...state.soundStreams].sort((a, b) => b.events.length - a.events.length)[0];
  let next = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: LOCK_PAD, stream: busiest } });
  next = projectReducer(next, { type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: busiest.id, padKey: LOCK_PAD } });
  return { state: next, lockedId: busiest.id };
}

/** useAutoAnalysis.generateFull, greedy branch. */
export async function generateGreedyAsApp(state: ProjectState): Promise<CandidateSolution[]> {
  const performance = getActivePerformance(state);
  const layout = getDisplayedLayout(state)!;
  const result = await generateGreedyCandidates({
    performance,
    instrumentConfig: state.instrumentConfig,
    engineConfig: state.engineConfig,
    evaluationConfig: {
      restingPose: state.engineConfig.restingPose,
      stiffness: state.engineConfig.stiffness,
      instrumentConfig: state.instrumentConfig,
      neutralHandCenters: getNeutralHandCenters(layout, state.instrumentConfig),
    },
    costToggles: state.costToggles,
    baseLayout: layout,
    activeLayout: layout,
    sections: state.sections,
    count: 4,
    strategy: state.greedyStrategy,
    voiceHints: state.soundStreams,
  });
  return result.candidates;
}

/**
 * useAutoAnalysis.generateFull, beam/annealing branch. The app routes Beam, and
 * Annealing at every intensity, here; mode 'fast' is the default (Beam, and
 * Annealing "Quick"), 'deep' is Annealing "Thorough".
 */
export async function generateBeamAnnealingAsApp(
  state: ProjectState,
  mode: OptimizationMode,
): Promise<CandidateSolution[]> {
  const performance = getActivePerformance(state);
  const layout = getDisplayedLayout(state)!;
  const result = await generateCandidates(performance, createDefaultPose0(), {
    count: 3,
    optimizationMode: mode,
    engineConfig: state.engineConfig,
    instrumentConfig: state.instrumentConfig,
    sections: state.sections,
    baseLayout: layout,
    activeLayout: layout,
  });
  return result.candidates;
}

export function unplayableCount(candidate: CandidateSolution): number {
  return countHandUsage(candidate.executionPlan).unplayable;
}

/**
 * An id-free summary of a candidate for snapshots: Sound ids are random per
 * import, so pads are named by Sound name ("Test MIDI 1 3").
 */
export function candidateSnapshot(state: ProjectState, candidate: CandidateSolution) {
  const nameById = new Map(state.soundStreams.map(s => [s.id, s.name]));
  const usage = countHandUsage(candidate.executionPlan);
  return {
    strategy: candidate.metadata.strategy,
    seed: candidate.metadata.seed,
    pads: padsByName(candidate.layout, nameById),
    left: usage.left,
    right: usage.right,
    unplayable: usage.unplayable,
    score: Number(candidate.executionPlan.score.toFixed(4)),
  };
}

function padsByName(layout: Layout, nameById: Map<string, string>): string[] {
  return Object.entries(layout.padToVoice)
    .map(([pad, voice]) => `${pad} ${nameById.get(voice.id) ?? `unknown:${voice.name}`}`)
    .sort();
}
