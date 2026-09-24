// @vitest-environment happy-dom
/**
 * Learn More stays in sync with the constraints (invariant 2; roadmap P1a-14).
 * The Constraints section states that every optimization method and manual
 * edits enforce placement locks, and that Sounds are matched by identity, not
 * pitch. S1b.1's sync test will render this from the shared lists; until then
 * the text is asserted directly.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HARD_CONSTRAINTS, LOCK_ENFORCING_METHODS, LearnMoreModal } from '../../../src/ui/components/panels/LearnMoreModal';

afterEach(cleanup);

function openConstraints() {
  render(<LearnMoreModal open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Constraints' }));
  return document.body.textContent ?? '';
}

describe('Learn More · Constraints', () => {
  it('lists lock enforcement for Greedy, Beam and Annealing and for manual edits', () => {
    const text = openConstraints();
    expect(LOCK_ENFORCING_METHODS).toEqual(['Greedy', 'Beam', 'Annealing']);
    expect(text).toContain('Placement Locks');
    expect(text).toContain('Greedy, Beam and Annealing all place locked Sounds first, on their locked pads, and never move them');
    expect(text).toContain('a candidate that would break a lock is dropped');
    expect(text).toContain('a locked Sound cannot be dragged off its pad, and nothing can be dropped onto a locked pad');
    expect(text).toContain('Locked · Unlock to move');
  });

  it('states that Sounds are matched by identity, never by pitch', () => {
    const text = openConstraints();
    expect(text).toContain('Sound Identity');
    expect(text).toContain('matched to a pad by its Sound, never by MIDI pitch');
    expect(text).toContain('A Sound with no pad is unmapped even when another Sound shares its pitch');
  });

  it('keeps the placement rules in the constraint list the section renders from', () => {
    const placement = HARD_CONSTRAINTS.find(group => group.category.startsWith('Placement'));
    expect(placement?.rules.map(rule => rule.key)).toEqual(['placementLock', 'identity']);
  });
});
