/**
 * Hand separation and one finger per sound are HARD rules.
 *
 *   - Hand separation: the left hand plays columns 0–4, the right hand 3–7.
 *   - One finger per sound: every pad is struck by the same finger throughout.
 *
 * Both used to be soft costs, which the solver traded away whenever breaking
 * them was cheaper — on the reference performance a sound was played by two
 * fingers although a plan keeping every rule existed. They are now kept
 * whenever any plan can keep them, and broken only where none can, on as few
 * strikes as possible, with every break flagged.
 *
 * The central test here is an oracle: a brute-force search over every static
 * fingering decides whether a rule-keeping plan exists, and the solver must
 * relax a rule exactly when it does not.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Midi } from '@tonejs/midi';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';
import { type Voice } from '../../../src/types/voice';
import { createEmptyLayout, type Layout } from '../../../src/types/layout';
import { type FingerAssignment, type ExecutionPlanResult } from '../../../src/types/executionPlan';
import { type FingerType } from '../../../src/types/fingerModel';
import { type PadCoord } from '../../../src/types/padGrid';
import { deriveFeasibilityVerdict } from '../../../src/types/diagnostics';
import { createBeamSolver } from '../../../src/engine/solvers/beamSolver';
import { analyzeStructuralRules } from '../../../src/engine/solvers/structuralLookahead';
import { seedLayoutFromPose0 } from '../../../src/engine/mapping/seedFromPose';
import { createDefaultPose0 } from '../../../src/engine/prior/naturalHandPose';
import { generateValidGripsWithTier, isStrictGripValid } from '../../../src/engine/prior/feasibility';
import { isZoneValid } from '../../../src/engine/surface/handZone';
import { buildFingerAssignmentFromLayout } from '../../../src/engine/optimization/greedyEvaluation';
import { summarizeConstraintRelaxation } from '../../../src/engine/evaluation/constraintRelaxation';
import { createSeededRng } from '../../../src/utils/seededRng';
import { evaluatePerformance } from '../../../src/engine/evaluation/canonicalEvaluator';
import { buildPerformanceMoments } from '../../../src/engine/structure/momentBuilder';
import { getNeutralHandCenters } from '../../../src/engine/prior/handPose';
import { DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

type Hand = 'left' | 'right';
const FINGERS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const key = (pad: PadCoord) => `${pad.row},${pad.col}`;

function voice(id: string, midi: number): Voice {
  return { id, name: id, sourceType: 'midi_track', sourceFile: '', originalMidiNote: midi, color: '#444' };
}

/** Builds a layout and a performance from moments of pad keys, `spacing` seconds apart. */
function scenario(padToVoice: Record<string, Voice>, moments: string[][], spacing = 0.5) {
  const layout: Layout = { ...createEmptyLayout('L', 'L', 'active'), padToVoice };
  const events: PerformanceEvent[] = [];
  moments.forEach((moment, mi) => moment.forEach((pk, k) => {
    const v = padToVoice[pk];
    events.push({
      noteNumber: v.originalMidiNote!, voiceId: v.id, startTime: mi * spacing,
      duration: 0.1, velocity: 100, eventKey: `e${mi}-${k}`,
    });
  }));
  return { layout, performance: { events, tempo: 120, name: 'scenario' } };
}

async function solve(
  layout: Layout,
  performance: { events: PerformanceEvent[]; tempo: number; name: string },
  options: {
    seeds?: Record<string, { hand: Hand; finger: FingerType }>;
    manual?: Record<string, { hand: Hand; finger: FingerType }>;
  } = {},
): Promise<ExecutionPlanResult> {
  const solver = createBeamSolver({
    instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    layout,
    initialPadOwnership: options.seeds,
  });
  return solver.solve(performance as never, { ...DEFAULT_ENGINE_CONFIG, beamWidth: 15 }, options.manual);
}

/**
 * Counts rule breaks straight from the plan, without trusting the solver's flags.
 * A pad's owner is its pinned finger if the user set one, otherwise the finger
 * that plays it most (the earliest on a tie) — so the count is a property of
 * the fingering, not of the order of the moments.
 */
function independentBreaks(plan: ExecutionPlanResult, pins: Record<string, string> = {}) {
  const played = plan.fingerAssignments
    .filter((fa): fa is FingerAssignment & { assignedHand: Hand } => fa.assignedHand !== 'Unplayable')
    .sort((a, b) => a.startTime - b.startTime);
  const tallies = new Map<string, Map<string, { count: number; first: number }>>();
  played.forEach((fa, order) => {
    const pk = `${fa.row},${fa.col}`;
    const code = `${fa.assignedHand}:${fa.finger}`;
    if (!tallies.has(pk)) tallies.set(pk, new Map());
    const entry = tallies.get(pk)!.get(code);
    if (entry) entry.count++;
    else tallies.get(pk)!.set(code, { count: 1, first: order });
  });
  const owner = new Map<string, string>();
  for (const [pk, tally] of tallies) {
    owner.set(pk, pins[pk] ?? [...tally].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)[0][0]);
  }
  let zone = 0;
  let ownership = 0;
  for (const fa of played) {
    if (!isZoneValid({ row: fa.row!, col: fa.col! }, fa.assignedHand)) zone++;
    if (owner.get(`${fa.row},${fa.col}`) !== `${fa.assignedHand}:${fa.finger}`) ownership++;
  }
  return { zone, ownership };
}

// ─── Oracle ─────────────────────────────────────────────────────────────────

/** Every fingering of one moment that keeps both rules, as "hand:finger|..." in sorted pad order. */
function ruleKeepingFingerings(pads: PadCoord[]): Set<string> {
  const sorted = [...pads].sort((a, b) => a.col - b.col || a.row - b.row);
  const result = new Set<string>();
  const grips = (handPads: PadCoord[], hand: Hand) => handPads.every(p => isZoneValid(p, hand))
    ? generateValidGripsWithTier(handPads, hand).map(r => r.pose)
      .filter(pose => Object.keys(pose.fingers).length >= handPads.length)
    : [];
  const fingering = (grip: { fingers: Record<string, { x: number; y: number } | undefined> }, handPads: PadCoord[], hand: Hand) => {
    const out: Record<string, string> = {};
    for (const pad of handPads) {
      const hit = Object.entries(grip.fingers).find(([, c]) => c && c.x === pad.col && c.y === pad.row);
      if (!hit) return null;
      out[key(pad)] = `${hand}:${hit[0]}`;
    }
    return out;
  };
  const record = (f: Record<string, string>) => result.add(sorted.map(p => f[key(p)]).join('|'));
  if (sorted.length <= 5) {
    for (const hand of ['left', 'right'] as const) {
      for (const grip of grips(sorted, hand)) {
        const f = fingering(grip as never, sorted, hand);
        if (f) record(f);
      }
    }
  }
  for (let mask = 1; mask < (1 << sorted.length) - 1; mask++) {
    const left = sorted.filter((_, i) => mask & (1 << i));
    const right = sorted.filter((_, i) => !(mask & (1 << i)));
    if (left.length > 5 || right.length > 5) continue;
    const leftGrips = grips(left, 'left');
    const rightGrips = grips(right, 'right');
    for (const a of leftGrips) {
      for (const b of rightGrips) {
        const fa = fingering(a as never, left, 'left');
        const fb = fingering(b as never, right, 'right');
        if (fa && fb) record({ ...fa, ...fb });
      }
    }
  }
  return result;
}

/** Brute force: is there one owner per pad that every moment's rule-keeping fingerings allow? */
function ruleKeepingPlanExists(pads: PadCoord[], moments: PadCoord[][], pins: Record<string, string>): boolean {
  const allowed = moments.map(ruleKeepingFingerings);
  const sortedMoments = moments.map(m => [...m].sort((a, b) => a.col - b.col || a.row - b.row));
  const options = (['left', 'right'] as const).flatMap(h => FINGERS.map(f => `${h}:${f}`));
  const owner: Record<string, string> = {};
  const consistent = () => sortedMoments.every((m, mi) =>
    !m.every(p => owner[key(p)]) || allowed[mi].has(m.map(p => owner[key(p)]).join('|')));
  const place = (i: number): boolean => {
    if (i === pads.length) return true;
    for (const option of pins[key(pads[i])] ? [pins[key(pads[i])]] : options) {
      owner[key(pads[i])] = option;
      if (consistent() && place(i + 1)) return true;
      delete owner[key(pads[i])];
    }
    return false;
  };
  return place(0);
}

describe('the solver relaxes a rule exactly when no plan can keep it', () => {
  for (const variant of ['plain', 'pose-seeded', 'user-pinned'] as const) {
    it(`agrees with a brute-force oracle on random performances (${variant})`, async () => {
      const rng = createSeededRng(variant === 'plain' ? 2024 : variant === 'pose-seeded' ? 7 : 99);
      const disagreements: unknown[] = [];
      let strictCases = 0;
      let relaxedCases = 0;

      for (let t = 0; t < 80; t++) {
        const pads: PadCoord[] = [];
        const padCount = 3 + Math.floor(rng() * 3);
        while (pads.length < padCount) {
          const pad = { row: Math.floor(rng() * 8), col: Math.floor(rng() * 8) };
          if (!pads.some(p => key(p) === key(pad))) pads.push(pad);
        }
        const moments: PadCoord[][] = [];
        const momentCount = 3 + Math.floor(rng() * 4);
        for (let m = 0; m < momentCount; m++) {
          const size = 1 + Math.floor(rng() * Math.min(4, padCount));
          moments.push([...pads].sort(() => rng() - 0.5).slice(0, size));
        }
        const used = pads.filter(p => moments.some(m => m.some(q => key(q) === key(p))));
        const padToVoice: Record<string, Voice> = {};
        used.forEach((p, i) => { padToVoice[key(p)] = voice(`v${i}`, 40 + i); });
        // One second apart, so hand speed never decides the outcome — geometry does.
        const { layout, performance } = scenario(padToVoice, moments.map(m => m.map(key)), 1.0);

        const randomOwner = () => ({ hand: (rng() < 0.5 ? 'left' : 'right') as Hand, finger: FINGERS[Math.floor(rng() * 5)] });
        const seeds: Record<string, { hand: Hand; finger: FingerType }> = {};
        const manual: Record<string, { hand: Hand; finger: FingerType }> = {};
        const pins: Record<string, string> = {};
        if (variant === 'pose-seeded') {
          for (const p of used) if (rng() < 0.7) seeds[key(p)] = randomOwner();
        }
        if (variant === 'user-pinned') {
          for (const p of used) {
            if (rng() >= 0.3) continue;
            let choice = randomOwner();
            while (!isZoneValid(p, choice.hand)) choice = randomOwner();
            pins[key(p)] = `${choice.hand}:${choice.finger}`;
            for (const e of performance.events) if (e.voiceId === padToVoice[key(p)].id) manual[e.eventKey!] = choice;
          }
        }

        const plan = await solve(layout, performance, {
          seeds: variant === 'pose-seeded' ? seeds : undefined,
          manual: variant === 'user-pinned' ? manual : undefined,
        });
        const exists = ruleKeepingPlanExists(used, moments, pins);
        const summary = plan.constraintRelaxation!;
        const bestEffort = (plan.diagnostics?.feasibility.reasons ?? []).some(r => r.type === 'fallback_grip');
        const counted = independentBreaks(plan, pins);
        if (exists) strictCases++; else relaxedCases++;

        // Keeps the rules whenever it can.
        if (exists && summary.mode !== 'strict') disagreements.push({ t, kind: 'relaxed needlessly', summary });
        // Never claims to keep them when it cannot (a best-effort moment has no valid grip at
        // all, so the oracle cannot vouch for it either way).
        if (!exists && summary.mode === 'strict' && !bestEffort) disagreements.push({ t, kind: 'false strict claim' });
        // Its own counts match what the plan actually does.
        if (counted.zone !== summary.handZoneStrikes || counted.ownership !== summary.fingerOwnershipStrikes) {
          disagreements.push({ t, kind: 'miscounted', counted, summary });
        }
        // And relaxing a rule never costs playability.
        if (plan.unplayableCount > 0) disagreements.push({ t, kind: 'unplayable', count: plan.unplayableCount });
        // The published fingering names only fingers that actually played each pad.
        for (const fa of plan.fingerAssignments) {
          if (fa.assignedHand === 'Unplayable') continue;
          const owner = plan.padFingerOwnership?.[`${fa.row},${fa.col}`];
          const playedByOwner = plan.fingerAssignments.some(other =>
            other.row === fa.row && other.col === fa.col &&
            other.assignedHand === owner?.hand && other.finger === owner?.finger);
          if (!playedByOwner) { disagreements.push({ t, kind: 'owner never played', pad: `${fa.row},${fa.col}` }); break; }
        }
      }

      expect(disagreements).toEqual([]);
      // The sample must exercise both outcomes, or it proves nothing.
      expect(strictCases).toBeGreaterThan(10);
      expect(relaxedCases).toBeGreaterThan(5);
    }, 120_000);
  }
});

describe('hand separation and one finger per sound are kept wherever possible', () => {
  it('keeps both rules on the reference performance at the auto-analysis beam width', async () => {
    // With the rules as soft costs, this exact configuration played one sound
    // with two fingers (left ring and left thumb) and scored 45 with 13 Hard
    // events, although a plan keeping both rules exists.
    const p = path.resolve(__dirname, '../../fixtures/midi/TEST MIDI 1.mid');
    const buf = fs.readFileSync(p);
    const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const events: PerformanceEvent[] = [];
    midi.tracks.forEach(track => track.notes.forEach((note, k) => events.push({
      noteNumber: note.midi, startTime: note.time, duration: note.duration,
      velocity: Math.round(note.velocity * 127), channel: track.channel + 1,
      eventKey: `${note.ticks}:${note.midi}:${k}`,
    })));
    events.sort((a, b) => a.startTime - b.startTime);
    const notes = [...new Set(events.map(e => e.noteNumber))].sort((a, b) => a - b);
    const performance = { events, tempo: 120, name: 'TEST MIDI 1' };
    const layout = seedLayoutFromPose0(
      performance, createDefaultPose0(), 0, { voices: new Map(notes.map(n => [String(n), voice(`s-${n}`, n)])) },
    );

    const plan = await solve(layout, performance);

    expect(plan.constraintRelaxation?.mode).toBe('strict');
    expect(independentBreaks(plan)).toEqual({ zone: 0, ownership: 0 });
    expect(plan.unplayableCount).toBe(0);
    expect(plan.hardCount).toBe(0);
  }, 60_000);

  it('does not follow a suggested finger into a dead end', async () => {
    // The natural-pose suggestion puts the shared-zone pad on the left ring
    // finger. That works for the first chord but not the second, where the same
    // pad sounds with a far-left pad no left grip can reach with that finger.
    const { layout, performance } = scenario(
      { '3,3': voice('a', 40), '4,5': voice('b', 41), '3,4': voice('c', 42), '4,0': voice('d', 43) },
      [['3,3', '4,5', '3,4'], ['3,3', '4,0'], ['3,3', '4,5', '3,4'], ['3,3', '4,0']],
    );
    const plan = await solve(layout, performance, { seeds: { '3,3': { hand: 'left', finger: 'ring' } } });

    expect(plan.constraintRelaxation?.mode).toBe('strict');
    expect(independentBreaks(plan)).toEqual({ zone: 0, ownership: 0 });
  });

  it('keeps a finger preference to its own sound instead of dragging the whole moment onto that hand', async () => {
    // A kick pinned to the left index, struck with a right-side hi-hat. The old
    // override forced every pad of the moment onto the preferred hand: the
    // hi-hat went to the left thumb (breaking hand separation) and the kick to
    // the left ring (ignoring the very preference that caused it).
    const { layout, performance } = scenario(
      { '3,1': voice('kick', 36), '3,6': voice('hat', 42), '2,5': voice('snare', 38) },
      [['3,1', '3,6'], ['2,5', '3,6'], ['3,1', '3,6'], ['2,5', '3,6']],
    );
    const manual = Object.fromEntries(performance.events
      .filter(e => e.voiceId === 'kick')
      .map(e => [e.eventKey!, { hand: 'left' as const, finger: 'index' as const }]));
    const plan = await solve(layout, performance, { manual });

    const kick = plan.fingerAssignments.filter(fa => fa.voiceId === 'kick');
    const hat = plan.fingerAssignments.filter(fa => fa.voiceId === 'hat');
    expect(kick.every(fa => fa.assignedHand === 'left' && fa.finger === 'index')).toBe(true);
    expect(hat.every(fa => fa.assignedHand === 'right')).toBe(true);
    expect(plan.constraintRelaxation?.mode).toBe('strict');
  });
});

describe('when a rule has to give way', () => {
  // Two right-zone pads seven rows apart: no single hand spans them, and the
  // left hand may not enter columns 5–7. Any plan must break hand separation.
  const moments = [['0,5', '7,5'], ['3,1'], ['0,5', '7,5'], ['3,1'], ['0,5', '7,5']];
  const pads = { '0,5': voice('high', 40), '7,5': voice('low', 41), '3,1': voice('kick', 36) };

  it('breaks it on as few strikes as possible, and keeps the other rule', async () => {
    const { layout, performance } = scenario(pads, moments);
    const plan = await solve(layout, performance);

    const summary = plan.constraintRelaxation!;
    expect(summary.mode).toBe('relaxed');
    // One crossing per moment, never both pads.
    expect(summary.handZoneStrikes).toBe(3);
    expect(summary.relaxedMomentCount).toBe(3);
    // The crossing sound keeps a single finger throughout.
    expect(summary.fingerOwnershipStrikes).toBe(0);
    expect(summary.sounds).toHaveLength(1);
    expect(summary.sounds[0].fingersUsed).toHaveLength(1);
    expect(plan.unplayableCount).toBe(0);
    expect(independentBreaks(plan)).toEqual({ zone: 3, ownership: 0 });
  });

  it('flags every relaxed strike and marks the plan degraded, with the reason', async () => {
    const { layout, performance } = scenario(pads, moments);
    const plan = await solve(layout, performance);

    const flagged = plan.fingerAssignments.filter(fa => fa.relaxedConstraints?.includes('hand-zone'));
    expect(flagged).toHaveLength(3);
    for (const fa of flagged) expect(isZoneValid({ row: fa.row!, col: fa.col! }, fa.assignedHand as Hand)).toBe(false);
    expect(plan.diagnostics?.feasibility.level).toBe('degraded');
    expect(plan.diagnostics?.feasibility.reasons.some(r => r.type === 'constraint_relaxed')).toBe(true);
  });
});

describe('a rule gives way only where it must', () => {
  it('keeps a sound on one finger when only one finger can serve all its moments', async () => {
    // The lookahead leaves pad (6,3) exactly one viable finger, the left thumb.
    // Cheaper right-hand fingers pinned at its first strike used to crowd that
    // path out of the beam, so the sound later had to be re-fingered on top of
    // the one hand-separation break the final chord makes unavoidable.
    const { layout, performance } = scenario(
      Object.fromEntries(['6,3', '2,2', '1,7', '2,1', '0,5', '7,5'].map((pk, i) => [pk, voice(`v${i}`, 40 + i)])),
      [['1,7'], ['6,3'], ['2,2', '1,7', '2,1'], ['2,1', '6,3', '2,2', '1,7'], ['2,1', '2,2', '6,3'], ['2,2', '6,3'], ['0,5', '7,5']],
    );
    const plan = await solve(layout, performance);

    const fingers = new Set(plan.fingerAssignments
      .filter(fa => fa.row === 6 && fa.col === 3)
      .map(fa => `${fa.assignedHand}:${fa.finger}`));
    expect([...fingers]).toEqual(['left:thumb']);
    expect(plan.constraintRelaxation?.handZoneStrikes).toBe(1);
    expect(plan.constraintRelaxation?.fingerOwnershipStrikes).toBe(0);
  });

  it('counts unavoidable re-fingerings the same whichever moment comes first', async () => {
    // Pad (2,3) can only be the left thumb in chord X and only the right thumb in
    // chord Y. Letting its first strike decide its finger reported 12 breaks when
    // X came first and 1 when it came last — for the same fingering.
    const X = ['2,3', '1,5', '4,5', '4,0', '0,5', '1,0'];
    const Y = ['2,3', '4,7', '1,2', '0,0', '3,1'];
    const pads = Object.fromEntries([...new Set([...X, ...Y])].map((pk, i) => [pk, voice(`v${i}`, 40 + i)]));
    const first = scenario(pads, [X, ...Array(12).fill(Y)], 1);
    const last = scenario(pads, [...Array(12).fill(Y), X], 1);

    const a = await solve(first.layout, first.performance);
    const b = await solve(last.layout, last.performance);

    expect(a.constraintRelaxation?.fingerOwnershipStrikes).toBe(1);
    expect(b.constraintRelaxation?.fingerOwnershipStrikes).toBe(1);
    expect(a.padFingerOwnership?.['2,3']).toEqual(b.padFingerOwnership?.['2,3']);
  });

  it('does not let one unavoidable break cause breaks anywhere else', async () => {
    // Appending an impossible chord, or a sound pinned to a finger it can never
    // keep, used to switch the lookahead off for the whole performance, and the
    // solver then broke rules on other sounds it had kept before.
    const rng = createSeededRng(31);
    const leaks: unknown[] = [];
    let checked = 0;
    for (let t = 0; t < 60; t++) {
      const pads: string[] = [];
      const padCount = 4 + Math.floor(rng() * 3);
      while (pads.length < padCount) {
        const pk = `${1 + Math.floor(rng() * 6)},${Math.floor(rng() * 7)}`;
        if (!pads.includes(pk)) pads.push(pk);
      }
      const moments: string[][] = [];
      for (let m = 0; m < 4 + Math.floor(rng() * 6); m++) {
        moments.push([...pads].sort(() => rng() - 0.5).slice(0, 1 + Math.floor(rng() * 3)));
      }
      const voices = (list: string[]) => Object.fromEntries(list.map((pk, i) => [pk, voice(`v${i}`, 40 + i)]));
      const base = scenario(voices(pads), moments, 1);
      const alone = await solve(base.layout, base.performance);
      if (alone.constraintRelaxation?.mode !== 'strict' || alone.unplayableCount > 0) continue;
      checked++;

      const chord = scenario(voices([...pads, '0,7', '7,7']), [...moments, ['0,7', '7,7']], 1);
      const withChord = await solve(chord.layout, chord.performance);
      const chordLeaks = withChord.fingerAssignments
        .filter(fa => fa.relaxedConstraints && !(fa.col === 7 && (fa.row === 0 || fa.row === 7)));
      if (chordLeaks.length > 0) leaks.push({ t, kind: 'impossible chord', count: chordLeaks.length });

      const pinned = scenario(voices([...pads, '3,6']), [...moments, ['3,6']], 1);
      const pinnedVoice = pinned.layout.padToVoice['3,6'].id;
      const manual = Object.fromEntries(pinned.performance.events
        .filter(e => e.voiceId === pinnedVoice)
        .map(e => [e.eventKey!, { hand: 'left' as const, finger: 'index' as const }]));
      const withPin = await solve(pinned.layout, pinned.performance, { manual });
      const pinLeaks = withPin.fingerAssignments.filter(fa => fa.relaxedConstraints && !(fa.row === 3 && fa.col === 6));
      if (pinLeaks.length > 0) leaks.push({ t, kind: 'unkeepable pin', count: pinLeaks.length });
    }
    expect(leaks).toEqual([]);
    expect(checked).toBeGreaterThan(30);
  }, 60_000);

  it('keeps a sound that cannot have its own finger on one stand-in, and reports fingers that were played', async () => {
    // Both sounds pinned to the right index, always struck together: one of them
    // cannot have it. It used to wander between stand-ins (R1, then R3), and the
    // published fingering claimed R2 for it — so Score, factor bars and
    // Calculate Cost all scored a collision the plan never plays.
    const { layout, performance } = scenario(
      { '0,5': voice('kick', 36), '0,6': voice('snare', 38) },
      Array(8).fill(['0,5', '0,6']),
    );
    const manual = Object.fromEntries(performance.events.map(e => [e.eventKey!, { hand: 'right' as const, finger: 'index' as const }]));
    const plan = await solve(layout, performance, { manual });

    const snare = new Set(plan.fingerAssignments.filter(fa => fa.col === 6).map(fa => `${fa.assignedHand}:${fa.finger}`));
    expect(snare.size).toBe(1);
    const snareSummary = plan.constraintRelaxation?.sounds.find(sd => sd.soundId === 'snare');
    expect(snareSummary?.ownerFinger).toBe('R2');
    expect(snareSummary?.ownerIsUserChoice).toBe(true);
    expect(snare.has(`${plan.padFingerOwnership!['0,6'].hand}:${plan.padFingerOwnership!['0,6'].finger}`)).toBe(true);

    const calculated = evaluatePerformance({
      moments: buildPerformanceMoments(performance.events),
      layout,
      padFingerAssignment: plan.padFingerOwnership!,
      config: {
        restingPose: DEFAULT_ENGINE_CONFIG.restingPose,
        stiffness: DEFAULT_ENGINE_CONFIG.stiffness,
        instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
        neutralHandCenters: getNeutralHandCenters(layout, DEFAULT_TEST_INSTRUMENT_CONFIG),
      },
    });
    expect(calculated.feasibility.level).not.toBe('infeasible');
  });

  it('plays every moment of a fast passage before it keeps the rules', async () => {
    // Keeping both rules through this passage leaves no hand within reach of the
    // chord at 0.632 s, 36 ms after the one before. Playing it needs one sound
    // on the other hand for a few strikes: playable comes first.
    const passage: Array<[number, string[]]> = [
      [0, ['1,1', '5,6', '4,5']], [0.038, ['1,1', '5,6', '4,5']], [0.144, ['1,3', '1,1']],
      [0.203, ['7,2', '1,3', '1,1']], [0.319, ['7,2', '4,4', '1,3']], [0.406, ['4,5', '1,1']],
      [0.443, ['4,5', '1,3']], [0.515, ['1,1']], [0.596, ['4,5', '1,3', '7,2']],
      [0.632, ['1,1', '5,6']], [0.695, ['4,5', '1,1']],
    ];
    const padToVoice = Object.fromEntries([...new Set(passage.flatMap(([, ps]) => ps))].map((pk, i) => [pk, voice(`v${i}`, 40 + i)]));
    const layout: Layout = { ...createEmptyLayout('L', 'L', 'active'), padToVoice };
    const events: PerformanceEvent[] = passage.flatMap(([time, ps], mi) => ps.map((pk, k) => ({
      noteNumber: padToVoice[pk].originalMidiNote!, voiceId: padToVoice[pk].id, startTime: time,
      duration: 0.05, velocity: 100, eventKey: `e${mi}-${k}`,
    })));

    const plan = await solve(layout, { events, tempo: 120, name: 'fast' });

    expect(plan.unplayableCount).toBe(0);
    expect(plan.constraintRelaxation?.mode).toBe('relaxed');
  });

  it('never publishes a finger that did not play the pad, even when a rescue search had to leave it', async () => {
    // 45 ms between moments: the fallback search holds the lookahead's
    // fingering, and hand speed forces it off that fingering. The pads it left
    // used to be published (and scored) with fingers that never touched them.
    const { layout, performance } = scenario(
      Object.fromEntries(['3,1', '0,4', '5,3', '7,3', '2,4', '7,7'].map((pk, i) => [pk, voice(`v${i}`, 40 + i)])),
      [['3,1'], ['0,4', '5,3'], ['7,3', '0,4'], ['5,3', '2,4', '7,7'], ['7,7', '0,4'], ['7,7', '0,4', '7,3', '2,4']],
      0.045,
    );
    const plan = await solve(layout, performance);

    const played = new Map<string, Set<string>>();
    for (const fa of plan.fingerAssignments) {
      if (fa.assignedHand === 'Unplayable') continue;
      const pk = `${fa.row},${fa.col}`;
      if (!played.has(pk)) played.set(pk, new Set());
      played.get(pk)!.add(`${fa.assignedHand}:${fa.finger}`);
    }
    for (const [pk, fingers] of played) {
      const owner = plan.padFingerOwnership![pk];
      expect(fingers.has(`${owner.hand}:${owner.finger}`)).toBe(true);
    }
    const counted = independentBreaks(plan);
    expect(counted.zone).toBe(plan.constraintRelaxation?.handZoneStrikes);
    expect(counted.ownership).toBe(plan.constraintRelaxation?.fingerOwnershipStrikes);
  });
});

describe('the lookahead', () => {
  it('rules out a finger that is certain to fail at a later moment', () => {
    const lookahead = analyzeStructuralRules([
      { activePads: [{ row: 3, col: 3 }, { row: 4, col: 5 }, { row: 3, col: 4 }] },
      { activePads: [{ row: 3, col: 3 }, { row: 4, col: 0 }] },
    ], new Map());
    const { viableOwners } = lookahead;
    const witness = lookahead.findWitness();

    expect(viableOwners.get('3,3')?.has('left:ring')).toBe(false);
    expect(witness).not.toBeNull();
    // The witness keeps every rule at both moments.
    for (const [pk, owner] of witness!) {
      const [row, col] = pk.split(',').map(Number);
      expect(isZoneValid({ row, col }, owner.hand)).toBe(true);
    }
  });

  it('offers no fingering, and filters nothing, when no plan can keep the rules', () => {
    const lookahead = analyzeStructuralRules(
      [{ activePads: [{ row: 0, col: 5 }, { row: 7, col: 5 }] }], new Map(),
    );
    expect(lookahead.findWitness()).toBeNull();
    expect(lookahead.viableOwners.size).toBe(0);
  });

  it('gives a pad that cannot keep one finger the finger that serves most of its strikes', () => {
    // (2,3) can only be the left thumb in chord X and only the right thumb in Y.
    // Held to the majority finger from the start, the search counts its one
    // unavoidable re-fingering as one — not twelve, as a first-strike pin did.
    const X = [[2, 3], [1, 5], [4, 5], [4, 0], [0, 5], [1, 0]];
    const Y = [[2, 3], [4, 7], [1, 2], [0, 0], [3, 1]];
    const chord = (pads: number[][]) => ({ activePads: pads.map(([row, col]) => ({ row, col })) });
    const lookahead = analyzeStructuralRules([chord(X), ...Array(12).fill(chord(Y))], new Map());

    expect(lookahead.hopelessOwners.get('2,3')).toEqual({ hand: 'right', finger: 'thumb' });
    expect(lookahead.viableOwners.has('2,3')).toBe(false);
  });

  it('honours the user\'s own finger choice in its fingering', () => {
    const pinned = new Map([['3,3', { hand: 'right' as const, finger: 'thumb' as const }]]);
    const witness = analyzeStructuralRules([
      { activePads: [{ row: 3, col: 3 }, { row: 4, col: 5 }] },
    ], pinned).findWitness();
    expect(witness?.get('3,3')).toEqual({ hand: 'right', finger: 'thumb' });
  });
});

describe('greedy fingering keeps hand separation whenever it can', () => {
  it('finds an in-zone, playable assignment that first-fit misses', () => {
    // Eight left-side pads in chords of up to four. First-fit colours the
    // co-occurrence graph badly: it ran pad (4,0) out of left fingers and sent
    // it to the right hand, although an all-left assignment exists in which no
    // two simultaneous pads share a finger and every chord is a valid grip.
    const pads = ['3,2', '4,1', '5,1', '4,0', '2,1', '5,0', '5,2', '3,1'];
    const padToVoice: Record<string, Voice> = {};
    pads.forEach((pk, i) => { padToVoice[pk] = voice(`v${i}`, 40 + i); });
    const momentPads = [
      ['2,1', '3,1', '4,0', '5,2'], ['4,1', '2,1', '3,1', '5,2'], ['5,2', '3,2', '5,0'], ['5,1', '4,1'],
      ['5,0', '3,2', '5,1', '3,1'], ['4,0', '3,2', '5,2', '3,1'], ['3,1', '4,0', '3,2', '5,2'],
      ['5,1', '2,1', '5,0'], ['4,0', '2,1'], ['3,2', '4,0', '3,1', '4,1'], ['3,2', '4,1', '3,1'],
    ];
    const layout: Layout = { ...createEmptyLayout('L', 'L', 'active'), padToVoice };
    const moments = momentPads.map(ps => ({
      notes: ps.map(pk => ({ padId: '', soundId: padToVoice[pk].id, noteNumber: padToVoice[pk].originalMidiNote! })),
    }));

    const assignment = buildFingerAssignmentFromLayout(layout, moments);

    for (const pk of pads) expect(assignment[pk].hand).toBe('left');
    for (const ps of momentPads) {
      const fingers = ps.map(pk => assignment[pk].finger);
      expect(new Set(fingers).size).toBe(fingers.length);
      const grip: Partial<Record<FingerType, { x: number; y: number }>> = {};
      for (const pk of ps) {
        const [row, col] = pk.split(',').map(Number);
        grip[assignment[pk].finger] = { x: col, y: row };
      }
      expect(isStrictGripValid(grip, 'left')).toBe(true);
    }
  });

  it('crosses a hand over before asking for an impossible grip, as the beam solver does', async () => {
    // Two right-zone pads seven rows apart, struck together: no right-hand grip
    // spans them. Greedy used to keep both on the right hand anyway (a "fallback
    // grip") while the beam sent one to the left hand — so the same layout read
    // "rules hold" in one engine and "rules relaxed" in the other.
    const { layout, performance } = scenario(
      { '0,6': voice('high', 40), '7,6': voice('low', 41), '3,1': voice('kick', 36) },
      [['0,6', '7,6'], ['3,1'], ['0,6', '7,6'], ['3,1']],
    );
    const moments = [['0,6', '7,6'], ['3,1'], ['0,6', '7,6'], ['3,1']].map(ps => ({
      notes: ps.map(pk => ({ padId: '', soundId: layout.padToVoice[pk].id, noteNumber: layout.padToVoice[pk].originalMidiNote! })),
    }));

    const greedy = buildFingerAssignmentFromLayout(layout, moments);
    const beam = await solve(layout, performance);

    const greedyCrossings = ['0,6', '7,6'].filter(pk => greedy[pk].hand === 'left').length;
    expect(greedyCrossings).toBe(1);
    expect(beam.constraintRelaxation?.handZoneStrikes).toBe(2);
  });
});

describe('the relaxation summary and verdict', () => {
  const fa = (overrides: Partial<FingerAssignment>): FingerAssignment => ({
    noteNumber: 40, voiceId: 'a', startTime: 0, assignedHand: 'left', finger: 'index',
    cost: 1, difficulty: 'Easy', row: 3, col: 1, ...overrides,
  });

  it('reports strict when nothing is flagged', () => {
    const summary = summarizeConstraintRelaxation([fa({}), fa({ startTime: 0.5 })]);
    expect(summary).toEqual({
      mode: 'strict', handZoneStrikes: 0, fingerOwnershipStrikes: 0, relaxedMomentCount: 0, sounds: [],
    });
  });

  it('counts strikes, moments and fingers per sound', () => {
    const summary = summarizeConstraintRelaxation([
      fa({ startTime: 0 }),
      fa({ startTime: 0.5, finger: 'middle', relaxedConstraints: ['finger-ownership'] }),
      // Within the moment window of the strike before it: the same moment.
      fa({ startTime: 0.51, voiceId: 'b', assignedHand: 'right', col: 1, relaxedConstraints: ['hand-zone'] }),
      fa({ startTime: 1.0 }),
    ]);
    expect(summary.mode).toBe('relaxed');
    expect(summary.handZoneStrikes).toBe(1);
    expect(summary.fingerOwnershipStrikes).toBe(1);
    expect(summary.relaxedMomentCount).toBe(1);
    expect(summary.sounds.find(s => s.soundId === 'a')?.fingersUsed).toEqual(['L2', 'L3']);
  });

  it('marks a plan that breaks a rule as degraded, never feasible', () => {
    const clean = deriveFeasibilityVerdict(0, 0, 0, 0, 10, { handZoneStrikes: 0, fingerOwnershipStrikes: 0 });
    const relaxed = deriveFeasibilityVerdict(0, 0, 0, 0, 10, { handZoneStrikes: 2, fingerOwnershipStrikes: 1 });
    expect(clean.level).toBe('feasible');
    expect(relaxed.level).toBe('degraded');
    expect(relaxed.reasons.filter(r => r.type === 'constraint_relaxed')).toHaveLength(2);
  });
});
