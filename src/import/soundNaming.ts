/**
 * Default Sound names for an imported MIDI file (T17, decision Q3).
 *
 * A Sound is named after its MIDI track or the file, plus a short sequence
 * letter ("Groove A", "Groove B"), never after its pitch: pitch is provenance
 * only (canon §10), and naming from it is the opt-in "Name from GM drum map".
 *
 * - A file with one pitch: the file's name ("Kick Loop").
 * - A file with several tracks: a track with one pitch is named after the
 *   track ("Kick"); a track with several pitches gives "<track> A", "<track> B"
 *   (an unnamed track uses the file's name).
 * - A file with one track: "<file> A", "<file> B" …
 * Letters continue past names the project already has, so a second import of
 * the same file gives "Groove H" … rather than a second "Groove A".
 */

/** One MIDI track as the importer saw it: its name and how many notes it has at each pitch. */
export interface ImportedTrack {
  name: string;
  noteCounts: ReadonlyMap<number, number>;
}

/** "A" … "Z", then "AA", "AB" …, like spreadsheet columns. */
export function sequenceLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * A readable name from a file name: extension dropped, underscores and dashes
 * as spaces, each word capitalised ("lead_chops.mid" → "Lead Chops").
 */
export function fileNameToDisplayName(fileName: string): string {
  return fileName
    .replace(/\.(mid|midi)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Names for the Sounds of one imported file, one per pitch, in the order of
 * `pitches`. `existingNames` are the project's current Sound names.
 */
export function defaultSoundNames(
  fileName: string,
  tracks: readonly ImportedTrack[],
  pitches: readonly number[],
  existingNames: readonly string[] = [],
): string[] {
  const fileBase = fileNameToDisplayName(fileName) || 'Sound';
  const taken = new Set(existingNames);

  const uniquePlain = (name: string): string => {
    let out = name;
    for (let n = 2; taken.has(out); n++) out = `${name} ${n}`;
    taken.add(out);
    return out;
  };

  if (pitches.length === 1) return [uniquePlain(fileBase)];

  const withNotes = tracks.filter(t => [...t.noteCounts.values()].some(c => c > 0));
  const multiTrack = withNotes.length > 1;

  // Each pitch's home: the track that plays it most (the first on a tie).
  const homeOf = (pitch: number): ImportedTrack | null => {
    let best: ImportedTrack | null = null;
    let bestCount = 0;
    for (const t of withNotes) {
      const c = t.noteCounts.get(pitch) ?? 0;
      if (c > bestCount) { best = t; bestCount = c; }
    }
    return best;
  };

  const bases = pitches.map(pitch => {
    if (!multiTrack) return { base: fileBase, single: false };
    const home = homeOf(pitch);
    const trackName = home?.name.trim() ?? '';
    if (!trackName) return { base: fileBase, single: false };
    const pitchesAtHome = pitches.filter(p => homeOf(p) === home).length;
    return { base: trackName, single: pitchesAtHome === 1 };
  });

  // A base that ends up with one Sound needs no letter.
  const countByBase = new Map<string, number>();
  for (const { base } of bases) countByBase.set(base, (countByBase.get(base) ?? 0) + 1);

  const nextLetter = new Map<string, number>();
  return bases.map(({ base, single }) => {
    if (single || countByBase.get(base) === 1) return uniquePlain(base);
    let i = nextLetter.get(base) ?? 0;
    let name = `${base} ${sequenceLetter(i)}`;
    while (taken.has(name)) name = `${base} ${sequenceLetter(++i)}`;
    nextLetter.set(base, i + 1);
    taken.add(name);
    return name;
  });
}
