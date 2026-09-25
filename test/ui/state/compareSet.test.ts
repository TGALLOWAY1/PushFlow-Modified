/**
 * The compare set is derived from current ids (S1b.3, T08): P1b-3b's
 * "no self-compare after delete or promote".
 */

import { describe, it, expect } from 'vitest';
import { liveCompareIds, canCompare, distinctCompareLayouts, ACTIVE_COMPARE_ID } from '../../../src/ui/state/compareSet';
import { projectReducer } from '../../../src/ui/state/projectState';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';
import type { CandidateSolution } from '../../../src/types/candidateSolution';

async function withCandidates() {
  let state = await suggestedTestMidi1();
  state = projectReducer(state, { type: 'PROMOTE_WORKING_LAYOUT' });
  const base = state.activeLayout;
  const keys = Object.keys(base.padToVoice);
  const make = (i: number): CandidateSolution => {
    const padToVoice = { ...base.padToVoice };
    [padToVoice[keys[0]!], padToVoice[keys[i]!]] = [padToVoice[keys[i]!]!, padToVoice[keys[0]!]!];
    return { id: `c${i}`, layout: { ...base, id: `l${i}`, role: 'candidate' as never, padToVoice } } as unknown as CandidateSolution;
  };
  state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [make(1), make(2)] });
  return state;
}

describe('compare set', () => {
  it('drops a deleted candidate, so Compare is disabled', async () => {
    const state = await withCandidates();
    expect(canCompare(liveCompareIds(['c1', 'c2'], state), state)).toBe(true);
    const after = projectReducer(state, { type: 'DELETE_CANDIDATE', payload: { candidateId: 'c2' } });
    expect(liveCompareIds(['c1', 'c2'], after)).toEqual(['c1']);
    expect(canCompare(liveCompareIds(['c1', 'c2'], after), after)).toBe(false);
  });

  it('after promoting a compared candidate, Active vs that candidate is no longer comparable', async () => {
    const state = await withCandidates();
    const ids = [ACTIVE_COMPARE_ID, 'c1'];
    expect(canCompare(liveCompareIds(ids, state), state)).toBe(true);
    const after = projectReducer(state, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'c1' } });
    const live = liveCompareIds(ids, after);
    expect(canCompare(live, after)).toBe(false);
  });

  it('two ids naming the same layout are one distinct layout', async () => {
    const state = await withCandidates();
    const same = { ...state, candidates: [{ ...state.candidates[0]!, id: 'dup', layout: state.activeLayout }] };
    expect(distinctCompareLayouts([ACTIVE_COMPARE_ID, 'dup'], same)).toBe(1);
    expect(canCompare([ACTIVE_COMPARE_ID, 'dup'], same)).toBe(false);
  });

  it('Active counts only while it has pads', async () => {
    const state = await withCandidates();
    const empty = { ...state, activeLayout: { ...state.activeLayout, padToVoice: {} } };
    expect(liveCompareIds([ACTIVE_COMPARE_ID, 'c1'], empty)).toEqual(['c1']);
  });
});
