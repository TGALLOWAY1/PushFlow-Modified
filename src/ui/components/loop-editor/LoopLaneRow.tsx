/**
 * LoopLaneRow.
 *
 * A single lane row in the loop editor sidebar.
 * Shows color swatch, editable name, MIDI note label, M/S buttons, and delete.
 */

import { useState, useRef, useEffect } from 'react';
import { type LoopLane } from '../../../types/loopEditor';
import { type LoopEditorAction } from '../../state/loopEditorReducer';
import { type FingerType, type HandSide, ALL_FINGERS } from '../../../types/fingerModel';
import { midiNoteToName } from '../../../utils/midiNotes';

/** A hand+finger assignment for a lane. */
export interface LaneFingerAssignment {
  hand: HandSide;
  finger: FingerType;
}

/** All 10 hand+finger combinations in cycle order. */
const FINGER_CYCLE: LaneFingerAssignment[] = (['left', 'right'] as HandSide[]).flatMap(
  hand => ALL_FINGERS.map(finger => ({ hand, finger }))
);

/** Compact label for a finger assignment, e.g. "L2" = left index. */
function fingerLabel(fa: LaneFingerAssignment): string {
  const handChar = fa.hand === 'left' ? 'L' : 'R';
  const fingerNum = ALL_FINGERS.indexOf(fa.finger) + 1;
  return `${handChar}${fingerNum}`;
}

interface LoopLaneRowProps {
  lane: LoopLane;
  dispatch: React.Dispatch<LoopEditorAction>;
  /** Current finger assignment for this lane (if set). */
  fingerAssignment?: LaneFingerAssignment;
  /** Callback when finger assignment changes. */
  onFingerAssignmentChange?: (laneId: string, assignment: LaneFingerAssignment) => void;
}

const ROW_HEIGHT = 32;

export function LoopLaneRow({ lane, dispatch, fingerAssignment, onFingerAssignmentChange }: LoopLaneRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(lane.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommitName = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== lane.name) {
      dispatch({ type: 'RENAME_LANE', payload: { laneId: lane.id, name: trimmed } });
    }
    setIsEditing(false);
    setEditValue(lane.name);
  };

  return (
    <div
      className="group flex items-center gap-1.5 px-2 hover:bg-gray-800/50 border-b border-gray-800/40"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Color swatch */}
      <div
        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: lane.color }}
      />

      {/* Name */}
      {isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded px-1 py-0 text-xs text-gray-200"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleCommitName}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCommitName();
            if (e.key === 'Escape') {
              setEditValue(lane.name);
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-xs text-gray-200 cursor-text"
          onDoubleClick={() => {
            setEditValue(lane.name);
            setIsEditing(true);
          }}
          title={lane.name}
        >
          {lane.name}
        </span>
      )}

      {/* Finger assignment cycle-button */}
      <button
        className="text-[10px] font-mono w-6 h-5 flex items-center justify-center rounded flex-shrink-0 transition-colors"
        style={{
          backgroundColor: fingerAssignment
            ? fingerAssignment.hand === 'left' ? 'rgba(0,136,255,0.2)' : 'rgba(255,68,0,0.2)'
            : 'rgba(100,100,100,0.15)',
          color: fingerAssignment
            ? fingerAssignment.hand === 'left' ? '#0088FF' : '#FF4400'
            : '#666',
        }}
        onClick={() => {
          if (!onFingerAssignmentChange) return;
          const currentIdx = fingerAssignment
            ? FINGER_CYCLE.findIndex(fc => fc.hand === fingerAssignment.hand && fc.finger === fingerAssignment.finger)
            : -1;
          const nextIdx = (currentIdx + 1) % FINGER_CYCLE.length;
          onFingerAssignmentChange(lane.id, FINGER_CYCLE[nextIdx]);
        }}
        title={fingerAssignment
          ? `${fingerAssignment.hand} ${fingerAssignment.finger} — click to cycle`
          : 'Click to assign finger'}
      >
        {fingerAssignment ? fingerLabel(fingerAssignment) : '··'}
      </button>

      {/* MIDI note label */}
      <span className="text-[10px] text-gray-500 w-7 text-center flex-shrink-0">
        {lane.midiNote !== null ? midiNoteToName(lane.midiNote) : '--'}
      </span>

      {/* M/S buttons */}
      <button
        className={`text-[10px] w-4 h-4 flex items-center justify-center rounded flex-shrink-0 ${
          lane.isMuted
            ? 'bg-red-500/30 text-red-400'
            : 'text-gray-500 hover:text-gray-300'
        }`}
        onClick={() => dispatch({ type: 'TOGGLE_LANE_MUTE', payload: lane.id })}
        title="Mute"
      >
        M
      </button>
      <button
        className={`text-[10px] w-4 h-4 flex items-center justify-center rounded flex-shrink-0 ${
          lane.isSolo
            ? 'bg-yellow-500/30 text-yellow-400'
            : 'text-gray-500 hover:text-gray-300'
        }`}
        onClick={() => dispatch({ type: 'TOGGLE_LANE_SOLO', payload: lane.id })}
        title="Solo"
      >
        S
      </button>

      {/* Delete (visible on hover) */}
      <button
        className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => dispatch({ type: 'DELETE_LANE', payload: lane.id })}
        title="Delete lane"
      >
        ×
      </button>
    </div>
  );
}
