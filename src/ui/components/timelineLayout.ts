/**
 * Fixed geometry of the timeline, shared by UnifiedTimeline and the drawer
 * that sizes itself to the timeline's content (T04).
 */

/** Height of one Sound's lane. */
export const TRACK_HEIGHT = 32;
/** Bar-number row of the ruler: the loop strip on top, the bar numbers and the playhead handle under it. */
export const BAR_HEADER_HEIGHT = 40;
/** The loop strip at the top of the ruler, where a loop is dragged out (S4.3a, T58). */
export const LOOP_STRIP_HEIGHT = 18;
/** Beat-number row of the ruler. */
export const BEAT_HEADER_HEIGHT = 20;
export const TOTAL_HEADER_HEIGHT = BAR_HEADER_HEIGHT + BEAT_HEADER_HEIGHT;
/** Room for the horizontal scrollbar under the last lane. */
export const TIMELINE_SCROLLBAR_ALLOWANCE = 8;
/** The "import MIDI or open the Composer" state shown before there are any Sounds. */
export const TIMELINE_EMPTY_HEIGHT = 106;

/**
 * The timeline's natural height: the ruler and every lane, with nothing
 * scrolled. Its controls sit in the drawer's tab row, and the transport above
 * the tabs (S4.3a), so neither is part of it.
 */
export function timelineContentHeight(streamCount: number): number {
  if (streamCount <= 0) return TIMELINE_EMPTY_HEIGHT;
  return TOTAL_HEADER_HEIGHT + streamCount * TRACK_HEIGHT + TIMELINE_SCROLLBAR_ALLOWANCE;
}
