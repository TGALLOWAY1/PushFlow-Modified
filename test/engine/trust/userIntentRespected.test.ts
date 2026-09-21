/**
 * The user's explicit decisions must survive generation.
 *
 * These cover the settings a person deliberately makes — a pinned pad, a chosen
 * finger, a muted sound — each of which was previously discarded somewhere
 * between the panel they set it in and the layout they got back.
 */

import { describe, it, expect } from 'vitest';
import { generateGreedyCandidates } from '../../../src/engine/optimization/greedyCandidatePipeline';
import { buildFingerAssignmentFromLayout } from '../../../src/engine/optimization/greedyEvaluation';
import { buildSoundStreamsFromLanes } from '../../../src/ui/state/lanesToStreams';
import { projectReducer, createEmptyProjectState } from '../../../src/ui/state/projectState';
import { createEmptyLayout, type Layout } from '../../../src/types/layout';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { type PerformanceLane } from '../../../src/types/performanceLane';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const voice = (id: string, midi: number) => ({
  id, name: id, sourceType: 'midi_track' as const, sourceFile: '',
  originalMidiNote: midi, color: '#444',
});

function fourSoundPerformance() {
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

async function generate(layout: Layout) {
  const performance = fourSoundPerformance();
  return generateGreedyCandidates({
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
    strategy: 'all',
    voiceHints: [],
  } as never);
}

const baseLayout = (extra: Partial<Layout> = {}): Layout => ({
  ...createEmptyLayout('L', 'L', 'active'),
  padToVoice: {
    '2,0': voice('kick', 36), '2,1': voice('snare', 37),
    '2,2': voice('hat', 38), '2,3': voice('tom', 39),
  },
  ...extra,
});

describe('generated candidates respect the user', () => {
  it('keeps a locked sound on its pad, exactly once', async () => {
    const layout = baseLayout({ placementLocks: { kick: '2,0' } });
    const { candidates } = await generate(layout);
    expect(candidates.length).toBeGreaterThan(0);

    for (const candidate of candidates) {
      const kickPads = Object.entries(candidate.layout.padToVoice)
        .filter(([, v]) => v.id === 'kick')
        .map(([pad]) => pad);
      // Locks are the one hard placement guarantee the product makes, and a lock
      // key that missed meant the sound was placed a SECOND time elsewhere.
      expect(kickPads).toEqual(['2,0']);
    }
  }, 120_000);

  it('honours a per-sound finger preference through optimization', async () => {
    const layout = baseLayout({ fingerConstraints: { '2,1': 'L5' } });
    const { candidates } = await generate(layout);
    expect(candidates.length).toBeGreaterThan(0);

    for (const candidate of candidates) {
      const snarePad = Object.entries(candidate.layout.padToVoice)
        .find(([, v]) => v.id === 'snare')?.[0];
      expect(snarePad).toBeDefined();
      const owner = candidate.executionPlan.padFingerOwnership?.[snarePad!];
      // The preference belongs to the SOUND, so it must follow it wherever the
      // optimizer moves it — including across a pad swap.
      expect(owner).toEqual({ hand: 'left', finger: 'pinky' });
    }
  }, 120_000);

  it('offers the best candidate first', async () => {
    const { candidates } = await generate(baseLayout());
    expect(candidates.length).toBeGreaterThan(0);

    // The cards are numbered and the app applies the first automatically, so
    // generation order must not decide which one is recommended.
    const unplayable = candidates.map(c =>
      c.executionPlan.unplayableMomentCount ?? c.executionPlan.unplayableCount);
    expect([...unplayable].sort((a, b) => a - b)).toEqual(unplayable);
  }, 120_000);
});

describe('finger preferences pin the assignment', () => {
  it('gives the preferred finger to the preferred sound', () => {
    const layout = baseLayout();
    const moments = [{ notes: [{ padId: '2,0' }, { padId: '2,1' }] }];
    const assignment = buildFingerAssignmentFromLayout(layout, moments, {
      snare: { hand: 'left', finger: 'pinky' },
    });
    expect(assignment['2,1']).toEqual({ hand: 'left', finger: 'pinky' });
    expect(assignment['2,0']).not.toEqual({ hand: 'left', finger: 'pinky' });
  });
});

describe('muting a sound does not delete it', () => {
  it('keeps every lane as a stream', () => {
    const lane = (id: string, over: Partial<PerformanceLane> = {}): PerformanceLane => ({
      id, name: id, sourceFileId: 's', sourceFileName: 'f.mid', groupId: null,
      orderIndex: 0, color: '#f00', colorMode: 'inherited',
      events: [{ eventId: `${id}-1`, laneId: id, startTime: 0, duration: 0.1, velocity: 100, rawPitch: 36 }],
      isHidden: false, isMuted: false, isSolo: false, ...over,
    });
    const streams = buildSoundStreamsFromLanes([lane('a'), lane('b', { isMuted: true })]);
    // Filtering muted lanes out removed the row you would un-mute from.
    expect(streams.map(s => [s.id, s.muted])).toEqual([['a', false], ['b', true]]);
  });
});

describe('placement locks survive Discard', () => {
  it('keeps a lock made during the working session', () => {
    let state = createEmptyProjectState();
    state = { ...state, activeLayout: baseLayout() };
    state = projectReducer(state, { type: 'CREATE_WORKING_LAYOUT' });
    state = projectReducer(state, {
      type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: 'kick', padKey: '2,0' },
    });
    expect(state.workingLayout?.placementLocks.kick).toBe('2,0');

    state = projectReducer(state, { type: 'DISCARD_WORKING_LAYOUT' });
    // A lock is an explicit decision, not an exploratory edit — Discard drops the
    // pad moves, not the guarantee.
    expect(state.workingLayout).toBeNull();
    expect(state.activeLayout.placementLocks.kick).toBe('2,0');
  });
});

describe('layout identity covers what analysis depends on', () => {
  it('changes when a placement lock is added', () => {
    const unlocked = baseLayout();
    const locked = baseLayout({ placementLocks: { kick: '2,0' } });
    // placementLocks is keyed by voice id, so testing it by pad key silently
    // never contributed to the hash.
    expect(hashLayout(locked)).not.toBe(hashLayout(unlocked));
  });

  it('changes when a finger constraint is added', () => {
    expect(hashLayout(baseLayout({ fingerConstraints: { '2,1': 'L5' } })))
      .not.toBe(hashLayout(baseLayout()));
  });
});
