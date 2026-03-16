/**
 * InteractiveGrid.
 *
 * Wraps the 8x8 Push 3 grid with interactive editing capabilities:
 * - Click empty pad to assign selected sound
 * - Drag sound from VoicePalette onto a pad
 * - Drag between pads to swap
 * - Click assigned pad to select/inspect
 * - Drop-target highlighting
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import chroma from 'chroma-js';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, getActiveStreams, type SoundStream } from '../state/projectState';
import { PadContextMenu } from './PadContextMenu';
import { type Voice } from '../../types/voice';
import { type FingerAssignment } from '../../types/executionPlan';
import { buildSelectedTransitionModel } from '../analysis/selectionModel';

interface InteractiveGridProps {
  assignments?: FingerAssignment[];
  selectedEventIndex?: number | null;
  onEventClick?: (idx: number | null) => void;
  /** When provided, display this layout instead of the global active layout.
   *  Used when viewing a candidate solution whose layout differs from the user's. */
  layoutOverride?: import('../../types/layout').Layout;
  /** Show onion skin overlay: previous/current/next event layers. */
  onionSkin?: boolean;
  /** Voice-level hand/finger constraints from SOUNDS panel (keyed by stream ID). */
  voiceConstraints?: Record<string, { hand?: 'left' | 'right'; finger?: string }>;
}

/** Abbreviated finger names for display */
const FINGER_ABBREV: Record<string, string> = {
  thumb: 'Th', index: 'Ix', middle: 'Md', ring: 'Rg', pinky: 'Pk',
};

const HAND_COLORS = {
  left: '#0088FF', // Azure (V1 left hand base)
  right: '#FF4400', // Orange-Red (V1 right hand base)
  Unplayable: '#FF3333',
  mixed: '#FFCC00',
};

const CELL_SIZE = 56;
const CELL_GAP = 4;
const GRID_STEP = CELL_SIZE + CELL_GAP;
const GRID_OFFSET_X = 20;
const GRID_CENTER_OFFSET = CELL_SIZE / 2;

interface PadSummary {
  voiceName: string;
  voiceColor: string | null;
  noteNumber: number | null;
  hands: Set<string>;
  fingers: Set<string>;
  hitCount: number;
}

function safeColorAlpha(color: string | null | undefined, alpha: number, fallback: string) {
  if (!color) return fallback;
  try {
    return chroma(color).alpha(alpha).css();
  } catch {
    return fallback;
  }
}

/** Physical reach threshold: pads farther apart than this are flagged as impossible. */
const IMPOSSIBLE_REACH_THRESHOLD = 5;

export function InteractiveGrid({ assignments, selectedEventIndex, onEventClick, layoutOverride, onionSkin = false, voiceConstraints = {} }: InteractiveGridProps) {
  const { state, dispatch } = useProject();
  const layout = layoutOverride ?? getDisplayedLayout(state);
  const activeStreams = getActiveStreams(state);
  const [dragOverPad, setDragOverPad] = useState<string | null>(null);
  const [dragSourcePad, setDragSourcePad] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ padKey: string; x: number; y: number } | null>(null);

  // Voice lookup by noteNumber
  const voiceByNote = useMemo(() => {
    const map = new Map<number, SoundStream>();
    for (const s of state.soundStreams) {
      map.set(s.originalMidiNote, s);
    }
    return map;
  }, [state.soundStreams]);

  // Build per-pad summary from assignments, overlaying voiceConstraints
  const padSummaries = useMemo(() => {
    const map = new Map<string, PadSummary>();
    if (!assignments) return map;
    for (const a of assignments) {
      if (a.row === undefined || a.col === undefined) continue;
      const key = `${a.row},${a.col}`;
      let summary = map.get(key);
      if (!summary) {
        const voice = voiceByNote.get(a.noteNumber);
        summary = {
          voiceName: voice?.name ?? `N${a.noteNumber}`,
          voiceColor: voice?.color ?? null,
          noteNumber: a.noteNumber,
          hands: new Set(),
          fingers: new Set(),
          hitCount: 0,
        };
        map.set(key, summary);
      }
      // Overlay voiceConstraints: if the user set a hand/finger for this voice, use it
      const voice = voiceByNote.get(a.noteNumber);
      const constraint = voice ? voiceConstraints[voice.id] : undefined;
      const effectiveHand = constraint?.hand ?? a.assignedHand;
      const effectiveFinger = constraint?.finger ?? a.finger;
      summary.hands.add(effectiveHand);
      if (effectiveFinger) summary.fingers.add(`${effectiveHand[0].toUpperCase()}-${FINGER_ABBREV[effectiveFinger] ?? effectiveFinger}`);
      summary.hitCount++;
    }
    return map;
  }, [assignments, voiceByNote, voiceConstraints]);

  // Selected pads: all assignments at the same start time as the selected event
  const selectedPadKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selectedEventIndex === null || !assignments) return keys;
    const selectedAssignment = assignments.find(a => a.eventIndex === selectedEventIndex);
    if (!selectedAssignment) return keys;
    const targetTime = selectedAssignment.startTime;
    for (const a of assignments) {
      if (a.startTime === targetTime && a.row !== undefined && a.col !== undefined) {
        keys.add(`${a.row},${a.col}`);
      }
    }
    return keys;
  }, [assignments, selectedEventIndex]);

  const selectedTransition = useMemo(
    () => buildSelectedTransitionModel(assignments, selectedEventIndex),
    [assignments, selectedEventIndex],
  );

  const nextPadKeys = selectedTransition?.nextPadKeys ?? new Set<string>();
  const previousPadKeys = selectedTransition?.previousPadKeys ?? new Set<string>();
  const sharedPadKeys = selectedTransition?.sharedPadKeys ?? new Set<string>();

  // Check for impossible moves (distance > physical reach)
  const impossibleMoveTargets = useMemo(() => {
    const targets = new Set<string>();
    if (!selectedTransition || !onionSkin) return targets;
    for (const move of selectedTransition.fingerMoves) {
      if (move.rawDistance !== undefined && move.rawDistance > IMPOSSIBLE_REACH_THRESHOLD) {
        if (move.toPad) targets.add(move.toPad);
      }
    }
    return targets;
  }, [selectedTransition, onionSkin]);

  const transitionPaths = useMemo(() => {
    if (!selectedTransition) return [];

    return selectedTransition.fingerMoves
      .filter(move => move.fromPad && move.toPad && !move.isHold)
      .map(move => {
        const [fromRow, fromCol] = move.fromPad!.split(',').map(Number);
        const [toRow, toCol] = move.toPad!.split(',').map(Number);
        const startX = GRID_OFFSET_X + toGridX(fromCol);
        const startY = toGridY(fromRow);
        const endX = GRID_OFFSET_X + toGridX(toCol);
        const endY = toGridY(toRow);
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const controlX = midX + (move.hand === 'left' ? -18 : 18);
        const controlY = midY - 24;
        return {
          id: `${move.hand}-${move.finger}-${move.fromPad}-${move.toPad}`,
          color: HAND_COLORS[move.hand],
          label: `${move.hand[0].toUpperCase()}-${FINGER_ABBREV[move.finger] ?? move.finger}`,
          d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
          endX,
          endY,
        };
      });
  }, [selectedTransition]);

  // Active playing pads — with blink tracking for repeated hits
  const BLINK_DURATION_MS = 120; // how long the flash lasts
  const prevActivePadsRef = useRef(new Set<string>());
  const [blinkingPads, setBlinkingPads] = useState(new Map<string, number>()); // padKey → timestamp

  const activePadKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!assignments || (!state.isPlaying && state.currentTime === 0)) return keys;

    // Map event keys to durations
    const durationMap = new Map<string, number>();
    for (const stream of state.soundStreams) {
      if (stream.muted) continue;
      for (const ev of stream.events) {
        durationMap.set(ev.eventKey, ev.duration);
      }
    }

    for (const a of assignments) {
      const duration = (a.eventKey && durationMap.get(a.eventKey)) || 0.2;
      if (state.currentTime >= a.startTime && state.currentTime < a.startTime + duration) {
        if (a.row !== undefined && a.col !== undefined) {
          keys.add(`${a.row},${a.col}`);
        }
      }
    }
    return keys;
  }, [assignments, state.currentTime, state.isPlaying, state.soundStreams]);

  // Detect new note-on events: pads that just became active (weren't active last frame)
  useEffect(() => {
    if (!state.isPlaying) {
      prevActivePadsRef.current = new Set();
      setBlinkingPads(new Map());
      return;
    }

    const prev = prevActivePadsRef.current;
    const now = Date.now();
    let hasNew = false;
    const newBlinks = new Map(blinkingPads);

    // Find pads that are newly active (note-on)
    for (const key of activePadKeys) {
      if (!prev.has(key)) {
        newBlinks.set(key, now);
        hasNew = true;
      }
    }

    // Clean up expired blinks
    for (const [key, t] of newBlinks) {
      if (now - t > BLINK_DURATION_MS) {
        newBlinks.delete(key);
        hasNew = true;
      }
    }

    if (hasNew) setBlinkingPads(newBlinks);
    prevActivePadsRef.current = new Set(activePadKeys);
  }, [activePadKeys, state.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle dropping a sound onto a pad
  const handleDrop = useCallback((e: React.DragEvent, padKey: string) => {
    e.preventDefault();
    setDragOverPad(null);

    // Check if it's a palette drag (sound stream)
    const streamData = e.dataTransfer.getData('application/pushflow-stream');
    if (streamData) {
      try {
        const data = JSON.parse(streamData);
        const stream = state.soundStreams.find(s => s.id === data.id);
        if (stream) {
          dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream } });
        }
      } catch { /* invalid data */ }
      setDragSourcePad(null);
      return;
    }

    // Check if it's a pad-to-pad drag (swap)
    const padData = e.dataTransfer.getData('application/pushflow-pad');
    if (padData && padData !== padKey) {
      dispatch({ type: 'SWAP_PADS', payload: { padKeyA: padData, padKeyB: padKey } });
    }
    setDragSourcePad(null);
  }, [state.soundStreams, dispatch]);

  const handleDragOver = useCallback((e: React.DragEvent, padKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPad(padKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPad(null);
  }, []);

  // Drag from a pad (for swapping)
  const handlePadDragStart = useCallback((e: React.DragEvent, padKey: string, voice: Voice) => {
    e.dataTransfer.setData('application/pushflow-pad', padKey);
    e.dataTransfer.setData('application/pushflow-stream', JSON.stringify({
      id: voice.id,
      name: voice.name,
      color: voice.color,
      originalMidiNote: voice.originalMidiNote,
      source: 'grid',
    }));
    e.dataTransfer.effectAllowed = 'move';
    setDragSourcePad(padKey);
  }, []);

  const handlePadClick = useCallback((row: number, col: number) => {
    const padKey = `${row},${col}`;
    const voice = layout?.padToVoice[padKey];

    if (!voice) {
      // Empty pad — if there's a selected event, find its assignment
      if (onEventClick) onEventClick(null);
      return;
    }

    // Pad has a voice — find an assignment for this pad and select it
    if (assignments && onEventClick) {
      const a = assignments.find(fa => fa.row === row && fa.col === col);
      onEventClick(a?.eventIndex ?? null);
    }
  }, [layout, assignments, onEventClick]);

  const handleRemovePad = useCallback((padKey: string) => {
    dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey } });
  }, [dispatch]);

  // Render grid rows (row 7 at top, row 0 at bottom — Push 3 orientation)
  const rows = [];
  for (let row = 7; row >= 0; row--) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const padKey = `${row},${col}`;
      const voice = layout?.padToVoice[padKey];
      const summary = padSummaries.get(padKey);
      const isSelected = selectedPadKeys.has(padKey);
      const isActivePlaying = activePadKeys.has(padKey);
      const isBlinking = blinkingPads.has(padKey);
      const isNext = nextPadKeys.has(padKey);
      const isPrevious = onionSkin && previousPadKeys.has(padKey) && !isSelected;
      const isShared = sharedPadKeys.has(padKey);
      const isImpossible = impossibleMoveTargets.has(padKey);
      const isDragOver = padKey === dragOverPad;
      const isDragSource = padKey === dragSourcePad;
      const constraint = layout?.fingerConstraints[padKey];

      // Determine colors
      let bgColor = 'var(--bg-panel)';
      let borderColor = 'var(--border-subtle)';
      let textColor = 'var(--text-tertiary)';
      let glowColor: string | null = null;
      let isGlowActive = false;

      if (voice) {
        if (summary && summary.hitCount > 0) {
          const hands = [...summary.hands];
          if (hands.length === 1 && hands[0] !== 'Unplayable') {
            glowColor = HAND_COLORS[hands[0] as 'left' | 'right'] ?? HAND_COLORS.mixed;
            borderColor = glowColor;
            textColor = 'var(--text-primary)';
            isGlowActive = true;
          } else if (hands.includes('Unplayable') && hands.length === 1) {
            glowColor = HAND_COLORS.Unplayable;
            borderColor = glowColor;
            textColor = glowColor;
            isGlowActive = true;
          } else {
            glowColor = HAND_COLORS.mixed;
            borderColor = glowColor;
            textColor = 'var(--text-primary)';
            isGlowActive = true;
          }
        } else {
          // Assigned but no analysis yet
          glowColor = voice.color ?? 'var(--border-strong)';
          borderColor = glowColor;
          textColor = 'var(--text-secondary)';
          // No isGlowActive here unless selected/playing
        }
      }

      // Finger display
      const fingerList = summary ? [...summary.fingers].slice(0, 2) : [];

      // Check if stream is muted
      const streamForVoice = voice ? state.soundStreams.find(s => s.id === voice.id) : null;
      const isMuted = streamForVoice?.muted ?? false;

      // Active/selected states override glow level, but keep the color if we have one
      const displayGlowColor = glowColor ?? borderColor;
      const boxGlow = isBlinking
        ? `inset 0 0 25px ${displayGlowColor}, 0 0 18px ${displayGlowColor}, 0 0 4px rgba(255,255,255,0.6)`
        : isSelected || isActivePlaying
          ? `inset 0 0 15px ${displayGlowColor}, 0 0 10px ${displayGlowColor}`
          : isGlowActive
            ? `inset 0 0 8px ${safeColorAlpha(displayGlowColor, 0.3, displayGlowColor)}`
            : 'none';

      cells.push(
        <div
          key={padKey}
          className={`
            group relative flex flex-col items-center justify-center
            w-14 h-14 rounded-lg text-[10px] font-mono leading-tight
            border transition-all duration-100 select-none
            ${isSelected ? 'z-10 scale-105 brightness-125 bg-[var(--bg-card)]' : ''}
            ${isBlinking && !isSelected ? 'z-10 scale-110 brightness-200 bg-[var(--bg-card)]' : ''}
            ${isActivePlaying && !isSelected && !isBlinking ? 'z-10 scale-105 brightness-150 bg-[var(--bg-card)]' : ''}
            ${isNext && !isSelected ? 'border-dashed brightness-110' : ''}
            ${isPrevious ? 'opacity-60' : ''}
            ${isShared ? 'ring-1 ring-emerald-400/50' : ''}
            ${isImpossible ? 'ring-2 ring-red-500/80' : ''}
            ${isDragOver ? 'ring-2 ring-blue-400/60 scale-105 bg-[var(--bg-card)]' : ''}
            ${isDragSource ? 'opacity-30' : ''}
            ${isMuted ? 'opacity-30 pointer-events-none' : ''}
            ${!voice ? 'hover:brightness-110' : 'hover:scale-[1.02]'}
            ${isMuted ? 'cursor-default' : 'cursor-pointer active:scale-95'}
          `}
          style={{
            backgroundColor: isSelected || isActivePlaying
              ? 'var(--bg-card)'
              : isNext && !voice
                ? 'rgba(59, 130, 246, 0.08)'
                : bgColor,
            borderColor: isDragOver ? '#3b82f6' : isNext && !isSelected ? '#60a5fa' : borderColor,
            color: textColor,
            boxShadow: boxGlow,
            opacity: isNext && !isSelected && !isActivePlaying ? 0.92 : undefined,
          }}
          onClick={() => !isMuted && handlePadClick(row, col)}
          onContextMenu={e => {
            e.preventDefault();
            if (!isMuted) setContextMenu({ padKey, x: e.clientX, y: e.clientY });
          }}
          onDragOver={e => !isMuted && handleDragOver(e, padKey)}
          onDragLeave={handleDragLeave}
          onDrop={e => !isMuted && handleDrop(e, padKey)}
          draggable={!!voice && !isMuted}
          onDragStart={e => voice && !isMuted && handlePadDragStart(e, padKey, voice)}
          onDragEnd={() => { setDragSourcePad(null); setDragOverPad(null); }}
          title={voice
            ? `[${row},${col}] ${voice.name}${summary ? ` | ${summary.hitCount} hits` : ''}${constraint ? ` | Constraint: ${constraint}` : ''}`
            : `[${row},${col}] empty — drop a sound here`}
        >
          {/* Previous event ghost (onion skin) */}
          {isPrevious && !voice && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ backgroundColor: 'rgba(100, 130, 255, 0.08)', border: '1px dotted rgba(100, 130, 255, 0.2)' }}
            />
          )}
          {voice ? (
            <>
              {/* Voice name */}
              <span className="block truncate w-full px-0.5 text-center text-[11px] font-semibold text-white/95 leading-tight">
                {voice.name}
              </span>
              {/* Fingers (from analysis) */}
              {fingerList.length > 0 && (
                <span className="block text-[10px] font-medium leading-none mt-0.5" style={{ color: textColor }}>
                  {fingerList.join(' ')}
                </span>
              )}
              {/* Hit count badge */}
              {summary && summary.hitCount > 0 && (
                <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold bg-black/40 rounded px-0.5 text-gray-400 pointer-events-none">
                  {summary.hitCount}
                </span>
              )}
              
              {/* Remove button (visible on hover via parent group) */}
              <button
                className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center
                           text-[9px] text-red-300 bg-red-500/30 rounded-bl opacity-0
                           group-hover:opacity-100 transition-opacity"
                onClick={e => {
                  e.stopPropagation();
                  handleRemovePad(padKey);
                }}
                title="Remove from pad"
              >
                ×
              </button>
            </>
          ) : (
            <span className="text-[8px] text-gray-600">{row},{col}</span>
          )}
        </div>
      );
    }
    rows.push(
      <div key={row} className="flex gap-1 items-center">
        <span className="w-4 text-[10px] text-gray-500 text-right mr-1 font-mono">{row}</span>
        {cells}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Analysis stale indicator */}
      {state.analysisStale && state.analysisResult && (
        <div className="text-[10px] text-amber-400 mb-1">
          Layout changed — analysis outdated
        </div>
      )}

      <div className="inline-block relative">
        {transitionPaths.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible z-20"
            style={{ width: GRID_OFFSET_X + (GRID_STEP * 8), height: GRID_STEP * 8 }}
            viewBox={`0 0 ${GRID_OFFSET_X + (GRID_STEP * 8)} ${GRID_STEP * 8}`}
            aria-hidden="true"
          >
            {transitionPaths.map(path => (
              <g key={path.id}>
                <path
                  d={path.d}
                  fill="none"
                  stroke={path.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeOpacity="0.8"
                />
                <circle cx={path.endX} cy={path.endY} r="3" fill={path.color} fillOpacity="0.9" />
              </g>
            ))}
          </svg>
        )}
        <div className="flex flex-col gap-1">
          {rows}
          {/* Column labels */}
          <div className="flex gap-1 ml-5">
            {Array.from({ length: 8 }, (_, col) => (
              <div key={col} className="w-14 text-center text-[10px] text-gray-500 font-mono">{col}</div>
            ))}
          </div>
        </div>
        {/* Zone labels */}
        <div className="flex ml-5 mt-1 gap-1">
          <div className="w-[calc(4*3.5rem+3*0.25rem)] text-center text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] pt-0.5">
            Left Hand
          </div>
          <div className="w-[calc(4*3.5rem+3*0.25rem)] text-center text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] pt-0.5">
            Right Hand
          </div>
        </div>
      </div>

      {/* Summary line */}
      {layout && (
        <div className="space-y-1 mt-1">
          <div className="text-[10px] text-gray-500">
            {Object.keys(layout.padToVoice).length} pad{Object.keys(layout.padToVoice).length !== 1 ? 's' : ''} assigned
            {' / '}
            {activeStreams.length} active sound{activeStreams.length !== 1 ? 's' : ''}
          </div>
          {selectedTransition?.next && (
            <div className="text-[10px] text-sky-300/80">
              Transition preview: {selectedTransition.timeDelta?.toFixed(3)}s to next event
              {' · '}
              {selectedTransition.sharedPadKeys.size} shared pad{selectedTransition.sharedPadKeys.size === 1 ? '' : 's'}
              {' · '}
              {selectedTransition.fingerMoves.filter(move => !move.isHold && move.fromPad && move.toPad).length} finger move{selectedTransition.fingerMoves.filter(move => !move.isHold && move.fromPad && move.toPad).length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <PadContextMenu
          padKey={contextMenu.padKey}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function toGridX(col: number): number {
  return (col * GRID_STEP) + GRID_CENTER_OFFSET;
}

function toGridY(row: number): number {
  return ((7 - row) * GRID_STEP) + GRID_CENTER_OFFSET;
}
