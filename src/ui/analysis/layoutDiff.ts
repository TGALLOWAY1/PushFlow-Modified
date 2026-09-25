/**
 * What changed between two layouts, in the units people count (T20, P2-8):
 * Sounds moved, by unique Sound id, and pads changed, by unique pad key. So
 * "6 Sounds moved (9 pads changed)" can never claim more Sounds than exist.
 */

import { type Layout } from '../../types/layout';

export interface LayoutDiff {
  /** Pads whose Sound differs (a Sound placed, removed or swapped there). */
  changedPads: Set<string>;
  /** Sounds on a different pad in B than in A, or on the grid in only one of them. */
  movedSounds: Set<string>;
  /** Per moved Sound: its pad in A and in B (null when it isn't on the grid there). */
  moves: Array<{ soundId: string; from: string | null; to: string | null }>;
}

function padOfEachSound(layout: Pick<Layout, 'padToVoice'>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [pad, voice] of Object.entries(layout.padToVoice)) {
    if (voice && !map.has(voice.id)) map.set(voice.id, pad);
  }
  return map;
}

export function layoutDiff(a: Pick<Layout, 'padToVoice'>, b: Pick<Layout, 'padToVoice'>): LayoutDiff {
  const changedPads = new Set<string>();
  for (const pad of new Set([...Object.keys(a.padToVoice), ...Object.keys(b.padToVoice)])) {
    if (a.padToVoice[pad]?.id !== b.padToVoice[pad]?.id) changedPads.add(pad);
  }
  const inA = padOfEachSound(a);
  const inB = padOfEachSound(b);
  const moves: LayoutDiff['moves'] = [];
  for (const soundId of new Set([...inA.keys(), ...inB.keys()])) {
    const from = inA.get(soundId) ?? null;
    const to = inB.get(soundId) ?? null;
    if (from !== to) moves.push({ soundId, from, to });
  }
  return { changedPads, movedSounds: new Set(moves.map(m => m.soundId)), moves };
}

/** "6 Sounds moved (9 pads changed)", or "No Sounds moved". */
export function describeLayoutDiff(diff: LayoutDiff): string {
  const sounds = diff.movedSounds.size;
  const pads = diff.changedPads.size;
  if (sounds === 0 && pads === 0) return 'No Sounds moved';
  return `${sounds} ${sounds === 1 ? 'Sound' : 'Sounds'} moved (${pads} ${pads === 1 ? 'pad' : 'pads'} changed)`;
}
