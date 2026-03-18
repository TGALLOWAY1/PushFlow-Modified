/**
 * PadContextMenu.
 *
 * Right-click context menu for grid pads.
 * Options: set finger constraint, remove voice, view reachability.
 */

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout } from '../state/projectState';

interface PadContextMenuProps {
  padKey: string;
  x: number;
  y: number;
  onClose: () => void;
}

const FINGER_OPTIONS = [
  { label: 'L1 (Thumb)', value: 'L-Th' },
  { label: 'L2 (Index)', value: 'L-Ix' },
  { label: 'L3 (Middle)', value: 'L-Md' },
  { label: 'L4 (Ring)', value: 'L-Rg' },
  { label: 'L5 (Pinky)', value: 'L-Pk' },
  { label: 'R1 (Thumb)', value: 'R-Th' },
  { label: 'R2 (Index)', value: 'R-Ix' },
  { label: 'R3 (Middle)', value: 'R-Md' },
  { label: 'R4 (Ring)', value: 'R-Rg' },
  { label: 'R5 (Pinky)', value: 'R-Pk' },
];

export function PadContextMenu({ padKey, x, y, onClose }: PadContextMenuProps) {
  const { state, dispatch } = useProject();
  const layout = getDisplayedLayout(state);
  const menuRef = useRef<HTMLDivElement>(null);

  const voice = layout?.padToVoice[padKey];
  const currentConstraint = layout?.fingerConstraints[padKey];

  // Clamp position to viewport bounds
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (x + rect.width > vw - 8) left = vw - rect.width - 8;
    if (y + rect.height > vh - 8) top = vh - rect.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPosition({ left, top });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: position.left, top: position.top }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-800">
        Pad [{padKey}] {voice ? `— ${voice.name}` : '— empty'}
      </div>

      {/* Remove voice */}
      {voice && (
        <button
          className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-800 transition-colors"
          onClick={() => {
            dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey } });
            onClose();
          }}
        >
          Remove from pad
        </button>
      )}

      {/* Finger constraint */}
      {voice && (
        <>
          <div className="px-3 py-1 text-[10px] text-gray-500 border-t border-gray-800 mt-1">
            Finger Constraint {currentConstraint && `(${currentConstraint})`}
          </div>
          {FINGER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`w-full px-3 py-1 text-left text-[11px] hover:bg-gray-800 transition-colors ${
                currentConstraint === opt.value ? 'text-purple-300' : 'text-gray-400'
              }`}
              onClick={() => {
                dispatch({
                  type: 'SET_FINGER_CONSTRAINT',
                  payload: {
                    padKey,
                    constraint: currentConstraint === opt.value ? null : opt.value,
                  },
                });
                onClose();
              }}
            >
              {currentConstraint === opt.value ? '* ' : '  '}{opt.label}
            </button>
          ))}
          {currentConstraint && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-gray-800 transition-colors border-t border-gray-800"
              onClick={() => {
                dispatch({
                  type: 'SET_FINGER_CONSTRAINT',
                  payload: { padKey, constraint: null },
                });
                onClose();
              }}
            >
              Clear constraint
            </button>
          )}
        </>
      )}
    </div>
  );
}
