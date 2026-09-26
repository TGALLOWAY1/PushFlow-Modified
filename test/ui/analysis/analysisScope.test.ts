/**
 * The scope line every verdict carries (S1b.1, T15 scope line).
 */

import { describe, it, expect } from 'vitest';
import { analysisScope, analysisScopeLine, planSoundIds, scopeLineOf } from '../../../src/ui/analysis/analysisScope';
import { type FingerAssignment } from '../../../src/types/executionPlan';
import { type Layout } from '../../../src/types/layout';

function layoutWith(ids: string[]): Layout {
  const padToVoice: Layout['padToVoice'] = {};
  ids.forEach((id, i) => {
    padToVoice[`0,${i}`] = { id, name: id, color: '#fff', originalMidiNote: null, sourceType: 'midi_track', sourceFile: '' } as Layout['padToVoice'][string];
  });
  return { padToVoice } as Layout;
}

const streams = (muted: boolean[]) => muted.map((m, i) => ({ id: `s${i}`, muted: m }));

describe('analysisScopeLine', () => {
  // S3.3 (T25): only placed Sounds' notes are scored, so an unplaced Sound is
  // left out of the analysis ("not placed yet"), like a muted one.
  it('names analysed, muted and unplaced Sounds', () => {
    const line = analysisScopeLine(streams([false, false, false, false, false, true, true]), layoutWith(['s0', 's1', 's2', 's5']));
    expect(line).toBe('Analysing 3 of 7 Sounds · 2 muted · 2 not placed yet');
  });

  it('is just the count when everything is analysed and placed', () => {
    expect(analysisScopeLine(streams([false, false]), layoutWith(['s0', 's1']))).toBe('Analysing 2 of 2 Sounds');
  });

  it('with no layout, analyses nothing: every Sound is not placed yet', () => {
    expect(analysisScopeLine(streams([false]), null)).toBe('Analysing 0 of 1 Sound · 1 not placed yet');
  });

  it('counts the placed Sounds in scope for "Unfinished · 3 of 5 Sounds placed"; muted Sounds are out of scope', () => {
    const scope = analysisScope(streams([false, false, false, false, false, true, true]), layoutWith(['s0', 's1', 's2', 's5']));
    expect(scope).toMatchObject({ total: 7, analysed: 3, muted: 2, unplaced: 2, placement: { placed: 3, total: 5 } });
    // A Sound with no notes has nothing to place.
    const empty = analysisScope([{ id: 's0', muted: false, events: [1] }, { id: 's1', muted: false, events: [] }], layoutWith(['s0']));
    expect(empty).toMatchObject({ unplaced: 0, placement: { placed: 1, total: 1 } });
  });

  it('with a plan that scored unplaced Sounds (made before S3.3), still says they are not placed', () => {
    const plan = planSoundIds([{ voiceId: 's0' }, { voiceId: 's1' }, { voiceId: 's2' }] as FingerAssignment[]);
    const scope = analysisScope(streams([false, false, false]), layoutWith(['s0']), plan);
    expect(scopeLineOf(scope)).toBe('Analysing 3 of 3 Sounds · 2 not placed yet');
    expect(scope.placement).toEqual({ placed: 1, total: 3 });
  });

  // Codex review on PR #104: a verdict's scope is the scope of the plan behind it.
  it('with the plan’s Sounds, ignores mutes made since the plan was computed', () => {
    const plan = [{ voiceId: 's0' }, { voiceId: 's1' }, { voiceId: 's1' }] as FingerAssignment[];
    const ids = planSoundIds(plan);
    expect([...ids].sort()).toEqual(['s0', 's1']);
    // s1 muted after the analysis; s2 unmuted after it (it was left out).
    const now = [{ id: 's0', muted: false }, { id: 's1', muted: true }, { id: 's2', muted: false }];
    expect(analysisScopeLine(now, layoutWith(['s0', 's1', 's2']), ids))
      .toBe('Analysing 2 of 3 Sounds · 1 not in this analysis');
    expect(analysisScopeLine(now, layoutWith(['s0', 's1', 's2'])))
      .toBe('Analysing 2 of 3 Sounds · 1 muted');
  });
});
