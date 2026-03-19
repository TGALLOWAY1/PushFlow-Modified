/**
 * Mapping Coverage - Computes how well a layout covers performance notes.
 *
 * Coverage is keyed by noteNumber only (channel ignored for this iteration).
 *
 * Ported from Version1/src/engine/mappingCoverage.ts with terminology updates.
 */

import { type Layout } from '../../types/layout';
import { type Performance } from '../../types/performance';
import { buildNoteToPadIndex } from './mappingResolver';

// ============================================================================
// Note Set
// ============================================================================

/**
 * Returns the set of unique note numbers used in the performance.
 */
export function getPerformanceNoteSet(performance: Performance): Set<number> {
  const set = new Set<number>();
  for (const event of performance.events) {
    set.add(event.noteNumber);
  }
  return set;
}

// ============================================================================
// Coverage
// ============================================================================

export interface MappingCoverageResult {
  mappedNotes: number;
  totalNotes: number;
  unmappedNotes: number[];
  mappedEventCount: number;
  totalEventCount: number;
}

/**
 * Computes how well a layout covers the notes used in a performance.
 */
export function computeMappingCoverage(
  performance: Performance,
  layout: Layout
): MappingCoverageResult {
  const requiredNotes = getPerformanceNoteSet(performance);
  const index = buildNoteToPadIndex(layout.padToVoice);

  const unmappedNotes: number[] = [];
  let mappedNotes = 0;

  for (const note of requiredNotes) {
    if (index.has(note)) {
      mappedNotes++;
    } else {
      unmappedNotes.push(note);
    }
  }

  let mappedEventCount = 0;
  for (const event of performance.events) {
    if (index.has(event.noteNumber)) {
      mappedEventCount++;
    }
  }

  unmappedNotes.sort((a, b) => a - b);

  return {
    mappedNotes,
    totalNotes: requiredNotes.size,
    unmappedNotes,
    mappedEventCount,
    totalEventCount: performance.events.length,
  };
}
