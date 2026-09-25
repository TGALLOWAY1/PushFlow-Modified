/**
 * General MIDI percussion key map (GM Level 1, notes 35–81), in short
 * musician names. Used only by the opt-in "Name from GM drum map" action:
 * a Sound is never named from its pitch unless the user asks (canon §10, Q3).
 */

export const GM_DRUM_NAMES: Readonly<Record<number, string>> = {
  35: 'Kick 2',
  36: 'Kick',
  37: 'Side Stick',
  38: 'Snare',
  39: 'Clap',
  40: 'Snare 2',
  41: 'Low Floor Tom',
  42: 'Closed Hat',
  43: 'High Floor Tom',
  44: 'Pedal Hat',
  45: 'Low Tom',
  46: 'Open Hat',
  47: 'Low-Mid Tom',
  48: 'High-Mid Tom',
  49: 'Crash',
  50: 'High Tom',
  51: 'Ride',
  52: 'China',
  53: 'Ride Bell',
  54: 'Tambourine',
  55: 'Splash',
  56: 'Cowbell',
  57: 'Crash 2',
  58: 'Vibraslap',
  59: 'Ride 2',
  60: 'High Bongo',
  61: 'Low Bongo',
  62: 'Mute High Conga',
  63: 'Open High Conga',
  64: 'Low Conga',
  65: 'High Timbale',
  66: 'Low Timbale',
  67: 'High Agogo',
  68: 'Low Agogo',
  69: 'Cabasa',
  70: 'Maracas',
  71: 'Short Whistle',
  72: 'Long Whistle',
  73: 'Short Guiro',
  74: 'Long Guiro',
  75: 'Claves',
  76: 'High Wood Block',
  77: 'Low Wood Block',
  78: 'Mute Cuica',
  79: 'Open Cuica',
  80: 'Mute Triangle',
  81: 'Open Triangle',
};

/** The GM drum name for a pitch, or null outside the GM percussion range. */
export function gmDrumName(pitch: number | null | undefined): string | null {
  if (pitch === null || pitch === undefined) return null;
  return GM_DRUM_NAMES[pitch] ?? null;
}

/**
 * New names for "Name from GM drum map": every Sound whose pitch is a GM drum
 * gets that drum's name; a name that would repeat gets " (2)", " (3)"…
 * Sounds outside the map keep their names, and so does a Sound already
 * called what the map would call it. Returns only the Sounds that change.
 */
export function gmDrumRenames(
  sounds: ReadonlyArray<{ id: string; name: string; originalMidiNote: number | null }>,
): Record<string, string> {
  const renames: Record<string, string> = {};
  const wanted = new Map<string, string>();
  for (const s of sounds) {
    const gm = gmDrumName(s.originalMidiNote);
    if (gm) wanted.set(s.id, gm);
  }
  // Names that stay: every Sound the map leaves alone, and every Sound that
  // already has its drum's name (so running the action twice changes nothing).
  const taken = new Set(sounds.filter(s => wanted.get(s.id) === undefined || wanted.get(s.id) === s.name).map(s => s.name));
  for (const s of sounds) {
    const base = wanted.get(s.id);
    if (!base || base === s.name) continue;
    let name = base;
    for (let n = 2; taken.has(name) && name !== s.name; n++) name = `${base} (${n})`;
    taken.add(name);
    if (name !== s.name) renames[s.id] = name;
  }
  return renames;
}
