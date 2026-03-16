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
  const assignments = state.analysisResult?.executionPlan.fingerAssignments;

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
          costBreakdown: { movement: 0, stretch: 0, drift: 0, bounce: 0, fatigue: 0, crossover: 0, total: 0 } as any,
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
    <div className="rounded-lg glass-panel overflow-hidden relative z-40">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-800/50 transition-colors">
        <button
          className="flex items-center gap-2 text-gray-400 font-medium"
          onClick={() => setCollapsed(!collapsed)}
        >
          <span className="text-gray-600">{collapsed ? '+' : '-'}</span>
          <span>
            Timeline
            <span className="text-gray-500 ml-2 font-normal">
              {new Set(filteredAssignments.map(a => a.startTime)).size} events
            </span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-mono w-12 text-right">
            {state.currentTime.toFixed(2)}s
          </span>
          <button
            className={`px-3 py-1 rounded text-[10px] font-bold ${state.isPlaying ? 'bg-amber-500 text-amber-950' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}
            onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          >
            {state.isPlaying ? 'STOP' : 'PLAY'}
          </button>
          <button
            className="px-2 py-1 rounded bg-gray-700/50 text-[10px] text-gray-400"
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
