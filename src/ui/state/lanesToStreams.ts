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

  const activeLanes = lanes.filter(l => {
    if (soloActive) return l.isSolo && !l.isMuted;
    return !l.isMuted && !l.isHidden;
  });

  return activeLanes.map(lane => {
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
      muted: false,
    };
  });
}
