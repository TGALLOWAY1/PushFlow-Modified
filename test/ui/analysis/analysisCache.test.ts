// @vitest-environment happy-dom
/**
 * Per-layout analysis cache (S1b.3, T08 slice): P1b-3c.
 * A second request for the same key is served without re-solving, the key is
 * complete, the LRU is capped, failures are not cached, and using the cache
 * writes nothing to project state or storage.
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
import { analyseLayoutCached, analysisKeyFor } from '../../../src/ui/analysis/layoutAnalysis';
import * as analyze from '../../../src/ui/analysis/analyzeLayout';
import { pickDocument } from '../../../src/ui/state/projectDocument';
import { getDisplayedLayout, projectReducer } from '../../../src/ui/state/projectState';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';
import type { CandidateSolution } from '../../../src/types/candidateSolution';
import { ALL_COSTS_ENABLED as DEFAULT_COST_TOGGLES } from '../../../src/types/costToggles';

const fake = (id: string) => ({ id } as unknown as CandidateSolution);
const key = (layoutHash: string, over: Partial<AnalysisKey> = {}): AnalysisKey => ({
  layoutHash, performanceHash: 'p', costToggles: DEFAULT_COST_TOGGLES, evaluatorId: 'beam-fast', ...over,
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
    const compute = vi.fn(() => new Promise<CandidateSolution>(r => setTimeout(() => r(fake('a')), 5)));
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

  it('does not cache a failed solve', async () => {
    const failing = vi.fn(async () => { throw new Error('boom'); });
    await expect(getAnalysisForLayout(key('L1'), failing)).rejects.toThrow('boom');
    const ok = vi.fn(async () => fake('ok'));
    await expect(getAnalysisForLayout(key('L1'), ok)).resolves.toMatchObject({ id: 'ok' });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('analyseLayoutCached on TEST MIDI 1', () => {
  it('solves once per layout, and leaves project state and storage unchanged', async () => {
    const state = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const docBefore = JSON.stringify(pickDocument(state));
    const storageBefore = JSON.stringify({ ...localStorage });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const spy = vi.spyOn(analyze, 'analyzeLayout');

    const first = await analyseLayoutCached(state, layout);
    const second = await analyseLayoutCached(state, layout);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(first.executionPlan.score).toBeGreaterThan(0);
    expect(first.executionPlan.layoutBinding?.layoutHash).toBeDefined();
    expect(peekAnalysis(analysisKeyFor(state, layout))).toBe(first);
    expect(JSON.stringify(pickDocument(state))).toBe(docBefore);
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).toBe(storageBefore);
    spy.mockRestore();
    setItem.mockRestore();
  });

  it('a change to the performance is a new key', async () => {
    const state = await suggestedTestMidi1();
    const layout = getDisplayedLayout(state)!;
    const muted = projectReducer(state, { type: 'TOGGLE_MUTE', payload: state.soundStreams[0]!.id });
    expect(analysisCacheKey(analysisKeyFor(state, layout))).not.toBe(analysisCacheKey(analysisKeyFor(muted, layout)));
  });
});
