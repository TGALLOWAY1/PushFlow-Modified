/**
 * Lane-to-Stream Conversion.
 *
 * Converts PerformanceLanes (authoring model) into SoundStreams (solver model).
 * Called when transitioning from the Lanes tab to the Editor tab.
 */

import { type PerformanceLane } from '../../types/performanceLane';
import { type SoundStream, type SoundEvent } from './projectState';

/**
 * Build SoundStreams from the current set of performance lanes.
 *
 * Respects mute/solo/hidden flags:
 * - If any lane has isSolo=true, only solo'd (and non-muted) lanes are included.
 * - Otherwise, non-muted and non-hidden lanes are included.
 *
 * Each lane maps to one SoundStream. The lane's rawPitch (from the first event)
 * is used as originalMidiNote for solver compatibility.
 */
export function buildSoundStreamsFromLanes(
  lanes: PerformanceLane[],
): SoundStream[] {
  const soloActive = lanes.some(l => l.isSolo);

  // Every lane becomes a stream, muted or not. Filtering muted lanes out here
  // DELETED them from the Sounds panel and the timeline on the next lane action,
  // leaving no row to un-mute from — so muting a sound to audition the rest was
  // effectively irreversible, and the sound's placement and constraints went with
  // it. Muting is a state a stream carries, not a reason to stop existing; every
  // consumer already reads the `muted` flag, and CLAUDE.md requires the timeline
  // show all sound streams.
  return lanes.map(lane => {
    const events: SoundEvent[] = lane.events.map(e => ({
      startTime: e.startTime,
      duration: e.duration,
      velocity: e.velocity,
      eventKey: e.eventId,
    }));

    return {
      id: lane.id,
      name: lane.name,
      color: lane.color,
      originalMidiNote: lane.events[0]?.rawPitch ?? 0,
      events,
      muted: soloActive
        ? !(lane.isSolo && !lane.isMuted)
        : (lane.isMuted || lane.isHidden),
    };
  });
}
