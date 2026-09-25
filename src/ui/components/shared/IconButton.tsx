/**
 * IconButton (T63): a button that shows only an icon.
 *
 * - `label` is required: it is the accessible name and, by default, the
 *   tooltip, so no icon-only button is nameless. The icon is aria-hidden.
 * - At least 24×24 px (T64).
 * - `disabledReason` disables it and says why next to it (DisabledReason,
 *   T31), tied by aria-describedby. Disabled buttons keep their pointer events,
 *   so the tooltip still shows and a click can't fall through.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { DisabledReason, useDisabledReason } from './DisabledReason';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title' | 'aria-label'> {
  /** Its accessible name ("Delete variant"); also the tooltip unless `title` says otherwise. */
  label: string;
  /** The icon, hidden from assistive tech. */
  children: ReactNode;
  /** The tooltip; the label by default, or false for none. */
  title?: string | false;
  /** Why it can't be used now: disables it and is shown beside it. */
  disabledReason?: string | null;
  /** Its square size in px: 24 (the minimum target), 28 or 32. */
  size?: 24 | 28 | 32;
  testId?: string;
}

const SIZE_CLASS = { 24: 'w-6 h-6', 28: 'w-7 h-7', 32: 'w-8 h-8' } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, title, disabledReason, disabled, size = 24, testId, className, type = 'button', ...rest },
  ref,
) {
  const reason = useDisabledReason(disabledReason);
  const describedBy = [rest['aria-describedby'], reason.describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <>
      <button
        {...rest}
        ref={ref}
        type={type}
        aria-label={label}
        aria-describedby={describedBy}
        title={title === false ? undefined : title ?? label}
        disabled={disabled || !!disabledReason}
        data-testid={testId}
        className={`focus-ring inline-flex items-center justify-center flex-shrink-0 ${SIZE_CLASS[size]} rounded-pf-sm text-[var(--text-tertiary)] enabled:hover:text-[var(--text-primary)] enabled:hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-[0.35] disabled:cursor-not-allowed ${className ?? ''}`}
      >
        <span aria-hidden="true" className="inline-flex">{children}</span>
      </button>
      <DisabledReason id={reason.id} reason={disabledReason} />
    </>
  );
});
