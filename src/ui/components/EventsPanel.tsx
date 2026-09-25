/**
 * EventsPanel.
 *
 * Temporal event navigator for the workspace. Derives PerformanceMoments
 * (polyphonic groups of simultaneous notes) from active SoundStreams and
 * renders them as a scrollable, selectable list.
 *
 * Selecting a moment:
 * - dispatches SELECT_EVENT for the first matching FingerAssignment
 * - scrolls the timeline to the event's time position
 * - exposes selection state for downstream grid/onion-view consumers
 *
 * Reuses V1 event-analysis patterns: epsilon-based temporal grouping,
 * keyboard navigation (ArrowUp/Down, j/k), auto-scroll selected row.
 */

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActiveStreams, getDisplayedExecutionPlan, type SoundStream } from '../state/projectState';
import { groupIntoMoments, summarizeMomentCost, type MomentCost } from '@/engine';
import { MOMENT_EPSILON } from '../../types/performanceEvent';
import { isOverlayOpen } from './shared/Overlay';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum time gap (seconds) to consider events simultaneous. */
// Re-declaring this drifted from the canonical value; import the single source.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A grouped moment in the performance timeline (polyphonic event). */
export interface PerformanceMomentSummary {
  momentIndex: number;
  /** Stable moment identity (momentKey). */
  momentKey: string;
  startTime: number;
  beatPosition: string;
  sounds: Array<{ name: string; color: string; streamId: string }>;
  noteCount: number;
}

// ─── Moment Derivation ──────────────────────────────────────────────────────

export function formatBeatPosition(time: number, tempo: number): string {
  const beatDuration = 60 / (tempo || 120);
  const totalBeats = time / beatDuration;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const subBeat = totalBeats % 1;
  if (subBeat < 0.01) return `${bar}.${beat}`;
  return `${bar}.${beat}`;
}

/**
 * Derive PerformanceMoments from active SoundStreams, using the shared moment
 * grouping (groupIntoMoments), so this list, the chart and the inspector agree
 * on what one moment is.
 */
export function derivePerformanceMoments(
  streams: SoundStream[],
  tempo: number,
): PerformanceMomentSummary[] {
  const notes: Array<{ startTime: number; voiceId: string; stream: SoundStream }> = [];
  for (const stream of streams) {
    for (const event of stream.events) {
      notes.push({ startTime: event.startTime, voiceId: stream.id, stream });
    }
  }

  return groupIntoMoments(notes).map(moment => {
    const soundMap = new Map<string, { name: string; color: string; streamId: string }>();
    for (const { stream } of moment.items) {
      if (!soundMap.has(stream.id)) {
        soundMap.set(stream.id, { name: stream.name, color: stream.color, streamId: stream.id });
      }
    }
    return {
      momentIndex: moment.index,
      momentKey: moment.key,
      startTime: moment.startTime,
      beatPosition: formatBeatPosition(moment.startTime, tempo),
      sounds: Array.from(soundMap.values()),
      noteCount: moment.items.length,
    };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EventsPanel({
  onionSkin,
  onToggleOnionSkin,
}: {
  onionSkin: boolean;
  onToggleOnionSkin: () => void;
}) {
  const { state, dispatch } = useProject();
  const activeStreams = getActiveStreams(state);
  const listRef = useRef<HTMLDivElement>(null);

  const moments = useMemo(
    () => derivePerformanceMoments(activeStreams, state.tempo),
    [activeStreams, state.tempo],
  );

  // Determine which moment is currently selected based on selectedEventIndex
  const selectedMomentIdx = useMemo(() => {
    if (state.selectedEventIndex === null) return null;
    const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
    if (!assignments) return null;
    const selected = assignments.find(a => a.eventIndex === state.selectedEventIndex);
    if (!selected) return null;
    const idx = moments.findIndex(m => Math.abs(m.startTime - selected.startTime) < MOMENT_EPSILON);
    return idx >= 0 ? idx : null;
  }, [state, moments]);

  const handleMomentClick = useCallback((moment: PerformanceMomentSummary) => {
    const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
    if (assignments) {
      const match = assignments.find(
        a => Math.abs(a.startTime - moment.startTime) < MOMENT_EPSILON
      );
      if (match?.eventIndex !== undefined) {
        dispatch({ type: 'SELECT_EVENT', payload: match.eventIndex });
        return;
      }
    }
    // Fallback: move playhead to the moment's time for timeline scrolling
    dispatch({ type: 'SET_CURRENT_TIME', payload: moment.startTime });
  }, [state, dispatch]);

  // Keyboard navigation (V1 pattern: ArrowUp/Down, j/k)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (moments.length === 0) return;
      // Nothing while playing (T61 slice), and nothing under an open dialog or menu.
      if (state.isPlaying || isOverlayOpen()) return;

      const currentIdx = selectedMomentIdx ?? -1;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, moments.length - 1);
        handleMomentClick(moments[nextIdx]);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        handleMomentClick(moments[prevIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moments, selectedMomentIdx, handleMomentClick, state.isPlaying]);

  // Auto-scroll selected moment row into view (V1 pattern)
  useEffect(() => {
    if (selectedMomentIdx === null || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-moment-index="${selectedMomentIdx}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedMomentIdx]);

  // Per-moment cost, read once per moment: every note of a moment carries the
  // whole moment's cost, so summing them made a chord cost more per note it had.
  const momentCosts = useMemo(() => {
    const map = new Map<number, MomentCost>();
    const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;
    if (!assignments || moments.length === 0) return map;

    const planMoments = groupIntoMoments(assignments);
    const byKey = new Map(planMoments.map(m => [m.key, m]));
    for (const moment of moments) {
      const match = byKey.get(moment.momentKey)
        ?? planMoments.find(m => Math.abs(m.startTime - moment.startTime) <= MOMENT_EPSILON);
      if (match) map.set(moment.momentIndex, summarizeMomentCost(match.items));
    }
    return map;
  }, [state, moments]);

  if (moments.length === 0) {
    return (
      <div className="py-6 text-center text-pf-sm text-[var(--text-tertiary)]">
        No events. Import MIDI or compose a pattern.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-pf-xs text-[var(--text-tertiary)]">
          {moments.length} events
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className={`w-5 h-5 flex items-center justify-center rounded-pf-sm transition-colors ${
              onionSkin ? 'text-sky-300 bg-sky-500/15' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            onClick={onToggleOnionSkin}
            title={onionSkin ? 'Disable onion skin' : 'Show previous/next event layers on grid'}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="3" />
              <circle cx="8" cy="8" r="5.5" opacity="0.5" />
              <circle cx="8" cy="8" r="7.5" opacity="0.25" />
            </svg>
          </button>
          {selectedMomentIdx !== null && (
            <button
              className="text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
            >
              Deselect
            </button>
          )}
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-1 text-pf-micro font-mono text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]/30">
        <span className="w-8 flex-shrink-0">#</span>
        <span className="flex-1">Beat</span>
        <span className="flex-shrink-0 w-10 text-right">Cost</span>
        <span className="flex-shrink-0 w-8 text-right">Notes</span>
      </div>

      <div ref={listRef} className="overflow-y-auto space-y-0.5" style={{ maxHeight: 'calc(100vh - 310px)' }}>
        {moments.map((moment) => (
          <MomentRow
            key={moment.momentIndex}
            moment={moment}
            isSelected={selectedMomentIdx === moment.momentIndex}
            momentCost={momentCosts.get(moment.momentIndex) ?? null}
            onClick={() => handleMomentClick(moment)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MomentRow({
  moment,
  isSelected,
  momentCost,
  onClick,
}: {
  moment: PerformanceMomentSummary;
  isSelected: boolean;
  momentCost: MomentCost | null;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const costBreakdown = momentCost?.breakdown ?? null;
  const unplayable = momentCost?.difficulty === 'Unplayable';

  // Cost severity colour, from the moment's own difficulty level.
  const costColor = !momentCost
    ? 'text-[var(--text-tertiary)]'
    : momentCost.difficulty === 'Unplayable' || momentCost.difficulty === 'Hard'
      ? 'text-red-400'
      : momentCost.difficulty === 'Medium' ? 'text-amber-400' : 'text-green-400';

  return (
    <button
      data-moment-index={moment.momentIndex}
      className={`
        w-full text-left px-2 py-1.5 rounded-pf-md text-pf-sm transition-colors
        ${isSelected
          ? 'bg-blue-600/20 border border-blue-500/40 text-[var(--text-primary)]'
          : 'hover:bg-[var(--bg-hover)] border border-transparent text-[var(--text-secondary)]'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Event label */}
        <span className={`text-pf-xs font-mono w-8 flex-shrink-0 ${isSelected ? 'text-blue-300' : 'text-[var(--text-tertiary)]'}`}>
          {String(moment.momentIndex + 1).padStart(2, '0')}
        </span>

        {/* Beat position */}
        <span className="text-pf-xs font-mono flex-1 text-[var(--text-secondary)]">
          {moment.beatPosition}
        </span>

        {/* Cost badge */}
        <span
          className={`text-pf-xs font-mono flex-shrink-0 w-10 text-right ${costBreakdown ? `cursor-pointer ${costColor}` : costColor}`}
          onClick={costBreakdown ? (e => { e.stopPropagation(); setExpanded(!expanded); }) : undefined}
          title={unplayable
            ? `${momentCost!.unplayableNoteCount} of ${momentCost!.noteCount} notes can't be played`
            : costBreakdown ? 'Cost of this event (once per event, not per note). Click for the breakdown' : 'No cost data'}
        >
          {unplayable ? '\u2717' : costBreakdown ? costBreakdown.total.toFixed(1) : '\u2014'}
        </span>

        {/* Note count badge */}
        <span className={`text-pf-xs flex-shrink-0 w-8 text-right ${
          moment.noteCount > 3 ? 'text-amber-400' : 'text-[var(--text-tertiary)]'
        }`}>
          {moment.noteCount}n
        </span>
      </div>

      {/* Expanded cost breakdown */}
      {expanded && costBreakdown && (
        <div className="mt-1 ml-10 grid grid-cols-2 gap-x-3 gap-y-0.5 text-pf-micro" onClick={e => e.stopPropagation()}>
          <span className="text-[var(--text-tertiary)]">Transition</span>
          <span className="text-[var(--text-secondary)] font-mono text-right">{costBreakdown.transitionCost.toFixed(2)}</span>
          <span className="text-[var(--text-tertiary)]">Grip</span>
          <span className="text-[var(--text-secondary)] font-mono text-right">{costBreakdown.handShapeDeviation.toFixed(2)}</span>
          <span className="text-[var(--text-tertiary)]">Finger Pref</span>
          <span className="text-[var(--text-secondary)] font-mono text-right">{costBreakdown.fingerPreference.toFixed(2)}</span>
          <span className="text-[var(--text-tertiary)]">Alternation</span>
          <span className="text-[var(--text-secondary)] font-mono text-right">{costBreakdown.alternation.toFixed(2)}</span>
          <span className="text-[var(--text-tertiary)]">Hand Balance</span>
          <span className="text-[var(--text-secondary)] font-mono text-right">{costBreakdown.handBalance.toFixed(2)}</span>
          {costBreakdown.constraintPenalty > 0 && (
            <>
              <span className="text-red-400">Constraint</span>
              <span className="text-red-400 font-mono text-right">{costBreakdown.constraintPenalty.toFixed(2)}</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}
