/**
 * InteractiveGrid.
 *
 * Wraps the 8x8 Push 3 grid with interactive editing capabilities. What a pad
 * click means comes from the input table (src/ui/input/inputTable.ts):
 * - with a Sound armed, a click on an empty pad places it (T62);
 * - otherwise a click selects the pad and its Sound, keeping any selected event;
 * - drag a Sound from VoicePalette onto a pad, or a pad onto another to swap;
 * - right-click opens the pad menu.
 * While the grid shows a layout edits don't go to (an inspected candidate,
 * variant or recovered draft, Active over a differing draft, or a trace
 * replay), every one of those edits is refused with a hint (S3.2).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import chroma from 'chroma-js';
import { Lock } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, isPadLocked, type SoundStream } from '../state/projectState';
import { padClickMeaning, PAD_TAKEN_MESSAGE } from '../input/inputTable';
import { useToast } from './shared/Toast';
import { type Layout } from '../../types/layout';
import { LOCKED_SOUND_DRAG_TYPE } from './dragTypes';
import { PadContextMenu } from './PadContextMenu';
import { useRemovePadWithUndo } from '../hooks/useRemovePadWithUndo';
import { useReadOnlyHint } from '../hooks/useReadOnlyHint';
import { type Voice } from '../../types/voice';
import { type FingerAssignment } from '../../types/executionPlan';
import { type GridLabelSettings } from '../state/viewSettings';
import { buildSelectedTransitionModel } from '../analysis/selectionModel';
import { findSelectedEvent, getEventTimeline } from '../analysis/eventTimeline';
import { buildSoundStreamLookup } from '../analysis/soundStreamLookup';
import { padLabel, padLabelLines, sharedNamePrefix } from '../analysis/padLabels';
import { midiNoteToName } from '../../utils/midiNotes';
import { formatPadPosition, spokenPadPosition } from '../../utils/padPosition';
import { COMPOSER_PRESET_DRAG_TYPE } from './composer/PresetCard';
import { type PresetDragPreview } from '../../types/composerPreset';
import {
  AXIS_WIDTH,
  COLUMN_LABELS_HEIGHT,
  FRAME_INSET,
  PAD_GAP,
  SECONDARY_LABEL_MIN_PAD,
  STATE_BAR_GAP,
  STATE_BAR_HEIGHT,
  ZONE_LABELS_HEIGHT,
} from './workspace/gridSizing';

interface InteractiveGridProps {
  assignments?: FingerAssignment[];
  /** When provided, display this layout instead of the one edits go to: an
   *  inspected read-only layout (S3.2) or a replayed trace step. */
  layoutOverride?: import('../../types/layout').Layout;
  /** Show onion skin overlay: previous/current/next event layers. */
  onionSkin?: boolean;
  /** Voice-level hand/finger constraints from SOUNDS panel (keyed by stream ID). */
  voiceConstraints?: Record<string, { hand?: 'left' | 'right'; finger?: string }>;
  /** Grid label settings controlling what info is shown on pads. */
  gridLabels?: GridLabelSettings;
  /** Pad keys belonging to the currently selected placed preset instance. */
  highlightedInstancePads?: Set<string>;
  /** Callback when a composer preset is dropped on the grid. */
  onPresetDrop?: (presetId: string, anchorRow: number, anchorCol: number, isMirrored: boolean) => void;
  /** Ghost preview during preset drag-over. */
  dragPreview?: PresetDragPreview | null;
  /** Callback when dragging a preset over a grid pad (for ghost preview). */
  onGridDragOver?: (anchorRow: number, anchorCol: number) => void;
  /** Callback when drag leaves the grid. */
  onGridDragLeave?: () => void;
  /** Current optimization iteration for visual debugging overlays. */
  debuggerIteration?: import('../../engine/optimization/optimizerInterface').OptimizationIteration;
  /** Pad edge in px, measured by the workspace (T04); labels keep their sizes. */
  padSize?: number;
  /** The layout-state bar (S3.2), in the fixed slot above the frame. */
  stateBar?: React.ReactNode;
}

/** Abbreviated finger names for display (numbered: thumb=1 through pinky=5) */
const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const HAND_COLORS = {
  left: '#0088FF', // Azure (V1 left hand base)
  right: '#FF4400', // Orange-Red (V1 right hand base)
  Unplayable: '#FF3333',
  mixed: '#FFCC00',
};

/** The overlay's x origin: pads start right of the row-number column. */
const GRID_OFFSET_X = AXIS_WIDTH;
/** Pad size the transition arcs' curvature was drawn for; arcs scale from it. */
const ARC_REFERENCE_PAD = 56;

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

export function InteractiveGrid({ assignments, layoutOverride, onionSkin = false, voiceConstraints = {}, gridLabels, highlightedInstancePads, onPresetDrop, dragPreview, onGridDragOver, onGridDragLeave, debuggerIteration, padSize = 56, stateBar }: InteractiveGridProps) {
  const { state, dispatch } = useProject();
  const toast = useToast();
  // Looking never writes (S3.2): `refuse()` says how to edit and blocks the gesture.
  const { hint: readOnlyHint, refuse: refuseEdit } = useReadOnlyHint();
  const readOnly = readOnlyHint !== null;
  // Overlay geometry follows the measured pad size (T04).
  const gridStep = padSize + PAD_GAP;
  const toGridX = (col: number) => col * gridStep + padSize / 2;
  const toGridY = (row: number) => (7 - row) * gridStep + padSize / 2;
  const arcScale = padSize / ARC_REFERENCE_PAD;
  // Secondary labels (note, position, empty-pad coordinates) hide on small pads.
  const showSecondaryLabels = padSize >= SECONDARY_LABEL_MIN_PAD;
  const layout = layoutOverride ?? getDisplayedLayout(state);
  // Drum-rack note for a pad is a function of its GRID POSITION, never the sound
  // that happens to sit on it (Product Invariant #5: MIDI pitch is metadata only).
  // bottom-left pad (row 0, col 0) = bottomLeftNote (default 36/C1); each step
  // right is +1, each row up is +8 — the 8×8 window into the 128-cell drum rack.
  const bottomLeftNote = state.instrumentConfig?.bottomLeftNote ?? 36;
  const padDrumRackNote = (row: number, col: number) => bottomLeftNote + row * 8 + col;
  const [dragOverPad, setDragOverPad] = useState<string | null>(null);
  const [dragSourcePad, setDragSourcePad] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ padKey: string; x: number; y: number; pad: HTMLElement } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  // The arrows are a grid overlay like the finger labels: on by default, in the gear (S3.2).
  const showTransitionArrows = gridLabels?.showTransitionArrows ?? true;

  const soundStreamLookup = useMemo(
    () => buildSoundStreamLookup(state.soundStreams),
    [state.soundStreams],
  );
  // Pads drop the words every Sound's name starts with (T17).
  const namePrefix = useMemo(
    () => sharedNamePrefix(state.soundStreams.map(s => s.name)),
    [state.soundStreams],
  );
  const nameLines = padLabelLines(padSize);

  // Build a live padToVoice that reflects current stream names/colors
  // (safety net: reducer should already sync, but this ensures display is always fresh)
  const livePadToVoice = useMemo(() => {
    if (!layout) return {};
    const result: Record<string, typeof layout.padToVoice[string]> = {};
    for (const [key, voice] of Object.entries(layout.padToVoice)) {
      const stream = soundStreamLookup.forVoice(voice);
      if (stream) {
        result[key] = {
          ...voice,
          id: stream.id,
          name: stream.name,
          color: stream.color,
          originalMidiNote: stream.originalMidiNote,
        };
      } else {
        result[key] = voice;
      }
    }
    return result;
  }, [layout, soundStreamLookup]);

  // Whether to show finger labels on pads (user constraints always show; solver assignments show when toggle is on)
  const showFingerLabels = gridLabels?.showFingerAssignment ?? true;

  // Build per-pad summary from assignments, overlaying voiceConstraints.
  // Finger labels show user constraints always, and solver assignments when showFingerAssignment toggle is on.
  const padSummaries = useMemo(() => {
    const map = new Map<string, PadSummary>();
    if (!assignments) return map;
    for (const a of assignments) {
      if (a.row === undefined || a.col === undefined) continue;
      const key = `${a.row},${a.col}`;
      let summary = map.get(key);
      if (!summary) {
        const voice = soundStreamLookup.forAssignment(a.voiceId);
        summary = {
          voiceName: voice?.name ?? 'Unknown Sound',
          voiceColor: voice?.color ?? null,
          noteNumber: a.noteNumber,
          hands: new Set(),
          fingers: new Set(),
          hitCount: 0,
        };
        map.set(key, summary);
      }
      // Use solver hand for glow coloring (visual feedback).
      // Show finger labels from user constraints or solver assignments (when toggle is on).
      const voice = soundStreamLookup.forAssignment(a.voiceId);
      const constraint = voice ? voiceConstraints[voice.id] : undefined;
      const effectiveHand = constraint?.hand ?? a.assignedHand;
      summary.hands.add(effectiveHand);
      // Add finger label: user constraint takes priority, then solver assignment
      if (constraint?.hand && constraint?.finger) {
        const handChar = constraint.hand === 'left' ? 'L' : 'R';
        const fingerNum = FINGER_ABBREV[constraint.finger] ?? constraint.finger;
        summary.fingers.add(`${handChar}${fingerNum}`);
      } else if (showFingerLabels && a.assignedHand && (a.assignedHand as string) !== 'raw' && (a.assignedHand as string) !== 'Unplayable' && a.finger && (a.finger as string) !== 'unassigned') {
        const handChar = a.assignedHand === 'left' ? 'L' : 'R';
        const fingerNum = FINGER_ABBREV[a.finger] ?? a.finger;
        summary.fingers.add(`${handChar}${fingerNum}`);
      }
      summary.hitCount++;
    }
    return map;
  }, [assignments, soundStreamLookup, voiceConstraints, showFingerLabels]);

  // The selected event (S4.1), whole: every note the plan plays at that
  // instant, by eventKey, so a chord played a few ms apart lights every pad.
  const timeline = getEventTimeline(state);
  const selectedEvent = useMemo(
    () => findSelectedEvent(timeline, assignments, state.selectedMomentKey),
    [timeline, assignments, state.selectedMomentKey],
  );

  // Selected pads, and padKey → finger label, for the selected event.
  const { selectedPadKeys, selectedPadFingers } = useMemo(() => {
    const keys = new Set<string>();
    const fingers = new Map<string, { label: string; hand: string; color: string }>();
    for (const a of selectedEvent?.notes ?? []) {
      if (a.row !== undefined && a.col !== undefined) {
        const key = `${a.row},${a.col}`;
        keys.add(key);
        const handChar = a.assignedHand === 'Unplayable' ? '?' : a.assignedHand[0].toUpperCase();
        const fingerNum = a.finger ? (FINGER_ABBREV[a.finger] ?? a.finger) : '';
        const handColor = a.assignedHand === 'left' ? HAND_COLORS.left
          : a.assignedHand === 'right' ? HAND_COLORS.right
          : HAND_COLORS.Unplayable;
        fingers.set(key, { label: `${handChar}${fingerNum}`, hand: a.assignedHand, color: handColor });
      }
    }
    return { selectedPadKeys: keys, selectedPadFingers: fingers };
  }, [selectedEvent]);

  const selectedTransition = useMemo(
    () => buildSelectedTransitionModel(timeline, assignments, state.selectedMomentKey),
    [timeline, assignments, state.selectedMomentKey],
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
    if (!selectedTransition || !showTransitionArrows || state.isPlaying) return [];

    const movesWithDistance = selectedTransition.fingerMoves
      .filter(move => move.fromPad && move.toPad && !move.isHold)
      .map(move => ({ move, distance: move.rawDistance ?? 0 }));

    // Filter to best 3 (shortest) and worst 3 (longest) by distance
    let filteredMoves: typeof movesWithDistance;
    if (movesWithDistance.length <= 6) {
      filteredMoves = movesWithDistance;
    } else {
      const sorted = [...movesWithDistance].sort((a, b) => a.distance - b.distance);
      const best3 = sorted.slice(0, 3);
      const worst3 = sorted.slice(-3);
      // Deduplicate in case of overlap
      const selectedSet = new Set([...best3, ...worst3]);
      filteredMoves = [...selectedSet];
    }

    return filteredMoves.map(({ move }) => {
        const [fromRow, fromCol] = move.fromPad!.split(',').map(Number);
        const [toRow, toCol] = move.toPad!.split(',').map(Number);
        const startX = GRID_OFFSET_X + toGridX(fromCol);
        const startY = toGridY(fromRow);
        const endX = GRID_OFFSET_X + toGridX(toCol);
        const endY = toGridY(toRow);
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const controlX = midX + (move.hand === 'left' ? -18 : 18) * arcScale;
        const controlY = midY - 24 * arcScale;
        return {
          id: `${move.hand}-${move.finger}-${move.fromPad}-${move.toPad}`,
          color: HAND_COLORS[move.hand],
          label: `${move.hand[0].toUpperCase()}${FINGER_ABBREV[move.finger] ?? move.finger}`,
          d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
          endX,
          endY,
        };
      });
  }, [selectedTransition, showTransitionArrows, state.isPlaying, padSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visual Debugger Overlays: Candidate Moves
  const debuggerPaths = useMemo(() => {
    if (!debuggerIteration) return [];
    
    const allMoves = debuggerIteration.candidateMoves
      .filter(move => move.fromPadKey && move.toPadKey && move.fromPadKey !== move.toPadKey);

    // Filter to best 3 (lowest delta) + worst 3 (highest delta) + accepted
    let filteredMoves: typeof allMoves;
    if (allMoves.length <= 7) {
      filteredMoves = allMoves;
    } else {
      const sorted = [...allMoves].sort((a, b) => a.deltaTotal - b.deltaTotal);
      const best3 = sorted.slice(0, 3);
      const worst3 = sorted.slice(-3);
      const accepted = allMoves.filter(m => m.accepted);
      const selectedSet = new Set([...best3, ...worst3, ...accepted]);
      filteredMoves = [...selectedSet];
    }

    return filteredMoves
      .map(move => {
        const [fromRow, fromCol] = move.fromPadKey!.split(',').map(Number);
        const [toRow, toCol] = move.toPadKey!.split(',').map(Number);
        
        const startX = GRID_OFFSET_X + toGridX(fromCol);
        const startY = toGridY(fromRow);
        const endX = GRID_OFFSET_X + toGridX(toCol);
        const endY = toGridY(toRow);
        
        // Add a slight curve so bidirectional overlaps are visible
        const dx = endX - startX;
        const dy = endY - startY;
        const midX = startX + dx / 2;
        const midY = startY + dy / 2;
        const normalX = -dy * 0.15;
        const normalY = dx * 0.15;
        
        const isChosen = move.accepted;
        const isImprovement = move.deltaTotal < -0.01;
        
        let color = '#94a3b8'; // slate-400 (neutral/worse)
        if (isChosen) {
          color = '#3b82f6'; // blue-500 (chosen)
        } else if (isImprovement) {
          color = '#10b981'; // emerald-500 (good but not chosen)
        }
        
        return {
          id: `debug-${move.fromPadKey}-${move.toPadKey}-${move.moveType}`,
          isChosen,
          color,
          d: `M ${startX} ${startY} Q ${midX + normalX} ${midY + normalY} ${endX} ${endY}`,
          labelX: midX + normalX,
          labelY: midY + normalY,
          delta: move.deltaTotal,
          endX,
          endY,
        };
      })
      // sort so chosen move is drawn last (on top)
      .sort((a, b) => (a.isChosen === b.isChosen ? 0 : a.isChosen ? 1 : -1));
  }, [debuggerIteration, padSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active playing pads — with blink tracking for repeated hits
  const BLINK_DURATION_MS = 120; // how long the flash lasts
  /** How long a pad stays lit after it is struck, in seconds. */
  const STRIKE_WINDOW_SECONDS = 0.09;
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
      // A pad is lit for the STRIKE, not for the note's length. Driving this from
      // MIDI duration left one to three pads permanently lit — on the reference
      // file the grid is lit 98% of the time — so it conveyed no rhythm at all,
      // which is the one thing the grid is meant to show during rehearsal.
      const noteDuration = (a.eventKey && durationMap.get(a.eventKey)) || STRIKE_WINDOW_SECONDS;
      const window = Math.min(noteDuration, STRIKE_WINDOW_SECONDS);
      if (state.currentTime >= a.startTime && state.currentTime < a.startTime + window) {
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

  // Build ghost preview pad map for rendering
  const ghostPads = useMemo(() => {
    if (!dragPreview) return null;
    const map = new Map<string, { hand: string | null; valid: boolean }>();
    for (const pad of dragPreview.pads) {
      const absRow = dragPreview.anchorRow + pad.position.rowOffset;
      const absCol = dragPreview.anchorCol + pad.position.colOffset;
      const key = `${absRow},${absCol}`;
      map.set(key, { hand: pad.hand, valid: dragPreview.isValid });
    }
    return map;
  }, [dragPreview]);

  // The latest preset-drop handler, read at drop time: a memoised handleDrop
  // kept a stale one, which validated against an old layout (T65).
  const onPresetDropRef = useRef(onPresetDrop);
  onPresetDropRef.current = onPresetDrop;

  // Handle dropping a sound onto a pad
  const handleDrop = useCallback((e: React.DragEvent, padKey: string) => {
    e.preventDefault();
    setDragOverPad(null);
    // Refused at dragover already; a drop that gets here anyway changes nothing.
    if (refuseEdit()) {
      setDragSourcePad(null);
      return;
    }

    // A locked pad takes no drop, and a locked Sound goes nowhere else (canon
    // section 11). The reducer refuses these too; this keeps the gesture from
    // looking accepted.
    // (A preset drop onto a locked pad reaches its handler, which refuses it with a reason.)
    const isPresetDrop = e.dataTransfer.types.includes(COMPOSER_PRESET_DRAG_TYPE);
    if ((layout && isPadLocked(layout, padKey) && !isPresetDrop) || e.dataTransfer.types.includes(LOCKED_SOUND_DRAG_TYPE)) {
      setDragSourcePad(null);
      return;
    }

    // Check for composer preset drop first
    const presetData = e.dataTransfer.getData(COMPOSER_PRESET_DRAG_TYPE);
    const onPresetDrop = onPresetDropRef.current;
    if (presetData && onPresetDrop) {
      try {
        const { presetId, isMirrored } = JSON.parse(presetData);
        const [rowStr, colStr] = padKey.split(',');
        const anchorRow = parseInt(rowStr, 10);
        const anchorCol = parseInt(colStr, 10);
        onPresetDrop(presetId, anchorRow, anchorCol, isMirrored);
      } catch {
        dispatch({ type: 'SET_ERROR', payload: 'Could not place preset — the dragged data was invalid. Try dragging it again.' });
      }
      return;
    }

    // Check pad-to-pad drag first (swap) — must come before stream check
    // because handlePadDragStart sets both data types
    const padData = e.dataTransfer.getData('application/pushflow-pad');
    if (padData === padKey) {
      // Dropped back on its own pad: nothing to do (T14). The reducer would
      // refuse it too; not dispatching keeps the gesture from looking like an edit.
      setDragSourcePad(null);
      return;
    }
    if (padData) {
      dispatch({ type: 'SWAP_PADS', payload: { padKeyA: padData, padKeyB: padKey } });
      setDragSourcePad(null);
      return;
    }

    // Check if it's a palette drag (sound stream from VoicePalette)
    const streamData = e.dataTransfer.getData('application/pushflow-stream');
    if (streamData) {
      try {
        const data = JSON.parse(streamData);
        const stream = state.soundStreams.find(s => s.id === data.id);
        if (stream) {
          dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream } });
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Could not assign sound — it no longer exists in this project.' });
        }
      } catch {
        dispatch({ type: 'SET_ERROR', payload: 'Could not assign sound — the dragged data was invalid. Try dragging it again.' });
      }
      setDragSourcePad(null);
      return;
    }

    setDragSourcePad(null);
  }, [state.soundStreams, dispatch, layout, refuseEdit]);

  const handleDragOver = useCallback((e: React.DragEvent, padKey: string) => {
    // Nothing drops onto a read-only layout (a Sound, a pad or a preset): the
    // pointer says so, and the hint says how to edit it.
    if (refuseEdit()) {
      e.dataTransfer.dropEffect = 'none';
      setDragOverPad(null);
      return;
    }
    // No drop onto a locked pad, and none of a locked Sound: without
    // preventDefault the browser refuses the drop and the pointer says so.
    const lockedTarget = layout && isPadLocked(layout, padKey) && !e.dataTransfer.types.includes(COMPOSER_PRESET_DRAG_TYPE);
    if (lockedTarget || e.dataTransfer.types.includes(LOCKED_SOUND_DRAG_TYPE)) {
      e.dataTransfer.dropEffect = 'none';
      setDragOverPad(null);
      return;
    }
    e.preventDefault();
    // A preset drag allows only 'copy'; answering 'move' made the browser
    // cancel the drop (T65).
    const isPresetDrag = e.dataTransfer.types.includes(COMPOSER_PRESET_DRAG_TYPE);
    e.dataTransfer.dropEffect = isPresetDrag ? 'copy' : 'move';
    setDragOverPad(padKey);

    // Notify workspace for ghost preview (only for composer preset drags)
    if (onGridDragOver && isPresetDrag) {
      const [rowStr, colStr] = padKey.split(',');
      onGridDragOver(parseInt(rowStr, 10), parseInt(colStr, 10));
    }
  }, [onGridDragOver, layout, refuseEdit]);

  const handleDragLeave = useCallback(() => {
    setDragOverPad(null);
    onGridDragLeave?.();
  }, [onGridDragLeave]);

  // Drag from a pad (for swapping)
  const handlePadDragStart = useCallback((e: React.DragEvent, padKey: string, voice: Voice) => {
    // A read-only layout's pads don't move (S3.2).
    if (refuseEdit()) {
      e.preventDefault();
      return;
    }
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
  }, [refuseEdit]);

  // The armed Sound (click-to-place, T62), if it still exists.
  const armedStream = useMemo(
    () => (state.armedStreamId ? state.soundStreams.find(s => s.id === state.armedStreamId) ?? null : null),
    [state.armedStreamId, state.soundStreams],
  );

  const handlePadClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    const padKey = `${row},${col}`;
    const voice = livePadToVoice[padKey];
    // A pad is taken if it holds a Sound in the layout shown or in the layout
    // edits go to. A read-only layout takes no edits (S3.2), so there only what
    // it shows counts: a placing click on a pad that looks empty is refused with
    // the hint, never read as the armed Sound's own pad in the draft behind it.
    const editable = state.workingLayout ?? state.activeLayout;
    const occupant = voice ?? (readOnly ? undefined : editable.padToVoice[padKey]);
    const occupantId = occupant ? soundStreamLookup.forVoice(occupant)?.id ?? occupant.id : null;
    const meaning = padClickMeaning({
      armed: !!armedStream,
      occupied: !!occupant,
      holdsArmed: !!armedStream && occupantId === armedStream.id,
      eventSelected: state.selectedMomentKey !== null,
      altKey: e.altKey,
    });

    switch (meaning.action) {
      case 'none':
        return;
      case 'disarm':
        dispatch({ type: 'ARM_SOUND', payload: null });
        return;
      case 'taken':
        // Nothing can be placed on a read-only layout, taken pad or not.
        if (refuseEdit()) return;
        toast.show({ message: PAD_TAKEN_MESSAGE, durationMs: 3000 });
        return;
      case 'place': {
        if (refuseEdit()) return;
        const stream = armedStream!;
        const lockedAt = editable.placementLocks[stream.id];
        if (lockedAt && lockedAt !== padKey) {
          toast.show({ message: `${stream.name} is locked to ${formatPadPosition(lockedAt)} · Unlock it to move it`, durationMs: 4000 });
          return;
        }
        const placedAlready = Object.values(editable.padToVoice)
          .some(v => (soundStreamLookup.forVoice(v)?.id ?? v.id) === stream.id);
        // One dispatch, so one undo step ("Place Sound").
        dispatch({ type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey, stream } });
        // Placing arms the next unplaced Sound; moving a placed one ends placing.
        dispatch({ type: 'ARM_SOUND', payload: placedAlready ? null : nextUnplacedSound(state.soundStreams, editable, soundStreamLookup, stream.id) });
        return;
      }
      case 'select-pad':
        dispatch({ type: 'SELECT_PAD', payload: { padKey, streamId: occupantId } });
        return;
      case 'clear-pad':
        dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } });
        return;
    }
  }, [livePadToVoice, state.workingLayout, state.activeLayout, state.soundStreams, soundStreamLookup, armedStream, state.selectedMomentKey, dispatch, toast, refuseEdit, readOnly]);

  // The pad's ×: removes with an Undo toast (T28).
  const handleRemovePad = useRemovePadWithUndo();

  // The selection overlay is suspended while playing and comes back on Stop
  // (T10 slice): struck pads then look exactly as they do with nothing selected.
  const showSelection = !state.isPlaying;
  const hasEventSelected = showSelection && selectedEvent !== null && selectedPadKeys.size > 0;

  // Render grid rows (row 7 at top, row 0 at bottom — Push 3 orientation)
  const rows = [];
  for (let row = 7; row >= 0; row--) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const padKey = `${row},${col}`;
      const voice = livePadToVoice[padKey];
      const summary = padSummaries.get(padKey);
      const isStreamHighlighted = !!voice && !!state.selectedStreamId && voice.id === state.selectedStreamId;
      const isSelected = showSelection && selectedPadKeys.has(padKey);
      const isActivePlaying = activePadKeys.has(padKey);
      const isBlinking = blinkingPads.has(padKey);
      const isNext = showSelection && nextPadKeys.has(padKey);
      const isPrevious = showSelection && onionSkin && previousPadKeys.has(padKey) && !isSelected;
      const isShared = showSelection && sharedPadKeys.has(padKey);
      const isImpossible = showSelection && impossibleMoveTargets.has(padKey);
      const isDragOver = padKey === dragOverPad;
      const isDragSource = padKey === dragSourcePad;
      const isInstanceHighlighted = highlightedInstancePads?.has(padKey) ?? false;
      // The pad selection (T28 slice): an outline, kept while an event is shown.
      const isPadSelected = !!voice && state.selectedPadKey === padKey;
      // While a Sound is armed, an empty pad previews it on hover (T62);
      // not on a read-only layout, where nothing can be placed.
      const previewsArmed = !!armedStream && !voice && !readOnly;
      const ghostInfo = ghostPads?.get(padKey);
      const constraint = layout?.fingerConstraints[padKey];
      const isLocked = !!voice && layout?.placementLocks[voice.id] === padKey;
      // Uninvolved pads dim to about 45% without desaturating (T09 slice);
      // the selected, next and (with onion skin) previous events stay readable.
      const isGreyedOut = hasEventSelected && !isSelected && !isNext && !isPrevious && !isPadSelected;
      const selectedFingerInfo = selectedPadFingers.get(padKey);

      // Determine colors
      let bgColor = 'var(--bg-panel)';
      let borderColor = 'var(--border-subtle)';
      let textColor = 'var(--text-tertiary)';
      let glowColor: string | null = null;
      let isGlowActive = false;

      if (voice) {
        const useHandColors = gridLabels?.showHandColors && summary && summary.hitCount > 0;

        if (useHandColors) {
          // Hand-color mode: pad background is based on which hand plays this pad
          const hands = [...summary.hands];
          if (hands.length === 1 && hands[0] !== 'Unplayable') {
            const handColor = HAND_COLORS[hands[0] as 'left' | 'right'] ?? HAND_COLORS.mixed;
            bgColor = safeColorAlpha(handColor, 0.3, handColor);
            glowColor = handColor;
            borderColor = handColor;
            textColor = 'var(--text-primary)';
            isGlowActive = true;
          } else if (hands.includes('Unplayable') && hands.length === 1) {
            bgColor = safeColorAlpha(HAND_COLORS.Unplayable, 0.25, HAND_COLORS.Unplayable);
            glowColor = HAND_COLORS.Unplayable;
            borderColor = glowColor;
            textColor = glowColor;
            isGlowActive = true;
          } else {
            const mixedColor = HAND_COLORS.mixed;
            bgColor = safeColorAlpha(mixedColor, 0.25, mixedColor);
            glowColor = mixedColor;
            borderColor = mixedColor;
            textColor = 'var(--text-primary)';
            isGlowActive = true;
          }
        } else {
          // Default mode: voice color as pad background
          if (voice.color) {
            bgColor = safeColorAlpha(voice.color, 0.25, voice.color);
          }

          if (summary && summary.hitCount > 0) {
            const hands = [...summary.hands];
            if (hands.length === 1 && hands[0] !== 'Unplayable') {
              glowColor = HAND_COLORS[hands[0] as 'left' | 'right'] ?? HAND_COLORS.mixed;
              borderColor = voice.color ?? glowColor;
              textColor = 'var(--text-primary)';
              isGlowActive = true;
            } else if (hands.includes('Unplayable') && hands.length === 1) {
              glowColor = HAND_COLORS.Unplayable;
              borderColor = glowColor;
              textColor = glowColor;
              isGlowActive = true;
            } else {
              glowColor = HAND_COLORS.mixed;
              borderColor = voice.color ?? glowColor;
              textColor = 'var(--text-primary)';
              isGlowActive = true;
            }
          } else {
            // Assigned but no analysis yet
            glowColor = voice.color ?? 'var(--border-strong)';
            borderColor = glowColor;
            textColor = 'var(--text-secondary)';
          }
        }
      }

      // Finger display
      const fingerList = summary ? [...summary.fingers].slice(0, 2) : [];

      // Check if stream is muted
      const streamForVoice = soundStreamLookup.forVoice(voice);
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
          data-testid={`pad-${row}-${col}`}
          // Focusable by script only, so the pad menu can hand focus back (T06).
          tabIndex={-1}
          aria-label={`${spokenPadPosition(row, col)}, ${voice ? voice.name : 'empty'}`}
          className={`
            group relative flex flex-col items-center justify-center flex-shrink-0
            rounded-lg text-[11px] font-mono leading-tight
            border transition-[transform,box-shadow,background-color,border-color,filter] duration-100 select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400
            ${isSelected ? 'z-10 scale-105 brightness-125 bg-[var(--bg-card)]' : ''}
            ${isBlinking && !isSelected ? 'z-10 scale-110 brightness-200 bg-[var(--bg-card)]' : ''}
            ${isActivePlaying && !isSelected && !isBlinking ? 'z-10 scale-105 brightness-150 bg-[var(--bg-card)]' : ''}
            ${isNext && !isSelected ? 'border-dashed brightness-110' : ''}
            ${isPrevious ? 'opacity-60' : ''}
            ${isDragOver ? 'scale-105 bg-[var(--bg-card)]' : ''}
            ${isDragSource ? 'opacity-30' : ''}
            ${isMuted ? 'opacity-30 pointer-events-none' : ''}
            ${isGreyedOut ? 'opacity-[0.45]' : ''}
            ${isDragSource ? 'opacity-40' : ''}
            ${!voice ? 'hover:brightness-110' : 'hover:scale-[1.02]'}
            ${isMuted ? 'cursor-default' : voice && !readOnly ? 'cursor-grab active:cursor-grabbing' : previewsArmed ? 'cursor-copy' : 'cursor-pointer'}
          `}
          style={{
            width: padSize,
            height: padSize,
            backgroundColor: isSelected && selectedFingerInfo
              ? selectedFingerInfo.color
              : isSelected || isActivePlaying
                ? 'var(--bg-card)'
                : isNext && !voice
                  ? 'rgba(59, 130, 246, 0.08)'
                  : bgColor,
            borderColor: isStreamHighlighted && !isSelected
              ? '#60a5fa'
              : isSelected && selectedFingerInfo
              ? selectedFingerInfo.color
              : isDragOver ? '#3b82f6' : isNext && !isSelected ? '#60a5fa' : borderColor,
            color: isSelected && selectedFingerInfo ? '#ffffff' : textColor,
            // Rings are part of this one box-shadow, so no state's glow can
            // hide another's ring; opacity comes from classes only (T09 slice).
            boxShadow: [
              ...padRings({ isShared, isImpossible, isInstanceHighlighted, isDragOver, isDragSource, isPadSelected }),
              isStreamHighlighted && !isSelected
                ? '0 0 8px rgba(96, 165, 250, 0.5), inset 0 0 4px rgba(96, 165, 250, 0.2)'
                : isSelected && selectedFingerInfo
                ? `0 0 12px ${selectedFingerInfo.color}, inset 0 0 8px rgba(255,255,255,0.15)`
                : boxGlow,
            ].filter(v => v && v !== 'none').join(', ') || 'none',
          }}
          onClick={e => !isMuted && handlePadClick(row, col, e)}
          data-selected={isPadSelected ? 'true' : undefined}
          data-struck={isSelected ? 'true' : undefined}
          onContextMenu={e => {
            e.preventDefault();
            // The pad menu edits (lock, finger, remove): not on a read-only layout (S3.2).
            if (isMuted || refuseEdit()) return;
            setContextMenu({ padKey, x: e.clientX, y: e.clientY, pad: e.currentTarget });
          }}
          onDragOver={e => !isMuted && handleDragOver(e, padKey)}
          onDragLeave={handleDragLeave}
          onDrop={e => !isMuted && handleDrop(e, padKey)}
          draggable={!!voice && !isMuted && !isLocked}
          onDragStart={e => voice && !isMuted && !isLocked && handlePadDragStart(e, padKey, voice)}
          onDragEnd={() => { setDragSourcePad(null); setDragOverPad(null); }}
          title={voice
            ? `${formatPadPosition(padKey)} · ${voice.name}${summary ? ` · ${summary.hitCount} hits` : ''}${constraint ? ` · Finger preference ${constraint}` : ''}${isLocked ? ' · Locked · Unlock to move' : ''}${readOnly ? ` · ${readOnlyHint}` : ''}`
            : readOnly
              ? `${formatPadPosition(padKey)} · empty · ${readOnlyHint}`
              : armedStream
              ? `${formatPadPosition(padKey)} · empty · click to place ${armedStream.name}`
              : `${formatPadPosition(padKey)} · empty · drop a Sound here`}
        >
          {/* The armed Sound, previewed on the empty pad under the pointer (T62) */}
          {previewsArmed && (
            <div
              data-testid="pad-armed-preview"
              className="absolute inset-1 rounded-md border-2 border-dashed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ borderColor: armedStream!.color, backgroundColor: safeColorAlpha(armedStream!.color, 0.15, 'transparent') }}
            />
          )}
          {/* Ghost preview for preset drag */}
          {ghostInfo && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none z-20"
              style={{
                backgroundColor: ghostInfo.valid
                  ? ghostInfo.hand === 'left' ? 'rgba(0,136,255,0.25)' : ghostInfo.hand === 'right' ? 'rgba(255,68,0,0.25)' : 'rgba(148,163,184,0.25)'
                  : 'rgba(255,50,50,0.3)',
                border: ghostInfo.valid
                  ? `2px solid ${ghostInfo.hand === 'left' ? 'rgba(0,136,255,0.6)' : ghostInfo.hand === 'right' ? 'rgba(255,68,0,0.6)' : 'rgba(148,163,184,0.7)'}`
                  : '2px solid rgba(255,50,50,0.6)',
              }}
            />
          )}
          {/* Previous event ghost (onion skin), on empty and occupied pads alike */}
          {isPrevious && (
            <div
              data-testid="onion-previous"
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ backgroundColor: 'rgba(100, 130, 255, 0.12)', border: '2px dotted rgba(140, 160, 255, 0.75)' }}
            />
          )}
          {voice ? (
            isSelected && selectedFingerInfo ? (
              /* Event-selected pad: solid color + prominent finger label only */
              <span className="text-[16px] font-bold text-white drop-shadow-md">
                {selectedFingerInfo.label}
              </span>
            ) : (
              <>
                {/* Voice name (togglable) */}
                {(gridLabels?.showSoundNames ?? true) && (
                  <span
                    data-testid="pad-label"
                    className="block w-full px-0.5 text-center text-[11px] font-semibold text-white/95 leading-[13px] overflow-hidden [overflow-wrap:anywhere]"
                    style={{ display: '-webkit-box', WebkitLineClamp: nameLines, WebkitBoxOrient: 'vertical' }}
                  >
                    {padLabel(voice.name, namePrefix, padSize)}
                  </span>
                )}
                {/* Note label — the pad's Ableton Drum Rack note, by position (e.g. C1, C#1) */}
                {gridLabels?.showNoteLabels && showSecondaryLabels && (
                  <span className="block text-[11px] font-mono text-cyan-300/80 leading-none mt-0.5">
                    {midiNoteToName(padDrumRackNote(row, col))}
                  </span>
                )}
                {/* Position label */}
                {gridLabels?.showPositionLabels && showSecondaryLabels && (
                  <span className="block text-[11px] text-gray-400 leading-none mt-0.5">
                    {row + 1}·{col + 1}
                  </span>
                )}
                {/* Fingers (from analysis) */}
                {(gridLabels?.showFingerAssignment ?? true) && fingerList.length > 0 && (
                  <span className="block text-[11px] font-medium leading-none mt-0.5" style={{ color: textColor }}>
                    {fingerList.join(' ')}
                  </span>
                )}

                {/* Lock glyph, in the corner outside the name area */}
                {isLocked && (
                  <span
                    className="absolute top-0.5 left-0.5 w-3 h-3 flex items-center justify-center text-amber-400 pointer-events-none"
                    title="Locked · Unlock to move"
                    aria-label="Locked · Unlock to move"
                    data-testid="pad-lock"
                  >
                    <Lock size={9} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}

                {/* Remove button (visible on hover via parent group); a locked Sound has none until unlocked, and a read-only layout none at all. */}
                {!isLocked && !readOnly && (
                  <button
                    className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center
                               text-[11px] text-red-300 bg-red-500/30 rounded-bl opacity-0
                               group-hover:opacity-100 transition-opacity"
                    onClick={e => {
                      e.stopPropagation();
                      handleRemovePad(padKey);
                    }}
                    title="Remove from pad"
                  >
                    ×
                  </button>
                )}
              </>
            )
          ) : showSecondaryLabels && (gridLabels?.showNoteLabels || gridLabels?.showPositionLabels) ? (
            <span className="text-[11px] leading-none text-gray-500">
              {gridLabels?.showNoteLabels ? midiNoteToName(padDrumRackNote(row, col)) : `${row + 1}·${col + 1}`}
            </span>
          ) : null}
        </div>
      );
    }
    rows.push(
      <div key={row} className="flex items-center" style={{ gap: PAD_GAP }}>
        <span className="w-4 flex-shrink-0 text-pf-xs text-[var(--text-tertiary)] text-right font-mono tabular-nums" style={{ marginRight: AXIS_WIDTH - 16 - PAD_GAP }} aria-hidden="true">{row + 1}</span>
        {cells}
      </div>
    );
  }

  const matrixWidth = GRID_OFFSET_X + 8 * padSize + 7 * PAD_GAP;
  const zoneWidth = 4 * padSize + 3 * PAD_GAP;

  return (
    // The state-bar slot and the frame, centred as one group in the measured
    // region ("safe" keeps the top visible if the pads are at their minimum).
    <div className="h-full w-full flex flex-col items-center" style={{ justifyContent: 'safe center' }}>
      {/* State-bar slot: fixed height, never scaled. Holds the layout-state bar
          (S3.2): the transition preview moved to the selected-event card, so
          selecting an event never changes the grid's size. */}
      <div
        data-testid="state-bar-slot"
        className="w-full flex items-center flex-shrink-0 min-w-0 overflow-hidden"
        style={{ height: STATE_BAR_HEIGHT, marginBottom: STATE_BAR_GAP }}
      >
        {stateBar}
      </div>

      {/* Hardware frame, fitted to the matrix (no invisible blur layers). */}
      <div
        data-testid="grid-frame"
        className="flex-shrink-0 rounded-[1.25rem] border border-[rgba(67,70,86,0.25)] bg-[#0e0e0e]"
        style={{ padding: FRAME_INSET - 1, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4), var(--shadow-xl)' }}
      >
      <div className="relative" style={{ width: matrixWidth }}>
        {(transitionPaths.length > 0 || debuggerPaths.length > 0) && (
          <svg
            className="absolute left-0 top-0 pointer-events-none overflow-visible z-20"
            style={{ width: matrixWidth, height: gridStep * 8 }}
            viewBox={`0 0 ${matrixWidth} ${gridStep * 8}`}
            aria-hidden="true"
          >
            <defs>
              <marker id="arrowhead-chosen" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#3b82f6" />
              </marker>
              <marker id="arrowhead-neutral" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto">
                <polygon points="0 0, 5 1.75, 0 3.5" fill="#94a3b8" />
              </marker>
              <marker id="arrowhead-good" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto">
                <polygon points="0 0, 5 1.75, 0 3.5" fill="#10b981" />
              </marker>
            </defs>
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
            {/* Visual Debugger Arrow Overlays */}
            {debuggerPaths.map(path => {
              const markerId = path.isChosen ? 'arrowhead-chosen' : path.delta < -0.01 ? 'arrowhead-good' : 'arrowhead-neutral';
              return (
                <g key={path.id}>
                  <path
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.isChosen ? "3.5" : "1.5"}
                    strokeLinecap="round"
                    strokeOpacity={path.isChosen ? "0.9" : "0.5"}
                    strokeDasharray={path.isChosen ? "none" : "4,3"}
                    markerEnd={`url(#${markerId})`}
                  />
                  {/* Delta Label */}
                  <rect
                    x={path.labelX - 18}
                    y={path.labelY - 9}
                    width="36"
                    height="18"
                    rx="4"
                    fill="var(--bg-panel)"
                    fillOpacity="0.8"
                    stroke={path.color}
                    strokeWidth="1"
                  />
                  <text
                    x={path.labelX}
                    y={path.labelY + 4}
                    fontSize="11"
                    fontWeight={path.isChosen ? "bold" : "normal"}
                    fontFamily="monospace"
                    textAnchor="middle"
                    fill={path.color}
                  >
                    {path.delta > 0 ? '+' : ''}{path.delta.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="flex flex-col" style={{ gap: PAD_GAP }}>
          {rows}
          {/* Column labels */}
          <div className="flex" style={{ gap: PAD_GAP, marginLeft: GRID_OFFSET_X, height: COLUMN_LABELS_HEIGHT }}>
            {Array.from({ length: 8 }, (_, col) => (
              <div key={col} className="flex-shrink-0 text-center text-pf-xs leading-4 text-[var(--text-tertiary)] font-mono tabular-nums" style={{ width: padSize }} aria-hidden="true">{col + 1}</div>
            ))}
          </div>
        </div>
        {/* Zone labels */}
        <div className="flex" style={{ gap: PAD_GAP, marginLeft: GRID_OFFSET_X, marginTop: ZONE_LABELS_HEIGHT - 16, height: 16 }}>
          <div data-testid="zone-label-left" className="flex-shrink-0 text-center text-[11px] leading-[15px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)]" style={{ width: zoneWidth }}>
            Left Hand
          </div>
          <div data-testid="zone-label-right" className="flex-shrink-0 text-center text-[11px] leading-[15px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)]" style={{ width: zoneWidth }}>
            Right Hand
          </div>
        </div>
      </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <PadContextMenu
          padKey={contextMenu.padKey}
          x={contextMenu.x}
          y={contextMenu.y}
          returnFocusTo={contextMenu.pad}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

/** Ring outlines for a pad's states, as box-shadow layers. */
function padRings(f: { isShared: boolean; isImpossible: boolean; isInstanceHighlighted: boolean; isDragOver: boolean; isDragSource: boolean; isPadSelected: boolean }): string[] {
  const rings: string[] = [];
  // The selected pad: a neutral outline outside the pad, clear of the hand colours.
  if (f.isPadSelected) rings.push('0 0 0 2px var(--bg-app), 0 0 0 4px rgba(226, 232, 240, 0.9)');
  if (f.isImpossible) rings.push('0 0 0 2px rgba(239, 68, 68, 0.8)');
  if (f.isInstanceHighlighted) rings.push('0 0 0 2px rgba(167, 139, 250, 0.6)');
  if (f.isDragOver || f.isDragSource) rings.push('0 0 0 2px rgba(96, 165, 250, 0.7)');
  if (f.isShared) rings.push('0 0 0 1px rgba(52, 211, 153, 0.5)');
  return rings;
}

/**
 * The Sound to arm after `placedId` is placed: the next one in the Sounds list
 * (wrapping round) that no pad holds, or null when every Sound is placed.
 */
function nextUnplacedSound(
  streams: SoundStream[],
  layout: Layout,
  lookup: ReturnType<typeof buildSoundStreamLookup>,
  placedId: string,
): string | null {
  const placed = new Set(Object.values(layout.padToVoice).map(v => lookup.forVoice(v)?.id ?? v.id));
  placed.add(placedId);
  const start = streams.findIndex(s => s.id === placedId);
  for (let i = 1; i <= streams.length; i++) {
    const candidate = streams[(start + i) % streams.length];
    if (candidate && !placed.has(candidate.id)) return candidate.id;
  }
  return null;
}
