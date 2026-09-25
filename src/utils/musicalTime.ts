/**
 * Musical time for display (T43).
 *
 * Positions read bar.beat.sixteenth, all 1-based, at the project tempo in
 * 4/4: "3.2.1" is bar 3, beat 2, the first sixteenth. A loop reads "Bars 3–4".
 * Seconds and milliseconds belong in tooltips.
 */

/** Length of a sixteenth note in seconds. */
export function sixteenthSeconds(tempo: number): number {
  return 60 / (tempo || 120) / 4;
}

/** Length of a bar (4 beats) in seconds. */
export function barSeconds(tempo: number): number {
  return (60 / (tempo || 120)) * 4;
}

/**
 * "3.2.1" for a time in seconds. A note between sixteenths reads as the
 * sixteenth it falls in; times before the start read as the start.
 */
export function formatBarBeat(time: number, tempo: number): string {
  // The epsilon keeps a time that is a whole sixteenth in floating point
  // (0.4999999…) on its own sixteenth.
  const n = Math.floor(Math.max(0, time) / sixteenthSeconds(tempo) + 1e-6);
  const bar = Math.floor(n / 16) + 1;
  const beat = Math.floor((n % 16) / 4) + 1;
  const sixteenth = (n % 4) + 1;
  return `${bar}.${beat}.${sixteenth}`;
}

/** "Bars 3–4" (or "Bar 3") for a region from `start` to `end` seconds; the end is exclusive. */
export function formatBarRange(start: number, end: number, tempo: number): string {
  const bar = barSeconds(tempo);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const first = Math.floor(Math.max(0, lo) / bar + 1e-6) + 1;
  const last = Math.max(first, Math.ceil(hi / bar - 1e-6));
  return first === last ? `Bar ${first}` : `Bars ${first}–${last}`;
}

/** "1.250 s", for tooltips. */
export function formatSeconds(time: number): string {
  return `${time.toFixed(3)} s`;
}

/** "250 ms", for short spans such as the gap to the next event. */
export function formatMilliseconds(seconds: number): string {
  return `${Math.round(seconds * 1000)} ms`;
}

/** "0.75x · 90 BPM": a playback rate with the tempo it plays at. */
export function formatRate(rate: number, tempo: number): string {
  return `${rate}x · ${Math.round(rate * (tempo || 120))} BPM`;
}
