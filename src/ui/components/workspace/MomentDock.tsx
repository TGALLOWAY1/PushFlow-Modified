/**
 * The moment dock (S4.2): a fixed-size panel beside the grid (under it in a
 * narrow centre), so selecting something never resizes the grid. It holds the
 * moment view's control (Now | Now + Next | Prev · Now · Next) above what is
 * selected.
 */

import { MomentViewControl } from './MomentViewControl';

export function MomentDock() {
  return (
    <section
      aria-label="Moment"
      data-testid="moment-dock"
      className="h-full flex flex-col gap-2 rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2 overflow-y-auto"
    >
      <div className="flex flex-col gap-1">
        <h3 className="section-header">Moment view</h3>
        <MomentViewControl />
      </div>
      <p data-testid="moment-dock-hint" className="text-pf-xs text-[var(--text-tertiary)] leading-relaxed">
        Select an event (the Events list, the timeline, ←/→ or Shift+←/→ for the hard ones) to see its strikes on the grid.
      </p>
    </section>
  );
}
