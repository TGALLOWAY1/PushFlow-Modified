/**
 * Prev hard / Next hard (S4.2, T27): select the Hard event before or after
 * the selected one, in time order, under the plan on screen. They stop at the
 * first and last Hard event (never wrapping); with nothing selected, Next
 * takes the first and Prev the last. Shift+←/→ do the same (the input table's
 * step-hard-events row). The count beside them says where the selection is and
 * why a button is disabled (T31).
 */

import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { hardEventSteps } from '../../analysis/eventDifficulty';
import { type TimelineEvent } from '../../analysis/eventTimeline';

const STEP = 'focus-ring inline-flex items-center gap-0.5 h-6 px-1.5 rounded-pf-sm border border-[var(--border-default)] bg-[var(--bg-card)] text-pf-micro font-semibold text-[var(--text-secondary)] whitespace-nowrap enabled:hover:bg-[var(--bg-hover)] enabled:hover:text-[var(--text-primary)] disabled:opacity-[0.35] disabled:cursor-not-allowed';

export function HardEventStepper({ testIdPrefix }: {
  /** Test ids read `${testIdPrefix}-prev-hard`, `-next-hard` and `-hard-status`. */
  testIdPrefix: string;
}) {
  const { state, dispatch } = useProject();
  const steps = hardEventSteps(state);
  const statusId = useId();
  const go = (event: TimelineEvent | null) => {
    if (event) dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
  };
  const status = steps.total === 0 ? 'No Hard events'
    : steps.position >= 0 ? `Hard ${steps.position + 1} of ${steps.total}`
    : `${steps.total} Hard`;
  return (
    <div role="group" aria-label="Hard events" className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        data-testid={`${testIdPrefix}-prev-hard`}
        className={STEP}
        disabled={!steps.previous}
        aria-describedby={statusId}
        title="Previous Hard event (Shift+←)"
        onClick={() => go(steps.previous)}
      >
        <ChevronLeft size={12} aria-hidden="true" />Prev hard
      </button>
      <button
        type="button"
        data-testid={`${testIdPrefix}-next-hard`}
        className={STEP}
        disabled={!steps.next}
        aria-describedby={statusId}
        title="Next Hard event (Shift+→)"
        onClick={() => go(steps.next)}
      >
        Next hard<ChevronRight size={12} aria-hidden="true" />
      </button>
      <span id={statusId} data-testid={`${testIdPrefix}-hard-status`} className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap truncate">
        {status}
      </span>
    </div>
  );
}
