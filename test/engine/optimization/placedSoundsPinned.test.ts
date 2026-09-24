/**
 * Generate never removes an already-placed Sound (S1a.4, T15 slice; roadmap
 * P1a-9). A placed Sound with no events in the performance (a muted Sound) is
 * pinned: every method keeps it on its pad in every candidate, and no lock is
 * added for it. Pins ride through seeding, compaction, mutation and
 * hill-climbing as locks, then leave the candidate's placementLocks again.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type Performance } from '../../../src/types/performance';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import { generateGreedyCandidates } from '../../../src/engine/optimization/greedyCandidatePipeline';
import {
  pinnedPlacements,
  pinsToHonour,
  fixedPlacements,
  withoutPins,
  describePinnedPlacements,
} from '../../../src/engine/mapping/placementLocks';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { checkPlanFreshness } from '../../../src/engine/evaluation/executionPlanValidation';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const voice = (id: string, midi: number): Voice => ({
  id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444',
});

/** Four Sounds, six strikes each, minus the muted ones (whose events are not in the performance). */
function performanceWithout(muted: string[]): Performance {
  const ids = ['kick', 'snare', 'hat', 'tom'].filter(id => !muted.includes(id));
  const events = ids.flatMap(id =>
    Array.from({ length: 6 }, (_, i) => ({
      noteNumber: 36 + ['kick', 'snare', 'hat', 'tom'].indexOf(id),
      startTime: (i * 4 + ['kick', 'snare', 'hat', 'tom'].indexOf(id)) * 0.25,
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

const TOM_PAD = '2,3';

function expectTomPinned(candidates: Array<{ layout: Layout; executionPlan: ExecutionPlanResult; metadata: { strategy: string } }>, locks: Record<string, string> = {}) {
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect({ strategy: candidate.metadata.strategy, onPad: candidate.layout.padToVoice[TOM_PAD]?.id })
      .toEqual({ strategy: candidate.metadata.strategy, onPad: 'tom' });
    expect(Object.values(candidate.layout.padToVoice).filter(v => v.id === 'tom')).toHaveLength(1);
    // A pin is not a lock the user set.
    expect(candidate.layout.placementLocks).toEqual(locks);
    // And the plan still describes the cleaned layout.
    expect(checkPlanFreshness(candidate.executionPlan, candidate.layout).isFresh).toBe(true);
  }
}

describe('pinnedPlacements', () => {
  it('pins every placed Sound whose events are not in the performance', () => {
    expect(pinnedPlacements(baseLayout(), performanceWithout(['tom']))).toEqual({ tom: TOM_PAD });
    expect(pinnedPlacements(baseLayout(), performanceWithout(['tom', 'hat']))).toEqual({ hat: '2,2', tom: TOM_PAD });
    expect(pinnedPlacements(baseLayout(), performanceWithout([]))).toEqual({});
    expect(pinnedPlacements(null, performanceWithout(['tom']))).toEqual({});
  });

  it('matches a layout Voice by pitch only for an event with no Sound', () => {
    const pitchOnly: Performance = {
      events: [{ noteNumber: 39, startTime: 0, duration: 0.1, velocity: 100, eventKey: 'p-0' }],
      tempo: 120,
      name: 'pitch',
    };
    // Tom (pitch 39) is played by the Sound-less event; the others are not.
    expect(pinnedPlacements(baseLayout(), pitchOnly)).toEqual({ kick: '7,0', snare: '2,1', hat: '2,2' });
    // With a Sound on the event, pitch decides nothing (invariant 5).
    const sounded: Performance = { ...pitchOnly, events: [{ ...pitchOnly.events[0], voiceId: 'kick' }] };
    expect(pinnedPlacements(baseLayout(), sounded)).toEqual({ snare: '2,1', hat: '2,2', tom: TOM_PAD });
  });

  it('pinsToHonour drops unknown Sounds and Sounds the user locked; locks win in fixedPlacements', () => {
    const known = new Set(['kick', 'snare', 'hat', 'tom']);
    const locks = { kick: '7,0' };
    expect(pinsToHonour({ kick: '0,0', tom: TOM_PAD, ghost: '5,5' }, locks, known)).toEqual({ tom: TOM_PAD });
    expect(fixedPlacements(locks, { kick: '0,0', tom: TOM_PAD })).toEqual({ kick: '7,0', tom: TOM_PAD });
  });

  it('withoutPins strips only the pins, keeps the locks and re-binds the plan', () => {
    const layout = baseLayout({ placementLocks: { kick: '7,0', tom: TOM_PAD } });
    const plan = {
      layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'active' as const },
      metadata: { layoutIdUsed: layout.id, layoutHashUsed: hashLayout(layout) },
    };
    const cleaned = withoutPins(layout, plan, { tom: TOM_PAD });
    expect(cleaned.layout.placementLocks).toEqual({ kick: '7,0' });
    expect(cleaned.layout.padToVoice).toBe(layout.padToVoice);
    expect(cleaned.executionPlan.layoutBinding.layoutHash).toBe(hashLayout(cleaned.layout));
    expect(cleaned.executionPlan.metadata.layoutHashUsed).toBe(hashLayout(cleaned.layout));
    expect(cleaned.executionPlan.layoutBinding.layoutHash).not.toBe(plan.layoutBinding.layoutHash);
    // Nothing to strip: the very same objects come back.
    const untouched = withoutPins(baseLayout({ placementLocks: { kick: '7,0' } }), plan, { tom: TOM_PAD });
    expect(untouched.executionPlan).toBe(plan);
  });

  it('describes the kept Sounds for the candidate list', () => {
    expect(describePinnedPlacements(0)).toBe('');
    expect(describePinnedPlacements(1)).toBe('1 muted Sound kept its pad in every candidate.');
    expect(describePinnedPlacements(2)).toBe('2 muted Sounds kept their pads in every candidate.');
  });
});

describe('Beam (pose0 seeding) with a muted, placed Sound', () => {
  it('keeps it on its pad in every candidate, without a lock, and says so in the summary', async () => {
    const layout = baseLayout();
    const performance = performanceWithout(['tom']);
    const { candidates, summary } = await generateCandidates(performance, createDefaultPose0(), {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates);
    expect(summary).toMatchObject({ pinnedPlacements: 1, droppedForLockViolations: 0 });
    // The other Sounds are still placed by the seed.
    for (const candidate of candidates) {
      expect(Object.values(candidate.layout.padToVoice).map(v => v.id).sort()).toEqual(['hat', 'kick', 'snare', 'tom']);
    }
  }, 60_000);

  it('honours a lock and a pin together, carrying only the lock', async () => {
    const layout = baseLayout({ placementLocks: { kick: '7,0' } });
    const performance = performanceWithout(['tom']);
    const { candidates } = await generateCandidates(performance, createDefaultPose0(), {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates, { kick: '7,0' });
    for (const candidate of candidates) expect(candidate.layout.padToVoice['7,0']?.id).toBe('kick');
  }, 60_000);

  it('without pins nothing changes: the candidates are the same objects as before', async () => {
    const layout = baseLayout();
    const performance = performanceWithout([]);
    const { candidates, summary } = await generateCandidates(performance, createDefaultPose0(), {
      count: 3,
      optimizationMode: 'fast',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expect(summary?.pinnedPlacements).toBe(0);
    for (const candidate of candidates) expect(candidate.layout.placementLocks).toEqual({});
  }, 60_000);
});

describe('Beam (baseline and compact strategies) with a muted, placed Sound', () => {
  it('keeps it on its pad while compacting the others', async () => {
    const layout = baseLayout();
    const performance = performanceWithout(['tom']);
    const { candidates } = await generateCandidates(performance, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates);
    const strategies = candidates.map(c => c.metadata.strategy);
    expect(strategies).toContain('baseline');
    expect(strategies.some(s => s.startsWith('compact'))).toBe(true);
  }, 60_000);
});

describe('Annealing with a muted, placed Sound', () => {
  it('never moves it and carries no lock for it', async () => {
    const layout = baseLayout();
    const performance = performanceWithout(['tom']);
    const { candidates, summary } = await generateCandidates(performance, createDefaultPose0(), {
      count: 1,
      useAnnealing: true,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates);
    expect(summary?.pinnedPlacements).toBe(1);
    expect(candidates[0].executionPlan.annealingTrace?.length).toBeGreaterThan(0);
  }, 180_000);
});

describe('Greedy with a muted, placed Sound', () => {
  it('keeps it on its pad in every candidate, without a lock', async () => {
    const layout = baseLayout();
    const performance = performanceWithout(['tom']);
    const { candidates, summary } = await generateGreedyCandidates({
      performance,
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
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates);
    expect(summary?.pinnedPlacements).toBe(1);
    // The trace is still produced (CLAUDE.md: trace must stay wired).
    expect(candidates[0].iterationTrace?.length).toBeGreaterThan(0);
  }, 120_000);

  it('is reached through the unified generateCandidates API too (optimizationMethod greedy)', async () => {
    const layout = baseLayout();
    const performance = performanceWithout(['tom']);
    const { candidates, summary } = await generateCandidates(performance, createDefaultPose0(), {
      count: 2,
      optimizationMethod: 'greedy',
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      evaluationConfig: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
      baseLayout: layout,
      activeLayout: layout,
      pinnedPlacements: pinnedPlacements(layout, performance),
    });
    expectTomPinned(candidates);
    expect(summary?.pinnedPlacements).toBe(1);
  }, 180_000);
});
