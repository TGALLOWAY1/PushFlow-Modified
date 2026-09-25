/**
 * The scope line every verdict carries (S1b.1, T15 scope line).
 */

import { describe, it, expect } from 'vitest';
import { analysisScopeLine } from '../../../src/ui/analysis/analysisScope';
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
  it('names analysed, muted and unplaced Sounds', () => {
    const line = analysisScopeLine(streams([false, false, false, false, false, true, true]), layoutWith(['s0', 's1', 's2', 's5']));
    expect(line).toBe('Analysing 5 of 7 Sounds · 2 muted · 2 not on the grid');
  });

  it('is just the count when everything is analysed and placed', () => {
    expect(analysisScopeLine(streams([false, false]), layoutWith(['s0', 's1']))).toBe('Analysing 2 of 2 Sounds');
  });

  it('counts every analysed Sound as not on the grid when there is no layout', () => {
    expect(analysisScopeLine(streams([false]), null)).toBe('Analysing 1 of 1 Sound · 1 not on the grid');
  });
});
