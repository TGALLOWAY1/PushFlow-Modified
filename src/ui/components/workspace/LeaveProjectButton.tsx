/**
 * "← Library" (S3.3, T30). Candidates are never saved (canon), so leaving the
 * project while some are unkept asks first, in a popover that says how many
 * would be lost: "Leave anyway" or "Stay". With none unkept it leaves at once.
 * The browser's own prompt covers closing the tab (useLayoutActions).
 */

import { useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { unkeptCandidates } from '../../state/keptCandidates';
import { Popover, useOverlayTitleId } from '../shared/Overlay';

export function LeaveProjectButton({ onLeave }: { onLeave: () => void }) {
  const { state } = useProject();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number; unkept: number } | null>(null);
  const titleId = useOverlayTitleId();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="leave-project"
        className="pf-btn pf-btn-subtle text-pf-sm"
        onClick={e => {
          const unkept = unkeptCandidates(state).length;
          if (unkept === 0) {
            onLeave();
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          setAt(prev => (prev ? null : { x: r.left, y: r.bottom + 6, unkept }));
        }}
        title="Save and return to library"
        aria-haspopup="dialog"
        aria-expanded={at !== null}
      >
        &larr; Library
      </button>
      {at && (
        <Popover
          x={at.x}
          y={at.y}
          onClose={() => setAt(null)}
          role="dialog"
          labelledBy={titleId}
          returnFocusTo={buttonRef.current}
          testId="leave-project-popover"
          className="w-72 p-3 space-y-2 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl"
        >
          <p id={titleId} className="text-pf-sm font-semibold text-[var(--text-primary)]">
            {at.unkept === 1 ? '1 candidate isn’t kept' : `${at.unkept} candidates aren’t kept`}
          </p>
          <p className="text-pf-xs text-[var(--text-tertiary)]">
            Candidates are temporary and go when you leave the project. Keep the ones you like as variants first.
          </p>
          <div className="flex gap-1.5 justify-end">
            <button type="button" data-testid="leave-project-stay" className="pf-btn pf-btn-subtle text-pf-sm" onClick={() => setAt(null)}>
              Stay
            </button>
            <button
              type="button"
              data-testid="leave-project-confirm"
              className="pf-btn pf-btn-primary text-pf-sm"
              onClick={() => { setAt(null); onLeave(); }}
            >
              Leave anyway
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
