/**
 * Mapping Coverage - Computes how well a layout covers a performance's Sounds.
 *
 * Coverage is by Sound identity: an event's Sound (voiceId) must have a pad.
 * Only an event with no Sound at all is counted by pitch (see voiceMap.ts).
 *
 * Ported from Version1/src/engine/mappingCoverage.ts with terminology updates.
 */

import { type Layout } from '../../types/layout';
import { type Performance } from '../../types/performance';
import { buildNoteToPadIndex, buildVoiceIdToPadIndex } from './mappingResolver';
import { soundKeyOf } from './voiceMap';

// ============================================================================
// Sound Set
// ============================================================================

/**
 * Returns the set of sound keys used in the performance (voiceId, or the pitch
 * string for an event with no Sound).
 */
export function getPerformanceSoundKeys(performance: Performance): Set<string> {
  const set = new Set<string>();
  for (const event of performance.events) {
    set.add(soundKeyOf(event));
  }
  return set;
}

// ============================================================================
// Coverage
// ============================================================================

export interface MappingCoverageResult {
  /** Sounds with a pad. */
  mappedNotes: number;
  /** Sounds in the performance. */
  totalNotes: number;
  /** Pitches of the Sounds with no pad (one entry per unmapped Sound). */
  unmappedNotes: number[];
  /** Sound keys with no pad. */
  unmappedSoundKeys: string[];
  mappedEventCount: number;
  totalEventCount: number;
}

/**
 * Computes how well a layout covers the Sounds used in a performance.
 */
export function computeMappingCoverage(
  performance: Performance,
  layout: Layout
): MappingCoverageResult {
  const voiceIdIndex = buildVoiceIdToPadIndex(layout.padToVoice);
  const noteIndex = buildNoteToPadIndex(layout.padToVoice);

  const isMapped = (event: { noteNumber: number; voiceId?: string }): boolean =>
    event.voiceId !== undefined
      ? voiceIdIndex.has(event.voiceId)
      : noteIndex.has(event.noteNumber);

  const seen = new Map<string, { noteNumber: number; mapped: boolean }>();
  let mappedEventCount = 0;
  for (const event of performance.events) {
    const mapped = isMapped(event);
    if (mapped) mappedEventCount++;
    const key = soundKeyOf(event);
    if (!seen.has(key)) seen.set(key, { noteNumber: event.noteNumber, mapped });
  }

  const unmappedNotes: number[] = [];
  const unmappedSoundKeys: string[] = [];
  let mappedNotes = 0;
  for (const [key, { noteNumber, mapped }] of seen) {
    if (mapped) {
      mappedNotes++;
    } else {
      unmappedNotes.push(noteNumber);
      unmappedSoundKeys.push(key);
    }
  }
  unmappedNotes.sort((a, b) => a - b);

  return {
    mappedNotes,
    totalNotes: seen.size,
    unmappedNotes,
    unmappedSoundKeys,
    mappedEventCount,
    totalEventCount: performance.events.length,
  };
}
