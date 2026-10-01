/**
 * PerformanceRoutePage (S9.2): the Performance Route at the Song level,
 * read-only. /project/:id/route, under ProjectShell, so it shares the
 * project, its history and the transport with the editor: playback carries
 * on across a switch between them.
 *
 * Top to bottom: the header; the zoom rail beside "What you do" (the route
 * line, the section cards, the Push-mode strip and badge, the legend) and
 * "What Ableton plays" (the ruler and the lanes); the transport bar. Every
 * row draws on one bar axis (routeGeometry.ts). The route shown is the
 * authored one, or the detected one until the user names sections
 * (derive.ts); the lanes mark what the Active Layout's own plan can't play
 * (R-D6). Nothing here writes to a layout or a finger preference.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../state/ProjectContext';
import { useTransport } from '../audio/TransportProvider';
import { useAutoSave } from '../hooks/useAutoSave';
import { useInputHandler } from '../input/inputRegistry';
import { stepSpeed } from '../audio/transportMath';
import { barSeconds } from '../../utils/musicalTime';
import { ShortcutSheet } from '../components/shared/ShortcutSheet';
import { useDisabledReason } from '../components/shared/DisabledReason';
import { displayedRoute, modeAt, routeLanes, songBarRange, DEFAULT_PHRASE_BARS } from '../route/derive';
import { type RouteAxis, sectionAt } from '../route/routeGeometry';
import { useActiveLayoutPlan, usePlayheadAt } from '../route/routeHooks';
import { setLiveRouteView } from '../route/liveRouteView';
import { RouteHeader, EDIT_ROUTE_REASON } from '../route/RouteHeader';
import { RouteRail } from '../route/RouteRail';
import { RouteLine, SectionCards, doneCount } from '../route/RouteBand';
import { ModeStrip, RouteLegend } from '../route/ModeStrip';
import { RouteLanes, RouteRuler } from '../route/RouteLanes';
import { RouteTransportBar, useLoopSong } from '../route/RouteTransportBar';
import { ROUTE_GUTTER_WIDTH } from '../route/routeLayout';

const LABEL = 'text-pf-micro font-semibold uppercase tracking-wider text-[var(--text-tertiary)]';

/** The Route's keys: playback and help only. It edits nothing, so Undo and Delete aren't bound here. */
function useRouteKeys({ onSave, onOpenShortcuts, onToggleLoop }: {
  onSave: () => void;
  onOpenShortcuts: () => void;
  onToggleLoop: () => void;
}) {
  const { state, dispatch } = useProject();
  const transport = useTransport();
  const rate = useRef(state.playbackRate);
  rate.current = state.playbackRate;
  useInputHandler('save', () => { onSave(); });
  useInputHandler('space', () => { dispatch({ type: 'TOGGLE_PLAYING' }); });
  useInputHandler('toggle-loop', () => { onToggleLoop(); });
  useInputHandler('change-speed', e => {
    const next = stepSpeed(rate.current, e.key === ']' ? 1 : -1);
    if (next !== rate.current) dispatch({ type: 'SET_PLAYBACK_RATE', payload: next });
  });
  useInputHandler('return-to-start', () => { transport.returnToStart(); });
  useInputHandler('shortcut-sheet', () => { onOpenShortcuts(); });
}

/** The width the bar axis has: the lanes' area less the gutter (and any scrollbar). */
function useAxisWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, Math.floor(el.clientWidth - ROUTE_GUTTER_WIDTH)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function PerformanceRoutePage() {
  const { state } = useProject();
  const navigate = useNavigate();
  const { saveNow } = useAutoSave(state);
  const [sheetOpen, setSheetOpen] = useState(false);
  const loop = useLoopSong();
  useRouteKeys({ onSave: saveNow, onOpenShortcuts: () => setSheetOpen(true), onToggleLoop: loop.toggle });

  const range = useMemo(() => songBarRange(state), [state.soundStreams, state.tempo]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = useMemo(
    () => displayedRoute(state),
    [state.performanceRoute, state.soundStreams, state.tempo, state.performanceLanes, state.laneGroups, state.activeLayout], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const lanes = useMemo(
    () => routeLanes(state),
    [state.soundStreams, state.performanceLanes, state.laneGroups, state.activeLayout, state.performanceRoute], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { unplayable } = useActiveLayoutPlan();

  const { ref: lanesRef, width } = useAxisWidth();
  const axis = useMemo<RouteAxis>(
    () => ({ startBar: range.startBar, spanBars: Math.max(1, range.endBar - range.startBar), width }),
    [range, width],
  );

  // The cards, the line and the live dots follow the playhead a beat at a time.
  const bar = barSeconds(state.tempo);
  const playheadBar = usePlayheadAt(bar / 4) / bar;
  const liveMode = modeAt(route.modeSpans, Math.min(playheadBar, range.endBar - 1e-6));
  const current = sectionAt(route.sections, playheadBar);

  useEffect(() => {
    setLiveRouteView({ level: 0, viewStart: range.startBar, viewSpan: range.endBar - range.startBar, editing: false });
    return () => setLiveRouteView(null);
  }, [range]);

  const detected = state.performanceRoute === null;
  // One visible reason, in the header, for every edit control that waits on edit mode.
  const editReason = useDisabledReason(EDIT_ROUTE_REASON);
  const songBars = range.endBar - range.startBar;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const captions = [
    plural(songBars, 'bar'),
    current ? plural(current.endBar - current.startBar, 'bar') : '',
    plural(DEFAULT_PHRASE_BARS, 'bar'),
    '1 bar',
    '1 press',
  ];
  const grid = { display: 'grid', gridTemplateColumns: `${ROUTE_GUTTER_WIDTH}px minmax(0, 1fr)` } as const;
  const ready = width > 0;

  return (
    <div data-testid="route-page" className="h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      <RouteHeader bars={range} onBack={() => navigate(`/project/${state.id}`)} editReasonId={editReason.id} />

      <div className="flex-1 min-h-0 flex">
        <RouteRail level={0} captions={captions} />

        <main className="flex-1 min-w-0 flex flex-col gap-4 px-4 py-3 overflow-hidden">
          <section aria-label="What you do" className="flex-shrink-0 flex flex-col gap-1.5">
            <div style={grid} className="items-center">
              <h2 className={LABEL}>What you do</h2>
              {ready && <RouteLine axis={axis} sections={route.sections} playheadBar={playheadBar} />}
            </div>
            <div style={grid}>
              <div className="flex flex-col gap-1.5 pr-3">
                <span data-testid="route-done-count" className="text-pf-xs text-[var(--text-secondary)] tabular-nums">
                  {doneCount(route.sections, playheadBar)}
                </span>
                {detected && (
                  <>
                    <span data-testid="route-detected" className="text-pf-micro text-[var(--text-tertiary)]">
                      Found from silences
                    </span>
                    <button
                      type="button"
                      data-testid="route-name-sections"
                      disabled
                      aria-describedby={editReason.id}
                      title={EDIT_ROUTE_REASON}
                      className="pf-btn pf-btn-subtle h-8 text-pf-xs font-semibold uppercase tracking-wider self-start"
                    >
                      Name sections
                    </button>
                  </>
                )}
              </div>
              {ready && <SectionCards axis={axis} route={route} playheadBar={playheadBar} liveMode={liveMode} />}
            </div>
            <div style={grid} className="items-center mt-1">
              <h2 className={LABEL}>Push mode</h2>
              {ready && <ModeStrip axis={axis} spans={route.modeSpans} playheadBar={playheadBar} />}
            </div>
            <div style={grid}>
              <span />
              <RouteLegend liveMode={liveMode} />
            </div>
          </section>

          <section aria-label="What Ableton plays" className="flex-1 min-h-0 flex flex-col gap-1">
            <div style={grid} className="items-end">
              <h2 className={LABEL}>What Ableton plays</h2>
              {ready && <RouteRuler axis={axis} range={range} sections={route.sections} tempo={state.tempo} />}
            </div>
            <div ref={lanesRef} data-testid="route-lanes" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {ready && (
                <RouteLanes
                  axis={axis}
                  range={range}
                  lanes={lanes}
                  route={route}
                  streams={state.soundStreams}
                  tempo={state.tempo}
                  unplayable={unplayable}
                  playheadBar={playheadBar}
                />
              )}
              {lanes.length === 0 && (
                <p className="text-pf-sm text-[var(--text-tertiary)] py-4">No Sounds yet: import a MIDI file in the editor.</p>
              )}
            </div>
          </section>
        </main>
      </div>

      <RouteTransportBar onOpenShortcuts={() => setSheetOpen(true)} />
      {sheetOpen && <ShortcutSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
