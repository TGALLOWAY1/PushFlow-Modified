/**
 * "Save as variant" asks for a name (S2.3, T29), pre-filled with the layout's
 * base name and the time ("Default – 23 Sep 14:02"). Enter or Save keeps it;
 * Escape or a click outside cancels. The reducer numbers a taken name.
 */

import { useEffect, useRef, useState } from 'react';
import { Popover, useOverlayTitleId } from '../shared/Overlay';

export function SaveVariantPopover({ x, y, defaultName, returnFocusTo, onSave, onClose }: {
  x: number;
  y: number;
  defaultName: string;
  returnFocusTo?: HTMLElement | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useOverlayTitleId();
  useEffect(() => { inputRef.current?.select(); }, []);
  const save = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <Popover
      x={x}
      y={y}
      onClose={onClose}
      role="dialog"
      labelledBy={titleId}
      returnFocusTo={returnFocusTo}
      testId="save-variant-popover"
      className="w-80 p-3 space-y-2 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl"
    >
      <form
        className="space-y-2"
        onSubmit={e => { e.preventDefault(); save(); }}
      >
        <label id={titleId} htmlFor={`${titleId}-name`} className="block text-pf-sm font-semibold text-[var(--text-primary)]">
          Save as variant
        </label>
        <input
          id={`${titleId}-name`}
          ref={inputRef}
          data-testid="save-variant-name"
          className="pf-input w-full text-pf-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <p className="text-pf-xs text-[var(--text-tertiary)]">
          A variant keeps this layout without changing the Active Layout.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="pf-btn pf-btn-subtle text-pf-sm" onClick={onClose}>Cancel</button>
          <button type="submit" data-testid="save-variant-confirm" className="pf-btn pf-btn-primary text-pf-sm" disabled={!name.trim()}>
            Save variant
          </button>
        </div>
      </form>
    </Popover>
  );
}
