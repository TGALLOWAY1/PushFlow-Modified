/**
 * Sound colours (T17): a 16-hue palette for new Sounds.
 *
 * The first seven are the Okabe–Ito colours without black, which stay apart
 * for the common colour-vision deficiencies and are pairwise more than 20
 * CIEDE2000 apart. The other nine were picked, each in turn, as the candidate
 * farthest (CIEDE2000) from every colour before it, among colours with at
 * least 3:1 contrast on the dark panels. Colour is never the only cue: pads,
 * rows and lanes also carry the Sound's name.
 *
 * The same values are the --sound-1 … --sound-16 tokens in src/index.css.
 * Only new imports take them; a colour already on a Sound is never changed.
 */

export const SOUND_PALETTE: readonly string[] = [
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#009E73', // bluish green
  '#F0E442', // yellow
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#CC79A7', // reddish purple
  '#787522', // olive
  '#48F4ED', // aqua
  '#FBB6A2', // peach
  '#6FF885', // mint
  '#DC2343', // crimson
  '#C3C1F9', // lavender
  '#7E5ADA', // violet
  '#A7B780', // sage
  '#22949F', // teal
];

/**
 * Colours for `count` new Sounds: the palette's colours not yet used in the
 * project, in palette order, so a second import continues where the first
 * stopped. Once all sixteen are taken it cycles through them again.
 */
export function nextSoundColors(existingColors: readonly string[], count: number): string[] {
  const used = new Set(existingColors.map(c => c.toUpperCase()));
  const free = SOUND_PALETTE.filter(c => !used.has(c));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i < free.length ? free[i]! : SOUND_PALETTE[(i - free.length) % SOUND_PALETTE.length]!);
  }
  return out;
}
