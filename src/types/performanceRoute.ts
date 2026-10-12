/**
 * Performance Route (P9, S9.1).
 *
 * The project's authored plan of what the performer does over the song:
 * named sections with "what you do" text, which Push mode they are in, and
 * which arrangement lanes they play by hand. One per project, bound to the one
 * performance timeline and independent of which layout is active. It is
 * document truth (saved, one undo step per edit) but never an analysis input:
 * nothing here moves a Sound, changes a fingering or marks the analysis stale.
 *
 * Positions are absolute bars counted the way the position readout counts
 * them, 0-based: bar 0 starts at time 0, so the readout's "3.1.1" is bar 2.
 * Ranges are half-open, [startBar, endBar). Sections sit on whole bars; mode
 * and performed spans on sixteenths of a bar (SPAN_GRID), so a quarter-beat of
 * Control presses between two modes is a span of its own. Sections and mode
 * spans tile the song's bar range (songBarRange in ui/route/derive.ts) with no
 * gap or overlap; normalizeRoute keeps them so.
 */

/** The Push 3 modes a performer can be in. */
export const PUSH_MODES = ['session', 'instrument', 'drum', 'fx', 'control'] as const;
export type PushMode = typeof PUSH_MODES[number];

export const PUSH_MODE_LABELS: Record<PushMode, string> = {
  session: 'Session View',
  instrument: 'Instrument',
  drum: 'Drum Rack',
  fx: 'FX / Device',
  control: 'Control',
};

/** Short forms for narrow spans and sequence pills ("DRM → INS"). */
export const PUSH_MODE_ABBREVIATIONS: Record<PushMode, string> = {
  session: 'SES',
  instrument: 'INS',
  drum: 'DRM',
  fx: 'FX',
  control: 'CTL',
};

export function isPushMode(value: unknown): value is PushMode {
  return typeof value === 'string' && (PUSH_MODES as readonly string[]).includes(value);
}

/** Mode and performed spans snap to sixteenths of a bar. */
export const SPAN_GRID = 1 / 16;

/** A half-open bar range, [startBar, endBar). */
export interface BarRange {
  startBar: number;
  endBar: number;
}

/** A named bar range with what the performer does in it. */
export interface RouteSection extends BarRange {
  id: string;
  /** As typed; the Route shows it in capitals. Empty shows a placeholder. */
  name: string;
  /** "What you do here"; empty shows the italic placeholder. */
  text: string;
}

/** The Push mode over a bar range; null is "no mode set". */
export interface ModeSpan extends BarRange {
  mode: PushMode | null;
}

/** Where the performer plays a lane by hand rather than letting its clip play. */
export interface PerformedSpan extends BarRange {
  /** A route lane id (laneIdOfGroup / laneIdOfSound). */
  laneId: string;
}

/** Per-lane facts the material can't give. Every lane is 'midi' in v1; 'audio' is for a later Live Set import. */
export interface RouteLaneMeta {
  laneId: string;
  kind: 'midi' | 'audio';
}

export interface PerformanceRoute {
  version: 1;
  sections: RouteSection[];
  modeSpans: ModeSpan[];
  performedSpans: PerformedSpan[];
  lanes: RouteLaneMeta[];
}

/** A route lane is a Sound group, or a Sound in no group. */
export function laneIdOfGroup(groupId: string): string {
  return `group:${groupId}`;
}

export function laneIdOfSound(soundId: string): string {
  return `sound:${soundId}`;
}

// ============================================================================
// Normalization
// ============================================================================

const snap = (bar: number, grid: number) => Math.round(bar / grid) * grid;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Items laid end to end over `range`, sorted, clipped, with overlaps cut
 * (the earlier item keeps the shared bars) and empty items dropped. Gaps are
 * left for the caller to fill.
 */
function clipped<T extends BarRange>(items: readonly T[], range: BarRange, grid: number): T[] {
  const out: T[] = [];
  const sorted = items
    .filter(i => Number.isFinite(i.startBar) && Number.isFinite(i.endBar))
    .map(i => ({ ...i, startBar: snap(i.startBar, grid), endBar: snap(i.endBar, grid) }))
    .sort((a, b) => a.startBar - b.startBar);
  let floor = range.startBar;
  for (const item of sorted) {
    const startBar = clamp(Math.max(item.startBar, floor), range.startBar, range.endBar);
    const endBar = clamp(item.endBar, range.startBar, range.endBar);
    if (endBar <= startBar) continue;
    out.push({ ...item, startBar, endBar });
    floor = endBar;
  }
  return out;
}

/**
 * Sections tiling `range`: each section runs to the next one's start, the
 * first starts at the range's start and the last ends at its end, so when the
 * material grows the first and last sections stretch to the new edges, and
 * sections the material no longer reaches go. At least one section remains
 * (the first, stretched over the whole range).
 */
function tiledSections(sections: readonly RouteSection[], range: BarRange): RouteSection[] {
  const kept = clipped(sections, range, 1);
  if (kept.length === 0) {
    const first = sections[0];
    return [{ id: first?.id ?? 'section-1', name: first?.name ?? '', text: first?.text ?? '', ...range }];
  }
  return kept.map((s, i) => ({
    ...s,
    startBar: i === 0 ? range.startBar : s.startBar,
    endBar: i === kept.length - 1 ? range.endBar : kept[i + 1].startBar,
  }));
}

/** Mode spans tiling `range`: gaps (new bars included) are "no mode set", and neighbours with one mode merge. */
function tiledModeSpans(spans: readonly ModeSpan[], range: BarRange): ModeSpan[] {
  const out: ModeSpan[] = [];
  const push = (span: ModeSpan) => {
    const last = out[out.length - 1];
    if (last && last.mode === span.mode && last.endBar === span.startBar) last.endBar = span.endBar;
    else out.push({ ...span });
  };
  let at = range.startBar;
  for (const span of clipped(spans, range, SPAN_GRID)) {
    if (span.startBar > at) push({ startBar: at, endBar: span.startBar, mode: null });
    push({ startBar: span.startBar, endBar: span.endBar, mode: span.mode });
    at = span.endBar;
  }
  if (at < range.endBar) push({ startBar: at, endBar: range.endBar, mode: null });
  return out;
}

/** Performed spans inside `range`, per live lane, merged where they touch or overlap. */
function mergedPerformedSpans(
  spans: readonly PerformedSpan[],
  range: BarRange,
  liveLaneIds: ReadonlySet<string> | null,
): PerformedSpan[] {
  const byLane = new Map<string, BarRange[]>();
  for (const span of spans) {
    if (liveLaneIds && !liveLaneIds.has(span.laneId)) continue;
    if (!Number.isFinite(span.startBar) || !Number.isFinite(span.endBar)) continue;
    const startBar = clamp(snap(span.startBar, SPAN_GRID), range.startBar, range.endBar);
    const endBar = clamp(snap(span.endBar, SPAN_GRID), range.startBar, range.endBar);
    if (endBar <= startBar) continue;
    const list = byLane.get(span.laneId) ?? [];
    list.push({ startBar, endBar });
    byLane.set(span.laneId, list);
  }
  const out: PerformedSpan[] = [];
  for (const [laneId, list] of byLane) {
    for (const r of mergeRanges(list)) out.push({ laneId, ...r });
  }
  return out.sort((a, b) => (a.laneId < b.laneId ? -1 : a.laneId > b.laneId ? 1 : a.startBar - b.startBar));
}

/** Ranges sorted, with overlapping ones, touching ones and those at most `maxGap` bars apart merged. */
export function mergeRanges(ranges: readonly BarRange[], maxGap = 0): BarRange[] {
  const sorted = [...ranges].sort((a, b) => a.startBar - b.startBar);
  const out: BarRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.startBar - last.endBar <= maxGap) last.endBar = Math.max(last.endBar, r.endBar);
    else out.push({ startBar: r.startBar, endBar: r.endBar });
  }
  return out;
}

/**
 * The route made valid for a song spanning `range`: sections on whole bars and
 * mode spans on sixteenths, both tiling the range in order with no gap or
 * overlap; performed spans inside it, merged per lane, and only for lanes in
 * `liveLaneIds` (when given; lane metadata likewise). Pure; a valid route
 * comes back equal (not necessarily the same object).
 */
export function normalizeRoute(
  route: PerformanceRoute,
  range: BarRange,
  liveLaneIds: ReadonlySet<string> | null = null,
): PerformanceRoute {
  const seen = new Set<string>();
  return {
    version: 1,
    sections: tiledSections(route.sections, range),
    modeSpans: tiledModeSpans(route.modeSpans, range),
    performedSpans: mergedPerformedSpans(route.performedSpans, range, liveLaneIds),
    lanes: route.lanes.filter(l => {
      if (seen.has(l.laneId) || (liveLaneIds && !liveLaneIds.has(l.laneId))) return false;
      seen.add(l.laneId);
      return true;
    }),
  };
}

/**
 * Why `route` is not a valid route over `range`, or null when it is: the
 * checks normalizeRoute's output always passes.
 */
export function routeProblem(route: PerformanceRoute, range: BarRange): string | null {
  const tiles = (items: readonly BarRange[], what: string, grid: number): string | null => {
    if (items.length === 0) return `no ${what}`;
    let at = range.startBar;
    for (const item of items) {
      if (item.endBar <= item.startBar) return `${what}: reversed or empty bounds at bar ${item.startBar}`;
      if (snap(item.startBar, grid) !== item.startBar || snap(item.endBar, grid) !== item.endBar) {
        return `${what}: off the grid at bar ${item.startBar}`;
      }
      if (item.startBar < at) return `${what}: overlap at bar ${item.startBar}`;
      if (item.startBar > at) return `${what}: gap at bar ${at}`;
      at = item.endBar;
    }
    return at === range.endBar ? null : `${what}: ends at bar ${at}, not ${range.endBar}`;
  };
  return tiles(route.sections, 'sections', 1) ?? tiles(route.modeSpans, 'mode spans', SPAN_GRID);
}

// ============================================================================
// Edits shared by the reducer
// ============================================================================

/**
 * `spans` with [startBar, endBar) set to `mode`, painting over whatever was
 * there. Not normalized: neighbours with the same mode merge in normalizeRoute.
 */
export function paintModeSpan(spans: readonly ModeSpan[], range: BarRange, mode: PushMode | null): ModeSpan[] {
  const out: ModeSpan[] = [];
  for (const span of spans) {
    if (span.endBar <= range.startBar || span.startBar >= range.endBar) { out.push(span); continue; }
    if (span.startBar < range.startBar) out.push({ ...span, endBar: range.startBar });
    if (span.endBar > range.endBar) out.push({ ...span, startBar: range.endBar });
  }
  out.push({ startBar: range.startBar, endBar: range.endBar, mode });
  return out.sort((a, b) => a.startBar - b.startBar);
}

/** `spans` with `laneId` performed (or not) over `range`. Not normalized. */
export function paintPerformed(
  spans: readonly PerformedSpan[],
  laneId: string,
  range: BarRange,
  performed: boolean,
): PerformedSpan[] {
  const out: PerformedSpan[] = [];
  for (const span of spans) {
    if (span.laneId !== laneId || span.endBar <= range.startBar || span.startBar >= range.endBar) { out.push(span); continue; }
    if (span.startBar < range.startBar) out.push({ ...span, endBar: range.startBar });
    if (span.endBar > range.endBar) out.push({ ...span, startBar: range.endBar });
  }
  if (performed) out.push({ laneId, ...range });
  return out;
}

/**
 * Every bound of the route times `factor`, snapped back to its grid. Until
 * notes are stored in beats (S5.3), a tempo change keeps notes at their
 * seconds and so moves them to other bars; scaling by newTempo / oldTempo
 * keeps each boundary with the notes it was on. S5.3 deletes this.
 */
export function rescaleRoute(route: PerformanceRoute, factor: number): PerformanceRoute {
  const scale = <T extends BarRange>(item: T, grid: number): T => ({
    ...item,
    startBar: snap(item.startBar * factor, grid),
    endBar: snap(item.endBar * factor, grid),
  });
  return {
    ...route,
    sections: route.sections.map(s => scale(s, 1)),
    modeSpans: route.modeSpans.map(s => scale(s, SPAN_GRID)),
    performedSpans: route.performedSpans.map(s => scale(s, SPAN_GRID)),
  };
}

// ============================================================================
// Stored shape
// ============================================================================

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isBar = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A stored route as the app keeps it, or null when there is none (never
 * authored, or not a route at all). Malformed items and repeated section ids
 * are dropped; the bounds are made valid against the song by normalizeRoute
 * when the project loads.
 */
export function performanceRouteOf(raw: unknown): PerformanceRoute | null {
  if (!isObject(raw) || !Array.isArray(raw.sections)) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);
  const ids = new Set<string>();
  const sections = list(raw.sections)
    // Each section once by id, so an edit never reaches two.
    .filter(s => typeof s.id === 'string' && isBar(s.startBar) && isBar(s.endBar) && !ids.has(s.id) && !!ids.add(s.id))
    .map(s => ({
      id: s.id as string,
      name: typeof s.name === 'string' ? s.name : '',
      text: typeof s.text === 'string' ? s.text : '',
      startBar: s.startBar as number,
      endBar: s.endBar as number,
    }));
  if (sections.length === 0) return null;
  return {
    version: 1,
    sections,
    modeSpans: list(raw.modeSpans)
      .filter(s => isBar(s.startBar) && isBar(s.endBar) && (s.mode === null || isPushMode(s.mode)))
      .map(s => ({ startBar: s.startBar as number, endBar: s.endBar as number, mode: s.mode as PushMode | null })),
    performedSpans: list(raw.performedSpans)
      .filter(s => typeof s.laneId === 'string' && isBar(s.startBar) && isBar(s.endBar))
      .map(s => ({ laneId: s.laneId as string, startBar: s.startBar as number, endBar: s.endBar as number })),
    lanes: list(raw.lanes)
      .filter(l => typeof l.laneId === 'string' && (l.kind === 'midi' || l.kind === 'audio'))
      .map(l => ({ laneId: l.laneId as string, kind: l.kind as RouteLaneMeta['kind'] })),
  };
}
