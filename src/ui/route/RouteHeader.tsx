/**
 * The Performance Route's header (S9.2): back to the editor, the project's
 * name and facts ("120 BPM · 4/4 · 8 bars · 0:16"), the layout it shows (the
 * Active Layout, always: R-D6), EDIT ROUTE, and the playhead as beat dots,
 * time since the song's start, and bar.beat.sixteenth.
 *
 * The role chip is the square sentence-case box and lives only here; Push
 * modes are capsules and live only in the route (design D3).
 */

import { ArrowLeft } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { useTransport, useTransportPosition, useTransportRunning } from '../audio/TransportProvider';
import { RoleChip } from '../components/shared/SubjectChip';
import { DisabledReason } from '../components/shared/DisabledReason';
import { ROLE_META } from '../state/layoutSubject';
import { formatBarBeat, formatSeconds } from '../../utils/musicalTime';
import { BEATS_PER_BAR } from '../audio/transportMath';
import { type BarRange } from '../../types/performanceRoute';
import { ROUTE_HEADER_HEIGHT, formatClock } from './routeLayout';

/** Why EDIT ROUTE is off until edit mode ships (S9.4). */
export const EDIT_ROUTE_REASON = 'Editing the route comes in a later update';

/** The playhead: beat dots, time since the song's start and bar.beat.sixteenth, redrawn every frame. */
function RoutePosition({ songStart, tempo }: { songStart: number; tempo: number }) {
  const position = Math.max(songStart, useTransportPosition());
  const running = useTransportRunning();
  const beat = Math.floor(position / (60 / tempo) + 1e-6) % BEATS_PER_BAR;
  return (
    <div
      data-testid="route-position"
      className="flex items-center gap-3 flex-shrink-0"
      title={`Playhead: bar.beat.sixteenth · ${formatSeconds(position)}`}
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
          <span
            key={i}
            data-testid="route-beat-dot"
            data-on={i === beat ? 'true' : undefined}
            className={`w-1.5 h-1.5 rounded-full ${
              i === beat ? (running ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-secondary)]') : 'bg-[var(--border-strong)]'
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-pf-sm tabular-nums text-[var(--text-secondary)] w-10 text-right">
        {formatClock(position - songStart)}
      </span>
      <span data-testid="route-position-bar" className="font-mono text-pf-md tabular-nums text-[var(--text-primary)] w-[4.5rem] text-right">
        {formatBarBeat(position, tempo)}
      </span>
    </div>
  );
}

export function RouteHeader({ bars, onBack, editReasonId }: {
  bars: BarRange;
  onBack: () => void;
  /** The id the visible "why" gets, so other disabled edit controls can point at it too. */
  editReasonId: string;
}) {
  const { state } = useProject();
  const { song } = useTransport();
  const barCount = bars.endBar - bars.startBar;

  return (
    <header
      data-testid="route-header"
      className="flex items-center gap-4 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex-shrink-0"
      style={{ height: ROUTE_HEADER_HEIGHT }}
    >
      <button
        type="button"
        data-testid="route-back"
        onClick={onBack}
        className="pf-btn pf-btn-subtle focus-ring text-pf-sm flex items-center gap-1.5 h-8 flex-shrink-0"
        title="Back to the editor"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Editor
      </button>

      <div className="flex flex-col min-w-0">
        <h1 data-testid="route-project-name" className="font-headline text-pf-lg font-semibold text-[var(--text-primary)] truncate leading-tight">
          {state.name || 'Untitled project'}
        </h1>
        <p data-testid="route-facts" className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap">
          {state.tempo} BPM · 4/4 · {barCount} {barCount === 1 ? 'bar' : 'bars'} · {formatClock(song.end - song.start)}
        </p>
      </div>

      <span data-testid="route-layout" className="flex items-center gap-1.5 min-w-0">
        <RoleChip role="active" text={ROLE_META.active.term} />
        <span className="text-pf-xs text-[var(--text-secondary)] truncate">{state.activeLayout.name}</span>
      </span>

      <div className="flex-1" />

      <span className="flex items-center gap-2 flex-shrink-0">
        <DisabledReason id={editReasonId} reason={EDIT_ROUTE_REASON} className="whitespace-nowrap" />
        <button
          type="button"
          data-testid="route-edit"
          disabled
          aria-describedby={editReasonId}
          className="pf-btn pf-btn-subtle text-pf-xs font-semibold uppercase tracking-wider h-8"
        >
          Edit route
        </button>
      </span>

      <RoutePosition songStart={song.start} tempo={state.tempo} />
    </header>
  );
}
