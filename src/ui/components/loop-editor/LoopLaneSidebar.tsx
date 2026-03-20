/**
 * LoopLaneSidebar.
 *
 * Left sidebar for the Loop Editor showing the list of lanes.
 */

import { type LoopLane } from '../../../types/loopEditor';
import { type LoopEditorAction } from '../../state/loopEditorReducer';
import { LoopLaneRow, type LaneFingerAssignment } from './LoopLaneRow';

interface LoopLaneSidebarProps {
  lanes: LoopLane[];
  dispatch: React.Dispatch<LoopEditorAction>;
  /** Per-lane finger assignments, keyed by lane ID. */
  fingerAssignments?: Record<string, LaneFingerAssignment>;
  /** Callback when a lane's finger assignment changes. */
  onFingerAssignmentChange?: (laneId: string, assignment: LaneFingerAssignment) => void;
}

const HEADER_HEIGHT = 40;
const SUB_HEADER_HEIGHT = 20;

export function LoopLaneSidebar({ lanes, dispatch, fingerAssignments, onFingerAssignmentChange }: LoopLaneSidebarProps) {
  const sortedLanes = [...lanes].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-700">
      {/* Header matching grid bar numbers row */}
      <div
        className="flex items-end px-2 pb-1 text-xs font-medium text-gray-400 border-b border-gray-700"
        style={{ height: HEADER_HEIGHT }}
      >
        Lane
      </div>

      {/* Sub-header matching subdivision labels row */}
      <div
        className="flex items-center px-2 text-[10px] text-gray-500 bg-gray-900/80 border-b border-gray-800/40"
        style={{ height: SUB_HEADER_HEIGHT }}
      >
        <span className="flex-1">Name</span>
        <span className="w-6 text-center">Fgr</span>
        <span className="w-7 text-center">MIDI</span>
        <span className="w-12 text-center">M S</span>
      </div>

      {/* Lane rows */}
      <div>
        {sortedLanes.map(lane => (
          <LoopLaneRow
            key={lane.id}
            lane={lane}
            dispatch={dispatch}
            fingerAssignment={fingerAssignments?.[lane.id]}
            onFingerAssignmentChange={onFingerAssignmentChange}
          />
        ))}

        {sortedLanes.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-600 text-center">
            No lanes yet
          </div>
        )}
      </div>
    </div>
  );
}
