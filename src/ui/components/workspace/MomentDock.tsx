/**
 * The moment dock (S4.2): a fixed-size panel beside the grid (under it in a
 * narrow centre), so selecting something never resizes the grid. It holds the
 * moment view's control (Now | Now + Next | Prev · Now · Next) above what is
 * selected: the pad inspector for a clicked pad (T28), the moment inspector
 * for the current moment (T27; while playing the event at the playhead,
 * S4.3b), or both, the pad first. With neither, a hint says how to select an
 * event.
 */

import { useProject } from '../../state/ProjectContext';
import { getInspectedLayout } from '../../state/projectState';
import { useCurrentMoment } from '../../hooks/useCurrentMoment';
import { MomentViewControl } from './MomentViewControl';
import { PadInspector } from './PadInspector';
import { MomentInspector } from './MomentInspector';

export function MomentDock() {
  const { state } = useProject();
  const padSelected = !!state.selectedPadKey && !!getInspectedLayout(state).padToVoice[state.selectedPadKey];
  const eventSelected = useCurrentMoment().key !== null;
  return (
    <section
      aria-label="Moment"
      data-testid="moment-dock"
      className="h-full flex flex-col gap-2 rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-2 overflow-y-auto"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="section-header">Moment view</h3>
        <MomentViewControl />
      </div>
      {padSelected && <PadInspector />}
      {eventSelected && <MomentInspector />}
      {!padSelected && !eventSelected && (
        <p data-testid="moment-dock-hint" className="text-pf-xs text-[var(--text-tertiary)] leading-relaxed">
          {state.isPlaying
            ? 'Playing: each event shows here as the playhead reaches it.'
            : 'Select an event (the Events list, the timeline, ←/→ or Shift+←/→ for the hard ones) to see its strikes on the grid. Click a pad to inspect it.'}
        </p>
      )}
    </section>
  );
}
