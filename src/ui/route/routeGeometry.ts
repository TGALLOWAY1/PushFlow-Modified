/**
 * Where things go on the Performance Route (S9.2). Pure.
 *
 * Every row of the Route (the route line, the section cards, the Push-mode
 * strip, the ruler and the lanes) draws on one bar axis, so a bar is at the
 * same x in all of them. The lanes' picture is worked out here as a list of
 * primitives (laneScene), which the canvas draws (drawLanes.ts) and the tests
 * read, since a canvas can't be inspected.
 */

import { type BarRange, type ModeSpan, type PerformanceRoute, type PushMode, type RouteSection } from '../../types/performanceRoute';
import { type SoundStream } from '../state/projectState';
import { barSeconds } from '../../utils/musicalTime';
import { type RouteLane } from './derive';

// ============================================================================
// The bar axis
// ============================================================================

/** The bars on screen and the width they fill, in px. */
export interface RouteAxis {
  startBar: number;
  spanBars: number;
  width: number;
}

export function xOfBar(axis: RouteAxis, bar: number): number {
  return ((bar - axis.startBar) / axis.spanBars) * axis.width;
}

export function pxPerBar(axis: RouteAxis): number {
  return axis.width / axis.spanBars;
}

/** The x extent of a bar range, inside the axis. */
export function spanX(axis: RouteAxis, range: BarRange): { x: number; w: number } {
  const x0 = Math.max(0, xOfBar(axis, range.startBar));
  const x1 = Math.min(axis.width, xOfBar(axis, range.endBar));
  return { x: x0, w: Math.max(0, x1 - x0) };
}

// ============================================================================
// Section cards
// ============================================================================

export type SectionState = 'done' | 'active' | 'upcoming';

/** A section's state at the playhead: played through, playing, or still ahead. */
export function sectionState(section: BarRange, playheadBar: number): SectionState {
  if (playheadBar >= section.endBar) return 'done';
  if (playheadBar >= section.startBar) return 'active';
  return 'upcoming';
}

/** The Push modes in a section, in the order they come, each once; no mode set is left out. */
export function sectionModes(section: BarRange, modeSpans: readonly ModeSpan[]): PushMode[] {
  const modes: PushMode[] = [];
  for (const span of modeSpans) {
    if (span.endBar <= section.startBar || span.startBar >= section.endBar || span.mode === null) continue;
    if (!modes.includes(span.mode)) modes.push(span.mode);
  }
  return modes;
}

/**
 * How much a card of this width shows (design: 220 / 150 / 92 / 58 / 30 px):
 * mode pills with names, then abbreviations, then glyphs, then one glyph,
 * then only its state; under 30 px nothing, with the tooltip saying it all.
 */
export type CardDetail = 'full' | 'abbr' | 'glyphs' | 'glyph' | 'state' | 'none';

export function cardDetail(width: number): CardDetail {
  if (width >= 220) return 'full';
  if (width >= 150) return 'abbr';
  if (width >= 92) return 'glyphs';
  if (width >= 58) return 'glyph';
  if (width >= 30) return 'state';
  return 'none';
}

/** "Bars 3–10" for a bar range: 1-based, the end inclusive, as the position readout counts. */
export function barRangeLabel(range: BarRange): string {
  const first = Math.floor(range.startBar) + 1;
  const last = Math.max(first, Math.ceil(range.endBar));
  return first === last ? `Bar ${first}` : `Bars ${first}–${last}`;
}

/** The section the playhead is in; the first before the song, the last after it. */
export function sectionAt(sections: readonly RouteSection[], bar: number): RouteSection | null {
  if (sections.length === 0) return null;
  return sections.find(s => s.startBar <= bar && bar < s.endBar)
    ?? (bar < sections[0].startBar ? sections[0] : sections[sections.length - 1]);
}

// ============================================================================
// The ruler
// ============================================================================

/** Bars between numbered ticks: the smallest of 1, 2, 4, 8… that leaves at least `minGap` px between labels. */
export function barLabelStep(axis: RouteAxis, minGap = 40): number {
  const ppb = pxPerBar(axis);
  let step = 1;
  while (step * ppb < minGap && step < 1024) step *= 2;
  return step;
}

export interface RulerTick {
  bar: number;
  x: number;
  /** The readout's bar number (1-based) on numbered ticks; null on the others. */
  label: string | null;
}

/** A tick on every bar line of the range, numbered every barLabelStep bars counted from bar 1. */
export function rulerTicks(axis: RouteAxis, range: BarRange): RulerTick[] {
  const step = barLabelStep(axis);
  const ticks: RulerTick[] = [];
  for (let bar = Math.ceil(range.startBar); bar <= range.endBar; bar++) {
    ticks.push({ bar, x: xOfBar(axis, bar), label: bar % step === 0 && bar < range.endBar ? String(bar + 1) : null });
  }
  return ticks;
}

// ============================================================================
// The lanes
// ============================================================================

/** Lanes switch from a density bar per bar to single notes at this many px per bar. */
export const NOTES_LOD_PX_PER_BAR = 50;

export type LaneDetail = 'density' | 'notes';

export function laneDetail(axis: RouteAxis): LaneDetail {
  return pxPerBar(axis) >= NOTES_LOD_PX_PER_BAR ? 'notes' : 'density';
}

/** One thing the canvas draws, in px inside the lanes area. */
export type LanePrimitive =
  | { kind: 'clip'; laneId: string; x: number; y: number; w: number; h: number }
  /** Where the lane is performed by hand: the mode's colour (null: no mode set). */
  | { kind: 'performed'; laneId: string; x: number; y: number; w: number; h: number; mode: PushMode | null }
  /** A bar's notes, as one bar as tall as how many there are. */
  | { kind: 'density'; laneId: string; x: number; y: number; w: number; h: number; unplayable: boolean }
  | { kind: 'note'; laneId: string; soundId: string; eventKey: string; x: number; y: number; w: number; h: number; unplayable: boolean };

export interface LaneRowLayout {
  laneId: string;
  y: number;
  h: number;
  /** Nothing in the lane is performed on screen: drawn at 45 %. */
  dim: boolean;
}

export interface LaneScene {
  detail: LaneDetail;
  rows: LaneRowLayout[];
  primitives: LanePrimitive[];
  /** How many notes (or bars, at the density level) are drawn as unplayable. */
  unplayableMarks: number;
}

export interface LaneSceneInput {
  axis: RouteAxis;
  lanes: readonly RouteLane[];
  streams: readonly SoundStream[];
  tempo: number;
  route: PerformanceRoute;
  /** Each lane's clips (clipsFor), by lane id. */
  clips: ReadonlyMap<string, readonly BarRange[]>;
  /** Notes the Active Layout's plan can't play, by eventKey. */
  unplayable: ReadonlySet<string>;
  laneHeight: number;
}

const LANE_PAD = 4;
/** The tallest a note mark gets. */
const NOTE_MARK_HEIGHT = 10;

/**
 * The lanes' picture: per lane its clips, the performed overlay in each Push
 * mode's colour, and its notes. Zoomed out, a bar of notes is one density bar
 * (the busiest bar of any lane fills its lane); from NOTES_LOD_PX_PER_BAR,
 * each note is drawn on its Sound's row. A note the plan can't play keeps its
 * place, outlined red (invariant 4: nothing is hidden); at the density level
 * its bar is.
 */
export function laneScene(input: LaneSceneInput): LaneScene {
  const { axis, lanes, streams, tempo, route, clips, unplayable, laneHeight } = input;
  const detail = laneDetail(axis);
  const bar = barSeconds(tempo);
  const view: BarRange = { startBar: axis.startBar, endBar: axis.startBar + axis.spanBars };
  const byId = new Map(streams.map(s => [s.id, s]));
  const rows: LaneRowLayout[] = [];
  const primitives: LanePrimitive[] = [];
  let unplayableMarks = 0;

  // The busiest bar of any lane, so density reads the same across lanes.
  const counts = new Map<string, Map<number, { n: number; unplayable: boolean }>>();
  let busiest = 1;
  for (const lane of lanes) {
    const perBar = new Map<number, { n: number; unplayable: boolean }>();
    for (const id of lane.soundIds) {
      for (const e of byId.get(id)?.events ?? []) {
        const b = Math.floor(e.startTime / bar + 1e-6);
        const cell = perBar.get(b) ?? { n: 0, unplayable: false };
        cell.n++;
        cell.unplayable ||= unplayable.has(e.eventKey);
        perBar.set(b, cell);
        busiest = Math.max(busiest, cell.n);
      }
    }
    counts.set(lane.id, perBar);
  }

  lanes.forEach((lane, i) => {
    const y = i * laneHeight;
    const inner = { y: y + LANE_PAD, h: laneHeight - LANE_PAD * 2 };
    const performed = route.performedSpans.filter(s => s.laneId === lane.id);
    rows.push({
      laneId: lane.id,
      y,
      h: laneHeight,
      dim: !performed.some(s => s.endBar > view.startBar && s.startBar < view.endBar),
    });

    for (const clip of clips.get(lane.id) ?? []) {
      const { x, w } = spanX(axis, clip);
      if (w > 0) primitives.push({ kind: 'clip', laneId: lane.id, x, y: inner.y, w, h: inner.h });
    }

    // The performed overlay, cut where the Push mode changes.
    for (const span of performed) {
      for (const mode of route.modeSpans) {
        const startBar = Math.max(span.startBar, mode.startBar);
        const endBar = Math.min(span.endBar, mode.endBar);
        if (endBar <= startBar) continue;
        const { x, w } = spanX(axis, { startBar, endBar });
        if (w > 0) primitives.push({ kind: 'performed', laneId: lane.id, x, y: inner.y, w, h: inner.h, mode: mode.mode });
      }
    }

    if (detail === 'density') {
      const ppb = pxPerBar(axis);
      for (const [b, cell] of counts.get(lane.id) ?? []) {
        if (b + 1 <= view.startBar || b >= view.endBar) continue;
        const h = Math.max(2, (cell.n / busiest) * (inner.h - 2));
        primitives.push({
          kind: 'density',
          laneId: lane.id,
          x: xOfBar(axis, b) + ppb * 0.15,
          y: inner.y + inner.h - h,
          w: Math.max(1, ppb * 0.7),
          h,
          unplayable: cell.unplayable,
        });
        if (cell.unplayable) unplayableMarks++;
      }
      return;
    }

    // Notes: one row per Sound of the lane, each a slim mark centred in its
    // row so the performed overlay behind it stays visible.
    const rowH = inner.h / Math.max(1, lane.soundIds.length);
    const markH = Math.max(2, Math.min(NOTE_MARK_HEIGHT, rowH - 2));
    lane.soundIds.forEach((soundId, r) => {
      for (const e of byId.get(soundId)?.events ?? []) {
        const start = e.startTime / bar;
        const end = (e.startTime + e.duration) / bar;
        if (end <= view.startBar || start >= view.endBar) continue;
        const x = xOfBar(axis, start);
        const isUnplayable = unplayable.has(e.eventKey);
        primitives.push({
          kind: 'note',
          laneId: lane.id,
          soundId,
          eventKey: e.eventKey,
          x,
          y: inner.y + r * rowH + (rowH - markH) / 2,
          w: Math.max(3, xOfBar(axis, end) - x),
          h: markH,
          unplayable: isUnplayable,
        });
        if (isUnplayable) unplayableMarks++;
      }
    });
  });

  return { detail, rows, primitives, unplayableMarks };
}

/** The lanes performed by hand at `bar` (the live dot). */
export function lanesLiveAt(route: PerformanceRoute, bar: number): Set<string> {
  return new Set(route.performedSpans.filter(s => s.startBar <= bar && bar < s.endBar).map(s => s.laneId));
}
