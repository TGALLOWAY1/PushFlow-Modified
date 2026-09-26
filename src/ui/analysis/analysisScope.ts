/**
 * The scope line every verdict carries (roadmap P1b, T15 scope line): which
 * Sounds the analysis covers. Muted Sounds are left out of the analysed
 * performance, and since S3.3 only placed Sounds' notes are scored (T25), so
 * a verdict says both instead of silently judging a narrower song:
 * "Analysing 5 of 7 Sounds · 1 muted · 1 not placed yet".
 *
 * A verdict's scope is the scope of the analysis that produced it. A mute or
 * unmute marks the analysis stale but leaves the old plan on screen until the
 * re-analysis lands, so the Sounds a plan scored are read from the plan
 * (planSoundIds), not from the live mute state. An unplaced Sound adds nothing
 * to any plan's numbers, so whether it is in scope is read live.
 */

import { type Layout } from '../../types/layout';
import { type FingerAssignment } from '../../types/executionPlan';
import { type PlacementProgress } from './verdictTiers';

export interface ScopeStream {
  id: string;
  muted: boolean;
  /** A Sound with no notes has nothing to place; without the list it counts as having notes. */
  events?: readonly unknown[];
}

/** The Sounds a plan analysed: every Sound with a note in it. */
export function planSoundIds(assignments: readonly FingerAssignment[]): Set<string> {
  const ids = new Set<string>();
  for (const a of assignments) if (a.voiceId) ids.add(a.voiceId);
  return ids;
}

export interface AnalysisScope {
  /** Every Sound of the project. */
  total: number;
  /** Sounds whose notes the analysis scores. */
  analysed: number;
  muted: number;
  /** Sounds on the grid that this plan left out although they aren't muted (unmuted since it ran). */
  notInAnalysis: number;
  /** Sounds in scope with no pad yet: their notes aren't scored until they are placed. */
  unplaced: number;
  /** Of the Sounds in scope, how many are placed: "Unfinished · 5 of 7 Sounds placed". */
  placement: PlacementProgress;
}

/**
 * @param analysedIds The Sounds the analysis covered (planSoundIds). Without it,
 *   the scope is the live one: every placed Sound that isn't muted.
 */
export function analysisScope(
  streams: readonly ScopeStream[],
  layout: Layout | null | undefined,
  analysedIds?: ReadonlySet<string>,
): AnalysisScope {
  const placedIds = new Set(Object.values(layout?.padToVoice ?? {}).map(v => v.id));
  let analysed = 0;
  let analysedPlaced = 0;
  let muted = 0;
  let notInAnalysis = 0;
  let unplaced = 0;
  for (const s of streams) {
    const placed = placedIds.has(s.id);
    const hasNotes = !s.events || s.events.length > 0;
    if (analysedIds ? analysedIds.has(s.id) : !s.muted && placed) {
      analysed++;
      // A plan made before S3.3 scored unplaced Sounds too (as unplayable).
      if (placed) analysedPlaced++;
      else unplaced++;
    } else if (s.muted) {
      muted++;
    } else if (!placed && hasNotes) {
      unplaced++;
    } else {
      notInAnalysis++;
    }
  }
  return {
    total: streams.length,
    analysed,
    muted,
    notInAnalysis,
    unplaced,
    placement: { placed: analysedPlaced, total: analysedPlaced + unplaced },
  };
}

export function analysisScopeLine(
  streams: readonly ScopeStream[],
  layout: Layout | null | undefined,
  analysedIds?: ReadonlySet<string>,
): string {
  return scopeLineOf(analysisScope(streams, layout, analysedIds));
}

export function scopeLineOf(scope: AnalysisScope): string {
  const parts = [`Analysing ${scope.analysed} of ${scope.total} Sound${scope.total === 1 ? '' : 's'}`];
  if (scope.muted > 0) parts.push(`${scope.muted} muted`);
  if (scope.notInAnalysis > 0) parts.push(`${scope.notInAnalysis} not in this analysis`);
  if (scope.unplaced > 0) parts.push(`${scope.unplaced} not placed yet`);
  return parts.join(' · ');
}
