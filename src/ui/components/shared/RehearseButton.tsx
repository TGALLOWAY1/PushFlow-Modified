/**
 * Rehearse one event (S4.3b, T10): a labelled button on the selected Events
 * row and under the chart for its selected bar, and a split button in the
 * docked inspector whose menu rehearses at a chosen speed (as written, 75% or
 * 50%) and remembers it for the session. What it does is useRehearse's; its
 * tooltip says so. `onRehearse` runs after it starts (the enlarged chart
 * closes, so the grid shows the count-in).
 */

import { useRef, useState } from 'react';
import { Check, ChevronDown, Repeat } from 'lucide-react';
import { type TimelineEvent } from '../../analysis/eventTimeline';
import { REHEARSE_SPEEDS } from '../../audio/transportMath';
import { rehearseSpeedWords, rehearseTitle, useRehearse } from '../../hooks/useRehearse';
import { Popover } from './Overlay';

const SPLIT_HALF = 'focus-ring inline-flex items-center h-6 border border-[var(--border-default)] bg-[var(--bg-card)] text-pf-micro font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]';

export function RehearseButton({ event, variant = 'button', testId = 'rehearse', onRehearse }: {
  event: TimelineEvent;
  /** 'button' on the selected Events row and under the chart; 'split' (with the speed menu) in the inspector. */
  variant?: 'button' | 'split';
  testId?: string;
  /** Called once Rehearse has started. */
  onRehearse?: () => void;
}) {
  const { rehearse: start, planFor, rate, playing } = useRehearse();
  const rehearse = (e: TimelineEvent, speed?: number) => {
    start(e, speed);
    onRehearse?.();
  };
  const plan = planFor(event);
  const title = rehearseTitle(plan, playing);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  if (variant === 'button') {
    return (
      <button
        type="button"
        data-testid={testId}
        data-event-index={event.index}
        className={`${SPLIT_HALF} gap-1 px-1.5 rounded-pf-sm flex-shrink-0`}
        title={title}
        onClick={() => rehearse(event)}
      >
        <Repeat size={11} aria-hidden="true" />
        Rehearse {plan.bars}
        {rate !== 1 && <span className="font-normal text-[var(--text-tertiary)]">{` · ${rehearseSpeedWords(rate)}`}</span>}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center" role="group" aria-label="Rehearse">
      <button
        type="button"
        data-testid={testId}
        data-event-index={event.index}
        className={`${SPLIT_HALF} gap-1 px-1.5 rounded-l-pf-sm`}
        title={title}
        onClick={() => rehearse(event)}
      >
        <Repeat size={11} aria-hidden="true" />
        Rehearse {plan.bars}
        {rate !== 1 && <span className="font-normal text-[var(--text-tertiary)]">{` · ${rehearseSpeedWords(rate)}`}</span>}
      </button>
      <button
        ref={menuButton}
        type="button"
        data-testid={`${testId}-menu`}
        aria-label="Rehearse at another speed"
        aria-haspopup="dialog"
        aria-expanded={menuAt !== null}
        title="Rehearse at full speed, 75% or 50%"
        className={`${SPLIT_HALF} justify-center w-5 border-l-0 rounded-r-pf-sm`}
        onClick={() => {
          if (menuAt) { setMenuAt(null); return; }
          const r = menuButton.current?.getBoundingClientRect();
          if (r) setMenuAt({ x: r.left, y: r.bottom + 4 });
        }}
      >
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {menuAt && (
        <Popover
          x={menuAt.x}
          y={menuAt.y}
          role="dialog"
          ariaLabel="Rehearse at"
          onClose={() => setMenuAt(null)}
          returnFocusTo={menuButton.current}
          testId={`${testId}-speeds`}
          className="w-[220px] py-1 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        >
          {REHEARSE_SPEEDS.map(speed => (
            <button
              key={speed}
              type="button"
              data-testid={`${testId}-at-${Math.round(speed * 100)}`}
              aria-current={speed === rate ? 'true' : undefined}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={() => { setMenuAt(null); rehearse(event, speed); }}
            >
              <span className="w-3 flex-shrink-0" aria-hidden="true">{speed === rate && <Check size={12} />}</span>
              Rehearse at {rehearseSpeedWords(speed)}
            </button>
          ))}
          <p className="px-3 pt-1.5 pb-1 mt-1 border-t border-[var(--border-subtle)] text-pf-micro text-[var(--text-tertiary)]">
            Loops {plan.bars}{playing ? '.' : `, after a ${plan.countInBars}-bar count-in.`} Stop comes back to this event.
          </p>
        </Popover>
      )}
    </div>
  );
}
