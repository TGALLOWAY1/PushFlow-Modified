/**
 * What the Performance Route derives from the project (P9, S9.1).
 *
 * Pure. Only the route itself is stored (performanceRoute.ts); everything here
 * is worked out from the material, the lane groups and the Active Layout at
 * render time and never saved: the route lanes, their clips, the detected
 * default route shown before the user names anything, and the phrases and
 * actions the Route zooms through.
 *
 * Bars are absolute and 0-based, as in performanceRoute.ts.
 */

import { type ProjectState } from '../state/projectState';
import {
  type BarRange,
  type ModeSpan,
  type PerformanceRoute,
  type PerformedSpan,
  type PushMode,
  type RouteSection,
  laneIdOfGroup,
  laneIdOfSound,
  mergeRanges,
  normalizeRoute,
} from '../../types/performanceRoute';
import { songSpan } from '../audio/transportMath';
import { barSeconds } from '../../utils/musicalTime';
import { orderSounds, soundGroupIds, sortedGroups } from '../state/soundOrder';

/** A silence this long (seconds, from the last note's end to the next note) starts a detected section. */
export const SILENCE_SECONDS = 2;

/** A detected section is at least this long; shorter ones join the one before. */
export const MIN_DETECTED_SECTION_BARS = 4;

/** Bars with notes form one clip until at least this many empty bars come between. */
export const CLIP_GAP_BARS = 2;

/** Phrases are this many bars unless the caller knows better. */
export const DEFAULT_PHRASE_BARS = 4;

type RouteInputs = Pick<
  ProjectState,
  'soundStreams' | 'tempo' | 'performanceLanes' | 'laneGroups' | 'activeLayout' | 'performanceRoute'
>;

/**
 * The song's bars: the transport's song span (songSpan) in bars, from the
 * bar holding the first note to the bar after the last note ends. Leading
 * rest bars are outside it, as they are outside playback.
 */
export function songBarRange(state: Pick<ProjectState, 'soundStreams' | 'tempo'>): BarRange {
  const span = songSpan(state.soundStreams, state.tempo);
  const bar = barSeconds(state.tempo);
  return { startBar: Math.round(span.start / bar), endBar: Math.round(span.end / bar) };
}

// ============================================================================
// Lanes and clips
// ============================================================================

/** A track as the Route draws it: a Sound group, or a Sound in no group. */
export interface RouteLane {
  id: string;
  name: string;
  color: string;
  kind: 'midi' | 'audio';
  /** Its Sounds, in the one order (soundOrder.ts). */
  soundIds: string[];
  /**
   * Whether the performer plays it by hand by default: one of its Sounds is
   * placed on the Active Layout and in the analysis. Read from the Layout,
   * never from a lane's name.
   */
  performed: boolean;
}

/** Every route lane, in the Sounds panel's order: each group with Sounds, then each ungrouped Sound. */
export function routeLanes(state: RouteInputs): RouteLane[] {
  const groupOf = soundGroupIds(state.performanceLanes, state.laneGroups);
  const sounds = orderSounds(state.soundStreams, state.performanceLanes, state.laneGroups);
  const placed = new Set(Object.values(state.activeLayout.padToVoice).map(v => v?.id));
  const performedSound = (s: ProjectState['soundStreams'][number]) => placed.has(s.id) && !s.excluded;
  const kindOf = (id: string) => state.performanceRoute?.lanes.find(l => l.laneId === id)?.kind ?? 'midi';

  const lanes: RouteLane[] = [];
  for (const group of sortedGroups(state.laneGroups)) {
    const members = sounds.filter(s => groupOf.get(s.id) === group.groupId);
    if (members.length === 0) continue;
    const id = laneIdOfGroup(group.groupId);
    lanes.push({
      id,
      name: group.name,
      color: group.color,
      kind: kindOf(id),
      soundIds: members.map(s => s.id),
      performed: members.some(performedSound),
    });
  }
  for (const sound of sounds) {
    if (groupOf.get(sound.id)) continue;
    const id = laneIdOfSound(sound.id);
    lanes.push({
      id,
      name: sound.name,
      color: sound.color,
      kind: kindOf(id),
      soundIds: [sound.id],
      performed: performedSound(sound),
    });
  }
  return lanes;
}

/**
 * Where a lane has material: the bars its notes sound in, merged into clips
 * that split where CLIP_GAP_BARS or more empty bars come between. Every clip
 * lies inside songBarRange.
 */
export function clipsFor(lane: Pick<RouteLane, 'soundIds'>, state: Pick<ProjectState, 'soundStreams' | 'tempo'>): BarRange[] {
  const bar = barSeconds(state.tempo);
  const ids = new Set(lane.soundIds);
  const bars: BarRange[] = [];
  for (const stream of state.soundStreams) {
    if (!ids.has(stream.id)) continue;
    for (const e of stream.events) {
      // The epsilons keep a note on a bar line in floating point in its own bar.
      const startBar = Math.floor(e.startTime / bar + 1e-6);
      const endBar = Math.max(startBar + 1, Math.ceil((e.startTime + e.duration) / bar - 1e-6));
      bars.push({ startBar, endBar });
    }
  }
  return mergeRanges(bars, CLIP_GAP_BARS - 1);
}

// ============================================================================
// The detected route
// ============================================================================

/**
 * Section starts from silences: wherever SILENCE_SECONDS or more pass with
 * nothing sounding, a section starts at the bar the next note is in, unless
 * that would leave a section shorter than MIN_DETECTED_SECTION_BARS.
 *
 * Not the engine's detectSections: it measures from one note's start to the
 * next, so at 120 BPM a hit per bar (2 s apart) split at every note, and it
 * drops sections under 0.5 s together with their notes.
 */
function detectedBoundaries(state: Pick<ProjectState, 'soundStreams' | 'tempo'>, range: BarRange): number[] {
  const notes = state.soundStreams
    .flatMap(s => s.events)
    .sort((a, b) => a.startTime - b.startTime);
  const bar = barSeconds(state.tempo);
  const starts: number[] = [];
  let soundingUntil = -Infinity;
  for (const note of notes) {
    if (note.startTime - soundingUntil >= SILENCE_SECONDS) starts.push(Math.floor(note.startTime / bar + 1e-6));
    soundingUntil = Math.max(soundingUntil, note.startTime + note.duration);
  }
  starts.shift(); // The first note starts the song, not a new section.
  const kept: number[] = [];
  let last = range.startBar;
  for (const start of starts) {
    if (start - last >= MIN_DETECTED_SECTION_BARS) { kept.push(start); last = start; }
  }
  while (kept.length > 0 && range.endBar - kept[kept.length - 1] < MIN_DETECTED_SECTION_BARS) kept.pop();
  return kept;
}

/**
 * The route the Route shows before the user names anything (design 09a) and
 * the one the first edit adopts:
 * - sections from silences, named "Section 1"… with no text;
 * - Drum Rack wherever a performed lane has notes (its clips, merged across
 *   lanes), no mode set elsewhere;
 * - each performed lane performed over its clips.
 * With nothing placed, no lane is performed and no mode is set.
 */
export function detectedRoute(state: RouteInputs): PerformanceRoute {
  const range = songBarRange(state);
  const bounds = [range.startBar, ...detectedBoundaries(state, range), range.endBar];
  const sections: RouteSection[] = bounds.slice(0, -1).map((startBar, i) => ({
    id: `section-${i + 1}`,
    name: `Section ${i + 1}`,
    text: '',
    startBar,
    endBar: bounds[i + 1],
  }));

  const lanes = routeLanes(state);
  const performedSpans: PerformedSpan[] = lanes
    .filter(l => l.performed)
    .flatMap(l => clipsFor(l, state).map(c => ({ laneId: l.id, ...c })));
  const modeSpans: ModeSpan[] = mergeRanges(performedSpans, CLIP_GAP_BARS - 1)
    .map(r => ({ ...r, mode: 'drum' as const }));

  return normalizeRoute(
    { version: 1, sections, modeSpans, performedSpans, lanes: [] },
    range,
    new Set(lanes.map(l => l.id)),
  );
}

/** The route the Route shows: the authored one, else the detected one. */
export function displayedRoute(state: RouteInputs): PerformanceRoute {
  return state.performanceRoute ?? detectedRoute(state);
}

/**
 * `route` made valid for the project as it is now: tiling the song's bars,
 * and with performed spans and lane facts only for lanes that still exist.
 */
export function routeInSync(route: PerformanceRoute, state: RouteInputs): PerformanceRoute {
  return normalizeRoute(route, songBarRange(state), new Set(routeLanes(state).map(l => l.id)));
}

// ============================================================================
// Zoom levels below the section
// ============================================================================

/** A section's phrases: `phraseBars` long from its start, the last one cut at its end. */
export function phrasesFor(section: BarRange, phraseBars: number = DEFAULT_PHRASE_BARS): BarRange[] {
  const step = Math.max(1, Math.round(phraseBars));
  const phrases: BarRange[] = [];
  for (let start = section.startBar; start < section.endBar; start += step) {
    phrases.push({ startBar: start, endBar: Math.min(section.endBar, start + step) });
  }
  return phrases;
}

/** One thing the performer does: a bar, or the part of one in a single Push mode. */
export interface RouteAction extends BarRange {
  mode: PushMode | null;
}

/** A phrase's actions: one per bar, split where the Push mode changes inside it. */
export function actionsFor(phrase: BarRange, modeSpans: readonly ModeSpan[]): RouteAction[] {
  const actions: RouteAction[] = [];
  for (let bar = phrase.startBar; bar < phrase.endBar; bar++) {
    const end = Math.min(bar + 1, phrase.endBar);
    const cuts = [bar, ...modeSpans.map(s => s.startBar).filter(b => b > bar && b < end), end];
    for (let i = 0; i < cuts.length - 1; i++) {
      actions.push({ startBar: cuts[i], endBar: cuts[i + 1], mode: modeAt(modeSpans, cuts[i]) });
    }
  }
  return actions;
}

/** The Push mode at `bar`, or null where none is set (or outside the spans). */
export function modeAt(modeSpans: readonly ModeSpan[], bar: number): PushMode | null {
  return modeSpans.find(s => s.startBar <= bar && bar < s.endBar)?.mode ?? null;
}
