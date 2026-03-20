/**
 * FingerAssignmentInput.
 *
 * Inline text input for typing finger assignments like "L1", "R5".
 * Replaces cycle-buttons and dual-dropdown approaches with a single
 * typeable field that accepts shorthand notation.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { type FingerType, type HandSide, ALL_FINGERS } from '../../../types/fingerModel';

export interface FingerAssignmentValue {
  hand: HandSide;
  finger: FingerType;
}

/**
 * Parse shorthand like "L1", "R5", "l3" into a structured assignment.
 * Returns null if the input is invalid.
 */
export function parseFingerShorthand(input: string): FingerAssignmentValue | null {
  const match = input.trim().match(/^([LlRr])([1-5])$/);
  if (!match) return null;
  const hand: HandSide = match[1].toUpperCase() === 'L' ? 'left' : 'right';
  const fingerMap: Record<string, FingerType> = {
    '1': 'thumb',
    '2': 'index',
    '3': 'middle',
    '4': 'ring',
    '5': 'pinky',
  };
  return { hand, finger: fingerMap[match[2]] };
}

/** Format a FingerAssignmentValue as compact label, e.g. "L2". */
export function fingerAssignmentLabel(fa: FingerAssignmentValue): string {
  const handChar = fa.hand === 'left' ? 'L' : 'R';
  const fingerNum = ALL_FINGERS.indexOf(fa.finger) + 1;
  return `${handChar}${fingerNum}`;
}

interface FingerAssignmentInputProps {
  value: FingerAssignmentValue | null | undefined;
  onChange: (assignment: FingerAssignmentValue | null) => void;
  size?: 'sm' | 'md';
}

export function FingerAssignmentInput({ value, onChange, size = 'sm' }: FingerAssignmentInputProps) {
  const displayValue = value ? fingerAssignmentLabel(value) : '';
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed === '') {
      onChange(null);
    } else {
      const parsed = parseFingerShorthand(trimmed);
      if (parsed) {
        onChange(parsed);
      }
      // On invalid input, just revert silently
    }
    setEditing(false);
  }, [editText, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditText(displayValue);
      setEditing(false);
    }
  }, [commit, displayValue]);

  const isSm = size === 'sm';
  const baseClass = isSm
    ? 'text-[10px] font-mono w-6 h-5'
    : 'text-[10px] font-mono w-8 h-5';

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${baseClass} bg-gray-900 border border-gray-600 rounded px-0.5 text-center text-gray-200 outline-none focus:border-blue-500 flex-shrink-0`}
        value={editText}
        onChange={e => setEditText(e.target.value.slice(0, 2))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        maxLength={2}
        placeholder="--"
      />
    );
  }

  return (
    <button
      className={`${baseClass} flex items-center justify-center rounded flex-shrink-0 transition-colors cursor-text`}
      style={{
        backgroundColor: value
          ? value.hand === 'left' ? 'rgba(0,136,255,0.2)' : 'rgba(255,68,0,0.2)'
          : 'rgba(100,100,100,0.15)',
        color: value
          ? value.hand === 'left' ? '#0088FF' : '#FF4400'
          : '#666',
      }}
      onClick={() => {
        setEditText(displayValue);
        setEditing(true);
      }}
      title={value
        ? `${value.hand} ${value.finger} — click to edit`
        : 'Click to assign finger (e.g. L1, R5)'}
    >
      {value ? fingerAssignmentLabel(value) : '··'}
    </button>
  );
}
