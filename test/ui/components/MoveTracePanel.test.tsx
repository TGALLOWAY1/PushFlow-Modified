// @vitest-environment happy-dom
/**
 * MoveTracePanel (S3.4; T33, and the S1a.3 follow-up "No component tests for
 * MoveTracePanel"): how the candidate on screen was found.
 *
 * - Titled "How candidate B was found · Stopped: <reason>" for every method,
 *   in the shared words ("Stopped: time limit reached").
 * - Greedy: each step's before, after and change agree and are said in words,
 *   even when the optimizer's own costBefore leaves out a term (F3-07: step 1
 *   read "−44.29" beside "86.51 → 88.22"); phases with no steps are hidden;
 *   the replay step is an index into the whole list.
 * - Annealing: a cost and temperature sparkline with accepted moves, drawn
 *   from a downsampled trace while the summary and the per-run table read
 *   every snapshot.
 * - Beam: a summary of the search.
 * - Bound to state: the panel reads state.moveHistory and friends, which
 *   follow the inspected candidate and survive promotion.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { MoveTracePanel } from '../../../src/ui/components/panels/MoveTracePanel';
import { createEmptyProjectState, type ProjectState, type TraceSubject } from '../../../src/ui/state/projectState';
import { STOP_REASON_LABELS, type OptimizerMove, type OptimizationIteration, type StopReason } from '../../../src/engine/optimization/optimizerInterface';
import { type AnnealingIterationSnapshot } from '../../../src/types/executionPlan';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { stopReasonText } from '../../../src/ui/analysis/stopReason';
import { ANNEALING_MAX_POINTS } from '../../../src/ui/analysis/traceSummary';

afterEach(cleanup);

let latest: ReturnType<typeof useProject>;
function Spy() {
  latest = useProject();
  return null;
}

const move = (iteration: number, phase: OptimizerMove['phase'], costAfter: number, costDelta: number, costBefore = costAfter - costDelta): OptimizerMove => ({
  iteration,
  type: 'pad_move',
  description: `Move ${iteration}`,
  costBefore,
  costAfter,
  costDelta,
  reason: `Reason ${iteration}`,
  phase,
  attemptIndex: 0,
});

const MOVES: OptimizerMove[] = [
  move(-1, 'init-fingers', 10, 0),
  move(0, 'hill-climb', 8.5, -1.5),
  move(1, 'hill-climb', 8.25, -0.25),
];

const subject = (extra: Partial<TraceSubject> = {}): TraceSubject => ({
  candidateId: 'cand-b', letter: 'B', annealing: null, beam: null, telemetry: null, promoted: false, ...extra,
});

function renderPanel(props: Parameters<typeof MoveTracePanel>[0], state: ProjectState = createEmptyProjectState()) {
  return render(
    <ProjectProvider initialState={state}>
      <Spy />
      <MoveTracePanel {...props} />
    </ProjectProvider>,
  );
}

const title = () => screen.getByTestId('trace-title').textContent;
const summary = () => screen.getByTestId('trace-summary').textContent;

describe('MoveTracePanel · title and stop reason', () => {
  it('renders nothing without a trace', () => {
    const { container } = renderPanel({ moves: null, trace: null, stopReason: 'completed', subject: subject() });
    expect(container.textContent).toBe('');
  });

  it.each<[string, Parameters<typeof MoveTracePanel>[0], string]>([
    ['greedy', { moves: MOVES, stopReason: 'no_improving_move', subject: subject() }, 'How candidate B was found · Stopped: no move improved the layout'],
    ['beam', { stopReason: 'completed', subject: subject({ letter: 'C', beam: { beamWidth: 16, noteCount: 48, layoutStrategy: 'baseline', wallClockMs: 40 } }) }, 'How candidate C was found · Stopped: finished'],
  ])('names the candidate and why its run stopped: %s', (method, props, expected) => {
    renderPanel(props);
    expect(title()).toBe(expected);
    expect(screen.getByTestId('trace-panel').dataset.method).toBe(method);
  });

  it('titles an annealing trace the same way, "Stopped: time limit reached" for the time budget', () => {
    renderPanel({ stopReason: 'time_budget', subject: subject({ letter: 'A', annealing: snapshots(40, 2) }) });
    expect(title()).toBe('How candidate A was found · Stopped: time limit reached');
    expect(screen.getByTestId('trace-panel').dataset.method).toBe('annealing');
  });

  it.each<[StopReason, string]>([
    ['time_budget', 'Stopped: time limit reached'],
    ['cancelled', 'Stopped: cancelled'],
    ['no_improving_move', 'Stopped: no move improved the layout'],
    ['completed', 'Stopped: finished'],
  ])('says why the run stopped: %s reads "%s"', (reason, text) => {
    renderPanel({ moves: MOVES, stopReason: reason, subject: subject() });
    expect(screen.getByTestId('trace-stop-reason').textContent).toBe(text);
  });

  it('has words for every stop reason the engine reports', () => {
    for (const reason of Object.keys(STOP_REASON_LABELS) as StopReason[]) {
      expect(stopReasonText(reason)).toMatch(/^Stopped: [a-z]/);
      expect(stopReasonText(reason)).not.toContain('_');
    }
    // A reason from older state that the engine no longer lists is shown as it is.
    renderPanel({ moves: MOVES, stopReason: 'legacy_reason', subject: subject() });
    expect(screen.getByTestId('trace-stop-reason').textContent).toBe('Stopped: legacy_reason');
  });

  it('shows no stop line when the run did not say, and names no candidate for a trace without one', () => {
    renderPanel({ moves: MOVES, subject: null });
    expect(screen.queryByTestId('trace-stop-reason')).toBeNull();
    expect(title()).toBe('How this layout was found');
  });
});

describe('MoveTracePanel · greedy', () => {
  it('states every step’s before, after and change in words, and they agree (F3-07)', () => {
    // The optimizer's costBefore left out the rhythm-peer cost that costAfter
    // and costDelta include: 86.51 → 88.22 beside a change of −44.29.
    const inconsistent = move(0, 'hill-climb', 88.22, -44.29, 86.51);
    const worse = move(1, 'hill-climb', 90.02, 1.8);
    renderPanel({ moves: [move(-1, 'init-fingers', 132.51, 0), inconsistent, worse], stopReason: 'iteration_cap', subject: subject() });

    expect(summary()).toBe('3 steps · cost 132.5 → 90.0 · −42.5 cost · better');
    const rows = screen.getAllByTestId('trace-row');
    const badges = screen.getAllByTestId('trace-row-change');
    expect(badges.map(b => [b.textContent, b.getAttribute('title')])).toEqual([
      ['−44.3', '−44.3 cost · better'],
      ['+1.8', '+1.8 cost · worse'],
    ]);
    fireEvent.click(within(rows[1]!).getByRole('button'));
    expect(within(rows[1]!).getByTestId('trace-row-cost').textContent).toBe('Cost 132.5 → 88.2 · −44.3 cost · better');
    fireEvent.click(within(rows[2]!).getByRole('button'));
    expect(within(rows[2]!).getByTestId('trace-row-cost').textContent).toBe('Cost 88.2 → 90.0 · +1.8 cost · worse');
    // Every row's numbers add up: after − before is the change.
    for (const row of screen.getAllByTestId('trace-row-cost')) {
      const [before, after, change] = row.textContent!.replace(/−/g, '-').match(/-?\+?[\d.]+/g)!.map(Number);
      expect(after! - before!).toBeCloseTo(change!, 9);
    }
    // No double negative ("Cost Saved -56.81") anywhere.
    expect(screen.getByTestId('trace-panel').textContent).not.toMatch(/Saved|−\s*−|- -/);
  });

  it('a step and the move it chose read the same change, rounded once', () => {
    const [step] = iterations(1);
    const chosen = { moveType: 'pad_move', description: 'Move D', fromPadKey: '7,0', toPadKey: '6,0', deltaTotal: -6.78, accepted: true } as const;
    const other = { moveType: 'pad_move', description: 'Move A', fromPadKey: '1,1', toPadKey: '1,2', deltaTotal: -4.31, accepted: false } as const;
    renderPanel({ trace: [{ ...step!, scoreAfter: 97.66, netDelta: -6.78, candidateMoves: [other, chosen], chosenMove: chosen }], subject: subject() });
    expect(screen.getByTestId('trace-row-change').textContent).toBe('−6.8');
    fireEvent.click(within(screen.getByTestId('trace-row')).getByRole('button'));
    expect(screen.getByTestId('trace-row-cost').textContent).toBe('Cost 104.5 → 97.7 · −6.8 cost · better');
    expect(screen.getByText('Chosen: Move D').nextSibling?.textContent).toBe('−6.8');
    expect(screen.getByText('Move A').nextSibling?.textContent).toBe('−4.3');
  });

  it('hides phases with no steps, and the filter when only one phase had any', () => {
    renderPanel({ moves: MOVES, stopReason: 'no_improving_move', subject: subject() });
    const chips = within(screen.getByTestId('trace-phases')).getAllByRole('button');
    expect(chips.map(c => c.textContent)).toEqual(['All (3)', 'Finger setup (1)', 'Hill climb (2)']);
    expect(screen.queryByText(/Placement/)).toBeNull();
    cleanup();

    // Greedy's usual trace: hill-climb steps only.
    renderPanel({ trace: iterations(4), stopReason: 'no_improving_move', subject: subject() });
    expect(screen.queryByTestId('trace-phases')).toBeNull();
    expect(screen.queryByText('Hill climb')).toBeNull();
    expect(summary()).toBe('4 steps · cost 40.0 → 36.0 · −4.0 cost · better');
  });

  it('filters by phase; replay steps index the whole list (state.moveHistoryIndex) with Next, Prev and Exit replay', () => {
    renderPanel({ moves: MOVES, stopReason: 'completed', subject: subject() });
    fireEvent.click(screen.getByText('Move 0'));
    expect(latest.state.moveHistoryIndex).toBe(1);
    fireEvent.click(screen.getByText(/Next/));
    expect(latest.state.moveHistoryIndex).toBe(2);
    fireEvent.click(screen.getByText(/Prev/));
    expect(latest.state.moveHistoryIndex).toBe(1);
    expect(screen.getByTestId('trace-step').textContent).toBe('Step 2 / 3');

    // With Hill climb shown alone, its rows keep their places in the whole list.
    fireEvent.click(screen.getByRole('button', { name: 'Hill climb (2)' }));
    expect(screen.getAllByTestId('trace-row').map(r => r.dataset.step)).toEqual(['1', '2']);
    fireEvent.click(screen.getByText(/Next/));
    expect(latest.state.moveHistoryIndex).toBe(2);
    fireEvent.click(screen.getByText(/Prev/));
    expect(latest.state.moveHistoryIndex).toBe(1);
    // Before the first step shown there is nothing to go back to.
    expect((screen.getByText(/Prev/) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('trace-exit-replay'));
    expect(latest.state.moveHistoryIndex).toBeNull();
  });
});

describe('MoveTracePanel · annealing', () => {
  it('draws cost and temperature from a downsampled trace, with accepted moves; the summary and table read every snapshot', () => {
    const trace = snapshots(1000, 2, { stoppedRun: 1 });
    renderPanel({ stopReason: 'time_budget', subject: subject({ letter: 'A', annealing: trace }) });
    const accepted = trace.filter(s => s.accepted).length;
    expect(summary()).toBe(`1,000 iterations over 2 runs · ${accepted.toLocaleString('en-US')} accepted · cost 200.0 → best 50.0 · −150.0 cost · better`);

    const best = screen.getByTestId('trace-best-line').getAttribute('d')!;
    const points = best.split(/[ML]/).filter(Boolean).length;
    expect(points).toBeLessThanOrEqual(ANNEALING_MAX_POINTS);
    expect(points).toBeGreaterThan(50);
    expect(screen.getByTestId('trace-accepted-rug').querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('trace-annealing-legend')).getByText('Best so far')).toBeTruthy();

    // The table: one row per run, every iteration counted, the time limit named.
    const runs = screen.getAllByTestId('trace-run').map(r => [...r.querySelectorAll('td')].map(td => td.textContent));
    expect(runs).toEqual([
      ['1', '500', String(trace.slice(0, 500).filter(s => s.accepted).length), '100', ''],
      ['2', '500', String(trace.slice(500).filter(s => s.accepted).length), '50.0', 'time limit'],
    ]);
  });

  it('a few costly layouts don’t flatten the best line: the scale stops at the 90th percentile and says peaks are clipped', () => {
    const trace = snapshots(300, 1).map((s, i) => (i % 50 === 25 ? { ...s, currentCost: 5000 } : s));
    renderPanel({ stopReason: 'completed', subject: subject({ letter: 'A', annealing: trace }) });
    const scaleText = screen.getByTestId('trace-cost-scale').textContent!;
    expect(scaleText).toMatch(/^Cost [\d.]+–[\d.]+ · peaks clipped$/);
    const [, hi] = scaleText.match(/–([\d.]+)/)!;
    expect(Number(hi)).toBeLessThan(300);
    // The readout still gives a clipped stretch's real value.
    const chart = screen.getByTestId('trace-annealing-chart');
    fireEvent.keyDown(chart, { key: 'Home' });
    for (let i = 0; i < 12; i++) fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(screen.getByTestId('trace-readout').textContent).toMatch(/^Iterations 25–26 · current \d{4} /);
  });

  it('reads out a stretch of iterations from the keyboard, as on hover', () => {
    renderPanel({ stopReason: 'completed', subject: subject({ letter: 'A', annealing: snapshots(300, 1) }) });
    const chart = screen.getByTestId('trace-annealing-chart');
    expect(screen.getByTestId('trace-readout').textContent).toBe('');
    fireEvent.keyDown(chart, { key: 'End' });
    expect(screen.getByTestId('trace-readout').textContent).toMatch(/^Iterations 29\d–300 · current [\d.]+ · best [\d.]+ · temperature \S+ · \d+ of \d+ accepted$/);
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(screen.getByTestId('trace-readout').textContent).toMatch(/^Iterations 1–\d+ /);
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.getByTestId('trace-readout').textContent).toBe('');
  });
});

describe('MoveTracePanel · beam', () => {
  it('summarises the search, which keeps no step history', () => {
    renderPanel({
      stopReason: 'completed',
      subject: subject({ letter: 'C', beam: { beamWidth: 16, noteCount: 48, layoutStrategy: 'compact-right', wallClockMs: 312 } }),
    });
    expect(screen.getByTestId('trace-panel').dataset.method).toBe('beam');
    expect(screen.getByTestId('trace-beam').textContent).toBe(
      'Beam search fingered 48 notes on its starting layout (Compact, right hand), keeping the 16 best hand positions at each step, '
      + 'in under a second. It searches fingerings for a fixed layout, so it has no step-by-step history.',
    );
  });
});

describe('MoveTracePanel · bound to state (T33)', () => {
  function Bound() {
    const { state } = useProject();
    return (
      <MoveTracePanel
        moves={state.moveHistory}
        trace={state.iterationTrace}
        stopReason={state.moveHistoryStopReason}
        subject={state.traceSubject}
      />
    );
  }

  it('follows the inspected candidate and still renders after it is promoted', () => {
    const state = createEmptyProjectState();
    const a = candidate('cand-a', { moveHistory: MOVES, stopReason: 'no_improving_move' });
    const b = candidate('cand-b', { annealingTrace: snapshots(120, 1), stopReason: 'time_budget' });
    const c = candidate('cand-c', { beamSummary: { beamWidth: 16, noteCount: 48, layoutStrategy: 'baseline', wallClockMs: 20 }, stopReason: 'completed' });
    render(
      <ProjectProvider initialState={state}>
        <Spy />
        <Bound />
      </ProjectProvider>,
    );
    act(() => latest.dispatch({ type: 'SET_CANDIDATES', payload: [a, b, c] }));
    expect(title()).toBe('How candidate A was found · Stopped: no move improved the layout');
    act(() => latest.dispatch({ type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-b' } }));
    expect(title()).toBe('How candidate B was found · Stopped: time limit reached');
    expect(screen.getByTestId('trace-panel').dataset.method).toBe('annealing');
    act(() => latest.dispatch({ type: 'INSPECT_LAYOUT', payload: { kind: 'candidate', id: 'cand-c' } }));
    expect(screen.getByTestId('trace-panel').dataset.method).toBe('beam');

    act(() => latest.dispatch({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } }));
    expect(latest.state.candidates.map(x => x.id)).toEqual(['cand-a', 'cand-c']);
    expect(title()).toBe('How candidate B was found · Stopped: time limit reached');
    expect(screen.getByTestId('trace-annealing')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

/** `n` hill-climb iterations, each 1 cheaper than the last, from 40. */
function iterations(n: number): OptimizationIteration[] {
  return Array.from({ length: n }, (_, i) => ({
    iterationIndex: i,
    phase: 'hill-climb',
    attemptIndex: 0,
    scoreBefore: 40 - i,
    scoreAfter: 39 - i,
    netDelta: -1,
    stateBefore: { layout: createEmptyProjectState().activeLayout, assignment: {} },
    candidateMoves: [],
    chosenMove: null,
    summary: `Iteration ${i}`,
  }) as OptimizationIteration);
}

/**
 * An annealing trace over `runs` runs: the current cost wanders down from 200,
 * the best falls to 100 by the end of the first run and 50 by the end of the
 * last, the temperature cools from 500 by 0.99 per iteration, and every third
 * iteration is accepted.
 */
function snapshots(n: number, runs: number, { stoppedRun }: { stoppedRun?: number } = {}): AnnealingIterationSnapshot[] {
  const perRun = Math.ceil(n / runs);
  return Array.from({ length: n }, (_, i) => {
    const run = Math.floor(i / perRun);
    const step = i - run * perRun;
    const t = (i + 1) / n;
    const best = run === 0 ? 200 - 100 * Math.min(1, (step + 1) / perRun) : 100 - 50 * ((step + 1) / (n - run * perRun));
    return {
      iteration: step,
      temperature: 500 * 0.99 ** step,
      currentCost: i === 0 ? 200 : best + 20 * Math.sin(i) * (1 - t) + 5,
      bestCost: best,
      accepted: i % 3 === 0,
      deltaCost: 0,
      transitionSum: 0,
      fingerPreferenceSum: 0,
      handShapeDeviationSum: 0,
      handBalanceSum: 0,
      constraintPenaltySum: 0,
      restartIndex: run,
      ...(stoppedRun === run && i === n - 1 ? { stoppedBy: 'time_budget' as const } : {}),
    };
  });
}

function candidate(id: string, extra: Partial<CandidateSolution>): CandidateSolution {
  // Each its own pad map: a Promote takes every candidate with the promoted pads (S3.3).
  const layout = { ...createEmptyProjectState().activeLayout, id: `${id}-layout`, padToVoice: { [`0,${id.charCodeAt(id.length - 1) - 97}`]: { id: `${id}-voice` } } }; // cand-a → 0,0, cand-b → 0,1 …
  return {
    id,
    layout,
    executionPlan: { fingerAssignments: [] },
    metadata: { strategy: 'baseline', seed: 0 },
    ...extra,
  } as unknown as CandidateSolution;
}
