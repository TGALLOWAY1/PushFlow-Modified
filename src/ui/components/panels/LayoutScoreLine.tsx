/**
 * A layout's Score and its hard and unplayable event counts, on the one
 * yardstick (S3.1): "Scoring…" until the layout is scored, "Couldn't score" if
 * that fails. The Layouts list's Active and variant rows use it. A partly
 * placed layout says so ("· 3 of 7 placed"): its Score covers only the placed
 * Sounds' notes (S3.3).
 */

import { type Layout } from '../../../types/layout';
import { useProject } from '../../state/ProjectContext';
import { useLayoutAnalysis } from '../../analysis/layoutAnalysis';
import { analysisScope } from '../../analysis/analysisScope';
import { isUnfinished } from '../../analysis/verdictTiers';
import {
  formatPlanScore,
  getPlanScoreQuality,
  playabilityTooltip,
  PLAYABILITY_TOOLTIP,
  SCORE_FAILED_TEXT,
  SCORING_TEXT,
} from '../../analysis/planScore';

export function LayoutScoreLine({ layout, testId }: { layout: Layout; testId: string }) {
  const { state } = useProject();
  const scored = useLayoutAnalysis(layout);
  const { placement } = analysisScope(state.soundStreams, layout);
  if (scored.status === 'empty') return null;
  if (scored.status === 'analysing') {
    return <div data-testid={testId} className="text-pf-xs text-[var(--text-tertiary)] animate-pulse" title={PLAYABILITY_TOOLTIP}>{SCORING_TEXT}</div>;
  }
  if (scored.status === 'error') {
    return <div data-testid={testId} className="text-pf-xs text-red-300" title={scored.message}>{SCORE_FAILED_TEXT}</div>;
  }
  const { playability, hardEvents, unplayableEvents } = scored.score;
  const quality = getPlanScoreQuality(playability);
  return (
    <div data-testid={testId} className="text-pf-xs text-[var(--text-secondary)]">
      <span
        className={`font-semibold ${quality === 'good' ? 'text-emerald-300' : quality === 'ok' ? 'text-amber-300' : 'text-red-300'}`}
        title={playabilityTooltip(playability)}
      >
        Score {formatPlanScore(playability)}
      </span>
      {' · '}{hardEvents} hard · {unplayableEvents} unplayable
      {isUnfinished(placement) && (
        <span className="text-[var(--accent-primary-soft)]" title="Unfinished: the Score covers only the placed Sounds' notes">
          {' · '}{placement.placed} of {placement.total} placed
        </span>
      )}
    </div>
  );
}
