/**
 * Which project Sound a Composer lane is, and which lane a layout voice is.
 *
 * A Composer lane becomes a project Sound whose id is the lane's id under
 * WORKSPACE_PATTERN_LANE_ID_PREFIX (loopToLanes with preserveLaneIds), so that
 * id is the lane's identity in every layout. A lane and a Sound are never
 * matched by MIDI pitch (invariant 5; T18). A name match stays only as a
 * fallback for pads placed before lanes carried project ids (T66, S1a.5).
 */

export const WORKSPACE_PATTERN_LANE_ID_PREFIX = 'workspace_pattern_';

/** The project Sound id of a Composer lane. */
export function projectSoundIdForLane(laneId: string): string {
  return `${WORKSPACE_PATTERN_LANE_ID_PREFIX}${laneId}`;
}

interface LaneLike { id: string; name: string }
interface VoiceLike { id: string; name: string }

/** The layout voice a lane plays, or undefined when the lane has no pad. */
export function voiceForLane<V extends VoiceLike>(lane: LaneLike, voices: ReadonlyArray<V>): V | undefined {
  const projectId = projectSoundIdForLane(lane.id);
  return voices.find(v => v.id === projectId)
    ?? voices.find(v => v.id === lane.id)
    ?? voices.find(v => v.name === lane.name);
}

/** The lane a layout voice belongs to, or undefined when it is not a Composer lane. */
export function laneForVoice<L extends LaneLike>(voice: VoiceLike, lanes: ReadonlyArray<L>): L | undefined {
  return lanes.find(l => projectSoundIdForLane(l.id) === voice.id)
    ?? lanes.find(l => l.id === voice.id)
    ?? lanes.find(l => l.name === voice.name);
}
