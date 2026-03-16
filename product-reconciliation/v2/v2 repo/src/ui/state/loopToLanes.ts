/**
 * Loop → PerformanceLane Conversion Bridge.
 *
 * Converts the grid-based loop representation into the existing
 * PerformanceLane / LaneEvent format for downstream integration.
 */

import { type PerformanceLane, type LaneEvent, type LaneGroup, type SourceFile } from '../../types/performanceLane';
import { type LoopState, loopCellKey, stepDuration, totalSteps } from '../../types/loopEditor';
import { generateId } from '../../utils/idGenerator';

export interface LoopConversionResult {
  lanes: PerformanceLane[];
  sourceFile: SourceFile;
  group: LaneGroup;
}

export interface LoopConversionOptions {
  sourceFileId?: string;
  sourceFileName?: string;
  groupId?: string;
  groupName?: string;
  laneIdPrefix?: string;
  preserveLaneIds?: boolean;
}

/**
 * Convert a LoopState into PerformanceLanes ready for IMPORT_LANES dispatch.
 *
 * @param loopState - The current loop editor state
 * @param sourceLabel - Human-readable label for the loop (used in group name and source file)
 */
export function convertLoopToPerformanceLanes(
  loopState: LoopState,
  sourceLabel: string,
  options: LoopConversionOptions = {},
): LoopConversionResult {
  const sourceFileId = options.sourceFileId ?? generateId('src');
  const groupId = options.groupId ?? generateId('grp');
  const stepDur = stepDuration(loopState.config);
  const steps = totalSteps(loopState.config);

  // Respect mute/solo
  const soloActive = loopState.lanes.some(l => l.isSolo);
  const activeLanes = loopState.lanes.filter(l => {
    if (soloActive) return l.isSolo && !l.isMuted;
    return !l.isMuted;
  });

  const lanes: PerformanceLane[] = activeLanes.map((loopLane, i) => {
    const laneId = options.preserveLaneIds
      ? `${options.laneIdPrefix ?? ''}${loopLane.id}`
      : generateId('lane');
    const events: LaneEvent[] = [];

    for (let step = 0; step < steps; step++) {
      const key = loopCellKey(loopLane.id, step);
      const loopEvent = loopState.events.get(key);
      if (!loopEvent) continue;

      events.push({
        eventId: generateId('evt'),
        laneId,
        startTime: step * stepDur,
        duration: stepDur,
        velocity: loopEvent.velocity,
        rawPitch: loopLane.midiNote ?? (36 + i),
      });
    }

    return {
      id: laneId,
      name: loopLane.name,
      sourceFileId,
      sourceFileName: options.sourceFileName ?? `Loop: ${sourceLabel}`,
      groupId,
      orderIndex: i,
      color: loopLane.color,
      colorMode: 'inherited' as const,
      events,
      isHidden: false,
      isMuted: false,
      isSolo: false,
    };
  });

  const group: LaneGroup = {
    groupId,
    name: options.groupName ?? sourceLabel,
    color: activeLanes[0]?.color ?? '#3b82f6',
    orderIndex: 0,
    isCollapsed: false,
  };

  const sourceFile: SourceFile = {
    id: sourceFileId,
    fileName: options.sourceFileName ?? `Loop: ${sourceLabel}`,
    importedAt: new Date().toISOString(),
    laneCount: lanes.length,
  };

  return { lanes, sourceFile, group };
}
