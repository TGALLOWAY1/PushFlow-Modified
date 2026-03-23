/**
 * TimelinePanel.
 *
 * Collapsible bottom panel wrapping ExecutionTimeline.
 * Filters to only show unmuted sound streams.
 * Provides bidirectional selection with the grid.
 */

import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActiveStreams } from '../state/projectState';
import { ExecutionTimeline } from './ExecutionTimeline';
import { type Voice } from '../../types/voice';
import { type FingerAssignment } from '../../types/executionPlan';

export function TimelinePanel() {
  const { state, dispatch } = useProject();
  const [collapsed, setCollapsed] = useState(false);

  const activeStreams = getActiveStreams(state);
  const assignments = state.analysisResult?.executionPlan?.fingerAssignments;

  // Build Voice[] from active streams for the timeline
  const voices: Voice[] = useMemo(() =>
    activeStreams.map(s => ({
      id: s.id,
      name: s.name,
      sourceType: 'midi_track' as const,
      sourceFile: '',
      originalMidiNote: s.originalMidiNote,
      color: s.color,
    })),
    [activeStreams]
  );

  // Filter assignments to only unmuted streams
  const activeNotes = useMemo(() =>
    new Set(activeStreams.map(s => s.originalMidiNote)),
    [activeStreams]
  );

  const filteredAssignments = useMemo(() => {
    if (assignments && assignments.length > 0) {
      return assignments.filter(a => activeNotes.has(a.noteNumber));
    }
    // Before generation, construct "dummy" assignments to render raw MIDI
    const dummies: FingerAssignment[] = [];
    for (const s of activeStreams) {
      if (!activeNotes.has(s.originalMidiNote)) continue;
      for (const ev of s.events) {
        dummies.push({
          eventKey: ev.eventKey,
          eventIndex: 0,
          noteNumber: s.originalMidiNote,
          startTime: ev.startTime,
          assignedHand: 'raw' as any, // Neutral styling
          finger: 'unassigned' as any,
          cost: 0,
          difficulty: 'Easy',
          costBreakdown: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
        });
      }
    }
    return dummies.sort((a, b) => a.startTime - b.startTime).map((a, i) => ({ ...a, eventIndex: i }));
  }, [assignments, activeStreams, activeNotes]);

  // RequestAnimationFrame playback loop
  useEffect(() => {
    let handle: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      dispatch({ type: 'TICK_TIME', payload: dt });
      handle = requestAnimationFrame(loop);
    };

    if (state.isPlaying) {
      lastTime = performance.now();
      handle = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(handle);
  }, [state.isPlaying, dispatch]);

  if (activeStreams.length === 0) {
    return null;
  }

  return (
    <div className="rounded-pf-lg glass-panel overflow-hidden relative z-40">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-3 py-2 text-pf-sm hover:bg-[var(--bg-hover)] transition-colors">
        <button
          className="flex items-center gap-2 text-[var(--text-secondary)] font-medium"
          onClick={() => setCollapsed(!collapsed)}
        >
          <span className="text-[var(--text-tertiary)]">{collapsed ? '+' : '-'}</span>
          <span>
            Timeline
            <span className="text-[var(--text-secondary)] ml-2 font-normal">
              {new Set(filteredAssignments.map(a => a.startTime)).size} events
            </span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-secondary)] font-mono w-12 text-right">
            {state.currentTime.toFixed(2)}s
          </span>
          <button
            className={`px-3 py-1 rounded-pf-sm text-pf-xs font-bold ${state.isPlaying ? 'bg-amber-500 text-amber-950' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}
            onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          >
            {state.isPlaying ? 'STOP' : 'PLAY'}
          </button>
          <button
            className="px-2 py-1 rounded-pf-sm bg-[var(--bg-hover)]/50 text-pf-xs text-[var(--text-secondary)]"
            onClick={() => {
              dispatch({ type: 'SET_IS_PLAYING', payload: false });
              dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
            }}
          >
            RESET
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <ExecutionTimeline
            assignments={filteredAssignments}
            voices={voices}
            selectedEventIndex={state.selectedEventIndex}
            onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
            tempo={state.tempo}
            currentTime={state.currentTime}
          />
        </div>
      )}
    </div>
  );
}
