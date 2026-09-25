/**
 * The scope line every verdict carries (roadmap P1b, T15 scope line): which
 * Sounds the analysis covers. Muted Sounds are left out of the analysed
 * performance, and a Sound that isn't on the grid can't be played, so a verdict
 * says both instead of silently judging a narrower song.
 *
 * A verdict's scope is the scope of the analysis that produced it. A mute or
 * unmute marks the analysis stale but leaves the old plan on screen until the
 * re-analysis lands, so a plan's scope is read from the Sounds in the plan
 * (planSoundIds), not from the live mute state.
 */

import { type Layout } from '../../types/layout';
import { type FingerAssignment } from '../../types/executionPlan';

export interface ScopeStream {
  id: string;
  muted: boolean;
}

/** The Sounds a plan analysed: every Sound with a note in it. */
export function planSoundIds(assignments: readonly FingerAssignment[]): Set<string> {
  const ids = new Set<string>();
  for (const a of assignments) if (a.voiceId) ids.add(a.voiceId);
  return ids;
}

/**
 * @param analysedIds The Sounds the analysis covered (planSoundIds). Without it,
 *   the scope is the live one: every Sound that isn't muted.
 */
export function analysisScopeLine(
  streams: readonly ScopeStream[],
  layout: Layout | null | undefined,
  analysedIds?: ReadonlySet<string>,
): string {
  const total = streams.length;
  const analysed = streams.filter(s => (analysedIds ? analysedIds.has(s.id) : !s.muted));
  const left = streams.filter(s => !analysed.includes(s));
  const muted = left.filter(s => s.muted).length;
  const otherwiseLeftOut = left.length - muted;
  const placedIds = new Set(Object.values(layout?.padToVoice ?? {}).map(v => v.id));
  const unplaced = analysed.filter(s => !placedIds.has(s.id)).length;

  const parts = [`Analysing ${analysed.length} of ${total} Sound${total === 1 ? '' : 's'}`];
  if (muted > 0) parts.push(`${muted} muted`);
  if (otherwiseLeftOut > 0) parts.push(`${otherwiseLeftOut} not in this analysis`);
  if (unplaced > 0) parts.push(`${unplaced} not on the grid`);
  return parts.join(' · ');
}
