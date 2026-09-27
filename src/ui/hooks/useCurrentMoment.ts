/**
 * The one current moment (S4.3b, T10).
 *
 * While playing, it is the event at the playhead, as the grid shows it; when
 * stopped, the selected event. A stop mid-song selects the event at the
 * playhead unless the user picked one (PLAYBACK_STOPPED), so a paused grid is
 * never blank, and Stop brings a picked event back. The grid, the docked
 * inspector and ←/→ all read it this way.
 */

import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan } from '../state/projectState';
import { getEventTimeline } from '../analysis/eventTimeline';
import { usePlayheadEventIndex } from '../audio/TransportProvider';

export interface CurrentMoment {
  /** The event's momentKey; null when there is none (nothing selected, or playing before the first event). */
  key: string | null;
  /** True while playing: it follows the playhead. */
  following: boolean;
}

export function useCurrentMoment(): CurrentMoment {
  const { state } = useProject();
  const timeline = getEventTimeline(state);
  const index = usePlayheadEventIndex(timeline, getDisplayedExecutionPlan(state)?.fingerAssignments);
  if (!state.isPlaying) return { key: state.selectedMomentKey, following: false };
  return { key: index === null ? null : timeline.events[index]?.key ?? null, following: true };
}
