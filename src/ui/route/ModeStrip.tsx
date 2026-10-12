/**
 * The Push-mode strip and badge (S9.2), on the bar axis under the cards.
 *
 * Each mode span is drawn in its mode's colour with its glyph and name, then
 * its abbreviation, then the glyph alone as it narrows; spans the playhead
 * has passed dim to 50 %. The badge follows the playhead along the strip with
 * the mode it is in ("NO MODE SET" where none is), flips when the mode
 * changes, glows while playing, and rests at 60 % after the song's end.
 */

import { type ModeSpan, type PushMode, PUSH_MODE_ABBREVIATIONS, PUSH_MODE_LABELS } from '../../types/performanceRoute';
import { ModeGlyph } from '../components/shared/ModeGlyph';
import { useProject } from '../state/ProjectContext';
import { useTransportPosition, useTransportRunning } from '../audio/TransportProvider';
import { barSeconds } from '../../utils/musicalTime';
import { modeAt } from './derive';
import { type RouteAxis, spanX, xOfBar } from './routeGeometry';
import { ROUTE_STRIP_HEIGHT, modeColour } from './routeLayout';

export const NO_MODE_SET = 'No mode set';

type SpanLabel = 'full' | 'abbr' | 'glyph' | 'none';

export function spanLabel(width: number): SpanLabel {
  if (width >= 110) return 'full';
  if (width >= 44) return 'abbr';
  if (width >= 14) return 'glyph';
  return 'none';
}

export function ModeStrip({ axis, spans, playheadBar }: {
  axis: RouteAxis;
  spans: readonly ModeSpan[];
  playheadBar: number;
}) {
  return (
    <div
      data-testid="mode-strip"
      className="relative rounded-pf-sm bg-[var(--bg-panel)]"
      style={{ width: axis.width, height: ROUTE_STRIP_HEIGHT }}
    >
      {spans.map(span => {
        const { x, w } = spanX(axis, span);
        if (w <= 0) return null;
        const label = spanLabel(w);
        const passed = span.endBar <= playheadBar;
        const text = span.mode ? PUSH_MODE_LABELS[span.mode] : NO_MODE_SET;
        return (
          <div
            key={`${span.startBar}-${span.mode}`}
            data-testid="mode-span"
            data-mode={span.mode ?? 'none'}
            data-passed={passed ? 'true' : undefined}
            title={text}
            className={`absolute top-0 h-full flex items-center gap-1 px-1.5 overflow-hidden border-r border-[var(--bg-app)] ${
              span.mode ? '' : 'border border-dashed border-[var(--border-default)]'
            }`}
            style={{
              left: x,
              width: w,
              opacity: passed ? 0.5 : 1,
              ...(span.mode ? { backgroundColor: modeColour(span.mode), color: 'var(--mode-on-fill)' } : {}),
            }}
          >
            {span.mode && label !== 'none' && <ModeGlyph mode={span.mode} size={9} className="flex-shrink-0" />}
            {span.mode && label === 'full' && <span className="text-pf-micro font-semibold truncate">{PUSH_MODE_LABELS[span.mode]}</span>}
            {span.mode && label === 'abbr' && <span className="text-pf-micro font-semibold">{PUSH_MODE_ABBREVIATIONS[span.mode]}</span>}
          </div>
        );
      })}
      <ModeBadge axis={axis} spans={spans} />
    </div>
  );
}

/** Follows the playhead every frame; nothing else on the strip redraws. */
function ModeBadge({ axis, spans }: { axis: RouteAxis; spans: readonly ModeSpan[] }) {
  const position = useTransportPosition();
  const running = useTransportRunning();
  // The axis is in bars; the transport in seconds.
  const bar = position / barSeconds(useProject().state.tempo);
  const end = axis.startBar + axis.spanBars;
  const ended = !running && bar >= end - 1e-6;
  const mode: PushMode | null = modeAt(spans, Math.min(bar, end - 1e-6));
  const x = Math.max(56, Math.min(axis.width - 56, xOfBar(axis, bar)));
  const colour = mode ? modeColour(mode) : 'var(--bg-active)';
  return (
    <div
      data-testid="mode-badge"
      data-mode={mode ?? 'none'}
      data-ended={ended ? 'true' : undefined}
      aria-live="polite"
      className="absolute top-1/2 pointer-events-none"
      style={{ left: x, transform: 'translate(-50%, -50%)', opacity: ended ? 0.6 : 1 }}
    >
      <span
        key={mode ?? 'none'}
        className="route-badge-flip inline-flex items-center gap-1 h-6 px-2 rounded-full border-2 border-[var(--bg-app)] text-pf-micro font-bold uppercase tracking-wider whitespace-nowrap"
        style={{
          backgroundColor: colour,
          color: mode ? 'var(--mode-on-fill)' : 'var(--text-primary)',
          boxShadow: running && mode ? `0 0 10px ${colour}` : undefined,
        }}
      >
        {mode && <ModeGlyph mode={mode} size={10} />}
        {mode ? PUSH_MODE_LABELS[mode] : NO_MODE_SET}
      </span>
    </div>
  );
}

/** What the strip's colours and the lanes' marks mean. */
export function RouteLegend({ liveMode }: { liveMode: PushMode | null }) {
  const colour = modeColour(liveMode ?? 'drum');
  return (
    <ul data-testid="route-legend" className="flex items-center gap-4 text-pf-micro text-[var(--text-tertiary)]">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="w-4 h-2.5 rounded-sm border" style={{ backgroundColor: 'var(--route-clip)', borderColor: 'var(--route-clip-edge)' }} />
        Plays from clip
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-4 h-2.5 rounded-sm border-t-2"
          style={{ backgroundColor: `color-mix(in srgb, ${colour} 24%, transparent)`, borderTopColor: colour }}
        />
        You perform it
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="w-4 h-2.5 rounded-sm border" style={{ backgroundColor: 'var(--route-note)', borderColor: 'var(--route-unplayable)' }} />
        Can’t be played as fingered
      </li>
    </ul>
  );
}
