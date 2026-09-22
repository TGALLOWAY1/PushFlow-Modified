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
 * other pad of the moment keeps an owner that is itself still possible. It also
 * searches (within a budget) for one complete rule-keeping owner per pad, which
 * the solver falls back to if its beam still misses.
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

/** Upper bound on search nodes when looking for a complete rule-keeping assignment. */
const WITNESS_SEARCH_BUDGET = 2_000;

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
   * Owners each pad may take in a rule-keeping plan. A pad with no entry is
   * unconstrained — breaking a rule somewhere is unavoidable for it.
   */
  viableOwners: Map<string, Set<OwnerCode>>;
  /**
   * One rule-keeping owner for every pad, when the search found one within its
   * budget. Its existence proves a rule-keeping plan exists (geometry only).
   */
  witness: Map<string, PadOwnerChoice> | null;
}

interface MomentConstraint {
  pads: string[];
  tuples: OwnerCode[][];
}

const padKeyOf = (pad: PadCoord) => `${pad.row},${pad.col}`;

/** The finger standing on `pad` in `grip`, matched the way the solver matches it. */
function fingerOnPad(grip: HandPose, pad: PadCoord): FingerType | null {
  for (const [finger, coord] of Object.entries(grip.fingers)) {
    if (coord && coord.x === pad.col && coord.y === pad.row) return finger as FingerType;
  }
  return null;
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

/**
 * Generalised arc consistency: repeatedly drop owners that no rule-keeping
 * fingering of some moment supports, given what the other pads can still take.
 * Returns false when some pad is left with no owner at all.
 */
function propagate(domains: Map<string, Set<OwnerCode>>, constraints: MomentConstraint[]): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const constraint of constraints) {
      const supported = constraint.pads.map(() => new Set<OwnerCode>());
      const padDomains = constraint.pads.map(pad => domains.get(pad)!);
      for (const tuple of constraint.tuples) {
        let fits = true;
        for (let j = 0; j < tuple.length; j++) {
          if (!padDomains[j].has(tuple[j])) { fits = false; break; }
        }
        if (!fits) continue;
        for (let j = 0; j < tuple.length; j++) supported[j].add(tuple[j]);
      }
      for (let j = 0; j < constraint.pads.length; j++) {
        const domain = padDomains[j];
        if (supported[j].size === domain.size) continue;
        const next = new Set([...domain].filter(owner => supported[j].has(owner)));
        if (next.size === 0) return false;
        domains.set(constraint.pads[j], next);
        changed = true;
      }
    }
  }
  return true;
}

/** Natural-first ordering of owners for a pad, so the witness is a sensible fingering. */
function ownerRank(owner: OwnerCode, col: number): number {
  const [hand, finger] = owner.split(':') as ['left' | 'right', FingerType];
  const order: FingerType[] = hand === 'left'
    ? ['pinky', 'ring', 'middle', 'index', 'thumb']
    : ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const naturalCol = (hand === 'left' ? 0 : 4) + order.indexOf(finger);
  const otherHalf = (hand === 'left' && col > 3) || (hand === 'right' && col <= 3);
  return Math.abs(naturalCol - col) + (finger === 'thumb' ? 4 : 0) + (otherHalf ? 8 : 0);
}

/**
 * Analyses the moments of a performance for rule-keeping fingerings.
 *
 * `pinned` owners (the user's own finger choices) are fixed. If propagation
 * shows the pins leave no rule-keeping plan, the per-pad viability is computed
 * without them, so the search still gets guidance for every other pad.
 */
export function analyzeStructuralRules(
  groups: Array<{ activePads: PadCoord[] }>,
  pinned: Map<string, PadOwnerChoice>,
): StructuralLookahead {
  const constraintsByKey = new Map<string, MomentConstraint>();
  const allPads = new Set<string>();
  const unboundedPads = new Set<string>();

  for (const group of groups) {
    const unique = new Map<string, PadCoord>();
    for (const pad of group.activePads) unique.set(padKeyOf(pad), pad);
    const pads = [...unique.values()].sort((a, b) =>
      a.col !== b.col ? a.col - b.col : a.row - b.row);
    const keys = pads.map(padKeyOf);
    keys.forEach(key => allPads.add(key));
    const setKey = keys.join('|');
    if (constraintsByKey.has(setKey)) continue;
    const tuples = rulesKeepingTuples(pads);
    if (tuples === null) {
      keys.forEach(key => unboundedPads.add(key));
      continue;
    }
    constraintsByKey.set(setKey, { pads: keys, tuples });
  }
  const constraints = [...constraintsByKey.values()];

  // Single-pad viability: owners every moment supports on its own.
  const baseDomains = new Map<string, Set<OwnerCode>>();
  for (const key of allPads) {
    baseDomains.set(key, new Set(
      ['left', 'right'].flatMap(hand =>
        ['thumb', 'index', 'middle', 'ring', 'pinky'].map(finger => `${hand}:${finger}`)),
    ));
  }
  for (const constraint of constraints) {
    constraint.pads.forEach((pad, j) => {
      const supported = new Set(constraint.tuples.map(tuple => tuple[j]));
      const domain = baseDomains.get(pad)!;
      baseDomains.set(pad, new Set([...domain].filter(owner => supported.has(owner))));
    });
  }
  const unfiltered = (domains: Map<string, Set<OwnerCode>>) => {
    const result = new Map<string, Set<OwnerCode>>();
    for (const [pad, domain] of domains) {
      // A pad in an over-large moment, or with no owner left, is not filtered.
      if (domain.size > 0 && !unboundedPads.has(pad)) result.set(pad, domain);
    }
    return result;
  };

  const hasEmpty = [...baseDomains.values()].some(domain => domain.size === 0);
  if (hasEmpty) return { viableOwners: unfiltered(baseDomains), witness: null };

  const domains = new Map([...baseDomains].map(([pad, domain]) => [pad, new Set(domain)]));
  for (const [pad, owner] of pinned) {
    if (!domains.has(pad)) continue;
    const code = `${owner.hand}:${owner.finger}`;
    domains.set(pad, new Set(domains.get(pad)!.has(code) ? [code] : []));
  }
  const pinsConsistent = [...domains.values()].every(domain => domain.size > 0)
    && propagate(domains, constraints);
  if (!pinsConsistent) {
    // The user's own choices rule out a rule-keeping plan. Guide the search with
    // what each pad can do on its own, and let it place the unavoidable breaks.
    const withoutPins = new Map([...baseDomains].map(([pad, domain]) => [pad, new Set(domain)]));
    const consistent = propagate(withoutPins, constraints);
    return { viableOwners: unfiltered(consistent ? withoutPins : baseDomains), witness: null };
  }

  // Look for one complete rule-keeping owner per pad: most-constrained pad first,
  // natural fingering first, re-propagating after every choice.
  let budget = WITNESS_SEARCH_BUDGET;
  const search = (current: Map<string, Set<OwnerCode>>): Map<string, Set<OwnerCode>> | null => {
    if (--budget < 0) return null;
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
      if (!propagate(next, constraints)) continue;
      const solved = search(next);
      if (solved) return solved;
      if (budget < 0) return null;
    }
    return null;
  };
  const solved = unboundedPads.size === 0 ? search(domains) : null;
  const witness = solved
    ? new Map([...solved].map(([pad, domain]) => {
        const [hand, finger] = [...domain][0].split(':') as ['left' | 'right', FingerType];
        return [pad, { hand, finger }];
      }))
    : null;

  return { viableOwners: unfiltered(domains), witness };
}
