/**
 * S3.2 · clean names (T32): layouts store a base name plus provenance, and
 * labels are built from role and base name.
 *
 * - layoutLabel: the one display-label helper ("Draft of Default").
 * - The reducers never write a role word into a name: the draft, a
 *   suggestion, an applied candidate, a loaded variant and the Active Layout
 *   a Promote replaces each keep a clean name and say where they came from in
 *   provenance.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  FALLBACK_LAYOUT_NAME,
  layoutLabel,
  legacyRoleWords,
  withoutLegacyRoleWords,
} from '../../../src/ui/state/layoutLabels';
import { suggestVariantName, variantBaseName, variantStamp } from '../../../src/ui/state/variantNames';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(() => { vi.useRealTimers(); });

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);
const layoutOf = (name: string, role: Layout['role'], provenance?: Layout['provenance']) => ({ name, role, provenance });

describe('layoutLabel: the name a surface shows, from role and base name', () => {
  it('a draft reads "Draft of <base>"; Active, variants and candidates read their base name', () => {
    expect(layoutLabel(layoutOf('Default', 'working'))).toBe('Draft of Default');
    expect(layoutLabel(layoutOf('Default', 'active'))).toBe('Default');
    expect(layoutLabel(layoutOf('Wide hands', 'variant'))).toBe('Wide hands');
    expect(layoutLabel(layoutOf('Coordination-Optimized', 'working'), { role: 'candidate' })).toBe('Coordination-Optimized');
    // A recovered draft is stored as a variant; its provenance makes it a draft again.
    expect(layoutLabel(layoutOf('Default', 'variant', 'recovered'))).toBe('Draft of Default');
  });

  it('withRole leads with the role where no chip or badge says it', () => {
    expect(layoutLabel(layoutOf('Default', 'active'), { withRole: true })).toBe('Active: Default');
    expect(layoutLabel(layoutOf('Default', 'working'), { withRole: true })).toBe('Draft of Default');
    expect(layoutLabel(layoutOf('Wide hands', 'variant'), { withRole: true })).toBe('Saved variant: Wide hands');
    expect(layoutLabel(layoutOf('Coordination', 'working'), { role: 'candidate', withRole: true })).toBe('Candidate: Coordination');
    expect(layoutLabel(layoutOf('Default', 'variant', 'recovered'), { withRole: true })).toBe('Recovered draft of Default');
  });

  it('the role it is shown in wins over its own; a blank name reads as the fallback', () => {
    expect(layoutLabel(layoutOf('Default', 'variant', 'recovered'), { role: 'working' })).toBe('Draft of Default');
    expect(layoutLabel(layoutOf('  ', 'working'))).toBe(`Draft of ${FALLBACK_LAYOUT_NAME}`);
  });
});

describe('legacy role words (what names carried before schema 5)', () => {
  it('finds them in order, in any mix and repeated', () => {
    expect(legacyRoleWords('Default (draft) (suggested) (draft)')).toEqual(['draft', 'suggested', 'draft']);
    expect(legacyRoleWords('Default (replaced 9/24/2026)')).toEqual(['replaced']);
    expect(legacyRoleWords('Default (draft) (replaced 24.9.2026) (replaced)')).toEqual(['draft', 'replaced', 'replaced']);
    expect(legacyRoleWords('Wide hands')).toEqual([]);
  });

  it('takes them out anywhere and never leaves an empty name, but leaves other words alone', () => {
    expect(withoutLegacyRoleWords('Default (draft) (draft)')).toBe('Default');
    expect(withoutLegacyRoleWords('Default (suggested)')).toBe('Default');
    expect(withoutLegacyRoleWords('Default (draft) variant')).toBe('Default variant');
    expect(withoutLegacyRoleWords('Default (replaced 9/24/2026)')).toBe('Default');
    expect(withoutLegacyRoleWords('(draft)')).toBe(FALLBACK_LAYOUT_NAME);
    for (const own of ['Draft ideas', 'Kick (Draft)', 'Song (copy)', 'Verse (drafted)', 'Wide hands']) {
      expect(withoutLegacyRoleWords(own)).toBe(own);
    }
  });

  it('variant names start from the base name, as before (S2.3)', () => {
    expect(variantBaseName('Default (draft) (suggested)')).toBe('Default');
    expect(variantBaseName('Song (copy)')).toBe('Song');
    expect(variantBaseName('Song (copy) (draft)')).toBe('Song');
    expect(variantBaseName('(copy)')).toBe(FALLBACK_LAYOUT_NAME);
    const at = new Date(2026, 8, 23, 14, 2);
    expect(suggestVariantName('Default (replaced 9/24/2026)', [], at)).toBe('Default – 23 Sep 14:02');
  });
});

/** Every layout name in the project's document. */
const allNames = (s: ProjectState) =>
  [s.activeLayout, s.workingLayout, ...s.savedVariants, ...s.recoveredDrafts].filter(Boolean).map(l => l!.name);
const ROLE_WORD = /\((draft|suggested)\)|\(replaced/;

function fakeCandidate(id: string, state: ProjectState, pads: string[], strategy: string, name: string): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i]!;
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  // Engine layouts are seeded from the user's layout, provenance and all.
  const layout: Layout = { ...state.activeLayout, id: `${id}-layout`, name, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working', provenance: 'manual' };
  return {
    id,
    layout,
    executionPlan: { layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' } },
    metadata: { strategy, seed: 0 },
  } as unknown as CandidateSolution;
}

const place = (state: ProjectState, padKey: string, i: number): ProjectAction =>
  ({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i]! } });

describe('the reducers keep names clean and record where a layout came from', () => {
  it('a manual edit starts a draft named after Active, labelled "Draft of Default"; more edits pile nothing on', async () => {
    const start = await importTestMidi1();
    expect(start.activeLayout.name).toBe('Default');
    let state = reduce(start, place(start, '0,0', 0));
    expect(state.workingLayout).toMatchObject({ name: 'Default', provenance: 'manual', role: 'working' });
    expect(layoutLabel(state.workingLayout!)).toBe('Draft of Default');
    state = reduce(state, place(state, '0,1', 1), place(state, '0,2', 2), { type: 'SWAP_PADS', payload: { padKeyA: '0,0', padKeyB: '1,0' } });
    expect(state.workingLayout!.name).toBe('Default');
  });

  it('Suggest keeps the base name and records "suggested"', async () => {
    const state = reduce(await importTestMidi1(), { type: 'SUGGEST_STARTING_LAYOUT' });
    expect(state.workingLayout).toMatchObject({ name: 'Default', provenance: 'suggested' });
    expect(Object.keys(state.workingLayout!.padToVoice)).toHaveLength(7);
    // Suggest again over the draft: still Default, never "Default (suggested) (suggested)".
    expect(reduce(state, { type: 'SUGGEST_STARTING_LAYOUT' }).workingLayout!.name).toBe('Default');
  });

  it('Promote keeps the clean base name; the replaced Active is saved as "Default – 25 Sep 14:02", numbered in the same minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-09-25T14:02:00.000Z');
    vi.setSystemTime(now);
    const stamp = variantStamp(now);

    let state = reduce(await importTestMidi1(), { type: 'SUGGEST_STARTING_LAYOUT' }, { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(state.activeLayout).toMatchObject({ name: 'Default', provenance: 'suggested', role: 'active' });
    // Active had no pads, so nothing was replaced.
    expect(state.savedVariants).toEqual([]);

    state = reduce(state, place(state, '7,7', 0), { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(state.activeLayout).toMatchObject({ name: 'Default', provenance: 'manual' });
    expect(state.savedVariants.map(v => ({ name: v.name, provenance: v.provenance, savedAt: v.savedAt, role: v.role }))).toEqual([
      { name: `Default – ${stamp}`, provenance: 'replaced-active', savedAt: now.toISOString(), role: 'variant' },
    ]);
    state = reduce(state, place(state, '6,6', 1), { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(state.savedVariants.map(v => v.name)).toEqual([`Default – ${stamp}`, `Default – ${stamp} (2)`]);
    expect(allNames(state).filter(n => ROLE_WORD.test(n))).toEqual([]);
  });

  it('a candidate applied, kept or promoted records its strategy, and keeps its base name', async () => {
    const start = await importTestMidi1();
    const cand = fakeCandidate('cand-a', start, ['4,4', '4,5'], 'Coordination-Optimized (seed 1)', 'Coordination-Optimized');
    const withCandidate = reduce(start, { type: 'SET_CANDIDATES', payload: [cand] });

    const applied = reduce(withCandidate, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    expect(applied.workingLayout).toMatchObject({ name: 'Coordination-Optimized', provenance: 'candidate:Coordination-Optimized (seed 1)' });
    expect(layoutLabel(applied.workingLayout!)).toBe('Draft of Coordination-Optimized');

    const kept = reduce(withCandidate, { type: 'SAVE_AS_VARIANT', payload: { name: 'Coordination idea', source: 'candidate', candidateId: 'cand-a' } });
    expect(kept.savedVariants[0]).toMatchObject({ name: 'Coordination idea', provenance: 'candidate:Coordination-Optimized (seed 1)' });

    const promoted = reduce(withCandidate, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-a' } });
    expect(promoted.activeLayout).toMatchObject({ name: 'Coordination-Optimized', provenance: 'candidate:Coordination-Optimized (seed 1)' });
  });

  it('a variant saved from the draft keeps its provenance; loading or promoting one records variant:<id>', async () => {
    let state = reduce(await importTestMidi1(), { type: 'SUGGEST_STARTING_LAYOUT' });
    state = reduce(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Idea', source: 'working', variantId: 'v-idea' } });
    expect(state.savedVariants[0]).toMatchObject({ id: 'v-idea', name: 'Idea', provenance: 'suggested' });

    const loaded = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' }, { type: 'LOAD_SAVED_VARIANT', payload: { variantId: 'v-idea' } });
    expect(loaded.workingLayout).toMatchObject({ name: 'Idea', provenance: 'variant:v-idea' });
    expect(layoutLabel(loaded.workingLayout!)).toBe('Draft of Idea');

    const promoted = reduce(state, { type: 'PROMOTE_VARIANT', payload: { variantId: 'v-idea' } });
    expect(promoted.activeLayout).toMatchObject({ name: 'Idea', provenance: 'variant:v-idea' });
  });

  it('a draft an action replaces is recovered under its clean name, labelled "Draft of Default"', async () => {
    const start = await importTestMidi1();
    let state = reduce(start, place(start, '0,0', 0), place(start, '0,7', 1));
    state = reduce(state, { type: 'SET_CANDIDATES', payload: [fakeCandidate('cand-a', state, ['4,4', '4,5'], 'test', 'Default')] });
    state = reduce(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    expect(state.recoveredDrafts).toHaveLength(1);
    expect(state.recoveredDrafts[0]).toMatchObject({ name: 'Default', provenance: 'recovered' });
    expect(layoutLabel(state.recoveredDrafts[0]!)).toBe('Draft of Default');
    expect(allNames(state).filter(n => ROLE_WORD.test(n))).toEqual([]);
  });
});
