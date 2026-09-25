// @vitest-environment happy-dom
/**
 * Per-layout analysis cache (S1b.3, T08 slice: P1b-3c; S3.1, one yardstick).
 * A second request for the same key is served without re-solving, the key is
 * complete, the LRU is capped, failures are not cached, and using the cache
 * writes nothing to project state or storage. Each entry holds a layout's plan
 * and its Playability, keyed by the canonical evaluator, and a candidate shares
 * its key with the same pads applied as the draft.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAnalysisForLayout,
  peekAnalysis,
  rememberAnalysis,
  clearAnalysisCache,
  analysisCacheSize,
  analysisCacheKey,
  ANALYSIS_CACHE_CAPACITY,
  type AnalysisKey,
} from '../../../src/ui/analysis/analysisCache';
import { analyseLayoutCached, analysisKeyFor, peekLayoutAnalysis } from '../../../src/ui/analysis/layoutAnalysis';
import * as analyze from '../../../src/ui/analysis/analyzeLayout';
import type { ScoredLayoutAnalysis } from '../../../src/ui/analysis/scoreLayout';
import { pickDocument } from '../../../src/ui/state/projectDocument';
import { getDisplayedLayout, projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { hashLayout, PLAYABILITY_EVALUATOR_ID } from '../../../src/engine';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';
import type { CandidateSolution } from '../../../src/types/candidateSolution';
import type { Layout } from '../../../src/types/layout';
import { ALL_COSTS_ENABLED as DEFAULT_COST_TOGGLES } from '../../../src/types/costToggles';

const fake = (id: string) => ({ analysis: { id }, score: { playability: 50 } } as unknown as ScoredLayoutAnalysis);
const key = (layoutHash: string, over: Partial<AnalysisKey> = {}): AnalysisKey => ({
  layoutHash, performanceHash: 'p', costToggles: DEFAULT_COST_TOGGLES, evaluatorId: PLAYABILITY_EVALUATOR_ID, ...over,
});

beforeEach(() => clearAnalysisCache());

describe('getAnalysisForLayout', () => {
  it('a second request for the same key is served from the cache without re-solving', async () => {
    const compute = vi.fn(async () => fake('a'));
    const first = await getAnalysisForLayout(key('L1'), compute);
    const second = await getAnalysisForLayout(key('L1'), compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('joins a solve already in flight for the same key', async () => {
    const compute = vi.fn(() => new Promise<ScoredLayoutAnalysis>(r => setTimeout(() => r(fake('a')), 5)));
    const [a, b] = await Promise.all([getAnalysisForLayout(key('L1'), compute), getAnalysisForLayout(key('L1'), compute)]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('keys fully: layout, performance, cost toggles and evaluator each give a new entry', async () => {
    const compute = vi.fn(async () => fake('x'));
    await getAnalysisForLayout(key('L1'), compute);
    await getAnalysisForLayout(key('L2'), compute);
    await getAnalysisForLayout(key('L1', { performanceHash: 'q' }), compute);
    await getAnalysisForLayout(key('L1', { costToggles: { ...DEFAULT_COST_TOGGLES, transitionCost: !DEFAULT_COST_TOGGLES.transitionCost } }), compute);
    await getAnalysisForLayout(key('L1', { evaluatorId: 'other' }), compute);
    expect(compute).toHaveBeenCalledTimes(5);
    expect(new Set([key('L1'), key('L2')].map(analysisCacheKey)).size).toBe(2);
  });

  it('is capped: the least recently used entry goes first', () => {
    for (let i = 0; i < ANALYSIS_CACHE_CAPACITY; i++) rememberAnalysis(key(`L${i}`), fake(`c${i}`));
    expect(peekAnalysis(key('L0'))).not.toBeNull(); // L0 is now the most recent
    rememberAnalysis(key('new'), fake('new'));
    expect(analysisCacheSize()).toBe(ANALYSIS_CACHE_CAPACITY);
    expect(peekAnalysis(key('L0'))).not.toBeNull();
    expect(peekAnalysis(key('L1'))).toBeNull();
  });

  it('holds every row a full Layouts list shows at once', () => {
    // Active, the draft, three runs of four candidates, five recovered drafts, and variants.
    expect(ANALYSIS_CACHE_CAPACITY).toBeGreaterThanOrEqual(1 + 1 + 12 + 5 + 20);
  });

  it('does not cache a failed solve', async () => {
    const failing = vi.fn(async () => { throw new Error('boom'); });
    await expect(getAnalysisForLayout(key('L1'), failing)).rejects.toThrow('boom');
    const ok = vi.fn(async () => fake('ok'));
    await expect(getAnalysisForLayout(key('L1'), ok)).resolves.toMatchObject({ analysis: { id: 'ok' } });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('analyseLayoutCached on TEST MIDI 1', () => {
  it('solves and scores once per layout, and leaves project state and storage unchanged', async () => {
    const state = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const docBefore = JSON.stringify(pickDocument(state));
    const storageBefore = JSON.stringify({ ...localStorage });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const spy = vi.spyOn(analyze, 'analyzeLayout');

    const first = await analyseLayoutCached(state, layout);
    const second = await analyseLayoutCached(state, layout);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.score).toBe(first.score);
    expect(second).toEqual(first);
    expect(first.score.evaluatorId).toBe(PLAYABILITY_EVALUATOR_ID);
    expect(first.score.playability).toBeGreaterThan(0);
    expect(first.score.events).toBe(32);
    // The plan comes back bound to the layout it was asked for.
    expect(first.analysis.layout).toBe(layout);
    expect(first.analysis.executionPlan.layoutBinding?.layoutHash).toBe(hashLayout(layout));
    expect(peekLayoutAnalysis(state, layout)).toEqual(first);
    expect(JSON.stringify(pickDocument(state))).toBe(docBefore);
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).toBe(storageBefore);
    spy.mockRestore();
    setItem.mockRestore();
  });

  it('keys by the canonical evaluator: the beam-fast entries are retired', async () => {
    const state = await suggestedTestMidi1();
    expect(PLAYABILITY_EVALUATOR_ID).toBe('canonical-v1');
    expect(analysisKeyFor(state, getDisplayedLayout(state)!).evaluatorId).toBe('canonical-v1');
  });

  it('a change to the performance is a new key', async () => {
    const state = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const muted = projectReducer(state, { type: 'TOGGLE_MUTE', payload: state.soundStreams[0]!.id });
    expect(analysisCacheKey(analysisKeyFor(state, layout))).not.toBe(analysisCacheKey(analysisKeyFor(muted, layout)));
  });

  it('cost toggles are part of the key and change the score, not the plan', async () => {
    const state = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const noMovement = projectReducer(state, { type: 'SET_COST_TOGGLES', payload: { ...state.costToggles, transitionCost: false } });
    expect(analysisCacheKey(analysisKeyFor(state, layout))).not.toBe(analysisCacheKey(analysisKeyFor(noMovement, layout)));
    const on = await analyseLayoutCached(state, layout);
    const off = await analyseLayoutCached(noMovement, layout);
    expect(off.score.factors.transition).toBe(0);
    expect(on.score.factors.transition).toBeGreaterThan(0);
    expect(off.analysis.executionPlan.fingerAssignments).toEqual(on.analysis.executionPlan.fingerAssignments);
  });
});

describe('one key for a candidate and the same pads applied as the draft', () => {
  /** The draft with its busiest Sound, which has a finger preference, moved to a free pad. */
  async function candidateThatMovesAPreferredSound(): Promise<{ state: ProjectState; candidate: CandidateSolution; moved: string }> {
    let state = await suggestedTestMidi1();
    const busiest = [...state.soundStreams].sort((a, b) => b.events.length - a.events.length)[0]!;
    state = projectReducer(state, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: busiest.id, hand: 'left', finger: 'index' } });
    const draft = state.workingLayout!;
    const from = Object.keys(draft.padToVoice).find(k => draft.padToVoice[k]!.id === busiest.id)!;
    expect(draft.fingerConstraints[from]).toBe('L2');
    const to = ['7,7', '6,6', '0,7'].find(k => !draft.padToVoice[k])!;
    const padToVoice = { ...draft.padToVoice, [to]: draft.padToVoice[from]! };
    delete padToVoice[from];
    // As an optimizer leaves it: the base's pad preferences, still keyed to the pad the Sound left.
    const layout: Layout = { ...draft, id: 'cand-layout', padToVoice, fingerConstraints: { ...draft.fingerConstraints } };
    const candidate = { id: 'cand', layout, executionPlan: { score: 90 }, metadata: { strategy: 'test', seed: 0 } } as unknown as CandidateSolution;
    state = projectReducer(state, { type: 'SET_CANDIDATES', payload: [candidate] });
    return { state, candidate, moved: to };
  }

  it('re-derives finger preferences from the Sounds, so the keys match where the raw hashes differ', async () => {
    const { state, candidate, moved } = await candidateThatMovesAPreferredSound();
    const applied = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidate.id } });
    const draft = applied.workingLayout!;
    expect(draft.fingerConstraints).toEqual({ [moved]: 'L2' });
    expect(hashLayout(candidate.layout)).not.toBe(hashLayout(draft));
    expect(analysisCacheKey(analysisKeyFor(state, candidate.layout))).toBe(analysisCacheKey(analysisKeyFor(applied, draft)));

    const spy = vi.spyOn(analyze, 'analyzeLayout');
    const onCandidatePath = await analyseLayoutCached(state, candidate.layout);
    const onWorkingPath = await analyseLayoutCached(applied, draft);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(onWorkingPath.score).toBe(onCandidatePath.score);
    // Solved with the preference on the pad the Sound now sits on.
    expect(spy.mock.calls[0]![0].layout.fingerConstraints).toEqual({ [moved]: 'L2' });
    // Each path gets the plan bound to its own layout.
    expect(onWorkingPath.analysis.executionPlan.layoutBinding?.layoutHash).toBe(hashLayout(draft));
    expect(onCandidatePath.analysis.executionPlan.layoutBinding?.layoutHash).toBe(hashLayout(candidate.layout));
    spy.mockRestore();
  });

  it('a lock whose Sound has left its pad is not part of the key', async () => {
    const { state, candidate } = await candidateThatMovesAPreferredSound();
    const ghostLocked: Layout = { ...candidate.layout, placementLocks: { ghost: '0,0' } };
    expect(analysisCacheKey(analysisKeyFor(state, ghostLocked))).toBe(analysisCacheKey(analysisKeyFor(state, candidate.layout)));
  });
});
