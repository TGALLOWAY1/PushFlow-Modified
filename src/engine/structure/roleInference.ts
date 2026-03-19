/**
 * Role inference: Classifies voices by their musical function.
 *
 * Analyzes event frequency, timing regularity, and velocity to infer
 * whether a voice serves as backbone, accent, fill, texture, or lead.
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type VoiceProfile, type MusicalRole } from '../../types/performanceStructure';

/**
 * Compute voice profiles with role inference for all voices in the performance.
 *
 * @param events - Sorted array of performance events
 * @returns Array of VoiceProfile objects, one per unique noteNumber
 */
export function inferVoiceRoles(events: PerformanceEvent[]): VoiceProfile[] {
  if (events.length === 0) return [];

  // Group events by noteNumber
  const voiceEvents = new Map<number, PerformanceEvent[]>();
  for (const event of events) {
    const existing = voiceEvents.get(event.noteNumber);
    if (existing) {
      existing.push(event);
    } else {
      voiceEvents.set(event.noteNumber, [event]);
    }
  }

  const totalDuration = events.length > 1
    ? events[events.length - 1].startTime - events[0].startTime
    : 1;

  const profiles: VoiceProfile[] = [];

  for (const [noteNumber, voiceEvts] of voiceEvents) {
    const eventCount = voiceEvts.length;
    const frequency = eventCount / Math.max(totalDuration, 0.001);

    // Compute timing regularity (coefficient of variation of inter-onset intervals)
    const regularity = computeRegularity(voiceEvts);

    // Average velocity
    const velocities = voiceEvts
      .map((e) => e.velocity ?? 100)
      .filter((v) => v > 0);
    const averageVelocity =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : 100;

    const role = classifyRole(eventCount, frequency, regularity, averageVelocity, events.length);

    profiles.push({
      noteNumber,
      eventCount,
      frequency,
      regularity,
      averageVelocity,
      role,
    });
  }

  // Sort by event count descending
  profiles.sort((a, b) => b.eventCount - a.eventCount);

  return profiles;
}

/**
 * Compute timing regularity as 1 - normalized coefficient of variation.
 * Returns 0 (very irregular) to 1 (perfectly regular).
 */
function computeRegularity(events: PerformanceEvent[]): number {
  if (events.length < 3) return 0.5; // Not enough data

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].startTime - events[i - 1].startTime);
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return 1; // All at same time = maximally regular

  const variance =
    intervals.reduce((sum, dt) => sum + (dt - mean) ** 2, 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean; // Coefficient of variation

  // Map CV to regularity: CV=0 -> regularity=1, CV>=2 -> regularity=0
  return Math.max(0, Math.min(1, 1 - cv / 2));
}

/**
 * Classify a voice's musical role based on its statistics.
 */
function classifyRole(
  eventCount: number,
  frequency: number,
  regularity: number,
  averageVelocity: number,
  totalEvents: number
): MusicalRole {
  const shareOfTotal = eventCount / Math.max(totalEvents, 1);

  // Backbone: high frequency, high regularity, significant share
  if (regularity > 0.6 && shareOfTotal > 0.15 && frequency > 2) {
    return 'backbone';
  }

  // Lead: moderate frequency, high velocity, moderate regularity
  if (averageVelocity > 110 && shareOfTotal > 0.1 && regularity > 0.3) {
    return 'lead';
  }

  // Accent: low count, high velocity
  if (eventCount <= 5 && averageVelocity > 100) {
    return 'accent';
  }

  // Texture: high regularity, low velocity (e.g., hi-hats, shakers)
  if (regularity > 0.7 && averageVelocity < 90) {
    return 'texture';
  }

  // Fill: irregular, moderate count
  if (regularity < 0.4 && eventCount > 2) {
    return 'fill';
  }

  // Default: classify by frequency
  if (frequency > 3) return 'backbone';
  if (eventCount <= 3) return 'accent';
  return 'fill';
}
