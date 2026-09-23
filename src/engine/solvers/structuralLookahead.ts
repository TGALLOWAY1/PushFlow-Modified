/**
 * Structural lookahead for the beam solver.
 *
 * Hand-zone separation and one finger per Sound are hard rules. The beam decides
 * a pad's finger at its first strike, from local cost alone — so it can commit a
 * pad to a finger that is certain to fail at a later moment, and then has to
 * break a rule there even though a plan keeping every rule existed.
 *
 * This module looks at the whole performance before the search starts. For every
 * pad it works out which (hand, finger) owners can take part in a rule-keeping
 * plan, by constraint propagation over the moments: an owner survives only if,
 * at every moment the pad sounds, some valid grip gives it that owner while every
 * other pad of the moment keeps an owner that is itself still possible. It can
 * also search (lazily, within a budget) for one complete rule-keeping owner per
 * pad, which the solver falls back to if its beam still breaks a rule.
 *
 * An unavoidable break is contained to the pads and moments involved, so one
 * impossible chord or one unkeepable finger choice does not switch the guidance
 * off for the rest of the performance.
 *
 * Only moment geometry is considered here — valid grips within each hand's zone.
 * Hand speed is left to the beam, which is why the result is guidance plus a
 * witness, not a verdict on its own.
 */

import { type PadCoord } from '../../types/padGrid';
import { type FingerType } from '../../types/fingerModel';
import { type HandPose } from '../../types/performance';
import { generateValidGripsWithTier } from '../prior/feasibility';
import { isZoneValid } from '../surface/handZone';

/** "left:index"-style code for one (hand, finger) owner. */
export type OwnerCode = string;

export interface PadOwnerChoice {
  hand: 'left' | 'right';
  finger: FingerType;
}

/** Maximum number of hand partitions enumerated for a simultaneous group. */
export const MAX_SPLIT_PARTITIONS = 64;

/**
 * Past this many rule-keeping fingerings, a moment is left out of propagation.
 * Leaving a constraint out only weakens the pruning, never makes it wrong.
 */
const MAX_TUPLES_PER_MOMENT = 20_000;

/** Upper bound on the witness search, in tuple visits — work done, not nodes visited. */
const WITNESS_WORK_BUDGET = 2_000_000;

/** Bound on memoised moment fingerings; the cache is simply cleared when it fills. */
const TUPLE_CACHE_LIMIT = 4_000;

/** Number of `pads` that `hand` would play outside its zone. */
export function countZoneViolations(pads: PadCoord[], hand: 'left' | 'right'): number {
  let count = 0;
  for (const pad of pads) {
    if (!isZoneValid(pad, hand)) count++;
  }
  return count;
}

/**
 * Enumerates every non-empty two-hand division of a simultaneous pad group.
 *
 * Both hands must receive at least one pad, and neither may receive more than
 * five (a hand has five fingers). Zone-respecting divisions come first (a stable
 * sort keeps the order deterministic), so the MAX_SPLIT_PARTITIONS cap can only
 * ever drop the most rule-breaking ones.
 */
export function enumerateHandPartitions(
  pads: PadCoord[],
): Array<{ leftPads: PadCoord[]; rightPads: PadCoord[]; zoneViolations: number }> {
  const partitions: Array<{ leftPads: PadCoord[]; rightPads: PadCoord[]; zoneViolations: number }> = [];
  const n = pads.length;
  if (n < 2 || n > 10) return partitions;

  const combinations = 1 << n;
  for (let mask = 1; mask < combinations - 1; mask++) {
    const leftPads: PadCoord[] = [];
    const rightPads: PadCoord[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) leftPads.push(pads[i]);
      else rightPads.push(pads[i]);
    }
    if (leftPads.length > 5 || rightPads.length > 5) continue;
    const zoneViolations =
      countZoneViolations(leftPads, 'left') + countZoneViolations(rightPads, 'right');
    partitions.push({ leftPads, rightPads, zoneViolations });
  }
  partitions.sort((a, b) => a.zoneViolations - b.zoneViolations);
  return partitions.slice(0, MAX_SPLIT_PARTITIONS);
}

export interface StructuralLookahead {
  /**
   * Owners each pad may take in a rule-keeping plan. A pad with no entry is not
   * filtered: either nothing constrains it, or keeping one finger for it was
   * shown to be impossible (see `hopelessOwners`).
   */
  viableOwners: Map<string, Set<OwnerCode>>;
  /**
   * For pads whose moments cannot all be played with any single finger: the
   * finger that keeps one-finger-per-sound at the most strikes. The solver holds
   * the pad to it, so the unavoidable re-fingerings are as few as possible and
   * do not depend on which moment happens to come first.
   */
  hopelessOwners: Map<string, PadOwnerChoice>;
  /**
   * Searches (once, lazily, within a work budget) for one rule-keeping owner for
   * every pad the lookahead still constrains. Pads it gave up on, or that no
   * listed moment constrains, are left out. Returns null when the search fails
   * or runs out of budget.
   */
  findWitness(): Map<string, PadOwnerChoice> | null;
}

interface MomentConstraint {
  pads: string[];
  tuples: OwnerCode[][];
  /** How many moments share this pad set — how many strikes it speaks for. */
  weight: number;
}

const padKeyOf = (pad: PadCoord) => `${pad.row},${pad.col}`;

const ALL_OWNERS: OwnerCode[] = ['left', 'right'].flatMap(hand =>
  ['thumb', 'index', 'middle', 'ring', 'pinky'].map(finger => `${hand}:${finger}`));

/** The finger standing on `pad` in `grip`, matched the way the solver matches it. */
function fingerOnPad(grip: HandPose, pad: PadCoord): FingerType | null {
  for (const [finger, coord] of Object.entries(grip.fingers)) {
    if (coord && coord.x === pad.col && coord.y === pad.row) return finger as FingerType;
  }
  return null;
}

/**
 * Rule-keeping fingerings, memoised by pad set. They depend only on the geometry
 * of the moment, and the same chords recur throughout a performance, across
 * repeated analyses of one layout, and across the thousands of layouts an
 * annealing run evaluates.
 */
const tupleCache = new Map<string, OwnerCode[][] | null>();

function cachedRulesKeepingTuples(setKey: string, pads: PadCoord[]): OwnerCode[][] | null {
  if (tupleCache.has(setKey)) return tupleCache.get(setKey)!;
  if (tupleCache.size >= TUPLE_CACHE_LIMIT) tupleCache.clear();
  const tuples = rulesKeepingTuples(pads);
  tupleCache.set(setKey, tuples);
  return tuples;
}

/** Every rule-keeping fingering of one moment, or null when there are too many to list. */
function rulesKeepingTuples(pads: PadCoord[]): OwnerCode[][] | null {
  const seen = new Set<string>();
  const tuples: OwnerCode[][] = [];
  const index = new Map(pads.map((pad, i) => [padKeyOf(pad), i]));

  const gripsFor = (handPads: PadCoord[], hand: 'left' | 'right') =>
    generateValidGripsWithTier(handPads, hand)
      .map(result => result.pose)
      .filter(pose => Object.keys(pose.fingers).length >= handPads.length);

  const fill = (tuple: OwnerCode[], grip: HandPose, handPads: PadCoord[], hand: 'left' | 'right') => {
    for (const pad of handPads) {
      const finger = fingerOnPad(grip, pad);
      if (!finger) return false;
      tuple[index.get(padKeyOf(pad))!] = `${hand}:${finger}`;
    }
    return true;
  };
  const add = (tuple: OwnerCode[]) => {
    const id = tuple.join('|');
    if (seen.has(id)) return true;
    seen.add(id);
    tuples.push(tuple);
    return tuples.length <= MAX_TUPLES_PER_MOMENT;
  };

  if (pads.length <= 5) {
    for (const hand of ['left', 'right'] as const) {
      if (countZoneViolations(pads, hand) > 0) continue;
      for (const grip of gripsFor(pads, hand)) {
        const tuple: OwnerCode[] = new Array(pads.length);
        if (fill(tuple, grip, pads, hand) && !add(tuple)) return null;
      }
    }
  }
  if (pads.length >= 2) {
    for (const { leftPads, rightPads, zoneViolations } of enumerateHandPartitions(pads)) {
      if (zoneViolations > 0) continue;
      const leftGrips = gripsFor(leftPads, 'left');
      if (leftGrips.length === 0) continue;
      const rightGrips = gripsFor(rightPads, 'right');
      for (const left of leftGrips) {
        const base: OwnerCode[] = new Array(pads.length);
        if (!fill(base, left, leftPads, 'left')) continue;
        for (const right of rightGrips) {
          const tuple = [...base];
          if (fill(tuple, right, rightPads, 'right') && !add(tuple)) return null;
        }
      }
    }
  }
  return tuples;
}

/** Removes `dropped` pads from every constraint, keeping what each moment still allows the others. */
function projectOut(constraints: MomentConstraint[], dropped: Set<string>): MomentConstraint[] {
  if (dropped.size === 0) return constraints;
  const result: MomentConstraint[] = [];
  for (const constraint of constraints) {
    const keep = constraint.pads.map((pad, j) => (dropped.has(pad) ? -1 : j)).filter(j => j >= 0);
    if (keep.length === constraint.pads.length) { result.push(constraint); continue; }
    if (keep.length === 0) continue;
    const seen = new Set<string>();
    const tuples: OwnerCode[][] = [];
    for (const tuple of constraint.tuples) {
      const projected = keep.map(j => tuple[j]);
      const id = projected.join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      tuples.push(projected);
    }
    result.push({ pads: keep.map(j => constraint.pads[j]), tuples, weight: constraint.weight });
  }
  return result;
}

/** Tracks the work a propagation may still do; exhausted means "gave up", not "inconsistent". */
interface WorkBudget { left: number; exhausted: boolean }

/**
 * Generalised arc consistency with a worklist: drops owners that no rule-keeping
 * fingering of some moment supports, given what the other pads can still take,
 * and revisits only the moments touching a pad whose options just narrowed.
 *
 * Returns null on success, or the pad left with no owner at all.
 */
function propagate(
  domains: Map<string, Set<OwnerCode>>,
  constraints: MomentConstraint[],
  byPad: Map<string, number[]>,
  initial: number[],
  budget?: WorkBudget,
): string | null {
  const queue = [...initial];
  const queued = new Set(queue);
  while (queue.length > 0) {
    const ci = queue.shift()!;
    queued.delete(ci);
    const constraint = constraints[ci];
    const padDomains = constraint.pads.map(pad => domains.get(pad)!);
    const supported = constraint.pads.map(() => new Set<OwnerCode>());
    for (const tuple of constraint.tuples) {
      if (budget && --budget.left < 0) { budget.exhausted = true; return constraint.pads[0]; }
      let fits = true;
      for (let j = 0; j < tuple.length; j++) {
        if (!padDomains[j].has(tuple[j])) { fits = false; break; }
      }
      if (!fits) continue;
      for (let j = 0; j < tuple.length; j++) supported[j].add(tuple[j]);
    }
    for (let j = 0; j < constraint.pads.length; j++) {
      const pad = constraint.pads[j];
      if (supported[j].size === padDomains[j].size) continue;
      const next = new Set([...padDomains[j]].filter(owner => supported[j].has(owner)));
      if (next.size === 0) return pad;
      domains.set(pad, next);
      for (const other of byPad.get(pad) ?? []) {
        if (other !== ci && !queued.has(other)) { queue.push(other); queued.add(other); }
      }
    }
  }
  return null;
}

function indexByPad(constraints: MomentConstraint[]): Map<string, number[]> {
  const byPad = new Map<string, number[]>();
  constraints.forEach((constraint, ci) => {
    for (const pad of constraint.pads) {
      if (!byPad.has(pad)) byPad.set(pad, []);
      byPad.get(pad)!.push(ci);
    }
  });
  return byPad;
}

/** Natural-first ordering of owners for a pad, so a chosen fingering is a sensible one. */
function ownerRank(owner: OwnerCode, col: number): number {
  const [hand, finger] = owner.split(':') as ['left' | 'right', FingerType];
  const order: FingerType[] = hand === 'left'
    ? ['pinky', 'ring', 'middle', 'index', 'thumb']
    : ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const naturalCol = (hand === 'left' ? 0 : 4) + order.indexOf(finger);
  const otherHalf = (hand === 'left' && col > 3) || (hand === 'right' && col <= 3);
  return Math.abs(naturalCol - col) + (finger === 'thumb' ? 4 : 0) + (otherHalf ? 8 : 0);
}

const toChoice = (code: OwnerCode): PadOwnerChoice => {
  const [hand, finger] = code.split(':') as ['left' | 'right', FingerType];
  return { hand, finger };
};

/**
 * Analyses the moments of a performance for rule-keeping fingerings.
 *
 * An unavoidable break is contained to where it occurs rather than disabling
 * the analysis for the whole performance:
 * - a moment no fingering can play within the rules constrains nothing;
 * - a pad that no single finger can play at all of its moments is set aside
 *   (and given the owner that keeps the rule at the most strikes);
 * - a user finger choice that cannot be kept everywhere is set aside too — the
 *   solver still holds the pad to it, it just stops constraining the others.
 * Every other pad keeps full lookahead guidance.
 */
export function analyzeStructuralRules(
  groups: Array<{ activePads: PadCoord[] }>,
  pinned: Map<string, PadOwnerChoice>,
): StructuralLookahead {
  const byKey = new Map<string, MomentConstraint>();
  for (const group of groups) {
    const unique = new Map<string, PadCoord>();
    for (const pad of group.activePads) unique.set(padKeyOf(pad), pad);
    const pads = [...unique.values()].sort((a, b) =>
      a.col !== b.col ? a.col - b.col : a.row - b.row);
    if (pads.length === 0) continue;
    const setKey = pads.map(padKeyOf).join('|');
    const existing = byKey.get(setKey);
    if (existing) { existing.weight++; continue; }
    const tuples = cachedRulesKeepingTuples(setKey, pads);
    // Too many fingerings to list: leaving the moment out only weakens pruning.
    if (tuples === null) continue;
    byKey.set(setKey, { pads: pads.map(padKeyOf), tuples, weight: 1 });
  }
  // A moment with no rule-keeping fingering breaks a rule whatever the plan
  // does; it says nothing about which finger any pad should keep.
  const original = [...byKey.values()].filter(constraint => constraint.tuples.length > 0);

  const constrainedPads = new Set(original.flatMap(constraint => constraint.pads));
  const base = new Map<string, Set<OwnerCode>>();
  for (const pad of constrainedPads) base.set(pad, new Set(ALL_OWNERS));
  for (const constraint of original) {
    constraint.pads.forEach((pad, j) => {
      const supported = new Set(constraint.tuples.map(tuple => tuple[j]));
      base.set(pad, new Set([...base.get(pad)!].filter(owner => supported.has(owner))));
    });
  }

  // Pads no single finger can play at every one of their moments.
  const hopeless = new Set([...base].filter(([, domain]) => domain.size === 0).map(([pad]) => pad));
  const givenUp = new Set(hopeless);
  const acceptedPins = new Map<string, OwnerCode>();

  let active: MomentConstraint[] = [];
  let byPad = new Map<string, number[]>();
  let domains = new Map<string, Set<OwnerCode>>();
  const attempt = (): string | null => {
    active = projectOut(original, givenUp);
    byPad = indexByPad(active);
    domains = new Map();
    for (const [pad, domain] of base) {
      if (givenUp.has(pad) || !byPad.has(pad)) continue;
      const pin = acceptedPins.get(pad);
      domains.set(pad, pin ? new Set(domain.has(pin) ? [pin] : []) : new Set(domain));
    }
    for (const [pad, domain] of domains) if (domain.size === 0) return pad;
    return propagate(domains, active, byPad, active.map((_, ci) => ci));
  };

  // Settle without the user's pins, setting aside whichever pad propagation
  // empties — each pass removes one, so this terminates.
  for (let wiped = attempt(); wiped !== null; wiped = attempt()) givenUp.add(wiped);
  // Then add the pins one at a time; one that cannot be kept everywhere is set
  // aside rather than discarding the lookahead for every other pad.
  for (const pad of [...pinned.keys()].sort()) {
    if (givenUp.has(pad) || !base.has(pad)) continue;
    const pin = pinned.get(pad)!;
    acceptedPins.set(pad, `${pin.hand}:${pin.finger}`);
    if (attempt() !== null) {
      acceptedPins.delete(pad);
      givenUp.add(pad);
      attempt();
    }
  }

  // Hopeless pads the user did not pin get the owner that keeps the rule at the
  // most strikes, weighted by how often each chord recurs.
  const hopelessOwners = new Map<string, PadOwnerChoice>();
  for (const pad of hopeless) {
    if (pinned.has(pad)) continue;
    const weights = new Map<OwnerCode, number>();
    for (const constraint of original) {
      const j = constraint.pads.indexOf(pad);
      if (j < 0) continue;
      for (const owner of new Set(constraint.tuples.map(tuple => tuple[j]))) {
        weights.set(owner, (weights.get(owner) ?? 0) + constraint.weight);
      }
    }
    const col = Number(pad.split(',')[1]);
    const best = [...weights].sort((a, b) =>
      b[1] - a[1] || ownerRank(a[0], col) - ownerRank(b[0], col))[0];
    if (best) hopelessOwners.set(pad, toChoice(best[0]));
  }

  const viableOwners = new Map([...domains].map(([pad, domain]) => [pad, new Set(domain)]));
  const settled = { active, byPad, domains };

  let witnessComputed = false;
  let witness: Map<string, PadOwnerChoice> | null = null;
  const findWitness = (): Map<string, PadOwnerChoice> | null => {
    if (witnessComputed) return witness;
    witnessComputed = true;
    if (settled.domains.size === 0) return null;

    // Most-constrained pad first, natural fingering first, re-propagating the
    // moments that pad sounds in after every choice. Bounded by work done, not
    // by nodes visited, so a large chord vocabulary cannot stall the solver.
    const budget: WorkBudget = { left: WITNESS_WORK_BUDGET, exhausted: false };
    const search = (current: Map<string, Set<OwnerCode>>): Map<string, Set<OwnerCode>> | null => {
      let choice: string | null = null;
      for (const [pad, domain] of current) {
        if (domain.size > 1 && (choice === null || domain.size < current.get(choice)!.size)) choice = pad;
      }
      if (choice === null) return current;
      const col = Number(choice.split(',')[1]);
      const options = [...current.get(choice)!].sort((a, b) => ownerRank(a, col) - ownerRank(b, col));
      for (const option of options) {
        const next = new Map([...current].map(([pad, domain]) => [pad, new Set(domain)]));
        next.set(choice, new Set([option]));
        const failed = propagate(next, settled.active, settled.byPad, settled.byPad.get(choice) ?? [], budget);
        if (budget.exhausted) return null;
        if (failed !== null) continue;
        const solved = search(next);
        if (solved) return solved;
        if (budget.exhausted) return null;
      }
      return null;
    };
    const solved = search(new Map([...settled.domains].map(([pad, domain]) => [pad, new Set(domain)])));
    witness = solved
      ? new Map([...solved].map(([pad, domain]) => [pad, toChoice([...domain][0])]))
      : null;
    return witness;
  };

  return { viableOwners, hopelessOwners, findWitness };
}
