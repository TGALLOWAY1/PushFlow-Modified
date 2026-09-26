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
 * factor labels as the Selected event card (FACTOR_META). The App Flow tab
 * names the layout roles from the list the layout-state bar's chips use
 * (ROLE_META, S3.2), and says looking never writes your draft. Its Lifecycle
 * section (S3.4, P3-10b) lists exactly those roles and the lifecycle's actions
 * from the list the state bar's buttons take their words from
 * (LIFECYCLE_ACTIONS), and how layouts are named.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import {
  HARD_CONSTRAINTS,
  LOCK_ENFORCING_METHODS,
  SOLVER_CONSTRAINT_RULES,
  LearnMoreModal,
  describeThoroughTimeLimit,
  namingExamples,
} from '../../../src/ui/components/panels/LearnMoreModal';
import {
  CONSTRAINT_RULE_NAMES,
  OPTIMIZER_METHOD_KEYS,
  OPTIMIZER_METHOD_LABELS,
  PLAN_SCORE_WEIGHTS,
  STOP_REASONS_EXPLAINED,
  getAvailableMethodKeys,
  planAnnealingRun,
} from '../../../src/engine';
import { PLAYABILITY_TOOLTIP } from '../../../src/ui/analysis/planScore';
import { DEEP_ANNEALING_CONFIG } from '../../../src/types/engineConfig';
import { stopReasonText } from '../../../src/ui/analysis/stopReason';
import { formatDuration } from '../../../src/ui/hooks/generationProgress';
import { VERDICT_TIERS } from '../../../src/ui/analysis/verdictTiers';
import { FACTOR_KEYS, FACTOR_META } from '../../../src/ui/analysis/factorMeta';
import { FeasibilityBadge } from '../../../src/ui/components/panels/CostBreakdownBars';
import { ROLE_META, ROLE_ORDER } from '../../../src/ui/state/layoutSubject';
import { USE_AS_DRAFT_HINT } from '../../../src/ui/hooks/useReadOnlyHint';
import { LIFECYCLE_ACTIONS } from '../../../src/ui/state/lifecycleActions';

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

  it('explains the Score as one yardstick, from the engine’s own weights (S3.1)', () => {
    openTab('Cost Factors');
    const text = screen.getByTestId('learn-score').textContent ?? '';
    expect(text).toContain('Score is its Playability, from 0 to 100: higher is easier');
    expect(text).toContain('canonical evaluator');
    expect(text).toContain(`minus ${PLAN_SCORE_WEIGHTS.hardEvent} for each hard event`);
    expect(text).toContain(`minus ${PLAN_SCORE_WEIGHTS.unplayableEvent} for each event that can’t be played`);
    expect(text).toContain(`minus up to ${PLAN_SCORE_WEIGHTS.ergonomicCap} for the average cost per event`);
    for (const key of FACTOR_KEYS) expect(text).toContain(FACTOR_META[key].label);
    expect(text).toContain('the same layout scores the same wherever it appears');
    expect(text).toContain('whichever optimizer proposed it');
    // The tooltip on every displayed Score names the same yardstick.
    expect(PLAYABILITY_TOOLTIP).toBe('Playability · canonical evaluator · higher = easier');
  });

  // S3.4 (T35): Thorough's time limit, read from the settings Generate runs.
  it('explains Thorough’s time limit from DEEP_ANNEALING_CONFIG, and that the best layout so far is kept', () => {
    openTab('Optimizers');
    const text = screen.getByTestId('learn-generation-time').textContent ?? '';
    const plan = planAnnealingRun(DEEP_ANNEALING_CONFIG);
    expect(DEEP_ANNEALING_CONFIG.timeBudgetMs).toBeDefined();
    expect(text).toContain(describeThoroughTimeLimit());
    expect(text).toContain(`up to ${plan.total.toLocaleString('en-US')} iterations in ${plan.iterationsPerRestart.length} runs`);
    expect(text).toContain(`at most ${formatDuration(DEEP_ANNEALING_CONFIG.timeBudgetMs!)} per candidate, shared equally so every run starts`);
    expect(text).toContain('the candidate is the best layout the search has found so far');
    expect(text).toContain('“Stopped: time limit reached”');
    expect(text).toContain('Cancel stops the run: nothing from it is kept, and the candidates you already had stay as they were');
  });

  it('lists every reason a run stops, in the trace panel’s words', () => {
    openTab('Optimizers');
    const rows = screen.getAllByTestId('learn-stop-reason');
    expect(rows.map(row => row.getAttribute('data-reason'))).toEqual(STOP_REASONS_EXPLAINED.map(r => r.reason));
    rows.forEach((row, i) => {
      const { reason, meaning } = STOP_REASONS_EXPLAINED[i]!;
      expect(row.textContent).toContain(stopReasonText(reason));
      expect(row.textContent).toContain(meaning);
    });
    expect(rows.map(row => row.getAttribute('data-reason'))).toEqual(expect.arrayContaining(['time_budget', 'cancelled']));
  });

  it('explains per-event cost with the Selected event card’s factor labels', () => {
    openTab('Cost Factors');
    const text = screen.getByTestId('learn-per-event-cost').textContent ?? '';
    expect(text).toContain('counted once for the event, never once per note');
    for (const key of FACTOR_KEYS) expect(text).toContain(FACTOR_META[key].label);
    expect(text).toContain('Unplayable');
  });
});

describe('Learn More · which layout is on screen (S3.2)', () => {
  it('lists every role the layout-state bar can show, from the list its chips use, in order', () => {
    openTab('App Flow');
    const section = screen.getByTestId('learn-more-roles');
    const chips = [...section.querySelectorAll('[data-testid="role-chip"]')];
    expect(chips.map(chip => chip.getAttribute('data-role'))).toEqual([...ROLE_ORDER]);
    chips.forEach((chip, i) => {
      const meta = ROLE_META[ROLE_ORDER[i]!];
      expect(chip.textContent).toBe(meta.label);
      expect(chip.parentElement?.textContent).toContain(meta.description);
    });
    const text = section.textContent ?? '';
    expect(text).toContain('Only your draft can be edited');
    expect(text).toContain(`an edit on it says “${USE_AS_DRAFT_HINT}”`);
  });

  it('says Generate shows candidate A read-only and Inspect never changes your draft', () => {
    const flow = openTab('App Flow');
    expect(flow).toContain('Generate proposes alternative layouts and shows candidate A read-only; your draft stays as it is');
    expect(flow).toContain('Inspect any layout on the grid without changing your draft');
    expect(flow).toContain('Use as my draft to edit one');
    cleanup();
    const overview = openTab('Overview');
    expect(overview).toContain('Generating never changes your layout');
    expect(overview).toContain('Looking never writes your draft');
    expect(overview).toContain('Back to my draft returns to it');
  });
});

describe('Learn More · the layout lifecycle (S3.4, P3-10b)', () => {
  it('lists exactly the roles, from ROLE_META, and the actions, from the list the state bar’s buttons use', () => {
    openTab('App Flow');
    const section = screen.getByTestId('learn-lifecycle');
    // The roles: the state bar's chips, in order (S3.2's block is part of the section).
    const chips = [...section.querySelectorAll('[data-testid="role-chip"]')];
    expect(chips.map(chip => chip.textContent)).toEqual(['Active', 'Working/Test', 'Candidate', 'Saved variant', 'Recovered draft']);
    expect(chips.map(chip => chip.getAttribute('data-role'))).toEqual([...ROLE_ORDER]);
    expect(within(section).getByTestId('learn-more-roles')).toBeTruthy();

    // The actions: exactly these, each with its button's words, where it is offered and what it does.
    expect(LIFECYCLE_ACTIONS.map(a => a.label)).toEqual([
      'Inspect', 'Back to my draft', 'Use as my draft', 'Save variant', 'Keep as variant', 'Promote', 'Discard',
    ]);
    const rows = within(section).getAllByTestId('learn-lifecycle-action');
    expect(rows.map(row => row.getAttribute('data-action'))).toEqual(LIFECYCLE_ACTIONS.map(a => a.id));
    rows.forEach((row, i) => {
      const action = LIFECYCLE_ACTIONS[i]!;
      expect(row.textContent).toContain(action.label);
      expect(row.textContent).toContain(action.on);
      expect(row.textContent).toContain(action.description);
    });
    // Save variant is the canon's Save as variant; Keep keeps a candidate.
    expect(rows[3]!.textContent).toContain('Save as variant');
    expect(rows[4]!.textContent).toContain('Candidates are temporary');
  });

  it('describes Promote as it acts: at once, with Undo; the replaced Active saved as a variant; an unrelated draft kept', () => {
    openTab('App Flow');
    const promote = screen.getAllByTestId('learn-lifecycle-action').find(row => row.getAttribute('data-action') === 'promote')!;
    expect(promote.textContent).toContain('Makes it the new Active Layout at once, with Undo in the toast');
    expect(promote.textContent).toContain('The Active Layout it replaces is saved as a variant');
    expect(promote.textContent).toContain('a draft that is not the layout you promote goes to Recovered drafts');
    expect(promote.textContent).not.toMatch(/Confirm/);
  });

  it('explains "Draft of …", recovered drafts, candidates’ names and the dated names of replaced Actives, from the functions that make them', () => {
    openTab('App Flow');
    const text = screen.getByTestId('learn-lifecycle-names').textContent ?? '';
    const names = namingExamples();
    expect(names).toEqual({
      draft: 'Draft of Default',
      recovered: 'Recovered draft of Default',
      replaced: 'Default – 23 Sep 14:02',
      replacedAgain: 'Default – 23 Sep 14:02 (2)',
      candidate: 'Candidate B · Natural hand pose, shifted 1 row',
    });
    for (const example of Object.values(names)) expect(text).toContain(`“${example}”`);
    expect(text).toContain('its role is shown beside it, never written into it');
  });
});
