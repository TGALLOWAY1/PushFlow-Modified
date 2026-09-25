/**
 * S2.2b · readable references, one meaning for "event", musical notation
 * (T20, T23, T43).
 *
 * P2-8: diffs count unique Sounds and unique pads, so "Sounds moved" can never
 * exceed the Sound count (the C7 case read "11 voices moved" with 7 Sounds).
 * Counts are in events (moments) and notes, the same for every solver. Positions
 * read bar.beat.sixteenth and "Row 4 · Col 4", and Speed shows its BPM.
 */

import { describe, expect, it } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { type FingerAssignment, type DifficultyLevel } from '../../../src/types/executionPlan';
import { describeLayoutDiff, layoutDiff } from '../../../src/ui/analysis/layoutDiff';
import { momentDifficultyCounts } from '../../../src/ui/analysis/momentCounts';
import { strategyLabel } from '../../../src/ui/analysis/strategyLabels';
import { verdictSummary } from '../../../src/ui/components/panels/CostBreakdownBars';
import { soundNameFor } from '../../../src/ui/components/shared/SoundLabel';
import { formatBarBeat, formatBarRange, formatMilliseconds, formatRate, formatSeconds } from '../../../src/utils/musicalTime';
import { formatPadLocator, formatPadPosition, formatRowCol, spokenPadPosition } from '../../../src/utils/padPosition';

const voice = (id: string): Voice => ({
  id, name: id.toUpperCase(), sourceType: 'midi_track', sourceFile: '', originalMidiNote: null, color: '#888',
});

function layoutOf(pads: Record<string, string>): Pick<Layout, 'padToVoice'> {
  return { padToVoice: Object.fromEntries(Object.entries(pads).map(([pad, id]) => [pad, voice(id)])) };
}

describe('layoutDiff (P2-8)', () => {
  it('counts each moved Sound once and each changed pad once: the C7 case', () => {
    // Seven Sounds; B moves all of them, and four land on pads another Sound left.
    // Counting pad entries on both sides gave "11 voices moved".
    const a = layoutOf({ '0,0': 'a', '0,1': 'b', '0,2': 'c', '0,3': 'd', '1,0': 'e', '1,1': 'f', '1,2': 'g' });
    const b = layoutOf({ '0,1': 'a', '0,2': 'b', '0,3': 'c', '0,4': 'd', '1,1': 'e', '1,2': 'f', '1,3': 'g' });
    const diff = layoutDiff(a, b);
    expect(diff.movedSounds.size).toBe(7);
    // Pads 0,0–0,4 and 1,0–1,3, each once, though six of them changed on both sides.
    expect(diff.changedPads.size).toBe(9);
    expect(describeLayoutDiff(diff)).toBe('7 Sounds moved (9 pads changed)');
  });

  it('never claims more Sounds than exist, and a swap is two Sounds on two pads', () => {
    const a = layoutOf({ '2,2': 'kick', '2,3': 'snare', '3,3': 'hat' });
    const b = layoutOf({ '2,2': 'snare', '2,3': 'kick', '3,3': 'hat' });
    const diff = layoutDiff(a, b);
    expect([...diff.movedSounds].sort()).toEqual(['kick', 'snare']);
    expect([...diff.changedPads].sort()).toEqual(['2,2', '2,3']);
    expect(diff.moves).toEqual(expect.arrayContaining([
      { soundId: 'kick', from: '2,2', to: '2,3' },
      { soundId: 'snare', from: '2,3', to: '2,2' },
    ]));
    expect(describeLayoutDiff(diff)).toBe('2 Sounds moved (2 pads changed)');
  });

  it('counts a Sound placed or removed as moved, from or to nowhere', () => {
    const diff = layoutDiff(layoutOf({ '0,0': 'a' }), layoutOf({ '0,0': 'a', '5,5': 'b' }));
    expect(diff.moves).toEqual([{ soundId: 'b', from: null, to: '5,5' }]);
    expect(describeLayoutDiff(diff)).toBe('1 Sound moved (1 pad changed)');
  });

  it('reads "No Sounds moved" for identical layouts', () => {
    const same = layoutOf({ '0,0': 'a', '1,1': 'b' });
    expect(describeLayoutDiff(layoutDiff(same, same))).toBe('No Sounds moved');
  });
});

function note(startTime: number, voiceId: string, difficulty: DifficultyLevel, playable = true): FingerAssignment {
  return {
    noteNumber: 36, voiceId, startTime,
    assignedHand: playable ? 'right' : 'Unplayable', finger: playable ? 'index' : null,
    cost: playable ? 1 : Infinity, difficulty, eventIndex: 0,
  };
}

describe('momentDifficultyCounts (T23, decision Q7)', () => {
  it('counts events as moments and hits as notes, whatever the plan counted', () => {
    const counts = momentDifficultyCounts([
      // A three-note chord: one event, three notes, Hard by its worst note.
      note(0, 'kick', 'Easy'), note(0, 'snare', 'Hard'), note(0.01, 'hat', 'Medium'),
      // A single Easy hit.
      note(0.5, 'hat', 'Easy'),
      // A two-note event with one unplayable note: one Unplayable event, one unplayable note.
      note(1, 'kick', 'Easy'), note(1, 'tom', 'Unplayable', false),
    ]);
    expect(counts).toEqual({ events: 3, notes: 6, easy: 1, medium: 0, hard: 1, unplayable: 1, unplayableNotes: 1 });
  });

  it('is all zeros with no plan', () => {
    expect(momentDifficultyCounts(undefined)).toEqual({ events: 0, notes: 0, easy: 0, medium: 0, hard: 0, unplayable: 0, unplayableNotes: 0 });
  });
});

describe('verdictSummary (T23)', () => {
  const counts = { events: 32, notes: 48, hard: 0, unplayable: 0, unplayableNotes: 0 };

  it('states a feasible layout in events', () => {
    expect(verdictSummary('feasible', counts)).toBe('All 32 events play with natural grips');
  });

  it('states an infeasible layout in notes that can\'t be played', () => {
    expect(verdictSummary('infeasible', { ...counts, unplayable: 3, unplayableNotes: 4 })).toBe("4 of 48 notes can't be played");
  });

  it('states a degraded layout by its hard events', () => {
    expect(verdictSummary('degraded', { ...counts, hard: 1 })).toBe('Playable, with 1 hard event');
  });
});

describe('musical notation (T43)', () => {
  it('reads bar.beat.sixteenth, 1-based, at the project tempo', () => {
    expect(formatBarBeat(0, 120)).toBe('1.1.1');
    expect(formatBarBeat(0.125, 120)).toBe('1.1.2');
    expect(formatBarBeat(0.5, 120)).toBe('1.2.1');
    expect(formatBarBeat(2, 120)).toBe('2.1.1');
    expect(formatBarBeat(5.25, 120)).toBe('3.3.3');
    // Floating-point sums of sixteenths stay on their sixteenth.
    expect(formatBarBeat(0.1 + 0.2 + 0.075, 120)).toBe('1.1.4');
    // At 90 BPM a bar lasts 8/3 s.
    expect(formatBarBeat(8 / 3, 90)).toBe('2.1.1');
  });

  it('never reads before the start', () => {
    expect(formatBarBeat(-0.3, 120)).toBe('1.1.1');
  });

  it('reads a loop as a bar range, end exclusive', () => {
    expect(formatBarRange(4, 8, 120)).toBe('Bars 3–4');
    expect(formatBarRange(4, 6, 120)).toBe('Bar 3');
    expect(formatBarRange(4.5, 5, 120)).toBe('Bar 3');
  });

  it('shows the BPM a playback rate plays at', () => {
    expect(formatRate(0.75, 120)).toBe('0.75x · 90 BPM');
    expect(formatRate(1, 96)).toBe('1x · 96 BPM');
  });

  it('keeps seconds and milliseconds for tooltips', () => {
    expect(formatSeconds(1.25)).toBe('1.250 s');
    expect(formatMilliseconds(0.2504)).toBe('250 ms');
  });
});

describe('pad positions (T43)', () => {
  it('reads one 1-based format, rows from the bottom as on Push', () => {
    expect(formatPadPosition('3,3')).toBe('Row 4 · Col 4');
    expect(formatPadPosition('0,7')).toBe('Row 1 · Col 8');
    expect(formatPadLocator('7,0')).toBe('R8 C1');
    expect(spokenPadPosition(0, 0)).toBe('Row 1, column 1');
    expect(formatRowCol(4, 8)).toBe('Row 5 · Col 9');
  });

  it('passes anything that is not a pad key through', () => {
    expect(formatPadPosition('nowhere')).toBe('nowhere');
  });
});

describe('readable names (T20)', () => {
  it('names a Sound by id, and never shows an id that names no Sound', () => {
    const sounds = [{ id: 'lane_1790_a', name: 'Kick' }];
    expect(soundNameFor('lane_1790_a', sounds)).toBe('Kick');
    expect(soundNameFor('lane_0000_gone', sounds)).toBe('a removed Sound');
  });

  it('turns generator strategy keys into words', () => {
    expect(strategyLabel('pose0-offset-0')).toBe('Natural hand pose');
    expect(strategyLabel('pose0-offset-2')).toBe('Natural hand pose, shifted 2 rows');
    expect(strategyLabel('compact-right')).toBe('Compact, right hand');
    expect(strategyLabel('baseline')).toBe('Based on your layout');
    expect(strategyLabel(undefined)).toBe('Candidate');
    expect(strategyLabel('Natural Pose Anchor (seed 1)')).toBe('Natural Pose Anchor (seed 1)');
  });
});
