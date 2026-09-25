/**
 * SelectedEventCard (roadmap P1b, T07).
 *
 * The selected event's own verdict, shown beside — never instead of — the
 * whole-layout verdict. It covers the whole moment (every note struck at that
 * instant), costs it once, and shows all five canonical factors from
 * FACTOR_META. A moment that can't be played says so instead of showing
 * all-zero bars.
 */

import { type DifficultyLevel } from '../../../types/executionPlan';
import { type SelectedMoment } from '../../analysis/selectedMoment';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown } from '../../analysis/factorMeta';
import { formatBeatPosition } from '../EventsPanel';

const MOMENT_LEVEL_STYLE: Record<DifficultyLevel, string> = {
  Easy: 'bg-[var(--status-ok-bg)] border-[var(--status-ok-border)] text-[var(--status-ok)]',
  Medium: 'bg-[var(--status-warn-bg)] border-[var(--status-warn-border)] text-[var(--status-warn)]',
  Hard: 'bg-[var(--status-bad-bg)] border-[var(--status-bad-border)] text-[var(--status-bad)]',
  Unplayable: 'bg-[var(--status-bad-bg)] border-[var(--status-bad-border)] text-[var(--status-bad)]',
};

export function SelectedEventCard({ selected, tempo, scope }: {
  selected: SelectedMoment;
  tempo: number;
  scope: string;
}) {
  const { moment, cost } = selected;
  const factors = cost.breakdown ? factorsFromBreakdown(cost.breakdown) : null;
  const max = factors ? Math.max(...FACTOR_KEYS.map(k => factors[k]), 0.01) : 1;
  const noteWord = cost.noteCount === 1 ? 'note' : 'notes';

  return (
    <div data-testid="selected-event-card" className="rounded-pf-sm border border-[var(--border-default)] bg-bg-card/60 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="section-header">Selected event</h4>
        <span className="text-pf-xs font-mono text-[var(--text-secondary)]">
          Event {moment.index + 1} &middot; {formatBeatPosition(moment.startTime, tempo)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          data-testid="moment-verdict"
          data-level={cost.difficulty}
          className={`px-1.5 py-0.5 rounded-pf-sm border text-pf-xs font-medium ${MOMENT_LEVEL_STYLE[cost.difficulty]}`}
        >
          {cost.difficulty === 'Unplayable' ? '✗ ' : ''}{cost.difficulty}
        </span>
        <span className="text-pf-xs text-[var(--text-tertiary)]">
          {cost.noteCount} {noteWord}
          {factors && cost.unplayableNoteCount === 0 && (
            <> &middot; cost <span className="font-mono text-[var(--text-secondary)]">{cost.cost.toFixed(1)}</span>, counted once for the event</>
          )}
        </span>
      </div>
      <div data-testid="verdict-scope" className="text-pf-micro text-[var(--text-tertiary)]">{scope}</div>

      {cost.unplayableNoteCount > 0 || !factors ? (
        <p className="text-pf-xs text-[var(--status-bad)]">
          {cost.unplayableNoteCount} of {cost.noteCount} {noteWord} can&rsquo;t be played: a Sound has no pad, or no grip reaches it.
        </p>
      ) : (
        <div className="space-y-1">
          {FACTOR_KEYS.map(key => {
            const meta = FACTOR_META[key];
            const value = factors[key];
            return (
              <div key={key} data-testid={`moment-factor-${key}`} className="flex items-center gap-2" title={meta.description}>
                <div className="flex items-center gap-1.5 w-24">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-pf-sm text-[var(--text-secondary)]">{meta.label}</span>
                </div>
                <div className="flex-1 h-2.5 bg-[var(--bg-panel)] rounded-pf-sm overflow-hidden">
                  <div
                    className="h-full rounded-pf-sm"
                    style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`, backgroundColor: meta.color, opacity: 0.8 }}
                  />
                </div>
                <span className="text-pf-sm text-[var(--text-tertiary)] font-mono w-10 text-right">{value.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
