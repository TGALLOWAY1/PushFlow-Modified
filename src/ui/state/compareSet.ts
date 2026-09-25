/**
 * The compare set, derived from current ids (T08 slice).
 *
 * The user's ticks live in workspace state; what Compare may use is always
 * derived from them against the project: ids of candidates that no longer
 * exist (deleted, promoted, replaced by a new Generate) drop out, and the
 * Active Layout counts only while it has pads. Compare needs two distinct
 * layouts (by layout hash), so a candidate identical to Active after a
 * Promote never makes a self-compare.
 */

import { hashLayout } from '@/engine';
import type { ProjectState } from './projectState';

/** Id of the Active Layout in the compare set. */
export const ACTIVE_COMPARE_ID = '__active__';

/** The selected ids that still name a layout, in selection order. */
export function liveCompareIds(selected: Iterable<string>, state: Pick<ProjectState, 'candidates' | 'activeLayout'>): string[] {
  const candidateIds = new Set(state.candidates.map(c => c.id));
  const activeHasPads = Object.keys(state.activeLayout.padToVoice).length > 0;
  return [...selected].filter(id => (id === ACTIVE_COMPARE_ID ? activeHasPads : candidateIds.has(id)));
}

/** How many different layouts (by hash) these ids name. */
export function distinctCompareLayouts(ids: string[], state: Pick<ProjectState, 'candidates' | 'activeLayout'>): number {
  const hashes = new Set<string>();
  for (const id of ids) {
    const layout = id === ACTIVE_COMPARE_ID ? state.activeLayout : state.candidates.find(c => c.id === id)?.layout;
    if (layout) hashes.add(hashLayout(layout));
  }
  return hashes.size;
}

/** True when the ids name at least two different layouts. */
export function canCompare(ids: string[], state: Pick<ProjectState, 'candidates' | 'activeLayout'>): boolean {
  return ids.length >= 2 && distinctCompareLayouts(ids, state) >= 2;
}
