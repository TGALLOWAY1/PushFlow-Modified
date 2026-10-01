/**
 * Route reducer (P9, S9.1).
 *
 * The Performance Route's edits, delegated from projectReducer. The route is
 * a document field, so each edit is one undo step (historyLabels.ts); it is
 * not an analysis input, so none of them marks the analysis stale, and none
 * touches a layout or a finger preference.
 *
 * Before the user edits anything the project has no route (null) and the
 * Route shows the detected one (derive.ts). The first edit adopts it and
 * applies the change in the same step, so a section the user renames from the
 * detected route keeps its bounds. Every result is normalized (sections and
 * mode spans tile the song), and an edit that changes nothing changes no
 * state: no undo step, no save.
 */

import { type ProjectState } from './projectState';
import {
  type BarRange,
  type PerformanceRoute,
  type PushMode,
  paintModeSpan,
  paintPerformed,
  SPAN_GRID,
} from '../../types/performanceRoute';
import { detectedRoute, routeInSync } from '../route/derive';
import { generateId } from '../../utils/idGenerator';
import { deepEqual } from '../../utils/deepEqual';

export type RouteAction =
  /** Takes the detected route as the project's own (the first edit does this too). */
  | { type: 'ROUTE_ADOPT_DETECTED' }
  /** Back to no route: the Route shows the detected one again. */
  | { type: 'ROUTE_CLEAR' }
  | { type: 'ROUTE_SET_SECTION_NAME'; payload: { sectionId: string; name: string } }
  | { type: 'ROUTE_SET_SECTION_TEXT'; payload: { sectionId: string; text: string } }
  /** Moves the boundary at the start of `sectionId` to `bar`, keeping both sections at least a bar long. */
  | { type: 'ROUTE_MOVE_BOUNDARY'; payload: { sectionId: string; bar: number } }
  /** Splits the section around `bar` there; the new section, after the bar, is "New section". */
  | { type: 'ROUTE_SPLIT_SECTION'; payload: { bar: number; newSectionId?: string } }
  /** Removes the boundary at the start of `sectionId`: the section before takes its bars. */
  | { type: 'ROUTE_MERGE_SECTION'; payload: { sectionId: string } }
  /** Sets the Push mode over a bar range (null: no mode set), painting over what was there. */
  | { type: 'ROUTE_SET_MODE_SPAN'; payload: BarRange & { mode: PushMode | null } }
  /**
   * Moves the ends of the mode span at `atBar` to [startBar, endBar): it paints
   * over what it grows into, and its neighbours take what it gives up.
   */
  | { type: 'ROUTE_SET_SPAN_ENDS'; payload: BarRange & { atBar: number } }
  /** Marks a lane performed by hand (or played from its clip) over a bar range. */
  | { type: 'ROUTE_SET_PERFORMED'; payload: BarRange & { laneId: string; performed: boolean } };

const ROUTE_ACTION_TYPES = new Set<string>([
  'ROUTE_ADOPT_DETECTED',
  'ROUTE_CLEAR',
  'ROUTE_SET_SECTION_NAME',
  'ROUTE_SET_SECTION_TEXT',
  'ROUTE_MOVE_BOUNDARY',
  'ROUTE_SPLIT_SECTION',
  'ROUTE_MERGE_SECTION',
  'ROUTE_SET_MODE_SPAN',
  'ROUTE_SET_SPAN_ENDS',
  'ROUTE_SET_PERFORMED',
]);

export function isRouteAction(type: string): boolean {
  return ROUTE_ACTION_TYPES.has(type);
}

/** The name a section split off by ROUTE_SPLIT_SECTION starts with. */
export const NEW_SECTION_NAME = 'New section';

const snapToGrid = (bar: number) => Math.round(bar / SPAN_GRID) * SPAN_GRID;
const validRange = (r: BarRange) => Number.isFinite(r.startBar) && Number.isFinite(r.endBar) && r.endBar > r.startBar;

/** `route` with the edit applied; the same route when the edit doesn't apply. Not normalized. */
function edited(route: PerformanceRoute, action: Exclude<RouteAction, { type: 'ROUTE_CLEAR' }>): PerformanceRoute {
  const { sections } = route;
  switch (action.type) {
    case 'ROUTE_ADOPT_DETECTED':
      return route;

    case 'ROUTE_SET_SECTION_NAME':
    case 'ROUTE_SET_SECTION_TEXT': {
      const key = action.type === 'ROUTE_SET_SECTION_NAME' ? 'name' : 'text';
      const value = action.type === 'ROUTE_SET_SECTION_NAME' ? action.payload.name : action.payload.text;
      return {
        ...route,
        sections: sections.map(s => (s.id === action.payload.sectionId ? { ...s, [key]: value } : s)),
      };
    }

    case 'ROUTE_MOVE_BOUNDARY': {
      const i = sections.findIndex(s => s.id === action.payload.sectionId);
      if (i <= 0 || !Number.isFinite(action.payload.bar)) return route;
      const before = sections[i - 1];
      const section = sections[i];
      const lo = before.startBar + 1;
      const hi = section.endBar - 1;
      if (lo > hi) return route;
      const bar = Math.min(hi, Math.max(lo, Math.round(action.payload.bar)));
      const next = [...sections];
      next[i - 1] = { ...before, endBar: bar };
      next[i] = { ...section, startBar: bar };
      return { ...route, sections: next };
    }

    case 'ROUTE_SPLIT_SECTION': {
      const bar = Math.round(action.payload.bar);
      const i = sections.findIndex(s => s.startBar < bar && bar < s.endBar);
      if (i < 0) return route;
      const taken = new Set(sections.map(s => s.id));
      const wanted = action.payload.newSectionId;
      const id = wanted && !taken.has(wanted) ? wanted : generateId('section');
      const next = [...sections];
      next.splice(i, 1,
        { ...sections[i], endBar: bar },
        { id, name: NEW_SECTION_NAME, text: '', startBar: bar, endBar: sections[i].endBar });
      return { ...route, sections: next };
    }

    case 'ROUTE_MERGE_SECTION': {
      const i = sections.findIndex(s => s.id === action.payload.sectionId);
      if (i <= 0) return route;
      const before = sections[i - 1];
      const section = sections[i];
      const next = [...sections];
      // The earlier section keeps its name and text; what it lacks it takes from the later one.
      next.splice(i - 1, 2, {
        ...before,
        endBar: section.endBar,
        name: before.name || section.name,
        text: before.text || section.text,
      });
      return { ...route, sections: next };
    }

    case 'ROUTE_SET_MODE_SPAN': {
      const range = { startBar: snapToGrid(action.payload.startBar), endBar: snapToGrid(action.payload.endBar) };
      if (!validRange(range)) return route;
      return { ...route, modeSpans: paintModeSpan(route.modeSpans, range, action.payload.mode) };
    }

    case 'ROUTE_SET_SPAN_ENDS': {
      const { atBar } = action.payload;
      const span = route.modeSpans.find(s => s.startBar <= atBar && atBar < s.endBar);
      const range = { startBar: snapToGrid(action.payload.startBar), endBar: snapToGrid(action.payload.endBar) };
      if (!span || !validRange(range)) return route;
      const modeEndingAt = (bar: number) => route.modeSpans.find(s => s.endBar === bar)?.mode ?? null;
      const modeStartingAt = (bar: number) => route.modeSpans.find(s => s.startBar === bar)?.mode ?? null;
      let spans = route.modeSpans;
      if (range.startBar > span.startBar) {
        spans = paintModeSpan(spans, { startBar: span.startBar, endBar: range.startBar }, modeEndingAt(span.startBar));
      }
      if (range.endBar < span.endBar) {
        spans = paintModeSpan(spans, { startBar: range.endBar, endBar: span.endBar }, modeStartingAt(span.endBar));
      }
      return { ...route, modeSpans: paintModeSpan(spans, range, span.mode) };
    }

    case 'ROUTE_SET_PERFORMED': {
      const { laneId, performed } = action.payload;
      const range = { startBar: snapToGrid(action.payload.startBar), endBar: snapToGrid(action.payload.endBar) };
      if (!validRange(range)) return route;
      return { ...route, performedSpans: paintPerformed(route.performedSpans, laneId, range, performed) };
    }
  }
}

export function routeReducer(state: ProjectState, action: RouteAction): ProjectState {
  const now = new Date().toISOString();
  if (action.type === 'ROUTE_CLEAR') {
    return state.performanceRoute === null ? state : { ...state, updatedAt: now, performanceRoute: null };
  }
  const current = state.performanceRoute;
  const base = current ?? detectedRoute(state);
  const next = routeInSync(edited(base, action), state);
  if (current ? deepEqual(next, current) : action.type !== 'ROUTE_ADOPT_DETECTED' && deepEqual(next, base)) {
    return state;
  }
  return { ...state, updatedAt: now, performanceRoute: next };
}

/**
 * The route kept valid after any other step (projectReducer): when the notes,
 * the tempo or the lanes change, the sections and mode spans re-tile the
 * song's bars, and performed spans of lanes that are gone go. A route that is
 * still valid is left as it is (the same object), and so is a missing one.
 */
export function withRouteInSync(prev: ProjectState, next: ProjectState): ProjectState {
  const route = next.performanceRoute;
  if (!route) return next;
  if (
    prev.performanceRoute === route
    && prev.soundStreams === next.soundStreams
    && prev.tempo === next.tempo
    && prev.performanceLanes === next.performanceLanes
    && prev.laneGroups === next.laneGroups
  ) return next;
  const synced = routeInSync(route, next);
  return deepEqual(synced, route) ? next : { ...next, performanceRoute: synced };
}
