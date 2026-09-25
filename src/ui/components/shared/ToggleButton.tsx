/**
 * ToggleButton (T63): an on/off button. A real <button> with aria-pressed, so
 * it is announced "Loop, toggle button, pressed". On reads filled and off
 * outlined, a second cue besides colour (T64), and it is at least 24 px tall.
 *
 * `label` is required: it is the visible text, or with `hideLabel` (icon only)
 * the accessible name and tooltip, so a toggle can never be nameless.
 * Enter presses it; Space plays and stops, as on every other button (S2.4).
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface ToggleButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'onClick' | 'onChange' | 'aria-pressed' | 'aria-label'> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** Its name: shown as text, or only to assistive tech and as the tooltip with `hideLabel`. */
  label: string;
  icon?: ReactNode;
  /** Show the icon alone; the label becomes the accessible name and tooltip. */
  hideLabel?: boolean;
  testId?: string;
}

const PRESSED = 'bg-accent-primary/25 border-accent-primary-soft/70 text-[var(--accent-primary-soft)]';
const RELEASED = 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] enabled:hover:text-[var(--text-primary)] enabled:hover:bg-[var(--bg-hover)]';

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function ToggleButton(
  { pressed, onPressedChange, label, icon, hideLabel = false, testId, className, title, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={pressed}
      aria-label={hideLabel ? label : undefined}
      title={title ?? (hideLabel ? label : undefined)}
      data-testid={testId}
      className={`focus-ring inline-flex items-center justify-center gap-1 min-h-[24px] ${hideLabel ? 'min-w-[24px] px-1' : 'px-2'} rounded-pf-sm border text-pf-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-[0.35] disabled:cursor-not-allowed ${pressed ? PRESSED : RELEASED} ${className ?? ''}`}
      onClick={() => onPressedChange(!pressed)}
    >
      {icon && <span aria-hidden="true" className="inline-flex">{icon}</span>}
      {!hideLabel && label}
    </button>
  );
});
