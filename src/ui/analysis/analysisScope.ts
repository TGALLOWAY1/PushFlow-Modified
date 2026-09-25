/**
 * The scope line every verdict carries (roadmap P1b, T15 scope line): which
 * Sounds the analysis covers. Muted Sounds are left out of the analysed
 * performance, and a Sound that isn't on the grid can't be played, so a verdict
 * says both instead of silently judging a narrower song.
 */

import { type Layout } from '../../types/layout';

export interface ScopeStream {
  id: string;
  muted: boolean;
}

export function analysisScopeLine(streams: readonly ScopeStream[], layout: Layout | null | undefined): string {
  const total = streams.length;
  const analysed = streams.filter(s => !s.muted);
  const muted = total - analysed.length;
  const placedIds = new Set(Object.values(layout?.padToVoice ?? {}).map(v => v.id));
  const unplaced = analysed.filter(s => !placedIds.has(s.id)).length;

  const parts = [`Analysing ${analysed.length} of ${total} Sound${total === 1 ? '' : 's'}`];
  if (muted > 0) parts.push(`${muted} muted`);
  if (unplaced > 0) parts.push(`${unplaced} not on the grid`);
  return parts.join(' · ');
}
