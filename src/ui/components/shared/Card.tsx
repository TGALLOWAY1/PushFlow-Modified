/**
 * Card (T63): a surface for one item (a layout, a candidate, a project).
 *
 * Plain, it is a container, and the types refuse an onClick on it: never a
 * clickable div. Interactive, it is a real button or link: `action` renders a
 * <button> (onClick) or <a> (href) with its own accessible name, stretched over
 * the whole card under its content (index.css, .pf-card-action). So the card
 * is keyboard-operable (Tab reaches it, Enter activates it) with a focus ring
 * around the card, while the card's own controls (a checkbox, a menu, Promote)
 * stay separate controls above it rather than being nested in a button.
 * `action.current` marks the card being shown (aria-current).
 * An interactive card's plain content lets pointer events through to the
 * action, so a title tooltip on it won't show: put what matters in the
 * action's label, or on one of the card's controls.
 */

import { type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export type CardAction = {
  /** The action's accessible name: "Inspect candidate B", "Open TEST MIDI 1". */
  label: string;
  /** This card is the one shown now (aria-current and a highlighted border). */
  current?: boolean;
  testId?: string;
} & (
  | { onClick: (e: MouseEvent<HTMLButtonElement>) => void; href?: undefined }
  | { href: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }
);

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children'> {
  /** Makes the card a real button (onClick) or link (href). */
  action?: CardAction;
  as?: 'div' | 'article' | 'section' | 'li';
  /** The default 12 px padding; false to set your own in className. */
  padded?: boolean;
  testId?: string;
  children: ReactNode;
}

export function Card({ action, as: Tag = 'div', padded = true, testId, className, children, ...rest }: CardProps) {
  const border = action?.current
    ? 'border-[var(--border-active)]'
    : `border-[var(--border-subtle)] ${action ? 'hover:border-[var(--border-strong)]' : ''}`;
  return (
    <Tag
      {...rest}
      data-testid={testId}
      className={`relative rounded-pf-lg border bg-[var(--bg-card)] transition-colors ${border} ${padded ? 'p-3' : ''} ${className ?? ''}`}
    >
      {action && (action.href !== undefined ? (
        <a
          href={action.href}
          aria-label={action.label}
          aria-current={action.current ? 'true' : undefined}
          data-testid={action.testId}
          className="pf-card-action focus-ring"
          onClick={action.onClick}
        />
      ) : (
        <button
          type="button"
          aria-label={action.label}
          aria-current={action.current ? 'true' : undefined}
          data-testid={action.testId}
          className="pf-card-action focus-ring"
          onClick={action.onClick}
        />
      ))}
      {action ? <div className="pf-card-content">{children}</div> : children}
    </Tag>
  );
}
