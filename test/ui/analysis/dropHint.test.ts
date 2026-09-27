/**
 * What a drop on a pad would do, said while dragging (S5.1, T46).
 */

import { describe, it, expect } from 'vitest';
import { dropHint } from '../../../src/ui/analysis/dropHint';

const voice = (id: string) => ({ id, name: id, sourceType: 'midi_track' as const, sourceFile: '', originalMidiNote: null, color: '#fff' });
const layout = {
  padToVoice: { '0,0': voice('Kick'), '3,3': voice('Snare'), '5,5': voice('Hat') },
  placementLocks: { Hat: '5,5' } as Record<string, string>,
};
const nameOf = (id: string) => id;

describe('dropHint', () => {
  it('a pad onto a taken pad swaps; onto an empty one it moves', () => {
    const session = { kind: 'pad' as const, soundId: 'Kick', fromPad: '0,0' };
    expect(dropHint(session, '3,3', layout, nameOf)).toEqual({ kind: 'swap', text: 'Swap with Snare' });
    expect(dropHint(session, '7,7', layout, nameOf)).toEqual({ kind: 'move', text: 'Move from Row 1 · Col 1' });
    expect(dropHint(session, '0,0', layout, nameOf)).toEqual({ kind: 'same', text: 'Already here' });
  });

  it('a Sound from a list replaces a taken pad\'s Sound, moves if placed, or is placed', () => {
    expect(dropHint({ kind: 'sound', soundId: 'Kick', fromPad: '0,0' }, '3,3', layout, nameOf))
      .toEqual({ kind: 'replace', text: 'Replace: Snare goes back to To place', evicts: 'Snare' });
    expect(dropHint({ kind: 'sound', soundId: 'Kick', fromPad: '0,0' }, '7,7', layout, nameOf))
      .toEqual({ kind: 'move', text: 'Move from Row 1 · Col 1' });
    expect(dropHint({ kind: 'sound', soundId: 'Tom', fromPad: null }, '7,7', layout, nameOf))
      .toEqual({ kind: 'place', text: 'Place Tom here' });
  });

  it('says why a drop would be refused: a locked pad, a locked Sound, a read-only layout', () => {
    expect(dropHint({ kind: 'pad', soundId: 'Kick', fromPad: '0,0' }, '5,5', layout, nameOf))
      .toEqual({ kind: 'refused', text: 'Hat is locked here · Unlock it first' });
    expect(dropHint({ kind: 'sound', soundId: 'Hat', fromPad: '5,5' }, '7,7', layout, nameOf))
      .toEqual({ kind: 'refused', text: 'Hat is locked to Row 6 · Col 6 · Unlock it to move it' });
    expect(dropHint({ kind: 'sound', soundId: 'Tom', fromPad: null }, '7,7', layout, nameOf, 'Use as my draft to edit'))
      .toEqual({ kind: 'refused', text: 'Use as my draft to edit' });
  });
});
