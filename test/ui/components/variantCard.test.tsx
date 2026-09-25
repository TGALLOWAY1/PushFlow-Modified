// @vitest-environment happy-dom
/**
 * S2.3 · variants worth keeping (T29, P2-6): each variant card reads
 * "Scoring..." while its layout is analysed through the per-layout cache, then
 * its score and Hard/Unplayable event counts; a card renames its variant in
 * place.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { LayoutOptionsPanel } from '../../../src/ui/components/panels/LayoutOptionsPanel';
import { projectReducer, type ProjectState } from '../../../src/ui/state/projectState';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { suggestedTestMidi1 } from '../../helpers/testMidi1';

let resolveAnalysis: ((value: CandidateSolution) => void) | null = null;
vi.mock('../../../src/ui/analysis/analyzeLayout', () => ({
  analyzeLayout: vi.fn(() => new Promise<CandidateSolution>(resolve => { resolveAnalysis = resolve; })),
}));

afterEach(cleanup);

let latest: ProjectState;
function Spy() {
  latest = useProject().state;
  return null;
}

async function projectWithVariant(): Promise<ProjectState> {
  const draft = await suggestedTestMidi1();
  // Promote, then move one Sound, so the variant differs from what the project has analysed.
  let state = projectReducer(draft, { type: 'PROMOTE_WORKING_LAYOUT' });
  const [firstPad, voice] = Object.entries(state.activeLayout.padToVoice)[0]!;
  state = projectReducer(state, { type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: firstPad } });
  const stream = state.soundStreams.find(s => s.id === voice.id)!;
  state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '7,7', stream } });
  return projectReducer(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'Corner kick', source: 'working', variantId: 'v1' } });
}

describe('saved variant cards', () => {
  it('read "Scoring..." while the variant is analysed, then its score and hard/unplayable events', async () => {
    const initial = await projectWithVariant();
    render(
      <ToastProvider>
        <ProjectProvider initialState={initial}>
          <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
        </ProjectProvider>
      </ToastProvider>,
    );
    const row = await screen.findByTestId('variant-row');
    expect(within(row).getByTestId('variant-score').textContent).toBe('Scoring...');

    const variant = initial.savedVariants[0]!;
    await act(async () => {
      resolveAnalysis!({
        id: 'analysis',
        layout: variant,
        executionPlan: {
          score: 81.6,
          unplayableCount: 0,
          hardCount: 0,
          fingerAssignments: [
            { noteNumber: 36, voiceId: 'a', startTime: 0, assignedHand: 'right', finger: 'index', cost: 1, difficulty: 'Hard', eventIndex: 0 },
            { noteNumber: 38, voiceId: 'b', startTime: 0.5, assignedHand: 'Unplayable', finger: null, cost: Infinity, difficulty: 'Unplayable', eventIndex: 1 },
          ],
        },
      } as unknown as CandidateSolution);
    });
    expect(within(row).getByTestId('variant-score').textContent).toBe('Score 82% · 1 hard · 1 unplayable');
  });

  it('renames a variant in place; Escape keeps the old name', async () => {
    const initial = await projectWithVariant();
    render(
      <ToastProvider>
        <ProjectProvider initialState={initial}>
          <Spy />
          <LayoutOptionsPanel selectedForCompare={new Set()} onToggleCompare={() => {}} onCompare={() => {}} />
        </ProjectProvider>
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByTestId('variant-rename'));
    const input = screen.getByTestId('variant-name-input');
    fireEvent.change(input, { target: { value: 'Wide hands' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(latest.savedVariants[0]!.name).toBe('Corner kick');

    fireEvent.click(screen.getByTestId('variant-rename'));
    const again = screen.getByTestId('variant-name-input');
    fireEvent.change(again, { target: { value: 'Wide hands' } });
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(latest.savedVariants[0]!.name).toBe('Wide hands');
    expect(screen.getByTestId('variant-name').textContent).toBe('Wide hands');
  });
});
