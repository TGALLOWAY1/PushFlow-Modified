/**
 * Pad labels (T17).
 *
 * When every Sound's name starts with the same words ("TEST MIDI 1 A",
 * "TEST MIDI 1 B" …), pads drop those words and show what tells the Sounds
 * apart ("A", "B"). A label that still doesn't fit is cut in the middle, so its
 * start and its end both stay visible ("Clos…Hat"). The full name stays in the
 * pad's tooltip and accessible name, and everywhere else in the app.
 */

/**
 * The whole words every name starts with, with the space after them; '' when
 * there are fewer than two names or they share no whole word.
 */
export function sharedNamePrefix(names: readonly string[]): string {
  if (names.length < 2) return '';
  let prefix = names[0]!;
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) return '';
  }
  // Back off to a word boundary: the prefix must end with whitespace.
  const cut = prefix.search(/\s\S*$/);
  if (!/\s$/.test(prefix)) prefix = cut >= 0 ? prefix.slice(0, cut + 1) : '';
  // Never leave a name empty.
  return names.some(n => n.length <= prefix.length) ? '' : prefix;
}

/** `text` with its middle replaced by "…" when it is longer than `max` characters. */
export function middleTruncate(text: string, max: number): string {
  if (max < 2 || text.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${text.slice(0, head)}…${tail > 0 ? text.slice(-tail) : ''}`;
}

/** Lines a pad's name may use: two from 40 px up, so a finger label still fits below. */
export function padLabelLines(padSize: number): 1 | 2 {
  return padSize >= 40 ? 2 : 1;
}

/** Roughly how many 11 px semibold characters fit on one line of a pad. */
export function padLabelCharsPerLine(padSize: number): number {
  return Math.max(2, Math.floor((padSize - 6) / 6.5));
}

/** The label a pad shows for a Sound, on at most `lines` lines. */
export function padLabel(name: string, prefix: string, padSize: number, lines: number = padLabelLines(padSize)): string {
  const trimmed = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name;
  const label = trimmed.trim() || name;
  return middleTruncate(label, padLabelCharsPerLine(padSize) * lines);
}
