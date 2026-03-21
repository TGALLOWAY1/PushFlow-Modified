/**
 * LoopLaneRow.
 *
 * A single lane row in the loop editor sidebar.
 * Shows color swatch, editable name, pad position, finger input, M/S buttons, and delete.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { type LoopLane } from '../../../types/loopEditor';
import { type LoopEditorAction } from '../../state/loopEditorReducer';
import { type FingerType, type HandSide } from '../../../types/fingerModel';
import { FingerAssignmentInput, type FingerAssignmentValue } from '../shared/FingerAssignmentInput';

/** A hand+finger assignment for a lane. */
export interface LaneFingerAssignment {
  hand: HandSide;
  finger: FingerType;
}

interface LoopLaneRowProps {
  lane: LoopLane;
  dispatch: React.Dispatch<LoopEditorAction>;
  /** Current finger assignment for this lane (if set). */
  fingerAssignment?: LaneFingerAssignment;
  /** Callback when finger assignment changes. */
  onFingerAssignmentChange?: (laneId: string, assignment: LaneFingerAssignment) => void;
  /** Pad position string (e.g. "3,5") if lane is assigned to a pad. */
  padPosition?: string;
}

/** Format a pad key like "3,5" into a compact label like "R3C5". */
function formatPadPosition(pk: string): string {
  const parts = pk.split(',');
  if (parts.length !== 2) return pk;
  return `R${parts[0]}C${parts[1]}`;
}

const ROW_HEIGHT = 32;

export function LoopLaneRow({ lane, dispatch, fingerAssignment, onFingerAssignmentChange, padPosition }: LoopLaneRowProps) {
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

  const handleFingerChange = useCallback((assignment: FingerAssignmentValue | null) => {
    if (!onFingerAssignmentChange || !assignment) return;
    onFingerAssignmentChange(lane.id, assignment);
  }, [onFingerAssignmentChange, lane.id]);

  return (
    <div
      className="group flex items-center gap-1.5 px-2 hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]"
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
          className="flex-1 min-w-0 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-pf-sm px-1 py-0 text-pf-sm text-[var(--text-primary)]"
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
          className="flex-1 min-w-0 truncate text-pf-sm text-[var(--text-primary)] cursor-text"
          onDoubleClick={() => {
            setEditValue(lane.name);
            setIsEditing(true);
          }}
          title={lane.name}
        >
          {lane.name}
        </span>
      )}

      {/* Finger assignment — type L1, R5, etc. */}
      <FingerAssignmentInput
        value={fingerAssignment ?? null}
        onChange={handleFingerChange}
        size="sm"
      />

      {/* Pad position label */}
      <span className="text-pf-xs text-[var(--text-secondary)] w-7 text-center flex-shrink-0" title={padPosition ? `Pad ${padPosition}` : 'Not assigned to pad'}>
        {padPosition ? formatPadPosition(padPosition) : '--'}
      </span>

      {/* M/S buttons */}
      <button
        className={`text-pf-xs w-4 h-4 flex items-center justify-center rounded-pf-sm flex-shrink-0 ${
          lane.isMuted
            ? 'bg-red-500/30 text-red-400'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        onClick={() => dispatch({ type: 'TOGGLE_LANE_MUTE', payload: lane.id })}
        title="Mute"
      >
        M
      </button>
      <button
        className={`text-pf-xs w-4 h-4 flex items-center justify-center rounded-pf-sm flex-shrink-0 ${
          lane.isSolo
            ? 'bg-yellow-500/30 text-yellow-400'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        onClick={() => dispatch({ type: 'TOGGLE_LANE_SOLO', payload: lane.id })}
        title="Solo"
      >
        S
      </button>

      {/* Delete (visible on hover) */}
      <button
        className="text-[var(--text-tertiary)] hover:text-red-400 text-pf-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => dispatch({ type: 'DELETE_LANE', payload: lane.id })}
        title="Delete lane"
      >
        ×
      </button>
    </div>
  );
}
