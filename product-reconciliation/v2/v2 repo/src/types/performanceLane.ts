/**
 * Performance Lane Types.
 *
 * Data model for the Performance Lanes import and organization feature.
 * Lanes are the authoring model — each represents a playable timing source
 * derived from an imported MIDI file. Lanes are organized into groups and
 * carry color/naming metadata forward into pad mapping and performance views.
 */

// ============================================================================
// Color Mode
// ============================================================================

/** Whether a lane's color is inherited from its group or explicitly overridden. */
export type LaneColorMode = 'inherited' | 'overridden';

// ============================================================================
// Lane Event
// ============================================================================

/** A single timing event within a performance lane. */
export interface LaneEvent {
  eventId: string;
  laneId: string;
  startTime: number;
  duration: number;
  velocity: number;
  /** Original MIDI note number, preserved for solver compatibility. */
  rawPitch?: number;
  /** Original MIDI channel, preserved for reference. */
  rawChannel?: number;
}

// ============================================================================
// Performance Lane
// ============================================================================

/**
 * A performance lane — one track of timing data derived from a source file.
 *
 * Each unique MIDI pitch in an imported file becomes its own lane.
 * Lanes carry organizational metadata (group, color, order) that
 * persists into later pad mapping and performance views.
 */
export interface PerformanceLane {
  id: string;
  name: string;
  sourceFileId: string;
  sourceFileName: string;
  groupId: string | null;
  orderIndex: number;
  color: string;
  colorMode: LaneColorMode;
  events: LaneEvent[];
  isHidden: boolean;
  isMuted: boolean;
  isSolo: boolean;
}

// ============================================================================
// Lane Group
// ============================================================================

/** A collapsible container for organizing related lanes. */
export interface LaneGroup {
  groupId: string;
  name: string;
  color: string;
  orderIndex: number;
  isCollapsed: boolean;
}

// ============================================================================
// Source File
// ============================================================================

/** Record of an imported MIDI source file. */
export interface SourceFile {
  id: string;
  fileName: string;
  importedAt: string;
  laneCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Count unique time slices (events) across lanes.
 * Simultaneously played notes count as a single event.
 */
export function countTimeSlices(lanes: PerformanceLane[]): number {
  const times = new Set<number>();
  for (const lane of lanes) {
    for (const e of lane.events) {
      times.add(e.startTime);
    }
  }
  return times.size;
}

/** Count unique time slices for a single lane. */
export function countLaneTimeSlices(lane: PerformanceLane): number {
  return new Set(lane.events.map(e => e.startTime)).size;
}
