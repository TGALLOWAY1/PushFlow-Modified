// @vitest-environment happy-dom
/**
 * S3.3 · Compare on the cache (T08 full), P3-4 at component level.
 *
 * Both sides of Compare take their plan and Playability from the per-layout
 * cache, never a stub and never a candidate's own optimizer plan: a candidate
 * whose stored plan is empty still shows its fingering and the score its row
 * shows, and the Active side equals Active's standalone analysis. Candidate
 * letters stay stable after a delete. Keep saves a side as a variant; Promote
 * is the one Promote and closes Compare.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { CompareModal } from '../../../src/ui/components/panels/CompareModal';
import { ACTIVE_COMPARE_ID } from '../../../src/ui/state/compareSet';
import { layoutIdentity, projectReducer, type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { analyseLayoutCached } from '../../../src/ui/analysis/layoutAnalysis';
import { formatPlanScore } from '../../../src/ui/analysis/planScore';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type Layout } from '../../../src/types/layout';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

let state: ProjectState;
let activeScore: number;
let candidateScore: number;
let candidateLayout: Layout;

/** A candidate whose own stored plan is a stub: nothing on it may reach Compare. */
function stubCandidate(id: string, layout: Layout): CandidateSolution {
  return {
    id,
    layout,
    executionPlan: { fingerAssignments: [], layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' } },
    difficultyAnalysis: { overallScore: 0.99, passages: [], bindingConstraints: [] },
    tradeoffProfile: { playability: 0, compactness: 0, handBalance: 0, transitionEfficiency: 0, structuralCoherence: 0 },
    metadata: { strategy: 'pose0-offset-1', seed: 1 },
  } as unknown as CandidateSolution;
}

beforeAll(async () => {
  const active = reduce(await suggestedTestMidi1(), { type: 'PROMOTE_WORKING_LAYOUT' });
  const pads = Object.keys(active.activeLayout.padToVoice);
  const swapped = { ...active.activeLayout.padToVoice };
  [swapped[pads[0]!], swapped[pads[1]!]] = [swapped[pads[1]!]!, swapped[pads[0]!]!];
  candidateLayout = { ...active.activeLayout, id: 'cand-layout', role: 'working', padToVoice: swapped };
  // The rows score both layouts through the cache first, as they would on screen.
  activeScore = (await analyseLayoutCached(active, active.activeLayout)).score.playability;
  candidateScore = (await analyseLayoutCached(active, candidateLayout)).score.playability;
  state = reduce(active,
    { type: 'SET_CANDIDATES', payload: [stubCandidate('c1', { ...active.activeLayout, id: 'c1-layout' }), stubCandidate('c2', candidateLayout)] },
    // Candidate A goes; B keeps its letter.
    { type: 'DELETE_CANDIDATE', payload: { candidateId: 'c1' } },
    { type: 'INSPECT_LAYOUT', payload: null },
  );
}, 60_000);

let api: ReturnType<typeof useProject>;
function Spy() {
  api = useProject();
  return null;
}

async function openCompare(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Spy />
        <CompareModal candidateIds={[ACTIVE_COMPARE_ID, 'c2']} onClose={onClose} />
      </ProjectProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(screen.getAllByTestId('compare-card').filter(c => c.dataset.status === 'ready')).toHaveLength(2), { timeout: 30_000 });
  const card = (id: string) => screen.getAllByTestId('compare-card').find(c => c.dataset.candidateId === id)!;
  return { onClose, active: card(ACTIVE_COMPARE_ID), candidate: card('c2') };
}

describe('Compare on the cache (T08, P3-4)', () => {
  it('reads both sides from the per-layout cache: Active\'s standalone score, the candidate\'s row score and fingering, never its stub', async () => {
    const { active, candidate } = await openCompare();
    expect(within(active).getByTestId('compare-score').textContent).toBe(formatPlanScore(activeScore));
    expect(within(candidate).getByTestId('compare-score').textContent).toBe(formatPlanScore(candidateScore));
    // Every placed pad on both grids shows the fingers of its cached plan.
    const fingered = screen.getAllByRole('button').filter(b => /· Fingers [LR]\d/.test(b.getAttribute('title') ?? ''));
    expect(fingered).toHaveLength(2 * Object.keys(candidateLayout.padToVoice).length);
    // The stub's tradeoffs (all 0) and "Extreme" never show.
    expect(candidate.textContent).not.toContain('Extreme');
  }, 60_000);

  it('names the candidate by its session letter, after a delete: Candidate B', async () => {
    const { candidate } = await openCompare();
    expect(within(candidate).getByTestId('compare-subject').getAttribute('data-chip')).toBe('Candidate B');
  }, 60_000);

  it('Keep saves a side as a variant; Promote is the one Promote and closes Compare', async () => {
    const { onClose, candidate } = await openCompare();
    fireEvent.click(within(candidate).getByTestId('compare-keep'));
    expect(api.state.savedVariants.map(v => v.name)).toEqual(['Natural hand pose, shifted 1 row']);
    expect(within(candidate).getByTestId('compare-keep').textContent).toBe('Kept');

    act(() => { fireEvent.click(within(candidate).getByTestId('compare-promote')); });
    expect(onClose).toHaveBeenCalled();
    expect(layoutIdentity(api.state, api.state.activeLayout)).toBe(layoutIdentity(api.state, candidateLayout));
    // The plan it showed, rebound to the new Active: fresh, nothing to re-solve.
    expect(api.state.analysisResult!.executionPlan.fingerAssignments.length).toBeGreaterThan(0);
    expect(api.state.analysisStale).toBe(false);
    expect(screen.getByTestId('toast').textContent).toMatch(/^Promoted Candidate B to Active Layout/);
  }, 60_000);
});
