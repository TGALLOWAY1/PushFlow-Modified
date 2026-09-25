// @vitest-environment happy-dom
/**
 * S3.1 · One yardstick (T21 slice), session checks with a real greedy candidate
 * on TEST MIDI 1:
 *  1. getAnalysisForLayout returns the same Playability for a layout on the
 *     working-layout path (the draft's auto-analysis) and on the candidate path.
 *  2. A greedy candidate applied as the draft through today's Preview scores the
 *     same before and after, and the variant cards and Compare read that value.
 *
 * The busiest Sound has a finger preference and the candidate moves it, so the
 * candidate's own layout carries a preference keyed to the pad it left: the
 * candidate and the draft hash differently, yet share one key and one score.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor, within, fireEvent } from '@testing-library/react';
import type { Dispatch } from 'react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { LayoutOptionsPanel } from '../../../src/ui/components/panels/LayoutOptionsPanel';
import { ActiveLayoutSummary } from '../../../src/ui/components/panels/ActiveLayoutSummary';
import { CompareModal } from '../../../src/ui/components/panels/CompareModal';
import { useAutoAnalysis } from '../../../src/ui/hooks/useAutoAnalysis';
import { analyseLayoutCached, analysisKeyFor, peekLayoutAnalysis } from '../../../src/ui/analysis/layoutAnalysis';
import { analysisCacheKey, clearAnalysisCache } from '../../../src/ui/analysis/analysisCache';
import * as analyze from '../../../src/ui/analysis/analyzeLayout';
import { ACTIVE_COMPARE_ID } from '../../../src/ui/state/compareSet';
import { projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { checkPlanFreshness, hashLayout } from '../../../src/engine';
import { suggestedTestMidi1, generateGreedyAsApp } from '../../helpers/testMidi1';

afterEach(cleanup);

let latest: ProjectState;
let dispatch: Dispatch<ProjectAction>;
function Spy() {
  const project = useProject();
  latest = project.state;
  dispatch = project.dispatch;
  return null;
}
function AutoAnalysis() {
  useAutoAnalysis();
  return null;
}

/**
 * TEST MIDI 1 suggested and promoted; a finger preference on the busiest Sound
 * (which makes a draft); Greedy (Natural Pose) run from that draft, as the app does.
 */
async function projectWithGreedyCandidate() {
  let state = await suggestedTestMidi1();
  state = projectReducer(state, { type: 'PROMOTE_WORKING_LAYOUT' });
  const busiest = [...state.soundStreams].sort((a, b) => b.events.length - a.events.length)[0]!;
  state = projectReducer(state, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: busiest.id, hand: 'left', finger: 'index' } });
  state = projectReducer(state, { type: 'SET_GREEDY_STRATEGY', payload: 'natural-pose' });
  const candidates = await generateGreedyAsApp(state);
  state = projectReducer(state, { type: 'SET_CANDIDATES', payload: candidates });
  const candidate = candidates[0]!;
  // The candidate moved the preferred Sound, so its raw layout differs from what applying it yields.
  const applied = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidate.id } });
  expect(hashLayout(candidate.layout)).not.toBe(hashLayout(applied.workingLayout!));
  return { state, candidate };
}

describe('S3.1 · one yardstick', () => {
  it('check 1: the working-layout path returns the candidate path’s Playability, from the same entry', async () => {
    const { state, candidate } = await projectWithGreedyCandidate();
    const solves = vi.spyOn(analyze, 'analyzeLayout');

    // Candidate path: the row's request.
    const onCandidatePath = await analyseLayoutCached(state, candidate.layout);
    expect(solves).toHaveBeenCalledTimes(1);
    // The greedy optimizer's own plan score is not the yardstick.
    expect(onCandidatePath.score.playability).not.toBe(candidate.executionPlan.score);

    // Working-layout path: the candidate applied as the draft, analysed by the
    // auto-analysis effect (debounced, through the cache and the scoring client).
    const applied = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: candidate.id } });
    render(
      <ToastProvider>
        <ProjectProvider initialState={applied}>
          <Spy />
          <AutoAnalysis />
        </ProjectProvider>
      </ToastProvider>,
    );
    await waitFor(() => {
      expect(latest.analysisStale).toBe(false);
      expect(latest.analysisResult).not.toBeNull();
    }, { timeout: 10_000 });
    const draft = latest.workingLayout!;
    expect(checkPlanFreshness(latest.analysisResult!.executionPlan, draft).isFresh).toBe(true);
    expect(latest.isProcessing).toBe(false);

    expect(analysisCacheKey(analysisKeyFor(latest, draft))).toBe(analysisCacheKey(analysisKeyFor(state, candidate.layout)));
    const onWorkingPath = peekLayoutAnalysis(latest, draft)!;
    expect(onWorkingPath.score.playability).toBe(onCandidatePath.score.playability);
    expect(onWorkingPath.score).toBe(onCandidatePath.score);
    // The draft's analysis is the cached plan, served without a second solve.
    expect(latest.analysisResult!.executionPlan.fingerAssignments).toEqual(onCandidatePath.analysis.executionPlan.fingerAssignments);
    expect(solves).toHaveBeenCalledTimes(1);

    // Not an artefact of sharing an entry: solved afresh, each path gives the same number.
    clearAnalysisCache();
    const draftAfresh = await analyseLayoutCached(latest, draft);
    clearAnalysisCache();
    const candidateAfresh = await analyseLayoutCached(state, candidate.layout);
    expect(solves).toHaveBeenCalledTimes(3);
    expect(draftAfresh.score).toEqual(onCandidatePath.score);
    expect(candidateAfresh.score).toEqual(onCandidatePath.score);
    solves.mockRestore();
  }, 60_000);

  it('check 2: Preview keeps the candidate’s score, and the variant card and Compare read it', async () => {
    const { state, candidate } = await projectWithGreedyCandidate();
    const { rerender } = render(
      <ToastProvider>
        <ProjectProvider initialState={state}>
          <Spy />
          <AutoAnalysis />
          <ActiveLayoutSummary />
          <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
        </ProjectProvider>
      </ToastProvider>,
    );

    // Before: candidate #1's row.
    const row = screen.getAllByTestId('candidate-row').find(r => r.getAttribute('data-candidate-id') === candidate.id)!;
    await waitFor(() => expect(within(row).getByTestId('candidate-score').textContent).toMatch(/^Score: \d+%$/), { timeout: 10_000 });
    const before = /(\d+)%/.exec(within(row).getByTestId('candidate-score').textContent!)![1]!;
    expect(within(row).getByTestId('candidate-score').getAttribute('title')).toContain('Playability · canonical evaluator · higher = easier');

    // Preview: APPLY_GENERATION_TO_LAYOUT, as the row's button does today.
    fireEvent.click(within(row).getByRole('button', { name: 'Preview' }));
    expect(latest.selectedCandidateId).toBe(candidate.id);
    const draft = latest.workingLayout!;
    await waitFor(() => {
      expect(latest.analysisStale).toBe(false);
      expect(latest.analysisResult && checkPlanFreshness(latest.analysisResult.executionPlan, latest.workingLayout!).isFresh).toBe(true);
    }, { timeout: 10_000 });
    expect(latest.workingLayout).toBe(draft);

    // After: the Analysis Score tile, for the previewed candidate and then for the draft itself.
    expect(screen.getByTestId('analysis-score').textContent).toBe(`Score${before}%`);
    await act(async () => { dispatch({ type: 'SELECT_CANDIDATE', payload: null }); });
    expect(screen.getByTestId('analysis-score').textContent).toBe(`Score${before}%`);
    expect(screen.getByTestId('analysis-score').getAttribute('title')).toContain('Playability · canonical evaluator');

    // The draft kept as a variant: its card reads the same score, with the same LayoutScore's counts.
    await act(async () => { dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: 'Kept', source: 'working', variantId: 'kept' } }); });
    const variantRow = screen.getAllByTestId('variant-row').find(r => r.getAttribute('data-variant-id') === 'kept')!;
    await waitFor(() => expect(within(variantRow).getByTestId('variant-score').textContent).toMatch(/^Score \d+%/));
    const scored = peekLayoutAnalysis(latest, draft)!.score;
    expect(within(variantRow).getByTestId('variant-score').textContent)
      .toBe(`Score ${before}% · ${scored.hardEvents} hard · ${scored.unplayableEvents} unplayable`);

    // Compare, that candidate against the Active Layout: its side reads the same score.
    rerender(
      <ToastProvider>
        <ProjectProvider initialState={state}>
          <Spy />
          <AutoAnalysis />
          <ActiveLayoutSummary />
          <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
          <CompareModal candidateIds={[ACTIVE_COMPARE_ID, candidate.id]} onClose={() => {}} />
        </ProjectProvider>
      </ToastProvider>,
    );
    const dialog = await screen.findByTestId('compare-dialog');
    const card = (id: string) => within(dialog).getAllByTestId('compare-card').find(c => c.getAttribute('data-candidate-id') === id)!;
    await waitFor(() => expect(within(card(candidate.id)).getByTestId('compare-score').textContent).toBe(`${before}%`), { timeout: 10_000 });
    // The Active side reads Active's own Playability, the number on the Active row.
    await waitFor(() => expect(screen.getByTestId('active-score').textContent).toMatch(/^Score \d+%/));
    const activeScore = /Score (\d+)%/.exec(screen.getByTestId('active-score').textContent!)![1];
    await waitFor(() => expect(within(card(ACTIVE_COMPARE_ID)).getByTestId('compare-score').textContent).toBe(`${activeScore}%`));
  }, 60_000);
});
