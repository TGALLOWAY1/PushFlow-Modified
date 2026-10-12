/**
 * "What Ableton plays" (S9.2): the ruler and the arrangement lanes on the bar
 * axis.
 *
 * The ruler numbers bars as the position readout does, less densely as bars
 * narrow, and marks where each section starts. Each lane (a Sound group, or a
 * Sound in no group) draws its clips in grey and, where the performer plays
 * it by hand, an overlay in the Push mode's colour; its notes are density
 * bars or single notes by zoom (laneScene), and a note the Active Layout's
 * plan can't play stays drawn, outlined red. The lane names sit in the
 * gutter, with a live dot on the lanes performed at the playhead.
 */

import { useEffect, useMemo, useRef } from 'react';
import { type BarRange, type PerformanceRoute } from '../../types/performanceRoute';
import { type SoundStream } from '../state/projectState';
import { useTransportPosition } from '../audio/TransportProvider';
import { barSeconds } from '../../utils/musicalTime';
import { clipsFor, type RouteLane } from './derive';
import { type RouteAxis, laneScene, lanesLiveAt, rulerTicks, xOfBar } from './routeGeometry';
import { drawLanes, lanePalette } from './drawLanes';
import { ROUTE_GUTTER_WIDTH, ROUTE_LANE_HEIGHT, ROUTE_RULER_HEIGHT } from './routeLayout';

/** The playhead line, redrawn every frame. */
function Playhead({ axis, tempo, height, testId }: { axis: RouteAxis; tempo: number; height: number; testId: string }) {
  const bar = useTransportPosition() / barSeconds(tempo);
  const x = xOfBar(axis, bar);
  if (x < 0 || x > axis.width) return null;
  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className="absolute top-0 w-px bg-[var(--text-primary)] pointer-events-none"
      style={{ left: Math.round(x), height }}
    />
  );
}

export function RouteRuler({ axis, range, sections, tempo }: {
  axis: RouteAxis;
  range: BarRange;
  sections: PerformanceRoute['sections'];
  tempo: number;
}) {
  const ticks = rulerTicks(axis, range);
  return (
    <div data-testid="route-ruler" className="relative border-b border-[var(--border-default)]" style={{ width: axis.width, height: ROUTE_RULER_HEIGHT }}>
      {ticks.map(t => (
        <span key={t.bar} aria-hidden="true">
          <span
            className="absolute bottom-0 w-px bg-[var(--route-grid)]"
            style={{ left: Math.round(t.x), height: t.label ? 8 : 4 }}
          />
          {t.label && (
            <span
              data-testid="route-ruler-label"
              className="absolute top-0.5 font-mono text-pf-micro text-[var(--text-tertiary)] tabular-nums"
              style={{ left: Math.round(t.x) + 3 }}
            >
              {t.label}
            </span>
          )}
        </span>
      ))}
      {sections.slice(1).map(s => (
        <span
          key={s.id}
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-px bg-[var(--route-clip-edge)]"
          style={{ left: Math.round(xOfBar(axis, s.startBar)) }}
        />
      ))}
      <Playhead axis={axis} tempo={tempo} height={ROUTE_RULER_HEIGHT} testId="route-ruler-playhead" />
    </div>
  );
}

function LanesCanvas({ axis, height, scene, barLines, sectionLines }: {
  axis: RouteAxis;
  height: number;
  scene: ReturnType<typeof laneScene>;
  barLines: number[];
  sectionLines: number[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(axis.width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLanes(ctx, { scene, axis, height, barLines, sectionLines, palette: lanePalette() });
  }, [axis, height, scene, barLines, sectionLines]);
  const unplayable = scene.unplayableMarks;
  return (
    <canvas
      ref={ref}
      data-testid="route-lanes-canvas"
      data-detail={scene.detail}
      data-unplayable={unplayable}
      role="img"
      aria-label={`${scene.rows.length} lanes, drawn as ${scene.detail === 'notes' ? 'notes' : 'note density per bar'}${
        unplayable > 0 ? `; ${unplayable} ${scene.detail === 'notes' ? 'notes' : 'bars'} can’t be played as fingered` : ''
      }`}
      className="block"
      style={{ width: axis.width, height }}
    />
  );
}

export function RouteLanes({ axis, range, lanes, route, streams, tempo, unplayable, playheadBar }: {
  axis: RouteAxis;
  range: BarRange;
  lanes: readonly RouteLane[];
  route: PerformanceRoute;
  streams: readonly SoundStream[];
  tempo: number;
  unplayable: ReadonlySet<string>;
  /** The playhead's bar, for the live dots. */
  playheadBar: number;
}) {
  const clips = useMemo(
    () => new Map(lanes.map(l => [l.id, clipsFor(l, { soundStreams: streams as SoundStream[], tempo })])),
    [lanes, streams, tempo],
  );
  const scene = useMemo(
    () => laneScene({ axis, lanes, streams, tempo, route, clips, unplayable, laneHeight: ROUTE_LANE_HEIGHT }),
    [axis, lanes, streams, tempo, route, clips, unplayable],
  );
  const barLines = useMemo(() => {
    const lines: number[] = [];
    for (let b = Math.ceil(range.startBar); b <= range.endBar; b++) lines.push(b);
    return lines;
  }, [range]);
  const sectionLines = useMemo(() => route.sections.slice(1).map(s => s.startBar), [route.sections]);
  const live = lanesLiveAt(route, playheadBar);
  const height = Math.max(ROUTE_LANE_HEIGHT, lanes.length * ROUTE_LANE_HEIGHT);
  const dim = new Set(scene.rows.filter(r => r.dim).map(r => r.laneId));

  return (
    <div className="flex" style={{ height }}>
      <ul data-testid="route-lane-names" className="flex-shrink-0" style={{ width: ROUTE_GUTTER_WIDTH }}>
        {lanes.map(lane => (
          <li
            key={lane.id}
            data-testid="route-lane"
            data-lane-id={lane.id}
            data-performed={lane.performed ? 'true' : undefined}
            data-live={live.has(lane.id) ? 'true' : undefined}
            className="flex items-center gap-2 pr-3 border-b border-[var(--border-subtle)]"
            style={{ height: ROUTE_LANE_HEIGHT, opacity: dim.has(lane.id) ? 0.45 : 1 }}
            title={`${lane.name} · ${lane.soundIds.length} ${lane.soundIds.length === 1 ? 'Sound' : 'Sounds'} · ${
              lane.performed ? 'you perform it' : 'plays from clip'
            }`}
          >
            <span aria-hidden="true" className="w-2 h-5 rounded-sm flex-shrink-0" style={{ backgroundColor: lane.color }} />
            <span className="text-pf-xs text-[var(--text-primary)] truncate min-w-0 flex-1">{lane.name}</span>
            <span className="text-pf-micro font-semibold tracking-wider text-[var(--text-tertiary)] uppercase">{lane.kind}</span>
            <span
              {...(live.has(lane.id) ? { role: 'img', 'aria-label': 'Performed now' } : { 'aria-hidden': true })}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${live.has(lane.id) ? 'bg-[var(--status-ok)]' : 'bg-transparent'}`}
            />
          </li>
        ))}
      </ul>
      <div className="relative">
        <LanesCanvas axis={axis} height={height} scene={scene} barLines={barLines} sectionLines={sectionLines} />
        <Playhead axis={axis} tempo={tempo} height={height} testId="route-lanes-playhead" />
      </div>
    </div>
  );
}
