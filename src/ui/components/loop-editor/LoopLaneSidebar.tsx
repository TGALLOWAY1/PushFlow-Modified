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
  /** Callback when a lane's finger assignment changes; null clears it. */
  onFingerAssignmentChange?: (laneId: string, assignment: LaneFingerAssignment | null) => void;
  /** Callback to add a new lane. */
  onAddLane?: () => void;
  /** Per-lane pad positions (e.g. "3,5"), keyed by lane ID. */
  padPositions?: Record<string, string>;
  /** Notes in the pattern, shown in the header (out of the toolbar, so it can't reflow it: T69). */
  noteCount?: number;
}

const HEADER_HEIGHT = 40;
const SUB_HEADER_HEIGHT = 20;

export function LoopLaneSidebar({ lanes, dispatch, fingerAssignments, onFingerAssignmentChange, onAddLane, padPositions, noteCount }: LoopLaneSidebarProps) {
  const sortedLanes = [...lanes].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="w-56 flex-shrink-0 border-r border-[var(--border-default)]">
      {/* Header matching grid bar numbers row */}
      <div
        className="flex items-end px-2 pb-1 text-pf-sm font-medium text-[var(--text-secondary)] border-b border-[var(--border-default)]"
        style={{ height: HEADER_HEIGHT }}
      >
        Lanes
        {noteCount !== undefined && (
          <span
            data-testid="composer-note-count"
            className="ml-1.5 min-w-0 text-pf-xs font-normal text-emerald-300/80 truncate"
            title="Changes sync directly into the shared performance timeline"
          >
            · {noteCount} {noteCount === 1 ? 'note' : 'notes'} · live sync
          </span>
        )}
        {onAddLane && (
          <button
            className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-pf-sm leading-none px-1"
            onClick={onAddLane}
            title="Add lane"
          >
            +
          </button>
        )}
      </div>

      {/* Sub-header matching subdivision labels row */}
      <div
        className="flex items-center px-2 text-pf-xs text-[var(--text-secondary)] bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]"
        style={{ height: SUB_HEADER_HEIGHT }}
      >
        <span className="flex-1">Name</span>
        <span className="w-6 text-center">Fgr</span>
        <span className="w-7 text-center">Pad</span>
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
            padPosition={padPositions?.[lane.id]}
          />
        ))}

        {sortedLanes.length === 0 && (
          <div className="px-3 py-4 text-pf-sm text-[var(--text-tertiary)] text-center">
            No lanes yet
          </div>
        )}
      </div>
    </div>
  );
}
