/**
 * Placement locks are honoured by every optimization method (S1a.3, T11;
 * roadmap P1a-5). Locked Sounds are pre-placed, the locks travel through
 * seeding, compaction and mutation, and a candidate that moved a locked Sound
 * is dropped with a stated reason.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type Performance } from '../../../src/types/performance';
import { type AnnealingConfig } from '../../../src/types/engineConfig';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../../src/engine/optimization/greedyCandidatePipeline';
import { createAnnealingSolver } from '../../../src/engine/optimization/annealingSolver';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const voice = (id: string, midi: number): Voice => ({
  id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444',
});

function fourSounds(): Performance {
  const ids = ['kick', 'snare', 'hat', 'tom'];
  const events = ids.flatMap((id, v) =>
    Array.from({ length: 6 }, (_, i) => ({
      noteNumber: 36 + v,
      startTime: (i * 4 + v) * 0.25,
      duration: 0.1,
      velocity: 100,
      voiceId: id,
      eventKey: `${id}-${i}`,
    })),
  ).sort((a, b) => a.startTime - b.startTime);
  return { events, tempo: 120, name: 'four' };
}

const baseLayout = (extra: Partial<Layout> = {}): Layout => ({
  id: 'L', name: 'L', role: 'active', scoreCache: null, fingerConstraints: {}, placementLocks: {},
  padToVoice: {
    '7,0': voice('kick', 36), '2,1': voice('snare', 37),
    '2,2': voice('hat', 38), '2,3': voice('tom', 39),
  },
  ...extra,
});

const LOCKS = { kick: '7,0' };

function expectLockHeld(candidates: Array<{ layout: Layout }>) {
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect(candidate.layout.padToVoice['7,0']?.id).toBe('kick');
    expect(Object.values(candidate.layout.padToVoice).filter(v => v.id === 'kick')).toHaveLength(1);
    expect(candidate.layout.placementLocks).toEqual(LOCKS);
  }
}

describe('Beam (pose0 seeding) with a lock', () => {
  it('holds the lock in every candidate and carries it', async () => {
    const layout = baseLayout({ placementLocks: LOCKS });
    const { candidates, summary } = await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
    });
    expectLockHeld(candidates);
    expect(summary?.droppedForLockViolations).toBe(0);
  }, 60_000);

  it('places an unplaced Sound by its hint, never by a pitch name', async () => {
    const layout = baseLayout({ padToVoice: { '7,0': voice('kick', 36) }, placementLocks: LOCKS });
    const { candidates } = await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 1,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      voiceHints: [
        { id: 'snare', name: 'Rim', color: '#00f', originalMidiNote: 37 },
        { id: 'hat', name: 'Hat', color: '#0f0', originalMidiNote: 38 },
        { id: 'tom', name: 'Tom', color: '#f0f', originalMidiNote: 39 },
      ],
    });
    expectLockHeld(candidates);
    const names = Object.values(candidates[0].layout.padToVoice).map(v => v.name).sort();
    expect(names).toEqual(['Hat', 'Rim', 'Tom', 'kick']);
  }, 60_000);
});

describe('Beam (baseline and compact strategies) with a lock', () => {
  it('keeps the locked Sound on its pad when compacting', async () => {
    const layout = baseLayout({ placementLocks: LOCKS });
    const { candidates } = await generateCandidates(fourSounds(), null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
    });
    expectLockHeld(candidates);
    // The compact strategies still rearrange the unlocked Sounds.
    const strategies = candidates.map(c => c.metadata.strategy);
    expect(strategies).toContain('baseline');
    expect(strategies.some(s => s.startsWith('compact'))).toBe(true);
  }, 60_000);
});

describe('Annealing with a lock', () => {
  const quick: AnnealingConfig = {
    iterations: 60, initialTemp: 500, coolingRate: 0.97, restartCount: 1,
    fastBeamWidth: 6, finalBeamWidth: 10, useZoneTransfer: true,
  };

  it('never moves the locked Sound and keeps the lock on the best layout', async () => {
    const layout = baseLayout({ placementLocks: LOCKS });
    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout, seed: 7, annealingConfig: quick,
    });
    const plan = await solver.solve(fourSounds(), DEFAULT_ENGINE_CONFIG);
    const best = solver.getBestLayout()!;
    expect(best.padToVoice['7,0']?.id).toBe('kick');
    expect(best.placementLocks).toEqual(LOCKS);
    expect(plan.annealingTrace?.length).toBe(quick.iterations * (quick.restartCount + 1));
    expect(plan.metadata?.solverTelemetry?.totalAccepted).toBeGreaterThan(0);
  }, 60_000);

  it('evaluates every layout under the user\'s finger preferences', async () => {
    const layout = baseLayout({ placementLocks: LOCKS });
    const performance = fourSounds();
    const preferences: Record<string, { hand: 'left' | 'right'; finger: 'pinky' }> = {};
    for (const event of performance.events) {
      if (event.voiceId === 'kick') preferences[event.eventKey!] = { hand: 'left', finger: 'pinky' };
    }
    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout, seed: 7, annealingConfig: quick,
    });
    const plan = await solver.solve(performance, DEFAULT_ENGINE_CONFIG, preferences);
    const kickStrikes = plan.fingerAssignments.filter(a => a.voiceId === 'kick');
    expect(kickStrikes.length).toBe(6);
    expect(kickStrikes.every(a => a.assignedHand === 'left' && a.finger === 'pinky')).toBe(true);
  }, 60_000);
});

describe('post-validation', () => {
  // Two Sounds locked to the same pad cannot both be honoured, so every
  // candidate breaks a lock and is dropped, and the summary says how many.
  const conflicting = { kick: '7,0', snare: '7,0' };

  it('drops beam candidates that break a lock and counts them', async () => {
    const layout = baseLayout({ placementLocks: conflicting });
    const { candidates, summary } = await generateCandidates(fourSounds(), createDefaultPose0(), {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
    });
    expect(candidates).toEqual([]);
    expect(summary).toMatchObject({ candidatesGenerated: 3, candidatesReturned: 0, droppedForLockViolations: 3 });
  }, 60_000);

  it('drops greedy candidates that break a lock and counts them', async () => {
    const layout = baseLayout({ placementLocks: conflicting });
    const { candidates, summary } = await generateGreedyCandidates({
      performance: fourSounds(),
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      evaluationConfig: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
      constraints: { softPreferences: {} },
      baseLayout: layout,
      activeLayout: layout,
      sections: [],
      count: 3,
      strategy: 'natural-pose',
      voiceHints: [],
    });
    expect(candidates).toEqual([]);
    expect(summary?.droppedForLockViolations).toBeGreaterThan(0);
  }, 120_000);
});
