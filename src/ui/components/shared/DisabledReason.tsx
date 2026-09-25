/**
 * Why a control is disabled, said next to it (T31): disabled buttons keep their
 * pointer events (index.css), and the reason is visible text tied to the button
 * by aria-describedby, not a tooltip nobody sees.
 */

import { useId } from 'react';

/** Ids for a button and its reason: spread `describedBy` onto the button. */
export function useDisabledReason(reason: string | null | undefined) {
  const id = useId();
  return { id, describedBy: reason ? id : undefined };
}

export function DisabledReason({ id, reason, className = '' }: {
  id: string;
  reason: string | null | undefined;
  className?: string;
}) {
  if (!reason) return null;
  return (
    <span id={id} data-testid="disabled-reason" className={`text-pf-micro text-[var(--text-tertiary)] ${className}`}>
      {reason}
    </span>
  );
}
