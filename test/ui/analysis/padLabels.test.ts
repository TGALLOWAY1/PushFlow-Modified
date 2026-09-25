/**
 * S2.2a · pads show what tells Sounds apart (T17): the words every name
 * shares are dropped, and a label that still doesn't fit is cut in the middle.
 */

import { describe, expect, it } from 'vitest';
import {
  middleTruncate,
  padLabel,
  padLabelCharsPerLine,
  padLabelLines,
  sharedNamePrefix,
} from '../../../src/ui/analysis/padLabels';

const TM1 = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(l => `TEST MIDI 1 ${l}`);

describe('sharedNamePrefix', () => {
  it('is the whole words every name starts with', () => {
    expect(sharedNamePrefix(TM1)).toBe('TEST MIDI 1 ');
    expect(sharedNamePrefix(['Groove Kick', 'Groove Kicker'])).toBe('Groove ');
  });

  it('is empty when names share no whole word, or there is only one', () => {
    expect(sharedNamePrefix(['Kick', 'Kick 2'])).toBe('');
    expect(sharedNamePrefix(['Kick', 'Snare'])).toBe('');
    expect(sharedNamePrefix(['TEST MIDI 1 A'])).toBe('');
    expect(sharedNamePrefix([])).toBe('');
  });

  it('never leaves a name empty', () => {
    expect(sharedNamePrefix(['Groove', 'Groove A'])).toBe('');
    expect(sharedNamePrefix(['Kick', 'Kick'])).toBe('');
  });
});

describe('middleTruncate', () => {
  it('keeps the start and the end', () => {
    expect(middleTruncate('Closed Hat', 8)).toBe('Clos…Hat');
    expect(middleTruncate('Kick', 8)).toBe('Kick');
    expect(middleTruncate('Tambourine', 5)).toBe('Ta…ne');
  });
});

describe('padLabel', () => {
  it('TEST MIDI 1: seven distinct one-letter labels at every pad size', () => {
    for (const pad of [32, 34, 40, 51, 72]) {
      const labels = TM1.map(n => padLabel(n, sharedNamePrefix(TM1), pad));
      expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    }
  });

  it('fits its lines: one under 40 px, two from 40 px', () => {
    expect(padLabelLines(34)).toBe(1);
    expect(padLabelLines(40)).toBe(2);
    const long = 'Mute High Conga Extended';
    for (const pad of [32, 40, 56, 72]) {
      expect(padLabel(long, '', pad).length).toBeLessThanOrEqual(padLabelCharsPerLine(pad) * padLabelLines(pad));
    }
  });

  it('shows the full name when nothing is shared', () => {
    expect(padLabel('Kick', '', 56)).toBe('Kick');
  });
});
