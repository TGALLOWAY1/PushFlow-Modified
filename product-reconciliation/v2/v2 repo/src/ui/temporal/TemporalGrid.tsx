/**
 * Temporal Grid (center-top panel).
 *
 * 8x8 pad grid with voice labels, finger ownership indicators,
 * drag-to-move pads, click-to-reassign fingers, and active-moment
 * highlighting with transition arc indicators.
 */

import { useState, useMemo, useCallback } from 'react';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type FingerType } from '../../types/fingerModel';
import { padKey, parsePadKey } from '../../types/padGrid';
import { type TransitionResult } from './types';

const ROWS = 8;
const COLS = 8;

const HAND_COLORS = {
  left: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300' },
  right: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300' },
};

const FINGER_LABELS: Record<FingerType, string> = {
  thumb: 'Th',
  index: 'Ix',
  middle: 'Md',
  ring: 'Rn',
  pinky: 'Pk',
};

const ALL_FINGERS: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

interface Props {
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  moments: PerformanceMoment[];
  selectedMomentIndex: number;
  transitionResults: TransitionResult[];
  onMovePad: (fromPadKey: string, toRow: number, toCol: number) => void;
  onReassignFinger: (padKey: string, hand: 'left' | 'right', finger: FingerType) => void;
}

export function TemporalGrid({
  layout,
  padFingerAssignment,
  moments,
  selectedMomentIndex,
  transitionResults,
  onMovePad,
  onReassignFinger,
}: Props) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editingPad, setEditingPad] = useState<string | null>(null);

  // Active pads for the selected moment
  const activePads = useMemo(() => {
    const set = new Set<string>();
    const moment = moments[selectedMomentIndex];
    if (!moment) return set;
    for (const note of moment.notes) {
      if (note.padId) set.add(note.padId);
    }
    return set;
  }, [moments, selectedMomentIndex]);

  // Next moment's active pads (for transition arcs)
  const nextActivePads = useMemo(() => {
    const set = new Set<string>();
    const nextMoment = moments[selectedMomentIndex + 1];
    if (!nextMoment) return set;
    for (const note of nextMoment.notes) {
      if (note.padId) set.add(note.padId);
    }
    return set;
  }, [moments, selectedMomentIndex]);

  // Current transition status
  const currentTransition = useMemo(() => {
    return transitionResults.find(t => t.transitionIndex === selectedMomentIndex);
  }, [transitionResults, selectedMomentIndex]);

  // Violated pads from transition evidence
  const violatedPads = useMemo(() => {
    const set = new Set<string>();
    if (!currentTransition) return set;
    for (const e of currentTransition.evidence) {
      if (e.pads) {
        for (const p of e.pads) set.add(p);
      }
    }
    return set;
  }, [currentTransition]);

  const handleDragStart = useCallback((pk: string) => {
    setDragSource(pk);
  }, []);

  const handleDragOver = useCallback((e: { preventDefault: () => void }, pk: string) => {
    e.preventDefault();
    setDragOver(pk);
  }, []);

  const handleDrop = useCallback(
    (targetRow: number, targetCol: number) => {
      if (dragSource) {
        const targetKey = padKey(targetRow, targetCol);
        if (targetKey !== dragSource && !layout.padToVoice[targetKey]) {
          onMovePad(dragSource, targetRow, targetCol);
        }
      }
      setDragSource(null);
      setDragOver(null);
    },
    [dragSource, layout.padToVoice, onMovePad],
  );

  const handleDragEnd = useCallback(() => {
    setDragSource(null);
    setDragOver(null);
  }, []);

  const handlePadClick = useCallback((pk: string) => {
    setEditingPad((prev: string | null) => (prev === pk ? null : pk));
  }, []);

  // Render grid
  const rows = [];
  for (let row = ROWS - 1; row >= 0; row--) {
    const cells = [];
    for (let col = 0; col < COLS; col++) {
      const pk = padKey(row, col);
      const voice = layout.padToVoice[pk] as Voice | undefined;
      const owner = padFingerAssignment[pk];
      const isActive = activePads.has(pk);
      const isNextActive = nextActivePads.has(pk);
      const isViolated = violatedPads.has(pk);
      const isDragSource = dragSource === pk;
      const isDragTarget = dragOver === pk;

      cells.push(
        <div
          key={pk}
          className={`
            relative w-12 h-12 rounded border text-center flex flex-col items-center justify-center
            transition-all duration-100 select-none
            ${voice
              ? owner
                ? `${HAND_COLORS[owner.hand].bg} ${HAND_COLORS[owner.hand].border}`
                : 'bg-gray-700/50 border-gray-500/40'
              : 'bg-gray-900/30 border-gray-800/40'}
            ${isActive ? 'ring-2 ring-yellow-400/70' : ''}
            ${isNextActive && !isActive ? 'ring-1 ring-cyan-400/40' : ''}
            ${isViolated ? 'ring-2 ring-red-500/80' : ''}
            ${isDragSource ? 'opacity-30' : ''}
            ${isDragTarget ? 'ring-2 ring-blue-400' : ''}
            ${voice ? 'cursor-pointer' : ''}
          `}
          draggable={!!voice}
          onDragStart={() => voice && handleDragStart(pk)}
          onDragOver={(e: { preventDefault: () => void }) => handleDragOver(e, pk)}
          onDrop={() => handleDrop(row, col)}
          onDragEnd={handleDragEnd}
          onClick={() => voice && handlePadClick(pk)}
        >
          {/* Voice label */}
          {voice && (
            <span className="text-[7px] text-gray-300 truncate w-full px-0.5 leading-tight">
              {voice.name.length > 6 ? voice.name.slice(0, 5) + '…' : voice.name}
            </span>
          )}

          {/* Finger label */}
          {owner && (
            <span className={`text-[8px] font-mono ${HAND_COLORS[owner.hand].text}`}>
              {owner.hand === 'left' ? 'L' : 'R'}-{FINGER_LABELS[owner.finger]}
            </span>
          )}

          {/* Active indicator dot */}
          {isActive && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />
          )}

          {/* Next-active indicator */}
          {isNextActive && !isActive && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
          )}

          {/* Pad coordinate */}
          <span className="absolute bottom-0 right-0.5 text-[6px] text-gray-600">
            {row},{col}
          </span>
        </div>,
      );
    }
    rows.push(
      <div key={row} className="flex gap-0.5">
        {cells}
      </div>,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Transition status indicator */}
      {currentTransition && (
        <div className={`text-[10px] px-2 py-1 rounded mb-1 ${
          currentTransition.status === 'violation'
            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
            : currentTransition.status === 'degraded'
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            : 'bg-green-500/15 text-green-300 border border-green-500/30'
        }`}>
          Transition {selectedMomentIndex}→{selectedMomentIndex + 1}: {currentTransition.status}
          {currentTransition.costBreakdown.movement.gridDistance > 0 && (
            <span className="ml-2 text-gray-400">
              dist={currentTransition.costBreakdown.movement.gridDistance.toFixed(1)}
              {' '}dt={currentTransition.costBreakdown.timeDeltaMs.toFixed(0)}ms
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="flex flex-col gap-0.5">{rows}</div>

      {/* Legend */}
      <div className="flex gap-3 mt-1 text-[9px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" /> current moment
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400/50" /> next moment
        </span>
      </div>

      {/* Finger reassignment popover */}
      {editingPad && layout.padToVoice[editingPad] && (
        <FingerPicker
          padKey={editingPad}
          currentHand={padFingerAssignment[editingPad]?.hand ?? 'right'}
          currentFinger={padFingerAssignment[editingPad]?.finger ?? 'index'}
          onSelect={(hand, finger) => {
            onReassignFinger(editingPad, hand, finger);
            setEditingPad(null);
          }}
          onClose={() => setEditingPad(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Finger Picker Sub-component
// ============================================================================

function FingerPicker({
  padKey: pk,
  currentHand,
  currentFinger,
  onSelect,
  onClose,
}: {
  padKey: string;
  currentHand: 'left' | 'right';
  currentFinger: FingerType;
  onSelect: (hand: 'left' | 'right', finger: FingerType) => void;
  onClose: () => void;
}) {
  const [hand, setHand] = useState(currentHand);
  const coord = parsePadKey(pk);

  return (
    <div className="mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          Reassign finger for pad {coord ? `(${coord.row},${coord.col})` : pk}
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">
          ✕
        </button>
      </div>

      {/* Hand toggle */}
      <div className="flex gap-1 mb-2">
        {(['left', 'right'] as const).map(h => (
          <button
            key={h}
            onClick={() => setHand(h)}
            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
              hand === h
                ? h === 'left'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Finger buttons */}
      <div className="flex gap-1">
        {ALL_FINGERS.map(f => (
          <button
            key={f}
            onClick={() => onSelect(hand, f)}
            className={`flex-1 text-[10px] px-1 py-1.5 rounded transition-colors ${
              hand === currentHand && f === currentFinger
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
            }`}
          >
            {FINGER_LABELS[f]}
          </button>
        ))}
      </div>
    </div>
  );
}
