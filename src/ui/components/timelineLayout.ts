/**
 * Fixed geometry of the timeline, shared by UnifiedTimeline and the drawer
 * that sizes itself to the timeline's content (T04).
 */

/** Height of one Sound's lane. */
export const TRACK_HEIGHT = 32;
/** Bar-number row of the ruler. */
export const BAR_HEADER_HEIGHT = 40;
/** Beat-number row of the ruler. */
export const BEAT_HEADER_HEIGHT = 20;
export const TOTAL_HEADER_HEIGHT = BAR_HEADER_HEIGHT + BEAT_HEADER_HEIGHT;
/** The one-row transport toolbar above the lanes. */
export const TIMELINE_TOOLBAR_HEIGHT = 44;
/** Room for the horizontal scrollbar under the last lane. */
export const TIMELINE_SCROLLBAR_ALLOWANCE = 8;
/** The "import MIDI or open the Composer" state shown before there are any Sounds. */
export const TIMELINE_EMPTY_HEIGHT = 150;

/** The timeline's natural height: toolbar, ruler and every lane, with nothing scrolled. */
export function timelineContentHeight(streamCount: number): number {
  if (streamCount <= 0) return TIMELINE_EMPTY_HEIGHT;
  return TIMELINE_TOOLBAR_HEIGHT + TOTAL_HEADER_HEIGHT + streamCount * TRACK_HEIGHT + TIMELINE_SCROLLBAR_ALLOWANCE;
}

// ─── Toolbar (T05) ──────────────────────────────────────────────────────────
// The transport cluster (Play/Stop, Return, position, Speed, Loop, Metronome,
// Hits) has fixed widths and is always shown. The secondary controls follow in
// priority order while they fit; the rest go into the "⋯" menu.

/** Gap between toolbar controls. */
export const TOOLBAR_GAP = 8;
/** The "⋯" button, and the toolbar's own horizontal padding. */
export const TOOLBAR_MORE_WIDTH = 32;
export const TOOLBAR_PADDING = 24;

/** Fixed widths of the transport controls, left to right. */
export const TRANSPORT_WIDTHS = {
  play: 64,
  return: 30,
  position: 56,
  speed: 140,
  loop: 64,
  metronome: 96,
  hits: 60,
} as const;

/** Width of the always-visible transport cluster, gaps included. */
export const TRANSPORT_CLUSTER_WIDTH = Object.values(TRANSPORT_WIDTHS).reduce((a, b) => a + b, 0)
  + (Object.keys(TRANSPORT_WIDTHS).length - 1) * TOOLBAR_GAP;

export type SecondaryControl = 'import' | 'count' | 'zoom' | 'clearLoop';

/** Secondary controls in priority order, with their fixed widths. */
export const SECONDARY_CONTROLS: ReadonlyArray<{ id: SecondaryControl; width: number }> = [
  { id: 'import', width: 72 },
  { id: 'count', width: 72 },
  { id: 'zoom', width: 164 },
  { id: 'clearLoop', width: 88 },
];

/**
 * Which secondary controls fit inline in a toolbar this wide; the others go in
 * the "⋯" menu. Controls stay in priority order: once one doesn't fit, neither
 * does anything after it. `present` leaves out controls with nothing to show
 * (no loop region to clear).
 */
export function fitSecondaryControls(
  toolbarWidth: number,
  present: ReadonlySet<SecondaryControl>,
): { inline: SecondaryControl[]; overflow: SecondaryControl[] } {
  const wanted = SECONDARY_CONTROLS.filter(c => present.has(c.id));
  const base = TOOLBAR_PADDING + TRANSPORT_CLUSTER_WIDTH;
  const all = wanted.reduce((sum, c) => sum + TOOLBAR_GAP + c.width, 0);
  // Everything fits: no "⋯" at all.
  if (base + all <= toolbarWidth) return { inline: wanted.map(c => c.id), overflow: [] };
  let room = toolbarWidth - base - TOOLBAR_GAP - TOOLBAR_MORE_WIDTH;
  const inline: SecondaryControl[] = [];
  const overflow: SecondaryControl[] = [];
  for (const c of wanted) {
    if (overflow.length === 0 && room >= TOOLBAR_GAP + c.width) {
      inline.push(c.id);
      room -= TOOLBAR_GAP + c.width;
    } else {
      overflow.push(c.id);
    }
  }
  return { inline, overflow };
}
