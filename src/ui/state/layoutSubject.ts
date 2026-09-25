/**
 * What the screen shows, in words (S3.2, T03): the role and name every surface
 * heads itself with (the layout-state bar, the Analysis panels, the Events
 * list, the selected-event card, the chart, both Compare sides and the
 * timeline), built in one place so they always name the same subject (canon
 * section 8: analysis must name its subject).
 */

import { type Layout } from '../../types/layout';
import { type CandidateSolution } from '../../types/candidateSolution';
import { layoutDiff } from '../analysis/layoutDiff';
import { strategyLabel } from '../analysis/strategyLabels';
import { layoutLabel } from './layoutLabels';
import {
  hasWorkingChanges,
  resolveInspectedLayout,
  type InspectedLayoutKind,
  type ProjectState,
} from './projectState';

/** The roles a subject can have: the canon's layout states, plus a recovered draft. */
export type SubjectRole = InspectedLayoutKind;

export interface RoleMeta {
  /** The chip's word (sentence case; the chip draws it in capitals). */
  label: string;
  /** The canon term it stands for. */
  term: string;
  /** What it means, for tooltips and Learn More. */
  description: string;
  /** Its colour token (index.css); the chip pairs it with an icon. */
  token: string;
}

/** One entry per role, in the order Learn More lists them. */
export const ROLE_META: Record<SubjectRole, RoleMeta> = {
  active: {
    label: 'Active',
    term: 'Active Layout',
    description: 'The committed baseline. Only Promote changes it.',
    token: '--role-active',
  },
  working: {
    label: 'Working/Test',
    term: 'Working/Test Layout',
    description: 'Your draft: every edit goes here until you Promote it, save it as a variant or Discard it.',
    token: '--role-working',
  },
  candidate: {
    label: 'Candidate',
    term: 'Candidate Solution',
    description: 'A layout Generate proposed, shown read-only. Use as my draft to edit it.',
    token: '--role-candidate',
  },
  variant: {
    label: 'Saved variant',
    term: 'Saved Layout Variant',
    description: 'A layout you kept, shown read-only. Use as my draft to edit it.',
    token: '--role-variant',
  },
  recovered: {
    label: 'Recovered draft',
    term: 'Recovered draft',
    description: 'A draft kept when an action replaced it, shown read-only. Use as my draft to edit it.',
    token: '--role-working',
  },
};

export const ROLE_ORDER: readonly SubjectRole[] = ['active', 'working', 'candidate', 'variant', 'recovered'];

export interface LayoutSubject {
  role: SubjectRole;
  /** The chip: "Active", "Working/Test", "Candidate B", "Saved variant", "Recovered draft". */
  chip: string;
  /** The name beside it: the layout's label, or how a candidate was made. */
  name: string;
}

/**
 * A candidate's letter by its place in the list: A for the first, then B … Z,
 * AA … One helper, so S3.3 can make the letters stable for the session.
 */
export function candidateLetter(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** The letter of a candidate in this list ("?" when it isn't in it). */
export function candidateLetterFor(candidates: readonly CandidateSolution[], candidateId: string): string {
  const index = candidates.findIndex(c => c.id === candidateId);
  return index < 0 ? '?' : candidateLetter(index);
}

/** A candidate's name: how it was made (T20). Its layout carries the user's base name, so that is no name for it. */
export function candidateName(candidate: CandidateSolution): string {
  return strategyLabel(candidate.metadata?.strategy);
}

export function candidateSubject(candidates: readonly CandidateSolution[], candidate: CandidateSolution): LayoutSubject {
  return {
    role: 'candidate',
    chip: `${ROLE_META.candidate.label} ${candidateLetterFor(candidates, candidate.id)}`,
    name: candidateName(candidate),
  };
}

/** A layout shown in a role other than candidate: its clean label (layoutLabels.ts). */
export function layoutSubject(layout: Layout, role: Exclude<SubjectRole, 'candidate'>): LayoutSubject {
  return { role, chip: ROLE_META[role].label, name: layoutLabel(layout, { role }) };
}

/** The subject of whatever the screen shows now (resolveInspectedLayout). */
export function inspectedSubject(state: ProjectState): LayoutSubject {
  const shown = resolveInspectedLayout(state);
  if (shown.candidate) return candidateSubject(state.candidates, shown.candidate);
  return layoutSubject(shown.layout, shown.role === 'candidate' ? 'active' : shown.role);
}

/** Pads whose Sound differs between two layouts (layoutDiff, P2-8). */
export function padsChanged(a: Pick<Layout, 'padToVoice'>, b: Pick<Layout, 'padToVoice'>): number {
  return layoutDiff(a, b).changedPads.size;
}

function pads(n: number): string {
  return `${n} ${n === 1 ? 'pad' : 'pads'}`;
}

/**
 * The state bar's comparison line for the layout shown: against Active, plus
 * against your draft when one differs from Active and isn't what is shown.
 * "3 pads vs Active · 2 vs your draft", "Same pads as Active · same pads as
 * your draft", or null for Active itself when there is no draft to compare with.
 */
export function shownLayoutDiff(state: ProjectState): string | null {
  const shown = resolveInspectedLayout(state);
  const draft = hasWorkingChanges(state) ? state.workingLayout : null;
  if (shown.role === 'active') {
    return shown.readOnly && draft ? `${pads(padsChanged(draft, shown.layout))} vs your draft` : null;
  }
  const vsActive = padsChanged(state.activeLayout, shown.layout);
  const parts = [vsActive === 0 ? 'Same pads as Active' : `${pads(vsActive)} vs Active`];
  if (draft && shown.readOnly) {
    const vsDraft = padsChanged(draft, shown.layout);
    parts.push(vsDraft === 0 ? 'same pads as your draft' : `${vsDraft} vs your draft`);
  }
  return parts.join(' · ');
}
