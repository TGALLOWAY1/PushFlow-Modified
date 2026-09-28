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
 * Every lane becomes a stream, excluded or not: filtering lanes out here once
 * DELETED them from the Sounds panel and the timeline, leaving no row to bring
 * them back from, and CLAUDE.md requires the timeline to show all sound
 * streams. A lane excluded from analysis (or hidden, the older flag) makes an
 * excluded stream (S4.4); only then does the stream carry the key, so an
 * unchanged rebuild equals the Sounds already there.
 *
 * Each lane maps to one SoundStream. The lane's rawPitch (from the first event)
 * is used as originalMidiNote for solver compatibility.
 */
export function buildSoundStreamsFromLanes(
  lanes: PerformanceLane[],
): SoundStream[] {
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
      ...(lane.shortLabel ? { shortLabel: lane.shortLabel } : {}),
      originalMidiNote: lane.events[0]?.rawPitch ?? 0,
      events,
      ...(lane.excluded || lane.isHidden ? { excluded: true } : {}),
    };
  });
}
