/**
 * Section detection: Identifies meaningful temporal segments in a performance.
 *
 * Uses two complementary strategies:
 * 1. Gap-based: Silences longer than a threshold create section boundaries
 * 2. Density-based: Significant changes in event density suggest section changes
 */

import { type PerformanceEvent } from '../../types/performanceEvent';
import { type Section, type DensityProfile } from '../../types/performanceStructure';
import { classifyDensity } from './densityAnalysis';

/** Minimum gap (seconds) to split into a new section. */
const DEFAULT_GAP_THRESHOLD = 2.0;

/** Minimum section duration in seconds. */
const MIN_SECTION_DURATION = 0.5;

/**
 * Detect sections using gap-based splitting.
 *
 * When there is a silence longer than gapThreshold between consecutive
 * events, a new section begins.
 *
 * @param events - Sorted array of performance events
 * @param densityProfile - Pre-computed density profile for characterization
 * @param gapThreshold - Minimum gap in seconds to split sections
 * @returns Array of detected sections
 */
export function detectSections(
  events: PerformanceEvent[],
  densityProfile: DensityProfile,
  gapThreshold: number = DEFAULT_GAP_THRESHOLD
): Section[] {
  if (events.length === 0) return [];

  const sections: Section[] = [];
  let sectionStart = events[0].startTime;
  let sectionEvents: PerformanceEvent[] = [events[0]];
  let sectionIndex = 0;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i].startTime - events[i - 1].startTime;

    if (gap >= gapThreshold) {
      // End current section
      const endTime = events[i - 1].startTime + (events[i - 1].duration ?? 0);
      const duration = endTime - sectionStart;

      if (duration >= MIN_SECTION_DURATION) {
        sections.push(
          createSection(sectionIndex, sectionStart, endTime, sectionEvents, densityProfile)
        );
        sectionIndex++;
      }

      // Start new section
      sectionStart = events[i].startTime;
      sectionEvents = [events[i]];
    } else {
      sectionEvents.push(events[i]);
    }
  }

  // Final section
  const lastEvent = events[events.length - 1];
  const endTime = lastEvent.startTime + (lastEvent.duration ?? 0);
  const duration = endTime - sectionStart;

  if (duration >= MIN_SECTION_DURATION || sections.length === 0) {
    sections.push(
      createSection(sectionIndex, sectionStart, endTime, sectionEvents, densityProfile)
    );
  }

  return sections;
}

/**
 * Create a Section object with density characterization.
 */
function createSection(
  index: number,
  startTime: number,
  endTime: number,
  events: PerformanceEvent[],
  densityProfile: DensityProfile
): Section {
  const duration = Math.max(endTime - startTime, 0.001);
  const density = events.length / duration;
  const densityLevel = classifyDensity(density, densityProfile.averageDensity);

  return {
    id: `section_${index}`,
    name: `Section ${index + 1}`,
    startTime,
    endTime,
    density,
    densityLevel,
  };
}
