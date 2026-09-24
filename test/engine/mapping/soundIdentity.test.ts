/**
 * Strict Sound identity in the engine (S1a.3, T18; roadmap P1a-6).
 *
 * An event is matched to a pad by its Sound (voiceId), never by MIDI pitch.
 * A Sound with no pad is unmapped even when another Sound shares its pitch.
 * Only an event with no Sound at all (no voiceId) is keyed by its pitch.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type Performance } from '../../../src/types/performance';
import {
  buildNoteToPadIndex,
  buildVoiceIdToPadIndex,
  resolveEventToPad,
} from '../../../src/engine/mapping/mappingResolver';
import { computeMappingCoverage } from '../../../src/engine/mapping/mappingCoverage';
import { buildVoiceMap, soundKeyOf } from '../../../src/engine/mapping/voiceMap';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { evaluatePerformance } from '../../../src/engine/evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../../../src/engine/structure/momentBuilder';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { ALL_COSTS_ENABLED } from '../../../src/types/costToggles';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

const voice = (id: string, midi: number | null, name = id): Voice => ({
  id, name, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444',
});

/** Kick A is placed; Kick B shares its pitch and has no pad. */
function sharedPitchLayout(): Layout {
  return {
    id: 'L', name: 'L', role: 'active', scoreCache: null,
    padToVoice: { '2,2': voice('kick-a', 36), '2,5': voice('hat', 42) },
    fingerConstraints: {},
    placementLocks: {},
  };
}

function sharedPitchPerformance(): Performance {
  const hits = (id: string, midi: number, times: number[]) =>
    times.map((t, i) => ({ noteNumber: midi, voiceId: id, startTime: t, duration: 0.1, velocity: 100, eventKey: `${id}-${i}` }));
  return {
    name: 'shared pitch',
    tempo: 120,
    events: [
      ...hits('kick-a', 36, [0, 1, 2]),
      ...hits('kick-b', 36, [0.5, 1.5, 2.5]),
      ...hits('hat', 42, [0.25, 0.75, 1.25, 1.75]),
    ].sort((a, b) => a.startTime - b.startTime),
  };
}

describe('resolveEventToPad', () => {
  const layout = sharedPitchLayout();
  const voiceIndex = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteIndex = buildNoteToPadIndex(layout.padToVoice);
  const config = DEFAULT_TEST_INSTRUMENT_CONFIG;

  it('resolves a placed Sound to its pad', () => {
    expect(resolveEventToPad({ noteNumber: 36, voiceId: 'kick-a' }, voiceIndex, noteIndex, config, 'strict'))
      .toEqual({ source: 'mapping', pad: { row: 2, col: 2 } });
  });

  it('leaves an unplaced Sound unmapped even when another Sound shares its pitch', () => {
    expect(resolveEventToPad({ noteNumber: 36, voiceId: 'kick-b' }, voiceIndex, noteIndex, config, 'strict'))
      .toEqual({ source: 'unmapped' });
  });

  it('never lends another Sound\'s pad in allow-fallback mode either', () => {
    const res = resolveEventToPad({ noteNumber: 36, voiceId: 'kick-b' }, voiceIndex, noteIndex, config, 'allow-fallback');
    // The chromatic preview position, not kick-a's pad.
    expect(res).toEqual({ source: 'fallback', pad: { row: 0, col: 0 } });
  });

  it('keys an event with no Sound by its pitch', () => {
    expect(resolveEventToPad({ noteNumber: 36 }, voiceIndex, noteIndex, config, 'strict'))
      .toEqual({ source: 'mapping', pad: { row: 2, col: 2 } });
  });

  it('treats a Sound whose id happens to equal its pitch as a Sound, not as a missing one', () => {
    // Absence of a Sound is stated by an undefined voiceId, never read from the id's text.
    const oddLayout: Layout = {
      ...sharedPitchLayout(),
      padToVoice: { '2,2': voice('kick-a', 36), '5,5': voice('36', 36, 'Sound named by its pitch') },
    };
    const oddVoiceIndex = buildVoiceIdToPadIndex(oddLayout.padToVoice);
    const oddNoteIndex = buildNoteToPadIndex(oddLayout.padToVoice);
    expect(resolveEventToPad({ noteNumber: 36, voiceId: '36' }, oddVoiceIndex, oddNoteIndex, config, 'strict'))
      .toEqual({ source: 'mapping', pad: { row: 5, col: 5 } });
    // Unplaced, it stays unmapped even though kick-a shares its pitch.
    expect(resolveEventToPad({ noteNumber: 36, voiceId: '36' }, voiceIndex, noteIndex, config, 'strict'))
      .toEqual({ source: 'unmapped' });
  });
});

describe('sound keys', () => {
  it('files a Sound under its voiceId and a Sound-less event under its pitch', () => {
    expect(soundKeyOf({ voiceId: 'kick-a', noteNumber: 36 })).toBe('kick-a');
    expect(soundKeyOf({ noteNumber: 36 })).toBe('36');
  });

  it('moments state whether a note has a Sound, separately from its grouping key', () => {
    const [withSound, withoutSound] = buildPerformanceMoments([
      { noteNumber: 36, voiceId: 'kick-a', startTime: 0 },
      { noteNumber: 36, startTime: 1 },
    ]).map(m => m.notes[0]);
    expect(withSound).toMatchObject({ soundId: 'kick-a', voiceId: 'kick-a' });
    expect(withoutSound).toMatchObject({ soundId: '36' });
    expect(withoutSound.voiceId).toBeUndefined();
  });

  it('builds voices by id: hints match by id only, never by pitch', () => {
    const performance = sharedPitchPerformance();
    const layout = sharedPitchLayout();
    const voices = buildVoiceMap(performance, layout, [
      { id: 'kick-b', name: 'Kick B', color: '#f00', originalMidiNote: 36 },
      { id: 'other', name: 'Other', color: '#0f0', originalMidiNote: 42 },
    ]);
    expect(voices.get('kick-a')?.name).toBe('kick-a');
    expect(voices.get('kick-b')).toMatchObject({ id: 'kick-b', name: 'Kick B', color: '#f00' });
    expect(voices.get('hat')?.id).toBe('hat');
    // A hint with only the pitch in common is not this Sound.
    const noHint = buildVoiceMap(performance, null, [{ id: 'other', name: 'Other', color: '#0f0', originalMidiNote: 36 }]);
    expect(noHint.get('kick-b')).toMatchObject({ id: 'kick-b', name: 'Sound 36' });
  });
});

describe('computeMappingCoverage', () => {
  it('counts Sounds, so a shared pitch does not hide an unplaced Sound', () => {
    const coverage = computeMappingCoverage(sharedPitchPerformance(), sharedPitchLayout());
    expect(coverage).toMatchObject({
      totalNotes: 3,
      mappedNotes: 2,
      unmappedNotes: [36],
      unmappedSoundKeys: ['kick-b'],
      mappedEventCount: 7,
      totalEventCount: 10,
    });
  });

  it('keys Sound-less events by pitch', () => {
    const performance: Performance = {
      name: 'legacy', tempo: 120,
      events: [{ noteNumber: 36, startTime: 0 }, { noteNumber: 40, startTime: 1 }],
    };
    const coverage = computeMappingCoverage(performance, sharedPitchLayout());
    expect(coverage).toMatchObject({ totalNotes: 2, mappedNotes: 1, unmappedNotes: [40], unmappedSoundKeys: ['40'] });
  });

  it('counts an unplaced Sound whose id equals its pitch as unmapped', () => {
    const performance: Performance = {
      name: 'odd id', tempo: 120,
      events: [{ noteNumber: 36, voiceId: '36', startTime: 0 }, { noteNumber: 36, voiceId: 'kick-a', startTime: 1 }],
    };
    const coverage = computeMappingCoverage(performance, sharedPitchLayout());
    expect(coverage).toMatchObject({ totalNotes: 2, mappedNotes: 1, unmappedSoundKeys: ['36'] });
  });
});

describe('P1a-6: two Sounds share a pitch and one is unplaced', () => {
  it('the beam solver leaves the unplaced Sound\'s events unmapped and plays the other', async () => {
    const performance = sharedPitchPerformance();
    const layout = sharedPitchLayout();
    const plan = await createBeamSolver({ instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG, layout })
      .solve(performance, DEFAULT_ENGINE_CONFIG);

    const byVoice = (id: string) => plan.fingerAssignments.filter(a => a.voiceId === id);
    expect(byVoice('kick-b').map(a => a.assignedHand)).toEqual(['Unplayable', 'Unplayable', 'Unplayable']);
    expect(byVoice('kick-b').every(a => a.row === undefined && a.col === undefined)).toBe(true);
    expect(byVoice('kick-a').every(a => a.assignedHand !== 'Unplayable' && a.row === 2 && a.col === 2)).toBe(true);
    expect(byVoice('hat').every(a => a.assignedHand !== 'Unplayable')).toBe(true);
    expect(plan.unplayableCount).toBe(3);
    expect(plan.metadata?.layoutCoverage).toMatchObject({ totalNotes: 3, unmappedNotesCount: 1 });
  });

  it('the canonical evaluator reports the unplaced Sound\'s moments as unmapped', () => {
    const performance = sharedPitchPerformance();
    const layout = sharedPitchLayout();
    const moments = buildPerformanceMoments(performance.events);
    const result = evaluatePerformance({
      moments,
      layout,
      padFingerAssignment: {
        '2,2': { hand: 'left', finger: 'index' },
        '2,5': { hand: 'right', finger: 'index' },
      },
      config: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
      costToggles: ALL_COSTS_ENABLED,
    });
    const unmappedMoments = result.eventCosts.filter(e => (e.violations?.unmapped ?? 0) > 0);
    expect(unmappedMoments).toHaveLength(3);
  });
});
