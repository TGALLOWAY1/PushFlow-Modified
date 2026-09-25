// @vitest-environment happy-dom
/**
 * MoveTracePanel (S3.4; T33 data slice, and the S1a.3 follow-up "No component
 * tests for MoveTracePanel").
 *
 * The panel renders a greedy trace (moves or iterations) with its phase counts
 * and step-through, and says why the run stopped in the shared words:
 * "Stopped: time limit reached" (Thorough's budget), "Stopped: cancelled".
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { MoveTracePanel } from '../../../src/ui/components/panels/MoveTracePanel';
import { createEmptyProjectState, type ProjectState } from '../../../src/ui/state/projectState';
import { STOP_REASON_LABELS, type OptimizerMove, type StopReason } from '../../../src/engine/optimization/optimizerInterface';
import { stopReasonText } from '../../../src/ui/analysis/stopReason';

afterEach(cleanup);

let latest: ProjectState;
function Spy() {
  latest = useProject().state;
  return null;
}

const move = (iteration: number, phase: OptimizerMove['phase'], costDelta: number): OptimizerMove => ({
  iteration,
  type: 'pad_move',
  description: `Move ${iteration}`,
  costBefore: 10,
  costAfter: 10 + costDelta,
  costDelta,
  reason: `Reason ${iteration}`,
  phase,
  attemptIndex: 0,
});

const MOVES: OptimizerMove[] = [
  move(-1, 'init-fingers', 0),
  move(0, 'hill-climb', -1.5),
  move(1, 'hill-climb', -0.25),
];

function renderPanel(props: Parameters<typeof MoveTracePanel>[0]) {
  return render(
    <ProjectProvider initialState={createEmptyProjectState()}>
      <Spy />
      <MoveTracePanel {...props} />
    </ProjectProvider>,
  );
}

describe('MoveTracePanel', () => {
  it('renders nothing without a trace', () => {
    const { container } = renderPanel({ moves: null, trace: null, stopReason: 'completed' });
    expect(container.textContent).toBe('');
  });

  it('lists the moves with their phase counts', () => {
    renderPanel({ moves: MOVES, stopReason: 'no_improving_move' });
    expect(screen.getByText('3 steps')).toBeTruthy();
    expect(screen.getByText('Hill Climb (2)')).toBeTruthy();
    for (const m of MOVES) expect(screen.getByText(m.description)).toBeTruthy();
  });

  it.each<[StopReason, string]>([
    ['time_budget', 'Stopped: time limit reached'],
    ['cancelled', 'Stopped: cancelled'],
    ['no_improving_move', 'Stopped: no move improved the layout'],
    ['completed', 'Stopped: finished'],
  ])('says why the run stopped: %s reads "%s"', (reason, text) => {
    renderPanel({ moves: MOVES, stopReason: reason });
    expect(screen.getByTestId('trace-stop-reason').textContent).toBe(text);
  });

  it('has words for every stop reason the engine reports', () => {
    for (const reason of Object.keys(STOP_REASON_LABELS) as StopReason[]) {
      expect(stopReasonText(reason)).toMatch(/^Stopped: [a-z]/);
      expect(stopReasonText(reason)).not.toContain('_');
    }
    // A reason from older state that the engine no longer lists is shown as it is.
    renderPanel({ moves: MOVES, stopReason: 'legacy_reason' });
    expect(screen.getByTestId('trace-stop-reason').textContent).toBe('Stopped: legacy_reason');
  });

  it('shows no stop line when the run did not say', () => {
    renderPanel({ moves: MOVES });
    expect(screen.queryByTestId('trace-stop-reason')).toBeNull();
  });

  it('steps through the trace with Next and Prev (state.moveHistoryIndex)', () => {
    renderPanel({ moves: MOVES, stopReason: 'completed' });
    fireEvent.click(screen.getByText('Move 0'));
    expect(latest.moveHistoryIndex).toBe(1);
    fireEvent.click(screen.getByText(/Next/));
    expect(latest.moveHistoryIndex).toBe(2);
    fireEvent.click(screen.getByText(/Prev/));
    expect(latest.moveHistoryIndex).toBe(1);
    expect(screen.getByText('Step 2 / 3')).toBeTruthy();
  });
});
