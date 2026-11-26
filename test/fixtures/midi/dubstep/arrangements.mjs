/**
 * Dubstep test suite for the optimization engine: three arrangements, and the
 * MIDI files cut from them.
 *
 * This file is the one source of truth. The .mid files beside it are its output
 * (`node scripts/generate-dubstep-midi.mjs`), committed so the app, a DAW and the
 * tests can all load them, and test/engine/optimization/dubstepSuite.test.ts
 * fails if they drift from it.
 *
 * Arrangements (4/4, condensed song forms with 8-bar phrases):
 *   deep130     130 BPM, F minor. UK deep dubstep: swung 16th hats, skippy kicks,
 *               wobbles on 8th triplets against a straight grid, 6 melodic hits.
 *   halftime140 140 BPM, G minor. Classic half-time / brostep: kick on 1, snare on 3,
 *               mid-bass call and response in the gaps, a triplet-bounce second drop.
 *   tearout150  150 BPM, E minor. Tearout / riddim: double kicks, bass switching every
 *               16th, machine-gun kick build, 16th-triplet bass stutters. 5 drums.
 *
 * Every arrangement uses one Sound per MIDI track (PushFlow names a Sound after its
 * track) and one pitch per Sound. Pitches only trigger the sample, Drum Rack style
 * from C1 (36); PushFlow never places a Sound by its pitch.
 *
 * Step notation: one string per Sound, bars separated by `|`, spaces ignored. A bar's
 * length sets its grid: 16 = 16ths, 12 = 8th triplets, 24 = 16th triplets, 32 = 32nds.
 *   X accent · x hit · o soft · g ghost · - hold the previous note · . rest
 * A `seq` writes several Sounds on one line (letters from its map, upper case = accent),
 * which is how a producer thinks of a bass line split across one-shots.
 */

import tonejs from '@tonejs/midi';

const { Midi } = tonejs;

export const PPQ = 480;
export const BAR_TICKS = PPQ * 4;
/** Notes closer than this become one moment in PushFlow (src/types/performanceEvent.ts). */
export const MOMENT_EPSILON_S = 0.025;

const VELOCITY = { X: 124, x: 100, o: 80, g: 56 };

// ============================================================================
// Sound palette
// ============================================================================

export const FAMILIES = ['drums', 'bass', 'melodic', 'fx'];

const DRUMS = { Kick: 36, Snare: 37, 'Closed Hat': 38, 'Open Hat': 39, Crash: 40, Fill: 41 };
const BASS = { Sub: 42, Wobble: 43, Growl: 44, Reese: 45, Yoi: 46, Screech: 47 };
const FX = { Riser: 54, Impact: 55 };
// Melodic hits are named for the key: four chord stabs on 48–51 (i, VI, III, VII),
// a pluck or bell on 52, the vox chop on 53.

function palette(drumNames, melodic) {
  const sounds = {};
  for (const name of drumNames) sounds[name] = { note: DRUMS[name], family: 'drums' };
  for (const [name, note] of Object.entries(BASS)) sounds[name] = { note, family: 'bass' };
  for (const [name, note] of Object.entries(melodic)) sounds[name] = { note, family: 'melodic' };
  for (const [name, note] of Object.entries(FX)) sounds[name] = { note, family: 'fx' };
  return sounds;
}

// ============================================================================
// Pattern helpers
// ============================================================================

const R = '.... .... .... ....';
const R12 = '... ... ... ...';

const bars = (...b) => b.join(' | ');
const times = (n, bar) => Array(n).fill(bar).join(' | ');
const rest = (n) => times(n, R);
const rest12 = (n) => times(n, R12);
/** One note held for n bars (a riser, a sub swell). */
const hold = (n) => ['X--- ---- ---- ----', ...Array(n - 1).fill('---- ---- ---- ----')].join(' | ');
const restLike = (bar) => bar.replace(/[^\s|]/g, '.');

/**
 * A chord progression on one-shot stabs: each Sound in `names` plays `cell` (an
 * array of bars) in turn, and rests while the others play.
 */
function chords(names, cell) {
  const out = {};
  names.forEach((name, i) => {
    out[name] = names.map((_, j) => cell.map((bar) => (i === j ? bar : restLike(bar))).join(' | ')).join(' | ');
  });
  return out;
}

const bassMap = { w: 'Wobble', g: 'Growl', r: 'Reese', y: 'Yoi', s: 'Screech' };

// ============================================================================
// deep130 — 130 BPM, F minor
// ============================================================================

const A_STABS = ['Stab Fm', 'Stab Db', 'Stab Ab', 'Stab Eb'];
const A_PLUCK = bars('x..x ..x. .x.. x.x.', '..x. .x.. x..x ..x.');
const A_PLUCK_ARP = bars('x.xx .x.x x.xx .x.x', 'x.xx .x.x x.x. x.x.');
const A_HAT = 'x.og x.o. x.og x.o.';
const A_LONG_CHORD = ['X--- ---- ---- ----', '---- ---- .... ....'];
const A_HAT_AFTER_CRASH = '..og x.o. x.og x.o.';

const deepBuild = (name, voxLastBar) => ({
  name,
  bars: 8,
  swing: 0.58,
  ramp: { Snare: [40, 120] },
  lanes: {
    // Quarters, 8ths, 8th triplets, swung 16ths: the roll speeds up under the riser.
    // The kit drops out, as deep builds do: just roll, pluck, stabs and riser.
    Snare: bars(times(4, 'x... x... x... x...'), times(2, 'x.x. x.x. x.x. x.x.'), 'xxx xxx xxx xxx', 'xxxx xxxx xxxx ....'),
    Pluck: bars(A_PLUCK, A_PLUCK, rest(4)),
    Riser: hold(8),
    ...chords(A_STABS, ['X... .... .... ....', R]),
    'Vox Chop': bars(rest(7), voxLastBar),
  },
});

const deep130 = {
  id: 'deep130',
  title: 'Deep 130',
  bpm: 130,
  sounds: palette(['Kick', 'Snare', 'Closed Hat', 'Open Hat', 'Crash', 'Fill'], {
    'Stab Fm': 48, 'Stab Db': 49, 'Stab Ab': 50, 'Stab Eb': 51, Pluck: 52, 'Vox Chop': 53,
  }),
  sections: [
    {
      // Pluck riff and long chord stabs, a dub vox on the 4th bar of each phrase.
      name: 'Intro',
      bars: 8,
      swing: 0.58,
      lanes: {
        ...chords(A_STABS, A_LONG_CHORD),
        Pluck: A_PLUCK,
        'Vox Chop': bars(rest(3), '.... .... .... x..x'),
      },
    },
    {
      // Shuffled hats and a rim-style snare on 3; no kick until the drop.
      name: 'Intro (hats in)',
      bars: 8,
      swing: 0.58,
      lanes: {
        ...chords(A_STABS, A_LONG_CHORD),
        Pluck: A_PLUCK,
        'Vox Chop': bars(rest(3), '.... .... .... x..x'),
        'Closed Hat': A_HAT,
        Snare: '.... .... X... ....',
        Sub: hold(2),
      },
      overrides: { 8: { Fill: '.... .... ..x. x.x.' } },
    },
    deepBuild('Build', '.... .... .... ..X.'),
    {
      // Kick on 1, then skippy kicks on the "and" of 1 and the swung "e" of 4 in bar 2.
      // Wobbles sit on 8th triplets against the swung hats; stabs skank on beat 2-and.
      name: 'Drop 1',
      bars: 16,
      swing: 0.58,
      lanes: {
        Kick: bars('X... .... .... ....', '..x. .... ...x ....'),
        Snare: bars('.... .... X... ....', '.... .... X... ..g.'),
        'Closed Hat': bars(A_HAT, 'x.og x... x.og x.o.'),
        'Open Hat': bars(R, '.... ..x. .... ....'),
        Crash: bars('X... .... .... ....', rest(7)),
        Impact: bars('X... .... .... ....', rest(15)),
        Fill: bars(rest(3), '.... .... .... .x.x'),
        Sub: hold(2),
        ...chords(A_STABS, ['.... ..x. .... ....', R, '.... ..x. .... ....', R]),
        'Vox Chop': bars(rest(7), '.... .... .... x.x.'),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('... www ... w.w', '.w. .w. ... r.r', '... www ... g.g', 'y... ..y. .... s.s.'),
      }],
      overrides: {
        1: { 'Closed Hat': A_HAT_AFTER_CRASH },
        9: { 'Closed Hat': A_HAT_AFTER_CRASH },
        8: { Fill: '.... .... ..x. x...', Snare: '.... .... X... ....', 'Closed Hat': 'x.og x... x.og ....' },
        16: {
          Fill: '.... .... x.x. x.x.',
          Snare: '.... .... X... ....',
          'Closed Hat': 'x.og x.o. .... ....',
          seq: { map: bassMap, pattern: 'y... .... .... ....' },
        },
      },
    },
    {
      // The pluck turns into a swung 16th arpeggio; sub holds each chord.
      name: 'Breakdown',
      bars: 8,
      swing: 0.58,
      lanes: {
        ...chords(A_STABS, A_LONG_CHORD),
        Pluck: A_PLUCK_ARP,
        'Vox Chop': bars(R, '.... .... .... x..x', R, '.... .... x... x.x.'),
        Sub: hold(2),
      },
    },
    {
      name: 'Breakdown (drums in)',
      bars: 8,
      swing: 0.58,
      lanes: {
        ...chords(A_STABS, A_LONG_CHORD),
        Pluck: A_PLUCK_ARP,
        'Vox Chop': bars(R, '.... .... .... x..x', R, '.... .... x... x.x.'),
        Kick: 'X... .... .... ....',
        Snare: '.... .... X... ....',
        'Closed Hat': A_HAT,
      },
      overrides: { 8: { Fill: '.... .... ..x. x.x.' } },
    },
    deepBuild('Build 2', '.... .... x.x. x.x.'),
    {
      // 2-step kicks, full swung 16th hats, offbeat stab skanks, growl/reese call and
      // response, and an 8th-triplet wobble run to close each 4 bars.
      name: 'Drop 2',
      bars: 16,
      swing: 0.58,
      lanes: {
        Kick: bars('X... .... ...x ....', '..x. .... ..x. ....'),
        Snare: bars('.... .... X... .g..', '.... .... X... ....'),
        'Closed Hat': bars('x.ox x.ox x.ox x.ox', 'x.ox x.ox x.ox x...'),
        'Open Hat': bars(R, '.... .... .... ..x.'),
        Crash: bars('X... .... .... ....', rest(7)),
        Impact: bars('X... .... .... ....', rest(15)),
        Sub: hold(2),
        ...chords(A_STABS, Array(4).fill('..x. .... ..x. ....')),
        'Vox Chop': bars(rest(3), '.... .... .... x..x'),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('G... g.g. .... r.r.', '.y.. y... ..s. ...s', 'G... g.g. .... r.r.', 'www www ... ...'),
      }],
      overrides: {
        1: { 'Closed Hat': '..ox x.ox x.ox x.ox' },
        9: { 'Closed Hat': '..ox x.ox x.ox x.ox' },
        8: { Fill: '.... .... ..x. x.x.' },
        16: { Fill: '.... .... x.x. x.x.', seq: { map: bassMap, pattern: 'G... .... .... ....' } },
      },
    },
    {
      name: 'Outro',
      bars: 8,
      swing: 0.58,
      lanes: {
        ...chords(A_STABS, A_LONG_CHORD),
        Pluck: bars(A_PLUCK, A_PLUCK, A_PLUCK, rest(2)),
        'Closed Hat': bars(times(4, A_HAT), rest(4)),
        Snare: bars(times(4, '.... .... X... ....'), rest(4)),
        Sub: hold(2),
      },
      overrides: {
        // The last chord: back to the tonic, with the sub and a crash.
        8: { 'Stab Fm': 'X... .... .... ....', 'Stab Eb': R, Sub: 'X... .... .... ....', Crash: 'X... .... .... ....' },
      },
    },
  ],
};

// ============================================================================
// halftime140 — 140 BPM, G minor
// ============================================================================

const B_STABS = ['Stab Gm', 'Stab Eb', 'Stab Bb', 'Stab F'];
const B_STAB_TRESILLO = ['X..x ..x. .... ....', '.... .... x... ..x.'];
const B_STAB_RIFF = ['X..x ..x. ..x. ....', 'x... ..x. .... x.x.'];
const B_DROP_HAT = 'X.o. x.o. X.o. x...';
const B_TRIP_HAT = 'X.o x.o X.o x.o';

const halftimeBuild = (name, voxLastBar) => ({
  name,
  bars: 8,
  ramp: { Snare: [44, 127] },
  lanes: {
    // The classic accelerating roll: quarters, 8ths, 16ths, 16th triplets, then 32nds
    // for two beats and a silent half bar before the drop.
    Snare: bars(
      times(2, 'x... x... x... x...'),
      times(2, 'x.x. x.x. x.x. x.x.'),
      times(2, 'xxxx xxxx xxxx xxxx'),
      'xxxxxx xxxxxx xxxxxx xxxxxx',
      'xxxxxxxx xxxxxxxx ........ ........',
    ),
    Kick: bars(times(4, 'X... X... X... X...'), times(2, 'X.X. X.X. X.X. X.X.'), rest(2)),
    'Closed Hat': bars(times(4, '..x. ..x. ..x. ..x.'), rest(4)),
    Riser: hold(8),
    ...chords(B_STABS, ['X... .... .... ....', R]),
    'Vox Chop': bars(rest(7), voxLastBar),
  },
});

const halftime140 = {
  id: 'halftime140',
  title: 'Halftime 140',
  bpm: 140,
  sounds: palette(['Kick', 'Snare', 'Closed Hat', 'Open Hat', 'Crash', 'Fill'], {
    'Stab Gm': 48, 'Stab Eb': 49, 'Stab Bb': 50, 'Stab F': 51, 'Vox Chop': 53,
  }),
  sections: [
    {
      // Tresillo (3+3+2) chord stabs over a i–VI–III–VII progression.
      name: 'Intro',
      bars: 8,
      lanes: {
        ...chords(B_STABS, B_STAB_TRESILLO),
        'Vox Chop': bars(rest(3), '.... .... .... x.x.'),
      },
    },
    {
      name: 'Intro (drums in)',
      bars: 8,
      lanes: {
        ...chords(B_STABS, B_STAB_TRESILLO),
        'Vox Chop': bars(rest(3), '.... .... .... x.x.'),
        'Closed Hat': 'x.o. x.o. x.o. x.o.',
        Kick: 'X... .... .... ....',
        Snare: bars(rest(4), times(4, '.... .... X... ....')),
      },
      overrides: {
        8: { Snare: '.... .... X... ..xx', Fill: '.... .... ..x. x...', 'Closed Hat': 'x.o. x.o. x... ....' },
      },
    },
    halftimeBuild('Build', '.... .... .... X...'),
    {
      // Kick on 1 (and the "and" of 3), snare on 3. The mid-bass answers the drums in
      // the gaps: growls before the snare, screech/yoi after it, an 8th wobble turnaround.
      name: 'Drop 1',
      bars: 16,
      lanes: {
        Kick: bars('X... .... ..x. ....', 'X... ..x. ..x. ....', 'X... .... ..x. ....', 'X... .... .... ....'),
        Snare: bars('.... .... X... ....', '.... .... X... ....', '.... .... X... ....', '.... .... X... x.xx'),
        'Closed Hat': bars(B_DROP_HAT, B_DROP_HAT, B_DROP_HAT, 'X.o. x.o. x... ....'),
        'Open Hat': bars(times(3, '.... .... .... ..x.'), R),
        Crash: bars('X... .... .... ....', rest(7)),
        Impact: bars('X... .... .... ....', rest(15)),
        Sub: bars('X--- ---- .... ....', R),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('G..g ..w. ..s. .s..', 'R.r. ..w. .... yy.y', 'G..g ..w. ..s. .s..', 'W.w. w.w. .... ....'),
      }],
      overrides: {
        // The crash takes the hat's downbeat.
        1: { 'Closed Hat': '..o. x.o. X.o. x...' },
        9: { 'Closed Hat': '..o. x.o. X.o. x...' },
        8: { Snare: '.... .... X... ..xx', Fill: '.... .... ..x. xx..' },
        16: {
          Kick: 'X... .... .... ....',
          Snare: '.... .... X... ....',
          Fill: '.... .... ..x. x.x.',
          'Closed Hat': 'X.o. x.o. .... ....',
          seq: { map: bassMap, pattern: 'G... .... .... ....' },
        },
      },
    },
    {
      name: 'Breakdown',
      bars: 8,
      lanes: {
        ...chords(B_STABS, B_STAB_RIFF),
        'Vox Chop': bars(rest(3), '.... .... x.x. .x..'),
        Sub: hold(2),
        Reese: bars(hold(2), rest(2)),
        Crash: bars('X... .... .... ....', rest(7)),
      },
    },
    {
      name: 'Breakdown (drums in)',
      bars: 8,
      lanes: {
        ...chords(B_STABS, B_STAB_RIFF),
        'Vox Chop': bars(rest(3), '.... .... x.x. .x..'),
        Sub: hold(2),
        Kick: 'X... .... .... ....',
        Snare: '.... .... X... ....',
        'Closed Hat': '..x. ..x. ..x. ..x.',
      },
      overrides: { 8: { Snare: '.... .... X... .xxx', Fill: '.... .... ..xx ....' } },
    },
    // Build 2 ends on a vox stutter in the gap before the drop.
    halftimeBuild('Build 2', '.... .... x.x. xxx.'),
    {
      // Same kit, triplet feel: kicks, hats and bass on 8th triplets, 16th-triplet
      // growl/screech stutters, and a snare/tom triplet roll into each 8.
      name: 'Drop 2',
      bars: 16,
      lanes: {
        Kick: bars('X.. ... ... ..x', '..x ..x ... ...', 'X.. ... ... ..x', '..x ... ... ...'),
        Snare: bars(times(3, '... ... X.. ...'), '... ... X.. x.x'),
        'Closed Hat': bars(B_TRIP_HAT, 'X.o x.o X.o x..', B_TRIP_HAT, 'X.o x.o ... ...'),
        'Open Hat': bars(R12, '... ... ... ..x', R12, R12),
        Crash: bars('X.. ... ... ...', rest12(7)),
        Impact: bars('X.. ... ... ...', rest12(15)),
        Sub: bars('X-- --- --- ---', R12),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('G.g .g. ... w.w', 'R.. r.r ... yyy', 'G.g .g. ... s.s', 'gsgsgs gsg... ...... ......'),
      }],
      overrides: {
        1: { 'Closed Hat': '..o x.o X.o x.o' },
        9: { 'Closed Hat': '..o x.o X.o x.o' },
        8: { Snare: '...... ...... X..... .x.x.x', Fill: '...... ...... ...... x.x.x.' },
        16: {
          Snare: '...... ...... X..... .x.x.x',
          Fill: '...... ...... ...... x.x.x.',
          seq: { map: bassMap, pattern: 'G.. ... ... ...' },
        },
      },
    },
    {
      name: 'Outro',
      bars: 8,
      lanes: {
        ...chords(B_STABS, B_STAB_RIFF),
        Kick: bars(times(4, 'X... .... ..x. ....'), rest(4)),
        Snare: bars(times(4, '.... .... X... ....'), rest(4)),
        'Closed Hat': bars(times(4, 'x.o. x.o. x.o. x.o.'), rest(4)),
        Sub: hold(2),
        Crash: bars('X... .... .... ....', rest(7)),
      },
      overrides: {
        1: { 'Closed Hat': '..o. x.o. x.o. x.o.' },
        8: {
          'Stab Gm': 'X... .... .... ....',
          'Stab F': R,
          Sub: 'X... .... .... ....',
          Crash: 'X... .... .... ....',
          Impact: 'X... .... .... ....',
        },
      },
    },
  ],
};

// ============================================================================
// tearout150 — 150 BPM, E minor
// ============================================================================

const C_STABS = ['Stab Em', 'Stab C'];
const C_BELL = bars('x..x ..x. ..x. x...', 'x..x ..x. .x.. ..x.');
const C_HAT = 'x.x. x.x. x.x. x.x.';

const tearoutBuild = (name, voxLastBar) => ({
  name,
  bars: 8,
  ramp: { Snare: [48, 127], Kick: [80, 127] },
  lanes: {
    // Kick in quarters, then 8ths, then a bar of machine-gun 16ths; the snare moves
    // from the backbeat to offbeat 8ths, and a 16th-triplet burst ends the build.
    Kick: bars(times(4, 'X... X... X... X...'), times(2, 'X.X. X.X. X.X. X.X.'), 'XXXX XXXX XXXX XXXX', R),
    Snare: bars(times(4, '.... X... .... X...'), times(2, '..x. ..x. ..x. ..x.'), R, 'xxxxxx xxxxxx ...... ......'),
    'Closed Hat': bars(times(4, '..x. ..x. ..x. ..x.'), rest(4)),
    Riser: hold(8),
    Bell: bars(C_BELL, C_BELL, rest(4)),
    ...chords(C_STABS, ['X... .... .... ....', R]),
    'Vox Chop': bars(rest(7), voxLastBar),
  },
});

const tearout150 = {
  id: 'tearout150',
  title: 'Tearout 150',
  bpm: 150,
  sounds: palette(['Kick', 'Snare', 'Closed Hat', 'Crash', 'Fill'], {
    'Stab Em': 48, 'Stab C': 49, Bell: 52, 'Vox Chop': 53,
  }),
  sections: [
    {
      name: 'Intro',
      bars: 8,
      lanes: {
        Bell: C_BELL,
        ...chords(C_STABS, ['X... .... .... ....', '.... .... X... ....']),
        'Vox Chop': bars(rest(3), '.... .... .... X.x.'),
        'Closed Hat': bars(rest(4), times(4, C_HAT)),
      },
      overrides: { 8: { Fill: '.... .... x.x. x.xx', 'Closed Hat': 'x.x. x.x. .... ....' } },
    },
    tearoutBuild('Build', '.... .... .... X...'),
    {
      // Double kicks, crash every 4 bars, and the bass changing one-shot nearly every
      // 16th: growls, a screech triplet, reese stabs, growl/screech alternation.
      name: 'Drop 1',
      bars: 16,
      lanes: {
        Kick: bars('X.x. .... ..x. ....', 'X... ..x. .x.. ..x.', 'X.x. .... ..x. ....', 'X... .... .... ....'),
        Snare: bars('.... .... X... ....', '.... .... X... .g..', '.... .... X... ....', '.... .... X... x.x.'),
        'Closed Hat': bars('..x. x.x. x.x. x.x.', C_HAT, C_HAT, 'x.x. x.x. .... ....'),
        Crash: bars('X... .... .... ....', rest(3)),
        Impact: bars('X... .... .... ....', rest(15)),
        Sub: 'X... .... .... ....',
        Fill: bars(rest(3), '.... .... ..x. .x.x'),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('G.g. sss. .... r.rr', 'Y.y. w.w. .... gsgs', 'G.g. sss. .... r.rr', 'w.ww w.ww .... ....'),
      }],
      overrides: {
        8: { Snare: '.... .... X.x. x.x.', Fill: '.... .... .x.x .x.x' },
        16: {
          Kick: 'X... .... .... ....',
          Snare: '.... .... X... ....',
          Fill: '.... .... ..x. x.x.',
          'Closed Hat': '..x. x.x. .... ....',
          seq: { map: bassMap, pattern: 'G... .... .... ....' },
          'Vox Chop': '.... .... .... X...',
        },
      },
    },
    {
      name: 'Breakdown',
      bars: 8,
      lanes: {
        Bell: C_BELL,
        ...chords(C_STABS, ['X--- ---- ---- ----', '---- ---- .... ....']),
        'Vox Chop': bars(R, '.... .... .... X.x.', R, '.... .... x.x. X...'),
        Sub: hold(2),
        Kick: bars(rest(4), times(4, 'X... .... .... ....')),
        Snare: bars(rest(4), times(4, '.... .... X... ....')),
        'Closed Hat': bars(rest(4), times(4, '..x. ..x. ..x. ..x.')),
      },
      overrides: { 8: { Fill: '.... .... ..x. x.x.', Snare: '.... .... X... ...x' } },
    },
    tearoutBuild('Build 2', '.... .... x.x. xxx.'),
    {
      // Riddim: everything on 8th triplets, bass in triplet bursts on one one-shot,
      // then two beats of 16th-triplet growl/screech alternation every 4th bar.
      name: 'Drop 2',
      bars: 16,
      lanes: {
        Kick: bars('X.. ..x ... ...', 'X.. ... ... .x.', 'X.. ..x ... ...', 'X.. ... ... ...'),
        Snare: '... ... X.. ...',
        'Closed Hat': bars('..x x.x ..x x.x', 'x.x x.x ..x x.x', 'x.x x.x ..x x.x', 'x.x x.x ..x ...'),
        Crash: bars('X.. ... ... ...', rest12(3)),
        Impact: bars('X.. ... ... ...', rest12(15)),
        Sub: 'X.. ... ... ...',
        Fill: bars(rest12(3), '... ... ... x.x'),
      },
      seqs: [{
        map: bassMap,
        pattern: bars('GgG ... ... wWw', 'RrR .y. ... sSs', 'GgG ... ... wWw', 'gsgsgs gsgsgs ...... ......'),
      }],
      overrides: {
        8: { Snare: '... ... X.. x.x', Fill: '... ... .x. .x.' },
        16: {
          Snare: '... ... X.. x.x',
          Fill: '... ... .x. .x.',
          seq: { map: bassMap, pattern: 'G.. ... ... ...' },
        },
      },
    },
    {
      name: 'Outro',
      bars: 8,
      lanes: {
        Kick: bars(times(4, 'X... .... ..x. ....'), rest(4)),
        Snare: bars(times(4, '.... .... X... ....'), rest(4)),
        'Closed Hat': bars(times(4, C_HAT), rest(4)),
        Crash: bars('X... .... .... ....', rest(7)),
        Bell: bars(C_BELL, C_BELL, C_BELL, rest(2)),
        ...chords(C_STABS, ['X... .... .... ....', '.... .... X... ....']),
      },
      overrides: {
        1: { 'Closed Hat': '..x. x.x. x.x. x.x.' },
        8: {
          'Stab Em': 'X... .... .... ....',
          'Stab C': R,
          Crash: 'X... .... .... ....',
          Impact: 'X... .... .... ....',
          Sub: 'X... .... .... ....',
        },
      },
    },
  ],
};

export const ARRANGEMENTS = { deep130, halftime140, tearout150 };

// ============================================================================
// The files
// ============================================================================

/**
 * Each file is a cut of one arrangement: a bar range (`from`/`to` are [section, bar],
 * 1-based and inclusive), optionally only some families, optionally humanized.
 * Tiers run from simple to complex, so a failure in tier 1 is read before tier 3.
 */
export const FILES = [
  // Tier 1: one family, 8 bars.
  { path: '1-elements/drums-130-shuffle.mid', arrangement: 'deep130', from: ['Drop 1', 1], to: ['Drop 1', 8], families: ['drums'] },
  { path: '1-elements/drums-140-halftime.mid', arrangement: 'halftime140', from: ['Drop 1', 1], to: ['Drop 1', 8], families: ['drums'] },
  { path: '1-elements/drums-150-tearout.mid', arrangement: 'tearout150', from: ['Drop 1', 1], to: ['Drop 1', 8], families: ['drums'] },
  { path: '1-elements/bass-140-call-response.mid', arrangement: 'halftime140', from: ['Drop 1', 1], to: ['Drop 1', 8], families: ['bass'] },
  { path: '1-elements/bass-150-riddim-triplets.mid', arrangement: 'tearout150', from: ['Drop 2', 1], to: ['Drop 2', 8], families: ['bass'] },
  { path: '1-elements/melodic-130-breakdown.mid', arrangement: 'deep130', from: ['Breakdown', 1], to: ['Breakdown', 8], families: ['melodic'] },
  { path: '1-elements/melodic-150-intro.mid', arrangement: 'tearout150', from: ['Intro', 1], to: ['Intro', 8], families: ['melodic'] },
  // Tier 2: whole sections, every family.
  { path: '2-sections/build-140.mid', arrangement: 'halftime140', from: ['Build', 1], to: ['Build', 8] },
  { path: '2-sections/build-into-drop-150.mid', arrangement: 'tearout150', from: ['Build', 5], to: ['Drop 1', 4] },
  { path: '2-sections/drop-130-deep.mid', arrangement: 'deep130', from: ['Drop 1', 1], to: ['Drop 1', 8] },
  { path: '2-sections/drop-140-halftime.mid', arrangement: 'halftime140', from: ['Drop 1', 1], to: ['Drop 1', 8] },
  { path: '2-sections/drop-140-triplets.mid', arrangement: 'halftime140', from: ['Drop 2', 1], to: ['Drop 2', 8] },
  { path: '2-sections/drop-150-tearout.mid', arrangement: 'tearout150', from: ['Drop 1', 1], to: ['Drop 1', 8] },
  { path: '2-sections/drop-150-riddim.mid', arrangement: 'tearout150', from: ['Drop 2', 1], to: ['Drop 2', 8] },
  // Timing as played, not quantized: chords spread over a few ms (still one moment).
  { path: '2-sections/drop-140-humanized.mid', arrangement: 'halftime140', from: ['Drop 1', 1], to: ['Drop 1', 8], humanize: { sdMs: 4, maxMs: 10, velocity: 8, seed: 140 } },
  // Tier 3: whole songs.
  { path: '3-songs/song-130-deep.mid', arrangement: 'deep130' },
  { path: '3-songs/song-140-halftime.mid', arrangement: 'halftime140' },
  { path: '3-songs/song-150-tearout.mid', arrangement: 'tearout150' },
];

// ============================================================================
// Rendering
// ============================================================================

function splitBars(pattern) {
  return pattern.split('|').map((bar) => bar.replace(/\s+/g, ''));
}

/** Expands a seq into one pattern per Sound in its map, with the seq's bar structure. */
function seqToLanes(seq, where) {
  const names = [...new Set(Object.values(seq.map))];
  const rows = Object.fromEntries(names.map((n) => [n, []]));
  let last = null;
  for (const bar of splitBars(seq.pattern)) {
    const barRows = Object.fromEntries(names.map((n) => [n, '']));
    for (const ch of bar) {
      let target = null;
      let mark = '.';
      if (ch === '.') {
        last = null;
      } else if (ch === '-') {
        if (!last) throw new Error(`${where}: '-' with no note to hold`);
        target = last;
        mark = '-';
      } else {
        target = seq.map[ch.toLowerCase()];
        if (!target) throw new Error(`${where}: '${ch}' is not in the seq's map`);
        mark = ch === ch.toUpperCase() ? 'X' : 'x';
        last = target;
      }
      for (const n of names) barRows[n] += n === target ? mark : '.';
    }
    for (const n of names) rows[n].push(barRows[n]);
  }
  return Object.fromEntries(names.map((n) => [n, rows[n].join('|')]));
}

/** Each lane's bars for the whole section, loops tiled and overrides applied. */
function sectionLaneBars(section, where) {
  const defs = {};
  const add = (obj) => {
    for (const [name, pattern] of Object.entries(obj)) {
      if (name in defs) throw new Error(`${where}: ${name} is written twice`);
      defs[name] = pattern;
    }
  };
  add(section.lanes ?? {});
  for (const seq of section.seqs ?? []) add(seqToLanes(seq, where));

  const out = {};
  for (const [name, pattern] of Object.entries(defs)) {
    const loop = splitBars(pattern);
    if (section.bars % loop.length !== 0) {
      throw new Error(`${where}/${name}: a ${loop.length}-bar pattern does not tile ${section.bars} bars`);
    }
    out[name] = Array.from({ length: section.bars }, (_, b) => loop[b % loop.length]);
  }

  for (const [barNumber, override] of Object.entries(section.overrides ?? {})) {
    const b = Number(barNumber) - 1;
    if (!(b >= 0 && b < section.bars)) throw new Error(`${where}: override for bar ${barNumber} is outside the section`);
    const replace = { ...override };
    delete replace.seq;
    if (override.seq) {
      for (const [name, pattern] of Object.entries(seqToLanes(override.seq, `${where} bar ${barNumber}`))) {
        if (name in replace) throw new Error(`${where} bar ${barNumber}: ${name} is written twice`);
        replace[name] = pattern;
      }
    }
    for (const [name, pattern] of Object.entries(replace)) {
      const [bar, ...extra] = splitBars(pattern);
      if (extra.length) throw new Error(`${where} bar ${barNumber}: an override is one bar`);
      if (!out[name]) out[name] = Array.from({ length: section.bars }, () => '.'.repeat(16));
      out[name][b] = bar;
    }
  }
  return out;
}

function swingOffset(swing, steps, step) {
  if (!swing || swing === 0.5 || steps !== 16 || step % 2 === 0) return 0;
  return Math.round((swing - 0.5) * (BAR_TICKS / 8));
}

/** Renders one section's notes from `startTick`. */
function renderSection(arrangement, section, startTick) {
  const where = `${arrangement.id}/${section.name}`;
  const notes = [];
  const sectionTicks = section.bars * BAR_TICKS;
  for (const [name, barList] of Object.entries(sectionLaneBars(section, where))) {
    const sound = arrangement.sounds[name];
    if (!sound) throw new Error(`${where}: ${name} is not in the arrangement's palette`);
    const ramp = section.ramp?.[name];
    let open = null;
    const close = (endTick) => {
      if (!open) return;
      notes.push({ ...open, durationTicks: endTick - open.ticks });
      open = null;
    };
    barList.forEach((bar, b) => {
      if (bar.length === 0 || BAR_TICKS % bar.length !== 0) {
        throw new Error(`${where}/${name} bar ${b + 1}: ${bar.length} steps do not divide a bar`);
      }
      const stepTicks = BAR_TICKS / bar.length;
      [...bar].forEach((ch, step) => {
        const gridTick = startTick + b * BAR_TICKS + step * stepTicks;
        if (ch === '-') {
          if (!open) throw new Error(`${where}/${name} bar ${b + 1}: '-' with no note to hold`);
          return;
        }
        close(gridTick);
        if (ch === '.') return;
        const base = VELOCITY[ch];
        if (base === undefined) throw new Error(`${where}/${name} bar ${b + 1}: unknown step '${ch}'`);
        let velocity = base;
        if (ramp) {
          const t = (gridTick - startTick) / sectionTicks;
          velocity = Math.round((ramp[0] + (ramp[1] - ramp[0]) * t) * (base / VELOCITY.x));
        }
        open = {
          name,
          midi: sound.note,
          family: sound.family,
          ticks: gridTick + swingOffset(section.swing, bar.length, step),
          velocity: Math.max(1, Math.min(127, velocity)),
        };
      });
    });
    close(startTick + sectionTicks);
  }
  return notes;
}

/** Every note of an arrangement, and where each section starts. */
export function renderArrangement(arrangement) {
  const notes = [];
  const sectionStarts = {};
  let tick = 0;
  for (const section of arrangement.sections) {
    if (section.name in sectionStarts) throw new Error(`${arrangement.id}: two sections called ${section.name}`);
    sectionStarts[section.name] = tick;
    notes.push(...renderSection(arrangement, section, tick));
    tick += section.bars * BAR_TICKS;
  }
  return { notes, sectionStarts, totalTicks: tick };
}

/** mulberry32: a small seeded RNG, so humanized files are reproducible. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function humanize(notes, bpm, { sdMs, maxMs, velocity, seed }) {
  const rand = seededRandom(seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const ticksPerMs = (PPQ * bpm) / 60000;
  return notes.map((n) => {
    const ms = Math.max(-maxMs, Math.min(maxMs, gauss() * sdMs));
    const ticks = Math.max(0, n.ticks + Math.round(ms * ticksPerMs));
    const vel = Math.max(1, Math.min(127, n.velocity + Math.round((rand() * 2 - 1) * velocity)));
    return { ...n, ticks, velocity: vel };
  });
}

/** The notes, tempo and markers of one file in FILES, before encoding. */
export function cutFile(spec) {
  const arrangement = ARRANGEMENTS[spec.arrangement];
  if (!arrangement) throw new Error(`${spec.path}: unknown arrangement ${spec.arrangement}`);
  const { notes, sectionStarts, totalTicks } = renderArrangement(arrangement);
  const barTick = ([section, bar]) => {
    if (!(section in sectionStarts)) throw new Error(`${spec.path}: no section ${section}`);
    return sectionStarts[section] + (bar - 1) * BAR_TICKS;
  };
  const start = spec.from ? barTick(spec.from) : 0;
  const end = spec.to ? barTick(spec.to) + BAR_TICKS : totalTicks;
  const families = spec.families ?? FAMILIES;

  let cut = notes
    .filter((n) => n.ticks >= start && n.ticks < end && families.includes(n.family))
    .map((n) => ({ ...n, ticks: n.ticks - start, durationTicks: Math.min(n.durationTicks, end - n.ticks) }));
  if (spec.humanize) cut = humanize(cut, arrangement.bpm, spec.humanize);
  cut.sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);

  const markers = arrangement.sections
    .map((s) => ({ text: s.name, ticks: sectionStarts[s.name] - start }))
    .filter((m) => m.ticks >= 0 && m.ticks < end - start);
  if (!markers.some((m) => m.ticks === 0)) {
    const current = [...arrangement.sections].reverse().find((s) => sectionStarts[s.name] <= start);
    markers.unshift({ text: current.name, ticks: 0 });
  }

  return { arrangement, notes: cut, markers, bars: (end - start) / BAR_TICKS };
}

/**
 * Pattern checks that keep moments unambiguous in a quantized file: two notes of one
 * Sound must not be closer than MOMENT_EPSILON (they would merge into one moment),
 * and notes of different Sounds are either together or clearly apart.
 */
export function timingProblems({ arrangement, notes }, { allowSpread = false } = {}) {
  const seconds = (ticks) => (ticks / PPQ) * (60 / arrangement.bpm);
  const problems = [];
  const lastBySound = new Map();
  for (const n of notes) {
    const prev = lastBySound.get(n.name);
    if (prev !== undefined && seconds(n.ticks - prev) < MOMENT_EPSILON_S) {
      problems.push(`${n.name} repeats ${(seconds(n.ticks - prev) * 1000).toFixed(1)} ms apart at tick ${n.ticks}`);
    }
    lastBySound.set(n.name, n.ticks);
  }
  if (!allowSpread) {
    for (let i = 1; i < notes.length; i++) {
      const gap = seconds(notes[i].ticks - notes[i - 1].ticks);
      if (gap > 0 && gap < MOMENT_EPSILON_S) {
        problems.push(`${notes[i - 1].name} and ${notes[i].name} are ${(gap * 1000).toFixed(1)} ms apart at tick ${notes[i].ticks}`);
      }
    }
  }
  return problems;
}

/** Encodes one file in FILES: one track per Sound, palette order, tempo, 4/4, section markers. */
export function buildMidiFile(spec) {
  const cut = cutFile(spec);
  const problems = timingProblems(cut, { allowSpread: Boolean(spec.humanize) });
  if (problems.length) throw new Error(`${spec.path}:\n  ${problems.join('\n  ')}`);

  const { arrangement, notes, markers } = cut;
  const midi = new Midi();
  midi.header.name = arrangement.title;
  midi.header.setTempo(arrangement.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  for (const m of markers) midi.header.meta.push({ type: 'marker', text: m.text, ticks: m.ticks });
  midi.header.update();

  for (const [name, sound] of Object.entries(arrangement.sounds)) {
    const own = notes.filter((n) => n.name === name);
    if (own.length === 0) continue;
    const track = midi.addTrack();
    track.name = name;
    for (const n of own) {
      track.addNote({ midi: sound.note, ticks: n.ticks, durationTicks: n.durationTicks, velocity: n.velocity / 127 });
    }
  }
  return new Uint8Array(midi.toArray());
}
