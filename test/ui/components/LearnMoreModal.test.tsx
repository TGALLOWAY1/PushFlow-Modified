// @vitest-environment happy-dom
/**
 * Learn More stays in sync with the constraints and verdicts (invariant 2;
 * roadmap P1a-14 and P1b-8).
 *
 * The sync test renders the Constraints section and checks it against the lists
 * the solvers use: every rule name the feasibility checks report
 * (CONSTRAINT_RULE_NAMES) and every optimization method (OPTIMIZER_METHOD_KEYS,
 * which must all be registered). It renders the verdict tiers from the same list
 * FeasibilityBadge uses (VERDICT_TIERS), and the per-event cost with the same
 * factor labels as the Selected event card (FACTOR_META).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HARD_CONSTRAINTS, LOCK_ENFORCING_METHODS, SOLVER_CONSTRAINT_RULES, LearnMoreModal } from '../../../src/ui/components/panels/LearnMoreModal';
import {
  CONSTRAINT_RULE_NAMES,
  OPTIMIZER_METHOD_KEYS,
  OPTIMIZER_METHOD_LABELS,
  getAvailableMethodKeys,
} from '../../../src/engine';
import { VERDICT_TIERS } from '../../../src/ui/analysis/verdictTiers';
import { FACTOR_KEYS, FACTOR_META } from '../../../src/ui/analysis/factorMeta';
import { FeasibilityBadge } from '../../../src/ui/components/panels/CostBreakdownBars';

afterEach(cleanup);

function openTab(name: string) {
  render(<LearnMoreModal open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name }));
  return document.body.textContent ?? '';
}

const openConstraints = () => openTab('Constraints');

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

  // S1a.4 (T15 slice): Generate never removes a placed Sound; muted Sounds stay pinned.
  it('states that a placed Sound with no events (muted) keeps its pad in every candidate, without a lock', () => {
    const text = openConstraints();
    expect(text).toContain('Placed Sounds Stay Placed');
    expect(text).toContain('Generate never removes a Sound that is already on the grid');
    expect(text).toContain('(a muted Sound) keeps its pad in every candidate from Greedy, Beam and Annealing');
    expect(text).toContain('pinned for that run, not locked');
  });

  it('keeps the placement rules in the constraint list the section renders from', () => {
    const placement = HARD_CONSTRAINTS.find(group => group.category.startsWith('Placement'));
    expect(placement?.rules.map(rule => rule.key)).toEqual(['placementLock', 'identity', 'pinned']);
  });
});

describe('Learn More sync (P1b-8)', () => {
  it('lists lock enforcement for every optimization method the engine registers', () => {
    expect([...getAvailableMethodKeys()].sort()).toEqual([...OPTIMIZER_METHOD_KEYS].sort());
    expect(LOCK_ENFORCING_METHODS).toEqual(OPTIMIZER_METHOD_KEYS.map(k => OPTIMIZER_METHOD_LABELS[k]));
    const text = openConstraints();
    expect(text).toContain(`Placement locks come first: ${LOCK_ENFORCING_METHODS.slice(0, -1).join(', ')} and ${LOCK_ENFORCING_METHODS[LOCK_ENFORCING_METHODS.length - 1]} each start from the locked pads`);
  });

  it('renders an entry for every rule the solvers’ feasibility checks report', () => {
    expect(SOLVER_CONSTRAINT_RULES).toBe(CONSTRAINT_RULE_NAMES);
    const text = openConstraints();
    const rendered = new Set(HARD_CONSTRAINTS.flatMap(group => group.rules.map(rule => rule.key)));
    for (const rule of CONSTRAINT_RULE_NAMES) {
      expect(rendered.has(rule), `Learn More has no entry for solver rule "${rule}"`).toBe(true);
      expect(text).toContain(rule);
    }
  });

  it('renders the verdict tiers from the list FeasibilityBadge uses, including Unknown', () => {
    openTab('Cost Factors');
    for (const tier of VERDICT_TIERS) {
      const row = screen.getByTestId(`learn-verdict-${tier.level}`);
      expect(row.textContent).toContain(tier.label);
      expect(row.textContent).toContain(tier.description);
    }
    expect(document.body.textContent).toContain('PushFlow never shows ‘Feasible’ without an analysis');
    cleanup();

    // The badge renders the same labels for the same levels.
    for (const tier of VERDICT_TIERS.filter(t => t.level !== 'unknown')) {
      render(<FeasibilityBadge verdict={{ level: tier.level as 'feasible', summary: 's', reasons: [] }} scope="scope" />);
      expect(screen.getByTestId('verdict-badge').textContent).toContain(tier.label);
      cleanup();
    }
    render(<FeasibilityBadge scope="scope" />);
    expect(screen.getByTestId('verdict-badge').textContent).toContain(VERDICT_TIERS.find(t => t.level === 'unknown')!.label);
  });

  it('renders its factor list from FACTOR_META, in order, with the registry’s colours (P2-9)', () => {
    openTab('Cost Factors');
    const rows = screen.getAllByTestId('learn-more-factor');
    expect(rows.map(row => row.getAttribute('data-factor'))).toEqual([...FACTOR_KEYS]);
    rows.forEach((row, i) => {
      const meta = FACTOR_META[FACTOR_KEYS[i]!];
      expect(row.textContent).toContain(meta.label);
      expect(row.textContent).toContain(meta.description);
    });
  });

  it('explains per-event cost with the Selected event card’s factor labels', () => {
    openTab('Cost Factors');
    const text = screen.getByTestId('learn-per-event-cost').textContent ?? '';
    expect(text).toContain('counted once for the event, never once per note');
    for (const key of FACTOR_KEYS) expect(text).toContain(FACTOR_META[key].label);
    expect(text).toContain('Unplayable');
  });
});
