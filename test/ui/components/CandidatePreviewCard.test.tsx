// @vitest-environment happy-dom
/**
 * CandidatePreviewCard (S3.4; P3-9, and the S1a.3 follow-up "No component
 * tests for MoveTracePanel and CandidatePreviewCard").
 *
 * Every candidate's card line says why its run stopped, for greedy, beam and
 * annealing alike, before what ran ("Stopped: time limit reached · Deep
 * optimization (2,412 of 3,200 iterations over 4 runs)"), so a narrow card that
 * cuts the line still shows the reason. The card names its letter and strategy,
 * and Inspect (the lifecycle list's word) shows it without writing anything.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProjectProvider } from '../../../src/ui/state/ProjectContext';
import { CandidatePreviewCard } from '../../../src/ui/components/panels/CandidatePreviewCard';
import { createEmptyProjectState } from '../../../src/ui/state/projectState';
import { lifecycleLabel } from '../../../src/ui/state/lifecycleActions';
import { candidateRunLine } from '../../../src/ui/analysis/stopReason';
import { type CandidateSolution } from '../../../src/types/candidateSolution';

afterEach(cleanup);

function candidate(extra: Partial<CandidateSolution> & { metadata: CandidateSolution['metadata'] }): CandidateSolution {
  const layout = { ...createEmptyProjectState().activeLayout, id: 'cand-layout' };
  return {
    id: 'cand-1',
    layout,
    executionPlan: {
      fingerAssignments: [],
      unplayableCount: 0,
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 1, handBalance: 0, constraintPenalty: 0 },
    },
    difficultyAnalysis: { overallScore: 0.1, passages: [], bindingConstraints: [] },
    tradeoffProfile: { playability: 1, compactness: 1, handBalance: 1, transitionEfficiency: 1, structuralCoherence: 1 },
    ...extra,
  } as unknown as CandidateSolution;
}

function renderCard(c: CandidateSolution, props: Partial<Parameters<typeof CandidatePreviewCard>[0]> = {}) {
  const onInspect = vi.fn();
  render(
    <ProjectProvider initialState={createEmptyProjectState()}>
      <CandidatePreviewCard
        candidate={c}
        soundStreams={[]}
        letter="B"
        isInspected={false}
        isCheckedForCompare={false}
        onInspect={onInspect}
        onPromote={() => {}}
        onDelete={() => {}}
        onToggleCompare={() => {}}
        {...props}
      />
    </ProjectProvider>,
  );
  return { onInspect };
}

const runLine = () => screen.getByTestId('candidate-run-line');

describe('CandidatePreviewCard · why its run stopped (P3-9)', () => {
  it.each<[string, CandidateSolution, string]>([
    ['greedy', candidate({
      stopReason: 'no_improving_move',
      metadata: { strategy: 'Natural Pose Anchor (seed 1)', seed: 1, optimizationSummary: 'Greedy Strict Greedy Descent: 12 moves, cost 50.29' },
    }), 'Stopped: no move improved the layout · Greedy Strict Greedy Descent: 12 moves, cost 50.29'],
    ['beam', candidate({
      stopReason: 'completed',
      metadata: { strategy: 'compact-right', seed: 0, optimizationMode: 'fast', optimizationSummary: 'Quick optimization (3000 iterations, 0 restarts)' },
    }), 'Stopped: finished · Quick optimization (3000 iterations, 0 restarts)'],
    ['annealing, time-limited', candidate({
      stopReason: 'time_budget',
      metadata: { strategy: 'pose0-offset-0', seed: 0, optimizationMode: 'deep', optimizationSummary: 'Deep optimization (2,412 of 3,200 iterations over 4 runs)' },
    }), 'Stopped: time limit reached · Deep optimization (2,412 of 3,200 iterations over 4 runs)'],
  ])('%s: the card line leads with the stop reason', (_method, c, expected) => {
    renderCard(c);
    expect(runLine().textContent).toBe(expected);
    // The whole line is in its tooltip when the card cuts it.
    expect(runLine().getAttribute('title')).toBe(expected);
    expect(candidateRunLine(c)).toBe(expected);
  });

  it('a candidate from before stop reasons existed still shows what ran; one with neither shows no line', () => {
    renderCard(candidate({ metadata: { strategy: 'baseline', seed: 0, optimizationMode: 'fast' } }));
    expect(runLine().textContent).toBe('fast');
    cleanup();
    renderCard(candidate({ metadata: { strategy: 'baseline', seed: 0 } }));
    expect(screen.queryByTestId('candidate-run-line')).toBeNull();
  });
});

describe('CandidatePreviewCard · identity and Inspect', () => {
  it('names its letter and how it was made; Inspect shows it and says so once it is on screen', () => {
    const c = candidate({ stopReason: 'completed', metadata: { strategy: 'compact-right', seed: 0 } });
    const { onInspect } = renderCard(c);
    expect(screen.getByTestId('candidate-row').dataset.letter).toBe('B');
    expect(screen.getByTestId('candidate-letter').textContent).toBe('B');
    expect(screen.getByText('Compact, right hand')).toBeTruthy();
    const inspect = screen.getByTestId('candidate-inspect');
    expect(inspect.textContent).toBe(lifecycleLabel('inspect'));
    fireEvent.click(inspect);
    expect(onInspect).toHaveBeenCalledTimes(1);
    cleanup();
    renderCard(c, { isInspected: true });
    expect(screen.getByTestId('candidate-inspect').getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('candidate-row').dataset.inspected).toBe('true');
  });
});
