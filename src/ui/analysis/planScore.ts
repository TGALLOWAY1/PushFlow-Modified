import { COMFORTABLE_PLAN_SCORE } from '@/engine';
import type { LayoutAnalysisState } from './layoutAnalysis';

export function formatPlanScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function getPlanScoreQuality(score: number): 'good' | 'ok' | 'bad' {
  if (score >= COMFORTABLE_PLAN_SCORE) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

export function getPlanScoreSummary(score: number): string {
  if (score >= COMFORTABLE_PLAN_SCORE) return 'Comfortable';
  if (score >= 50) return 'Playable with effort';
  return 'Needs work';
}

/** What every displayed Score is (S3.1): one yardstick, the same for a layout wherever it appears. */
export const PLAYABILITY_TOOLTIP = 'Playability · canonical evaluator · higher = easier';

/** Shown in place of a Score while its layout is solved and scored. */
export const SCORING_TEXT = 'Scoring…';

/** Shown in place of a Score when scoring its layout failed. */
export const SCORE_FAILED_TEXT = "Couldn't score";

/** A Score's tooltip: what it is, and the band it falls in. */
export function playabilityTooltip(playability?: number): string {
  return playability === undefined
    ? PLAYABILITY_TOOLTIP
    : `${PLAYABILITY_TOOLTIP} · ${getPlanScoreSummary(playability)}`;
}

/** An analysis panel's Score tile for a layout's scoring state; `wording` marks text rather than a number. */
export function scoreTile(scored: LayoutAnalysisState): {
  value: string;
  quality?: 'good' | 'ok' | 'bad';
  subtitle: string;
  wording: boolean;
} {
  switch (scored.status) {
    case 'ready': {
      const p = scored.score.playability;
      return { value: formatPlanScore(p), quality: getPlanScoreQuality(p), subtitle: playabilityTooltip(p), wording: false };
    }
    case 'error':
      return { value: SCORE_FAILED_TEXT, subtitle: scored.message, wording: true };
    case 'empty':
      return { value: '—', subtitle: PLAYABILITY_TOOLTIP, wording: false };
    default:
      return { value: SCORING_TEXT, subtitle: PLAYABILITY_TOOLTIP, wording: true };
  }
}
