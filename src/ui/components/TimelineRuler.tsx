/**
 * The timeline's bar ruler (S4.3a, T58), two strips deep:
 *
 * - The loop strip on top. Drag across it to set a loop; drag the loop bar to
 *   move it and its ends to resize it. Edges snap to bars; with Shift to
 *   beats; with Alt not at all. The pointer is captured, so a drag carries on
 *   outside the ruler. The bar reads its bounds as bar.beat ("2.1.1" and
 *   "4.1.1") and its bars ("Bars 2–3"); with Loop off it stays, dimmed.
 * - The bar numbers under it, and the playhead's handle. Click to move the
 *   playhead there, or drag (from anywhere on the numbers, or the handle) to
 *   scrub; while playing, playback follows. Stopped, the playhead lands on
 *   the nearest event when the pointer is released, and that event is
 *   selected: the one current moment (S4.3b, T10).
 *
 * Positions come from the transport (useTransport, useTransportPosition), so
 * the ruler shows and moves what the workspace's transport plays.
 */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useProject } from '../state/ProjectContext';
import { useTransport, useTransportPosition } from '../audio/TransportProvider';
import { MIN_LOOP_SECONDS, loopRegionOf, snapModeOf, snapTime, type SnapMode } from '../audio/transportMath';
import { barSeconds, formatBarBeat, formatBarRange } from '../../utils/musicalTime';
import { getEventTimeline, nearestEvent } from '../analysis/eventTimeline';
import { BAR_HEADER_HEIGHT, LOOP_STRIP_HEIGHT } from './timelineLayout';

interface Region { start: number; end: number }

type LoopDrag =
  | { kind: 'create'; anchor: number }
  | { kind: 'move'; grab: number; length: number }
  | { kind: 'start' | 'end'; origin: Region };

/** The loop bar's labels need this much room each; narrower, the less important ones go. */
const EDGE_LABEL_ROOM = 44;
const RANGE_LABEL_ROOM = 70;
/** A pointer that moved less than this was a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;

/** Keeps a drag's pointer events on the strip when the pointer leaves it (T58: a loop drag ended at the ruler's edge). */
function capture(e: ReactPointerEvent<HTMLElement>): void {
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer: nothing to capture */ }
}

function release(e: ReactPointerEvent<HTMLElement>): void {
  try {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  } catch { /* already released */ }
}

export interface TimelineRulerProps {
  minTime: number;
  maxTime: number;
  zoom: number;
  width: number;
  bars: ReadonlyArray<{ barNum: number; x: number }>;
  barWidth: number;
  /** Called with the region being dragged (for the lanes' shading), or null when the drag ends. */
  onPreview?: (region: Region | null) => void;
}

/** One snap step: a bar, a beat, or (free) the shortest loop. */
function snapUnit(tempo: number, mode: SnapMode): number {
  if (mode === 'bar') return barSeconds(tempo);
  if (mode === 'beat') return barSeconds(tempo) / 4;
  return MIN_LOOP_SECONDS;
}

/**
 * A region from a fixed edge and a moving one, ordered and never empty: an
 * edge that lands on the fixed one opens to one snap step past it. Only the
 * moving edge snaps, so resizing never shifts the other end.
 */
function regionFrom(fixed: number, movingTime: number, tempo: number, mode: SnapMode): Region {
  let moving = snapTime(movingTime, tempo, mode);
  if (Math.abs(moving - fixed) < MIN_LOOP_SECONDS) {
    const unit = snapUnit(tempo, mode);
    moving = movingTime >= fixed ? fixed + unit : Math.max(0, fixed - unit);
  }
  return { start: Math.min(fixed, moving), end: Math.max(fixed, moving) };
}

export function TimelineRuler({ minTime, maxTime, zoom, width, bars, barWidth, onPreview }: TimelineRulerProps) {
  const { state, dispatch } = useProject();
  const transport = useTransport();
  const tempo = state.tempo;
  const stored = loopRegionOf({ start: state.loopStart, end: state.loopEnd });

  const stripRef = useRef<HTMLDivElement | null>(null);
  const timeAt = useCallback((clientX: number): number => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect || zoom <= 0) return minTime;
    return Math.min(maxTime, Math.max(minTime, minTime + (clientX - rect.left) / zoom));
  }, [zoom, minTime, maxTime]);

  // ─── The loop strip ──────────────────────────────────────────────────────
  const drag = useRef<{ loop: LoopDrag; startX: number; moved: boolean } | null>(null);
  const [preview, setPreview] = useState<Region | null>(null);
  const show = (region: Region | null) => {
    setPreview(region);
    onPreview?.(region);
  };

  const regionFor = (loop: LoopDrag, clientX: number, modifiers: { shiftKey: boolean; altKey: boolean }): Region => {
    const mode = snapModeOf(modifiers);
    const t = timeAt(clientX);
    switch (loop.kind) {
      case 'create':
        return regionFrom(snapTime(loop.anchor, tempo, mode), t, tempo, mode);
      case 'move': {
        const start = snapTime(t - loop.grab, tempo, mode);
        return { start, end: start + loop.length };
      }
      case 'start':
        return regionFrom(loop.origin.end, t, tempo, mode);
      case 'end':
        return regionFrom(loop.origin.start, t, tempo, mode);
    }
  };

  const onStripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const part = (e.target as HTMLElement).closest('[data-loop-part]')?.getAttribute('data-loop-part');
    const t = timeAt(e.clientX);
    let loop: LoopDrag;
    if (stored && (part === 'start' || part === 'end')) loop = { kind: part, origin: stored };
    else if (stored && part === 'body') loop = { kind: 'move', grab: t - stored.start, length: stored.end - stored.start };
    else loop = { kind: 'create', anchor: t };
    drag.current = { loop, startX: e.clientX, moved: false };
    capture(e);
  };

  const onStripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    show(regionFor(d.loop, e.clientX, e));
  };

  const onStripUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    release(e);
    if (!d || !d.moved) {
      show(null);
      return;
    }
    const region = regionFor(d.loop, e.clientX, e);
    show(null);
    if (region.end - region.start < MIN_LOOP_SECONDS) return;
    dispatch({ type: 'SET_LOOP_REGION', payload: region });
    dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
    // Stopped, Play starts at a new loop, or at a moved one the playhead left.
    const at = transport.engine ? transport.engine.position() : state.currentTime;
    if (!state.isPlaying && (d.loop.kind === 'create' || at < region.start || at >= region.end)) {
      transport.seek(region.start);
    }
  };

  const onStripCancel = () => {
    drag.current = null;
    show(null);
  };

  // ─── Seeking and scrubbing on the bar numbers ────────────────────────────
  const scrubbing = useRef(false);
  const onNumbersDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    scrubbing.current = true;
    capture(e);
    // The handle is grabbed where it is; anywhere else, the playhead jumps there.
    if (!(e.target as HTMLElement).closest('[data-testid="playhead-handle"]')) transport.seek(timeAt(e.clientX));
  };
  const onNumbersMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) transport.seek(timeAt(e.clientX));
  };
  const onNumbersUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasScrubbing = scrubbing.current;
    scrubbing.current = false;
    release(e);
    // Stopped: the playhead lands on the nearest event, and it is selected (T10).
    if (!wasScrubbing || state.isPlaying) return;
    const event = nearestEvent(getEventTimeline(state), timeAt(e.clientX));
    if (event) dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
  };
  const onNumbersCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    scrubbing.current = false;
    release(e);
  };

  const shown = preview ?? stored;
  const active = !!preview || state.loopEnabled;
  const loopWidth = shown ? (shown.end - shown.start) * zoom : 0;
  const numbersHeight = BAR_HEADER_HEIGHT - LOOP_STRIP_HEIGHT;

  return (
    <div
      data-testid="timeline-ruler"
      className="sticky top-0 z-40 bg-[var(--bg-app)] border-b border-[var(--border-default)] select-none"
      style={{ height: BAR_HEADER_HEIGHT, width }}
    >
      {/* Loop strip */}
      <div
        ref={stripRef}
        data-testid="loop-strip"
        className="absolute left-0 right-0 top-0 cursor-crosshair border-b border-[var(--border-subtle)]"
        style={{ height: LOOP_STRIP_HEIGHT }}
        title="Drag to set a loop: it snaps to bars; hold Shift for beats, Alt for no snapping"
        onPointerDown={onStripDown}
        onPointerMove={onStripMove}
        onPointerUp={onStripUp}
        onPointerCancel={onStripCancel}
      >
        {!shown && (
          <span data-testid="loop-strip-hint" className="absolute left-1.5 top-0 text-[11px] leading-[17px] text-[var(--text-tertiary)] whitespace-nowrap pointer-events-none">
            Drag here to loop a passage
          </span>
        )}
        {shown && (
          <div
            data-testid="loop-bar"
            data-loop-part="body"
            data-active={active ? 'true' : 'false'}
            aria-label={`Loop ${formatBarRange(shown.start, shown.end, tempo)}, ${formatBarBeat(shown.start, tempo)} to ${formatBarBeat(shown.end, tempo)}${active ? '' : ' (Loop is off)'}`}
            className={`absolute top-[1px] flex items-center justify-between gap-1 rounded-sm cursor-grab overflow-hidden ${
              active
                ? 'bg-sky-500/35 border border-sky-300/80 text-sky-50'
                : 'bg-sky-500/10 border border-dashed border-sky-300/50 text-sky-200/80'
            }`}
            style={{ left: (shown.start - minTime) * zoom, width: Math.max(4, loopWidth), height: LOOP_STRIP_HEIGHT - 2 }}
            title={`Loop ${formatBarRange(shown.start, shown.end, tempo)} (${formatBarBeat(shown.start, tempo)}–${formatBarBeat(shown.end, tempo)}) · drag to move it, drag an end to resize it${active ? '' : ' · Loop is off'}`}
          >
            <span data-loop-part="start" data-testid="loop-start-handle" className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize" />
            <span data-loop-part="end" data-testid="loop-end-handle" className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize" />
            {loopWidth >= EDGE_LABEL_ROOM && (
              <span data-testid="loop-start-label" className="pl-1.5 text-[11px] leading-4 font-mono tabular-nums whitespace-nowrap pointer-events-none">
                {formatBarBeat(shown.start, tempo)}
              </span>
            )}
            {loopWidth >= 2 * EDGE_LABEL_ROOM + RANGE_LABEL_ROOM && (
              <span data-testid="timeline-loop-label" className="text-[11px] leading-4 whitespace-nowrap pointer-events-none">
                {formatBarRange(shown.start, shown.end, tempo)}
              </span>
            )}
            {loopWidth >= 2 * EDGE_LABEL_ROOM && (
              <span data-testid="loop-end-label" className="pr-1.5 text-[11px] leading-4 font-mono tabular-nums whitespace-nowrap pointer-events-none">
                {formatBarBeat(shown.end, tempo)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bar numbers: click to move the playhead, drag to scrub. */}
      <div
        data-testid="ruler-numbers"
        className="absolute left-0 right-0 bottom-0 cursor-pointer"
        style={{ height: numbersHeight }}
        title="Click to move the playhead (stopped, to the nearest event), or drag to scrub"
        onPointerDown={onNumbersDown}
        onPointerMove={onNumbersMove}
        onPointerUp={onNumbersUp}
        onPointerCancel={onNumbersCancel}
      >
        <div className="flex h-full" style={{ width }}>
          {bars.map(bar => (
            <div
              key={`bar-${bar.barNum}`}
              data-testid="ruler-bar"
              data-bar={bar.barNum}
              className="text-center text-pf-sm font-medium text-[var(--text-secondary)] border-l border-[var(--border-default)] flex items-end justify-center pb-0.5"
              style={{ width: barWidth, minWidth: barWidth, flexShrink: 0 }}
            >
              {bar.barNum}
            </div>
          ))}
        </div>
        <PlayheadHandle minTime={minTime} maxTime={maxTime} zoom={zoom} />
      </div>
    </div>
  );
}

/** The playhead's grab handle on the ruler, redrawn from the transport every frame while playing. */
function PlayheadHandle({ minTime, maxTime, zoom }: { minTime: number; maxTime: number; zoom: number }) {
  const position = useTransportPosition();
  const x = (Math.max(minTime, Math.min(maxTime, position)) - minTime) * zoom;
  return (
    <div
      data-testid="playhead-handle"
      aria-hidden="true"
      className="absolute top-0 w-3 h-2.5 -ml-1.5 cursor-grab z-10"
      style={{ left: x }}
      title="Drag to scrub"
    >
      <svg viewBox="0 0 12 10" className="w-3 h-2.5 block">
        <path d="M0 0 H12 L6 10 Z" fill="rgba(239, 68, 68, 0.9)" />
      </svg>
    </div>
  );
}
