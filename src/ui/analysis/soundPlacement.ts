/**
 * Where each Sound is on the layout on screen, and the Sounds panel's filters
 * (S5.1, T45): All, To place, On grid, Locked, each with its count, so "To
 * place" and "On grid" always add up to All and match the grid.
 *
 * Placement is a row's pill ("To place") or pad locator ("R4 C4"), and a
 * filter; never a section label (CLAUDE.md Sound Grouping rules).
 */

import { type Layout } from '../../types/layout';

export interface SoundPlacement {
  /** The pads that hold it on the layout on screen (normally one). */
  padKeys: string[];
  /** Locked to one of those pads. */
  locked: boolean;
}

/** Each Sound's pads and lock on `layout`, by Sound id; a Sound on no pad has no pads. */
export function soundPlacements(
  sounds: readonly { id: string }[],
  layout: Pick<Layout, 'padToVoice' | 'placementLocks'> | null | undefined,
): Map<string, SoundPlacement> {
  const pads = new Map<string, string[]>();
  for (const [padKey, voice] of Object.entries(layout?.padToVoice ?? {})) {
    const list = pads.get(voice.id);
    if (list) list.push(padKey);
    else pads.set(voice.id, [padKey]);
  }
  const result = new Map<string, SoundPlacement>();
  for (const sound of sounds) {
    const padKeys = (pads.get(sound.id) ?? []).sort();
    const lockedTo = layout?.placementLocks?.[sound.id];
    result.set(sound.id, { padKeys, locked: !!lockedTo && padKeys.includes(lockedTo) });
  }
  return result;
}

export type SoundFilter = 'all' | 'to-place' | 'on-grid' | 'locked';

export const SOUND_FILTERS: readonly { id: SoundFilter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every Sound' },
  { id: 'to-place', label: 'To place', title: 'Sounds on no pad of the layout on screen' },
  { id: 'on-grid', label: 'On grid', title: 'Sounds on a pad of the layout on screen' },
  { id: 'locked', label: 'Locked', title: 'Sounds locked to their pad' },
];

export function matchesFilter(placement: SoundPlacement | undefined, filter: SoundFilter): boolean {
  const placed = !!placement && placement.padKeys.length > 0;
  switch (filter) {
    case 'all': return true;
    case 'to-place': return !placed;
    case 'on-grid': return placed;
    case 'locked': return !!placement?.locked;
  }
}

/** How many Sounds each filter shows. */
export function filterCounts(placements: ReadonlyMap<string, SoundPlacement>): Record<SoundFilter, number> {
  const counts: Record<SoundFilter, number> = { 'all': 0, 'to-place': 0, 'on-grid': 0, 'locked': 0 };
  for (const placement of placements.values()) {
    for (const { id } of SOUND_FILTERS) if (matchesFilter(placement, id)) counts[id]++;
  }
  return counts;
}

/** Whether a Sound's name matches the search: every word, anywhere, in any case. */
export function matchesSearch(name: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = name.toLowerCase();
  return words.every(w => lower.includes(w));
}
