/**
 * Checkbox (T63): a native <input type="checkbox">, so its role, checked state,
 * click and Space come from the browser; it is only drawn with tokens.
 *
 * - The name is a visible `label` or, where the row around it already says
 *   what it is, a required `aria-label`; the types refuse neither.
 * - `indeterminate` shows the mixed state ("some of these").
 * - The whole label, and at least 24×24 px around the box, toggles it (T64).
 * - `disabledReason` disables it and says why beside it (DisabledReason, T31).
 * Space on a focused checkbox ticks it: the input table leaves Space to a
 * checkbox (inputRegistry.ts, widgetOwnsKey), while Space on an ordinary
 * button still plays (S2.4).
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { DisabledReason, useDisabledReason } from './DisabledReason';

/** A visible label, or an aria-label where the surroundings say what it is. */
type CheckboxName =
  | { label: ReactNode; 'aria-label'?: undefined }
  | { label?: undefined; 'aria-label': string };

export type CheckboxProps = CheckboxName & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The mixed state: some, not all, of what it stands for. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Why it can't be changed now: disables it and is shown beside it. */
  disabledReason?: string | null;
  id?: string;
  className?: string;
  testId?: string;
};

export function Checkbox({
  label, 'aria-label': ariaLabel, checked, onChange, indeterminate = false, disabled,
  disabledReason, id, className, testId,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reason = useDisabledReason(disabledReason);
  const isDisabled = disabled || !!disabledReason;
  const marked = checked || indeterminate;

  // indeterminate is a DOM property with no attribute. Set on every render: a
  // click clears it in the DOM, and the props are the truth.
  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  });

  return (
    <>
      <label
        className={`inline-flex items-center gap-2 min-h-[24px] ${label === undefined ? 'min-w-[24px] justify-center' : ''} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className ?? ''}`}
      >
        <span className="relative inline-flex items-center justify-center w-4 h-4 flex-shrink-0">
          <input
            ref={inputRef}
            type="checkbox"
            id={id}
            checked={checked}
            disabled={isDisabled}
            aria-label={ariaLabel}
            aria-describedby={reason.describedBy}
            data-testid={testId}
            className={`focus-ring appearance-none w-4 h-4 m-0 rounded-pf-sm border transition-colors disabled:opacity-[0.35] ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${
              marked
                ? 'bg-accent-primary border-accent-primary'
                : 'bg-[var(--bg-input)] border-[var(--border-strong)] enabled:hover:border-[var(--text-tertiary)]'
            }`}
            onChange={e => onChange(e.currentTarget.checked)}
          />
          {marked && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
              {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
            </span>
          )}
        </span>
        {label !== undefined && (
          <span className={`text-pf-sm ${isDisabled ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{label}</span>
        )}
      </label>
      <DisabledReason id={reason.id} reason={disabledReason} />
    </>
  );
}
