/**
 * "Use as my draft" / "Edit as draft" (S3.2): makes a candidate, a saved
 * variant or a recovered draft the Working/Test Layout, as one undo step. With
 * no draft that differs from Active, or a layout that keeps all of the draft
 * (S3.3), it acts at once; otherwise a popover offers "Save my draft as a
 * variant first" or "Replace (undoable)", so a hand-made draft is never
 * replaced by surprise (T01).
 */

import { useRef, useState } from 'react';
import { Popover, useOverlayTitleId } from '../shared/Overlay';
import { useUseAsDraft, type DraftSource } from '../../hooks/useUseAsDraft';

export function UseAsDraftButton({ source, label = 'Use as my draft', title, className = '', testId }: {
  source: DraftSource;
  /** "Use as my draft" in the state bar; "Edit as draft" on a variant row. */
  label?: string;
  title?: string;
  className?: string;
  testId?: string;
}) {
  const { needsChoice: needsChoiceFor, apply } = useUseAsDraft();
  const needsChoice = needsChoiceFor(source);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const titleId = useOverlayTitleId();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        className={className}
        title={title ?? 'Make this layout your Working/Test Layout, to edit it'}
        aria-haspopup={needsChoice ? 'dialog' : undefined}
        aria-expanded={needsChoice ? at !== null : undefined}
        onClick={e => {
          e.stopPropagation();
          if (!needsChoice) {
            apply(source);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          setAt(prev => (prev ? null : { x: r.left, y: r.bottom + 6 }));
        }}
      >
        {label}
      </button>
      {at && (
        <Popover
          x={at.x}
          y={at.y}
          onClose={() => setAt(null)}
          role="dialog"
          labelledBy={titleId}
          returnFocusTo={buttonRef.current}
          testId="use-as-draft-popover"
          className="w-72 p-3 space-y-2 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl"
        >
          <p id={titleId} className="text-pf-sm font-semibold text-[var(--text-primary)]">Replace your draft?</p>
          <p className="text-pf-xs text-[var(--text-tertiary)]">
            Your Working/Test Layout differs from the Active Layout. Keep it as a variant, or replace it: Undo brings it back, and it stays under Recovered drafts.
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              data-testid="use-as-draft-save-first"
              className="pf-btn pf-btn-primary text-pf-sm justify-start"
              onClick={() => { setAt(null); apply(source, { saveDraftFirst: true }); }}
            >
              Save my draft as a variant first
            </button>
            <button
              type="button"
              data-testid="use-as-draft-replace"
              className="pf-btn pf-btn-subtle text-pf-sm justify-start"
              onClick={() => { setAt(null); apply(source); }}
            >
              Replace (undoable)
            </button>
            <button type="button" className="pf-btn pf-btn-ghost text-pf-sm justify-start" onClick={() => setAt(null)}>
              Cancel
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
