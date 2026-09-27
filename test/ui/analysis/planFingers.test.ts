/**
 * The plan's fingers per Sound (S5.1, T19): what the "Hand & finger preference
 * (soft)" chip shows faintly when a Sound has no preference. The whole Sound's
 * fingering counts, most-used first; its first strike used to win.
 */

import { describe, it, expect } from 'vitest';
import { planFingersBySound, planFingersLabel } from '../../../src/ui/analysis/planFingers';
import { type FingerAssignment } from '../../../src/types/executionPlan';

function note(voiceId: string | undefined, hand: FingerAssignment['assignedHand'], finger: FingerAssignment['finger']): FingerAssignment {
  return {
    voiceId,
    assignedHand: hand,
    finger,
    noteNumber: 36,
    startTime: 0,
    cost: 0,
    difficulty: 'Easy',
  } as FingerAssignment;
}

describe('planFingersBySound', () => {
  it('reads one finger as "L2"', () => {
    const plans = planFingersBySound([note('kick', 'left', 'index'), note('kick', 'left', 'index')]);
    expect(plans.get('kick')).toEqual({ fingers: [{ hand: 'left', finger: 'index', label: 'L2', count: 2 }], label: 'L2' });
  });

  it('reads two as "L2/L3", most-used first, and not the first strike\'s', () => {
    const plans = planFingersBySound([
      note('snare', 'left', 'middle'),
      note('snare', 'left', 'index'),
      note('snare', 'left', 'index'),
    ]);
    const snare = plans.get('snare')!;
    expect(snare.label).toBe('L2/L3');
    expect(snare.fingers.map(f => [f.label, f.count])).toEqual([['L2', 2], ['L3', 1]]);
  });

  it('breaks a tie by the finger used first', () => {
    const plans = planFingersBySound([note('hat', 'right', 'ring'), note('hat', 'right', 'middle')]);
    expect(plans.get('hat')!.label).toBe('R4/R3');
  });

  it('reads three or more as "mixed", across hands', () => {
    const plans = planFingersBySound([
      note('tom', 'left', 'index'),
      note('tom', 'right', 'index'),
      note('tom', 'right', 'thumb'),
    ]);
    expect(plans.get('tom')!.label).toBe('mixed');
    expect(plans.get('tom')!.fingers).toHaveLength(3);
  });

  it('leaves out unplayable notes and notes of no Sound', () => {
    const plans = planFingersBySound([
      note('kick', 'Unplayable', 'index'),
      note(undefined, 'left', 'index'),
      note('kick', 'left', 'thumb'),
    ]);
    expect([...plans.keys()]).toEqual(['kick']);
    expect(plans.get('kick')!.label).toBe('L1');
  });

  it('is memoised per plan, and empty with none', () => {
    const assignments = [note('kick', 'left', 'index')];
    expect(planFingersBySound(assignments)).toBe(planFingersBySound(assignments));
    expect(planFingersBySound(null).size).toBe(0);
  });
});

describe('planFingersLabel', () => {
  it('joins one or two, and says "mixed" beyond', () => {
    expect(planFingersLabel([{ label: 'R1' }])).toBe('R1');
    expect(planFingersLabel([{ label: 'R1' }, { label: 'L1' }])).toBe('R1/L1');
    expect(planFingersLabel([{ label: 'R1' }, { label: 'L1' }, { label: 'L2' }])).toBe('mixed');
  });
});
