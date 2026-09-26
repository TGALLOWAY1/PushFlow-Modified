// @vitest-environment happy-dom
/**
 * S3.3 · One Promote (T13), criterion P3-3 at reducer and hook level.
 *
 * Every entry point (the state bar and a candidate row dispatch
 * PROMOTE_CANDIDATE; Compare does too; a variant row PROMOTE_VARIANT; the
 * draft's bar PROMOTE_WORKING_LAYOUT) goes through one promote: the same
 * candidate leaves the same Active Layout and the same plan, the plan the
 * user reviewed (the layout's own plan from the per-layout cache), rebound to
 * the new Active. Staleness still works after the rebind; the promoted
 * candidate's trace stays on screen; the replaced Active is kept as a
 * variant, an unrelated draft in Recovered drafts; one undo step each.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import {
  getActiveTrace,
  getAnalysisForLayout,
  layoutIdentity,
  projectReducer,
  withDerivedLayoutState,
  type ProjectAction,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import { analyseLayoutCached, peekLayoutAnalysis } from '../../../src/ui/analysis/layoutAnalysis';
import { useLayoutActions } from '../../../src/ui/hooks/useLayoutActions';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type Layout } from '../../../src/types/layout';
import { type OptimizationIteration } from '../../../src/engine/optimization/optimizerInterface';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

/** The plan's fingering, as a hash of what the timeline and grid would draw. */
function planHash(state: ProjectState): string | null {
  const plan = state.analysisResult?.executionPlan;
  if (!plan) return null;
  return JSON.stringify(plan.fingerAssignments.map(a => [a.eventKey, a.voiceId, a.row, a.col, a.assignedHand, a.finger]));
}

/**
 * Suggested TEST MIDI 1, promoted (Active); a candidate that moves two Sounds
 * and carries a stale finger preference on a pad its Sound left (as Greedy's
 * do), with an optimizer trace; a hand-made draft that differs from both.
 */
let base: ProjectState;
let candidate: CandidateSolution;
const TRACE = [{ iteration: 0 }, { iteration: 1 }] as unknown as OptimizationIteration[];

beforeAll(async () => {
  let state = reduce({ ...(await suggestedTestMidi1()), id: 'proj-promote' }, { type: 'PROMOTE_WORKING_LAYOUT' });
  const active = state.activeLayout;
  const [firstPad, secondPad] = Object.keys(active.padToVoice);
  const padToVoice = { ...active.padToVoice };
  const first = padToVoice[firstPad!]!;
  const second = padToVoice[secondPad!]!;
  padToVoice[firstPad!] = second;
  padToVoice[secondPad!] = first;
  const voiceId = state.soundStreams[0]!.id;
  state = reduce(state, { type: 'SET_VOICE_CONSTRAINT', payload: { streamId: voiceId, hand: 'left', finger: 'index' } }, { type: 'DISCARD_WORKING_LAYOUT' });
  const layout: Layout = {
    ...active,
    id: 'cand-b-layout',
    role: 'working',
    padToVoice,
    // A preference left on the pad its Sound moved from: the raw hash differs from the draft it becomes.
    fingerConstraints: { '7,7': 'L2' },
  };
  const scored = await analyseLayoutCached(state, layout);
  candidate = {
    ...scored.analysis,
    id: 'cand-b',
    layout,
    // The optimizer's own plan: never what a Promote shows.
    executionPlan: { ...scored.analysis.executionPlan, fingerAssignments: [] },
    metadata: { strategy: 'Natural Pose Anchor (seed 1)', seed: 1, candidateFamily: 'Natural Pose Anchor' },
    iterationTrace: TRACE,
  };
  base = reduce(state,
    { type: 'SET_CANDIDATES', payload: [{ ...candidate, id: 'cand-a', layout: { ...active, id: 'cand-a-layout', role: 'working' } }, candidate] },
    { type: 'INSPECT_LAYOUT', payload: null },
  );
}, 60_000);

// The per-layout cache is module state: every case reads the entry beforeAll made.
afterEach(cleanup);

/** The plan a Promote carries: the layout's own, from the cache (what useLayoutActions sends). */
const reviewedFor = (state: ProjectState, layout: Layout) => peekLayoutAnalysis(state, layout)!.analysis;

describe('One Promote (T13, P3-3)', () => {
  it('bar/card/modal (PROMOTE_CANDIDATE), the variant route and the draft route leave one Active Layout and one plan', () => {
    // Bar, card and Compare all dispatch PROMOTE_CANDIDATE with the cached plan.
    const byCandidate = projectReducer(base, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b', reviewed: reviewedFor(base, candidate.layout) } });

    // Variant: Keep the candidate, then promote the variant.
    const kept = projectReducer(base, { type: 'SAVE_AS_VARIANT', payload: { name: 'Natural Pose Anchor (seed 1)', source: 'candidate', candidateId: 'cand-b', variantId: 'var-b' } });
    const variant = kept.savedVariants.find(v => v.id === 'var-b')!;
    const byVariant = projectReducer(kept, { type: 'PROMOTE_VARIANT', payload: { variantId: 'var-b', reviewed: reviewedFor(kept, variant) } });

    // Draft: Use as my draft, then the draft's Promote (its plan is the one on screen).
    const used = projectReducer(base, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-b' } });
    const analysed = projectReducer(used, { type: 'SET_ANALYSIS_RESULT', payload: reviewedFor(used, used.workingLayout!) });
    const byDraft = projectReducer(analysed, { type: 'PROMOTE_WORKING_LAYOUT' });

    const activeHash = hashLayout(byCandidate.activeLayout);
    const plan = planHash(byCandidate);
    expect(plan).not.toBeNull();
    for (const [route, s] of [['variant', byVariant], ['draft', byDraft]] as const) {
      expect(hashLayout(s.activeLayout), route).toBe(activeHash);
      expect(planHash(s), route).toBe(plan);
      expect(s.analysisStale, route).toBe(false);
    }
    // The optimizer's own plan (no fingering) is never what Promote shows.
    expect(byCandidate.analysisResult!.executionPlan.fingerAssignments.length).toBeGreaterThan(0);
    // The Active Layout is the candidate as its draft would be (preferences re-derived).
    expect(activeHash).toBe(hashLayout(withDerivedLayoutState(candidate.layout, base.voiceConstraints)));
  });

  it('a pad map matching a candidate promotes as that candidate: every such card leaves the list and its trace stays on screen', () => {
    const used = projectReducer(base, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-b' } });
    expect(layoutIdentity(used, used.workingLayout!)).toBe(layoutIdentity(used, candidate.layout));
    const promoted = projectReducer(used, { type: 'PROMOTE_WORKING_LAYOUT' });
    expect(promoted.candidates.map(c => c.id)).toEqual(['cand-a']);
    expect(getActiveTrace(promoted)).toBe(TRACE);
    expect(promoted.iterationTrace).toBe(TRACE);

    const fromCard = projectReducer(base, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(fromCard.candidates.map(c => c.id)).toEqual(['cand-a']);
    expect(getActiveTrace(fromCard)).toBe(TRACE);
    // The candidate's own move history and stopReason stay on screen, marked promoted (S3.4, T33).
    const withOwn = { ...base, candidates: base.candidates.map(c => c.id === 'cand-b' ? { ...c, moveHistory: [], stopReason: 'no_improving_move' as const } : c) };
    const carried = projectReducer(withOwn, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect({ moves: carried.moveHistory, stop: carried.moveHistoryStopReason, promoted: carried.traceSubject?.promoted })
      .toEqual({ moves: [], stop: 'no_improving_move', promoted: true });
  });

  it('staleness detection holds after the rebind: fresh for the promoted Active, stale after an edit', () => {
    const promoted = projectReducer(base, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b', reviewed: reviewedFor(base, candidate.layout) } });
    expect(promoted.analysisResult!.executionPlan.layoutBinding!.layoutHash).toBe(hashLayout(promoted.activeLayout));
    expect(getAnalysisForLayout(promoted, promoted.activeLayout)).toBe(promoted.analysisResult);
    const edited = projectReducer(promoted, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: promoted.soundStreams[0]! } });
    expect(edited.workingLayout).not.toBeNull();
    expect(getAnalysisForLayout(edited, edited.workingLayout!)).toBeNull();
    expect(edited.analysisStale).toBe(true);
  });

  it('uses the inspected layout\'s own plan when the action carries none (the bar\'s Promote of the layout on screen)', () => {
    const reviewed = reviewedFor(base, candidate.layout);
    const inspected = reduce(base,
      { type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-b' } },
      { type: 'SET_INSPECTED_ANALYSIS', payload: reviewed },
    );
    const promoted = projectReducer(inspected, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(planHash(promoted)).toBe(JSON.stringify(reviewed.executionPlan.fingerAssignments.map(a => [a.eventKey, a.voiceId, a.row, a.col, a.assignedHand, a.finger])));
    expect(promoted.analysisStale).toBe(false);
  });

  it('keeps the replaced Active as a variant and an unrelated draft in Recovered drafts', () => {
    const drafted = projectReducer(base, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '0,0', stream: base.soundStreams[3]! } });
    const promoted = projectReducer(drafted, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(promoted.savedVariants.map(v => v.provenance)).toEqual(['replaced-active']);
    expect(promoted.recoveredDrafts.map(l => hashLayout(l))).toEqual([hashLayout(drafted.workingLayout!)]);
    expect(promoted.workingLayout).toBeNull();
    expect(promoted.inspectedLayout).toBeNull();
  });
});

/** The hook every entry point calls, in a real ProjectProvider. */
describe('useLayoutActions().promote: one undo step, one toast', () => {
  let api: ReturnType<typeof useProject>;
  let actions: ReturnType<typeof useLayoutActions>;
  function Spy() {
    api = useProject();
    actions = useLayoutActions();
    return null;
  }
  const mount = (state: ProjectState) => render(
    <ToastProvider>
      <ProjectProvider initialState={state}>
        <Spy />
      </ProjectProvider>
    </ToastProvider>,
  );

  it('acts at once with the cached plan, says the verdict and the unplaced Sounds, and one Undo brings everything back', async () => {
    mount(base);
    const before = { active: hashLayout(base.activeLayout), candidates: base.candidates.map(c => c.id) };
    act(() => actions.promote({ kind: 'candidate', id: 'cand-b' }));
    expect(api.state.analysisResult!.executionPlan.fingerAssignments.length).toBeGreaterThan(0);
    expect(api.undoLabel).toBe('Promote');
    const toasts = screen.getAllByTestId('toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.textContent).toMatch(/^Promoted Candidate B to Active Layout · (Feasible|Degraded|Infeasible)/);

    fireEvent.click(within(toasts[0]!).getByRole('button', { name: 'Undo' }));
    expect(hashLayout(api.state.activeLayout)).toBe(before.active);
    expect(api.state.candidates.map(c => c.id).sort()).toEqual([...before.candidates].sort());
    expect(api.canUndo).toBe(false);
  });

  it('warns about Sounds a promoted layout leaves unplaced', () => {
    const partial: CandidateSolution = { ...candidate, id: 'cand-p', layout: { ...candidate.layout, id: 'cand-p-layout', padToVoice: { '3,3': Object.values(candidate.layout.padToVoice)[0]! } } };
    mount(projectReducer(base, { type: 'SET_CANDIDATES', payload: [partial] }));
    act(() => actions.promote({ kind: 'candidate', id: 'cand-p' }));
    expect(screen.getByTestId('toast').textContent).toContain('6 Sounds not placed');
  });
});
