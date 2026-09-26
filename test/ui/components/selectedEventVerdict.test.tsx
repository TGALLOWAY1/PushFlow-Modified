// @vitest-environment happy-dom
/**
 * Honest verdict with an event selected (S1b.1; T07, repro C6; criterion P1b-2a).
 *
 * TEST MIDI 1 with four of seven Sounds placed, solved on the whole
 * performance (as every plan was before S3.3, so its unplaced Sounds' notes
 * can't be played), is Infeasible. Selecting any event keeps the whole-layout
 * verdict pinned (never "Feasible"), and shows the event's own verdict in a
 * separate "Selected event" card with all five factors from FACTOR_META, or
 * "Unplayable" instead of all-zero bars. Both analysis panels are checked.
 *
 * Since S3.3 the app scores only placed Sounds' notes, so its own analysis of
 * the same layout reads "Unfinished · 4 of 7 Sounds placed", and never
 * "Feasible", whichever event is selected (last block).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { PerformanceCostsPanel } from '../../../src/ui/components/panels/PerformanceCostsPanel';
import { ActiveLayoutSummary } from '../../../src/ui/components/panels/ActiveLayoutSummary';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { groupIntoMoments } from '../../../src/engine';
import {
  getActivePerformance,
  getDisplayedLayout,
  projectReducer,
  rebindAnalysisToLayout,
  type ProjectState,
  type ProjectAction,
} from '../../../src/ui/state/projectState';
import { FACTOR_KEYS } from '../../../src/ui/analysis/factorMeta';
import { scoringRequestFor } from '../../../src/ui/analysis/layoutAnalysis';
import { analyseAndScoreLayout } from '../../../src/ui/analysis/scoreLayout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { importTestMidi1 } from '../../helpers/testMidi1';

afterEach(cleanup);

let dispatch: (action: ProjectAction) => void;
function Grab() {
  dispatch = useProject().dispatch;
  return null;
}

let analysed: ProjectState;
let plan: ExecutionPlanResult;

beforeAll(async () => {
  let state = await importTestMidi1();
  ['3,3', '3,4', '4,2', '4,5'].forEach((padKey, i) => {
    state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream: state.soundStreams[i] } });
  });
  const layout = getDisplayedLayout(state)!;
  plan = await createBeamSolver({ instrumentConfig: state.instrumentConfig, layout, sourceLayoutRole: layout.role })
    .solve(getActivePerformance(state), { ...state.engineConfig, beamWidth: 15 });
  const analysis = { id: 'analysis', layout, executionPlan: plan, metadata: { strategy: 'analysis', seed: 0 } } as unknown as CandidateSolution;
  analysed = projectReducer(state, { type: 'SET_ANALYSIS_RESULT', payload: analysis });
}, 60_000);

function renderPanels() {
  return render(
    <ProjectProvider initialState={analysed}>
      <Grab />
      <div data-testid="costs"><PerformanceCostsPanel /></div>
      <div data-testid="summary"><ActiveLayoutSummary /></div>
    </ProjectProvider>,
  );
}

describe('verdict with an event selected', () => {
  it('the fixture is Infeasible, with playable and unplayable events', () => {
    expect(plan.diagnostics?.feasibility.level).toBe('infeasible');
    const moments = groupIntoMoments(plan.fingerAssignments);
    expect(moments.some(m => m.items.every(a => a.assignedHand !== 'Unplayable'))).toBe(true);
    expect(moments.some(m => m.items.some(a => a.assignedHand === 'Unplayable'))).toBe(true);
  });

  it('keeps the whole-layout verdict pinned and never shows "Feasible" for any selected event', () => {
    renderPanels();
    const moments = groupIntoMoments(plan.fingerAssignments);
    for (const moment of moments) {
      for (const a of moment.items) {
        act(() => dispatch({ type: 'SELECT_EVENT', payload: a.eventIndex! }));
        const badges = screen.getAllByTestId('verdict-badge');
        expect(badges).toHaveLength(2);
        for (const badge of badges) {
          expect(badge.getAttribute('data-level')).toBe('infeasible');
          expect(within(badge).getByTestId('verdict-scope').textContent).toBe('Analysing 7 of 7 Sounds · 3 not placed yet');
        }
      }
    }
  });

  it('shows the selected event in its own card: all five factors, or "Unplayable" instead of zero bars', () => {
    renderPanels();
    const moments = groupIntoMoments(plan.fingerAssignments);
    for (const moment of moments) {
      act(() => dispatch({ type: 'SELECT_EVENT', payload: moment.items[moment.items.length - 1].eventIndex! }));
      for (const panel of ['costs', 'summary']) {
        const card = within(screen.getByTestId(panel)).getByTestId('selected-event-card');
        expect(card.textContent).toContain(`Event ${moment.index + 1}`);
        expect(within(card).getByTestId('verdict-scope')).toBeTruthy();
        const level = within(card).getByTestId('moment-verdict').getAttribute('data-level');
        const unplayable = moment.items.some(a => a.assignedHand === 'Unplayable');
        if (unplayable) {
          expect(level).toBe('Unplayable');
          expect(within(card).queryByTestId('moment-factor-transition')).toBeNull();
          expect(card.textContent).toContain('can’t be played');
        } else {
          expect(level).toBe(moment.items[0].difficulty);
          for (const key of FACTOR_KEYS) expect(within(card).getByTestId(`moment-factor-${key}`)).toBeTruthy();
        }
      }
    }
  });

  it('shows no Selected event card and keeps the verdict once the selection is cleared', () => {
    renderPanels();
    act(() => dispatch({ type: 'SELECT_EVENT', payload: plan.fingerAssignments[0].eventIndex! }));
    act(() => dispatch({ type: 'SELECT_EVENT', payload: null }));
    expect(screen.queryByTestId('selected-event-card')).toBeNull();
    expect(screen.getAllByTestId('verdict-badge').map(b => b.getAttribute('data-level'))).toEqual(['infeasible', 'infeasible']);
  });

  // Codex review on PR #104: a mute marks the analysis stale but the old plan
  // stays on screen until re-analysis; its verdict keeps the plan's scope.
  it('keeps the verdict’s scope tied to the displayed plan after a mute', () => {
    renderPanels();
    act(() => dispatch({ type: 'TOGGLE_MUTE', payload: analysed.soundStreams[0].id }));
    for (const badge of screen.getAllByTestId('verdict-badge')) {
      expect(badge.getAttribute('data-level')).toBe('infeasible');
      expect(within(badge).getByTestId('verdict-scope').textContent).toBe('Analysing 7 of 7 Sounds · 3 not placed yet');
    }
  });
});

describe('the app\'s own analysis of a partly placed layout (S3.3, T25)', () => {
  let placedOnly: ProjectState;
  let placedPlan: ExecutionPlanResult;

  beforeAll(async () => {
    const layout = getDisplayedLayout(analysed)!;
    // The one scoring path: only the four placed Sounds' notes.
    const { request } = scoringRequestFor(analysed, layout);
    const { analysis } = await analyseAndScoreLayout(request);
    placedPlan = analysis.executionPlan;
    placedOnly = projectReducer(analysed, { type: 'SET_ANALYSIS_RESULT', payload: rebindAnalysisToLayout(analysis, layout) });
  }, 60_000);

  it('scores only the placed Sounds\' notes', () => {
    const placed = new Set(Object.values(getDisplayedLayout(analysed)!.padToVoice).map(v => v.id));
    expect(placedPlan.fingerAssignments.length).toBeGreaterThan(0);
    expect(placedPlan.fingerAssignments.every(a => placed.has(a.voiceId!))).toBe(true);
    expect(placedPlan.fingerAssignments.some(a => a.assignedHand === 'Unplayable')).toBe(false);
  });

  it('reads "Unfinished · 4 of 7 Sounds placed" in both panels, and never "Feasible" for any selected event', () => {
    render(
      <ProjectProvider initialState={placedOnly}>
        <Grab />
        <div data-testid="costs"><PerformanceCostsPanel /></div>
        <div data-testid="summary"><ActiveLayoutSummary /></div>
      </ProjectProvider>,
    );
    const check = () => {
      const badges = screen.getAllByTestId('verdict-badge');
      expect(badges).toHaveLength(2);
      for (const badge of badges) {
        expect(badge.getAttribute('data-level')).toBe('unfinished');
        expect(within(badge).getByTestId('verdict-headline').textContent).toBe('Unfinished · 4 of 7 Sounds placed');
        expect(badge.textContent).toMatch(/Scoring covers the \d+ notes you can play so far/);
        expect(within(badge).getByTestId('verdict-scope').textContent).toBe('Analysing 4 of 7 Sounds · 3 not placed yet');
      }
    };
    check();
    for (const moment of groupIntoMoments(placedPlan.fingerAssignments)) {
      act(() => dispatch({ type: 'SELECT_EVENT', payload: moment.items[0]!.eventIndex! }));
      check();
    }
    // The unplaced Sounds are listed, each draggable onto a pad, with "Place remaining 3 Sounds".
    for (const panel of ['costs', 'summary']) {
      const unplaced = within(screen.getByTestId(panel)).getByTestId('unplaced-sounds');
      expect(within(unplaced).getAllByTestId('unplaced-sound')).toHaveLength(3);
      for (const chip of within(unplaced).getAllByTestId('unplaced-sound')) expect(chip.getAttribute('draggable')).toBe('true');
      expect(within(unplaced).getByTestId('place-remaining').textContent).toBe('Place remaining 3 Sounds');
    }
  });
});
