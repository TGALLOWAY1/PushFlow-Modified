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

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActiveStreams, type SoundStream } from '../state/projectState';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum time gap (seconds) to consider events simultaneous. */
const MOMENT_EPSILON = 0.001;

// ─── Types ───────────────────────────────────────────────────────────────────

/** A grouped moment in the performance timeline (polyphonic event). */
export interface PerformanceMomentSummary {
  momentIndex: number;
  startTime: number;
  beatPosition: string;
  sounds: Array<{ name: string; color: string; streamId: string }>;
  noteCount: number;
}

// ─── Moment Derivation ──────────────────────────────────────────────────────

function formatBeatPosition(time: number, tempo: number): string {
  const beatDuration = 60 / (tempo || 120);
  const totalBeats = time / beatDuration;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const subBeat = totalBeats % 1;
  if (subBeat < 0.01) return `${bar}.${beat}`;
  return `${bar}.${beat}`;
}

function groupCurrentMoment(
  group: Array<{ startTime: number; streamId: string; name: string; color: string }>,
  momentIndex: number,
  tempo: number,
): PerformanceMomentSummary {
  const time = group[0].startTime;
  const soundMap = new Map<string, { name: string; color: string; streamId: string }>();
  for (const e of group) {
    if (!soundMap.has(e.streamId)) {
      soundMap.set(e.streamId, { name: e.name, color: e.color, streamId: e.streamId });
    }
  }
  return {
    momentIndex,
    startTime: time,
    beatPosition: formatBeatPosition(time, tempo),
    sounds: Array.from(soundMap.values()),
    noteCount: group.length,
  };
}

/**
 * Derive PerformanceMoments from active SoundStreams.
 * Groups events across all streams by startTime within MOMENT_EPSILON.
 * Adapted from V1 groupDebugEventsIntoMoments pattern.
 */
export function derivePerformanceMoments(
  streams: SoundStream[],
  tempo: number,
): PerformanceMomentSummary[] {
  const allEvents: Array<{ startTime: number; streamId: string; name: string; color: string }> = [];
  for (const stream of streams) {
    for (const event of stream.events) {
      allEvents.push({
        startTime: event.startTime,
        streamId: stream.id,
        name: stream.name,
        color: stream.color,
      });
    }
  }

  allEvents.sort((a, b) => a.startTime - b.startTime);

  const moments: PerformanceMomentSummary[] = [];
  let currentGroup: typeof allEvents = [];
  let currentTime = -Infinity;

  for (const event of allEvents) {
    if (event.startTime - currentTime > MOMENT_EPSILON) {
      if (currentGroup.length > 0) {
        moments.push(groupCurrentMoment(currentGroup, moments.length, tempo));
      }
      currentGroup = [event];
      currentTime = event.startTime;
    } else {
      currentGroup.push(event);
    }
  }

  if (currentGroup.length > 0) {
    moments.push(groupCurrentMoment(currentGroup, moments.length, tempo));
  }

  return moments;
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
    const assignments = state.analysisResult?.executionPlan.fingerAssignments;
    if (!assignments) return null;
    const selected = assignments.find(a => a.eventIndex === state.selectedEventIndex);
    if (!selected) return null;
    const idx = moments.findIndex(m => Math.abs(m.startTime - selected.startTime) < MOMENT_EPSILON);
    return idx >= 0 ? idx : null;
  }, [state.selectedEventIndex, state.analysisResult, moments]);

  const handleMomentClick = useCallback((moment: PerformanceMomentSummary) => {
    const assignments = state.analysisResult?.executionPlan.fingerAssignments;
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
  }, [state.analysisResult, dispatch]);

  // Keyboard navigation (V1 pattern: ArrowUp/Down, j/k)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (moments.length === 0) return;

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
  }, [moments, selectedMomentIdx, handleMomentClick]);

  // Auto-scroll selected moment row into view (V1 pattern)
  useEffect(() => {
    if (selectedMomentIdx === null || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-moment-index="${selectedMomentIdx}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedMomentIdx]);

  if (moments.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-gray-500">
        No events. Import MIDI or compose a pattern.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-500">
          {moments.length} events
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              onionSkin ? 'text-sky-300 bg-sky-500/15' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
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
              className="text-[10px] text-gray-500 hover:text-gray-300"
              onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
            >
              Deselect
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className="overflow-y-auto space-y-0.5" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {moments.map((moment) => (
          <MomentRow
            key={moment.momentIndex}
            moment={moment}
            isSelected={selectedMomentIdx === moment.momentIndex}
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
  onClick,
}: {
  moment: PerformanceMomentSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-moment-index={moment.momentIndex}
      className={`
        w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors
        ${isSelected
          ? 'bg-blue-600/20 border border-blue-500/40 text-gray-100'
          : 'hover:bg-gray-800/50 border border-transparent text-gray-300'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {/* Event label */}
        <span className={`text-[10px] font-mono w-14 flex-shrink-0 ${isSelected ? 'text-blue-300' : 'text-gray-500'}`}>
          Event {String(moment.momentIndex + 1).padStart(2, '0')}
        </span>

        {/* Beat position */}
        <span className="text-[10px] font-mono w-6 flex-shrink-0 text-gray-400">
          {moment.beatPosition}
        </span>

        {/* Sound badges */}
        <div className="flex-1 flex flex-wrap gap-0.5 min-w-0">
          {moment.sounds.map((sound) => (
            <span
              key={sound.streamId}
              className="px-1 py-0 rounded text-[9px] font-medium truncate max-w-[60px]"
              style={{
                backgroundColor: sound.color + '30',
                color: sound.color,
                border: `1px solid ${sound.color}50`,
              }}
              title={sound.name}
            >
              {sound.name}
            </span>
          ))}
        </div>

        {/* Note count badge */}
        <span className={`text-[10px] flex-shrink-0 ${
          moment.noteCount > 3 ? 'text-amber-400' : 'text-gray-500'
        }`}>
          {moment.noteCount}n
        </span>
      </div>
    </button>
  );
}
