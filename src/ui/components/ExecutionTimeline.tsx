/**
 * ExecutionTimeline Component.
 *
 * Per-voice swim lane timeline showing finger assignments over time.
 * Each voice gets its own horizontal lane. Events are colored by hand
 * and labeled with the finger used.
 *
 * Features:
 * - Horizontal zoom (mouse wheel) and scroll
 * - Beat grid lines at tempo-derived intervals
 * - Event pills with hand coloring and finger labels
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import { type FingerAssignment } from '../../types/executionPlan';
import { type Voice } from '../../types/voice';

interface ExecutionTimelineProps {
  assignments: FingerAssignment[];
  voices: Voice[];
  selectedEventIndex?: number | null;
  onEventClick?: (eventIndex: number) => void;
  tempo?: number;
  currentTime?: number;
}

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const HAND_STYLES: Record<string, { bg: string, text: string }> = {
  left: { bg: '#3b82f6', text: '#dbeafe' },
  right: { bg: '#a855f7', text: '#f3e8ff' },
  Unplayable: { bg: '#ef4444', text: '#fecaca' },
  raw: { bg: '#4b5563', text: '#9ca3af' }, // neutral pre-generation events
};

const LANE_HEIGHT = 28;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const EVENT_WIDTH = 20;

export function ExecutionTimeline({ assignments, voices, selectedEventIndex, onEventClick, tempo = 120, currentTime }: ExecutionTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  let tempMinTime = 0, tempMaxTime = 0, tempDuration = 0.1;
  try {
    tempMinTime = assignments.length > 0 ? assignments[0].startTime : 0;
    tempMaxTime = assignments.length > 0 ? assignments[assignments.length - 1].startTime : 0;
    tempDuration = Math.max(tempMaxTime - tempMinTime, 0.1);
  } catch (err) {
    console.error('ExecutionTimeline: error computing min/max', err, { assignments });
  }

  const minTime = tempMinTime;
  const maxTime = tempMaxTime;
  const duration = tempDuration;

  // Build voice lookup by noteNumber
  const voiceByNote = useMemo(() => {
    const map = new Map<number, Voice>();
    for (const v of voices) {
      if (v.originalMidiNote !== null) map.set(v.originalMidiNote, v);
    }
    return map;
  }, [voices]);

  // Discover unique voices (by noteNumber) from assignments, ordered by first appearance
  const voiceLanes = useMemo(() => {
    const seen = new Map<number, { noteNumber: number; voice: Voice | null; firstTime: number }>();
    for (const a of assignments) {
      if (!seen.has(a.noteNumber)) {
        seen.set(a.noteNumber, {
          noteNumber: a.noteNumber,
          voice: voiceByNote.get(a.noteNumber) ?? null,
          firstTime: a.startTime,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.noteNumber - b.noteNumber);
  }, [assignments, voiceByNote]);

  // Map noteNumber to lane index
  const laneIndex = new Map<number, number>();
  voiceLanes.forEach((lane, i) => laneIndex.set(lane.noteNumber, i));

  const totalHeight = voiceLanes.length * LANE_HEIGHT;

  // Beat grid lines
  const beatLines = useMemo(() => {
    if (tempo <= 0) return [];
    const beatDuration = 60 / tempo; // seconds per beat
    const lines: { time: number; isMeasure: boolean; label: string }[] = [];
    const startBeat = Math.ceil(minTime / beatDuration);
    const endBeat = Math.floor(maxTime / beatDuration);
    for (let b = startBeat; b <= endBeat; b++) {
      const time = b * beatDuration;
      const isMeasure = b % 4 === 0;
      lines.push({ time, isMeasure, label: isMeasure ? `${Math.floor(b / 4) + 1}` : '' });
    }
    return lines;
  }, [tempo, minTime, maxTime]);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (1 - e.deltaY * 0.002))));
    }
  }, []);

  // Zoomed content width (as percentage multiplier)
  const contentWidthPct = zoom * 100;

  // Time axis labels — show more labels when zoomed
  const timeLabels = useMemo(() => {
    const labelCount = Math.max(3, Math.min(Math.floor(zoom * 5), 20));
    const labels: { time: number; pct: number }[] = [];
    for (let i = 0; i <= labelCount; i++) {
      const t = minTime + (i / labelCount) * duration;
      labels.push({ time: t, pct: (i / labelCount) * 100 });
    }
    return labels;
  }, [zoom, minTime, duration]);

  if (assignments.length === 0) {
    return (
      <div className="w-full py-4 text-center text-gray-500 text-xs text-medium">
        No events to display.
      </div>
    );
  }

  return (
    <div className="w-full space-y-1">
      {/* Legend + zoom control */}
      <div className="flex gap-4 text-[10px] text-gray-400 items-center">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: HAND_STYLES.left.bg }} /> Left
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: HAND_STYLES.right.bg }} /> Right
        </span>
        <span className="text-gray-500">|</span>
        <span>{new Set(assignments.map(a => a.startTime)).size} events</span>
        <span>{assignments.filter(a => a.assignedHand === 'Unplayable').length} unplayable</span>
        <span>Duration: {duration.toFixed(1)}s</span>
        <span className="text-gray-500">|</span>
        <span className="flex items-center gap-1">
          <button
            className="px-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
            onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.5))}
            title="Zoom out"
          >-</button>
          <span className="w-10 text-center">{zoom.toFixed(1)}x</span>
          <button
            className="px-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.5))}
            title="Zoom in"
          >+</button>
          {zoom > 1 && (
            <button
              className="px-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-500 text-[9px]"
              onClick={() => setZoom(1)}
              title="Reset zoom"
            >1:1</button>
          )}
        </span>
        <span className="text-[9px] text-gray-600">Ctrl+Scroll to zoom</span>
      </div>

      {/* Swim lanes */}
      <div className="flex">
        {/* Voice labels */}
        <div className="flex-shrink-0 w-20 pr-2" style={{ height: totalHeight }}>
          {voiceLanes.map(lane => (
            <div
              key={lane.noteNumber}
              className="flex items-center justify-end text-[10px] truncate"
              style={{ height: LANE_HEIGHT }}
            >
              <span
                className="truncate font-medium"
                style={{ color: lane.voice?.color ?? '#9ca3af' }}
                title={lane.voice?.name ?? `Note ${lane.noteNumber}`}
              >
                {lane.voice?.name ?? `N${lane.noteNumber}`}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto rounded border border-gray-700 bg-gray-900/50"
          style={{ height: totalHeight + 2 }}
          onWheel={handleWheel}
        >
          <div className="relative" style={{ width: `${contentWidthPct}%`, height: totalHeight }}>
            {/* Beat grid lines */}
            {beatLines.map((line, i) => {
              const x = ((line.time - minTime) / duration) * 100;
              return (
                <div
                  key={`beat-${i}`}
                  className="absolute top-0"
                  style={{
                    left: `${x}%`,
                    height: totalHeight,
                    width: 1,
                    backgroundColor: line.isMeasure ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  {line.label && (
                    <span className="absolute -top-0 left-0.5 text-[8px] text-gray-600 font-mono">
                      {line.label}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Lane dividers */}
            {voiceLanes.map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-b border-gray-800/50"
                style={{ top: (i + 1) * LANE_HEIGHT }}
              />
            ))}

            {/* Alternating lane backgrounds */}
            {voiceLanes.map((_, i) => (
              i % 2 === 1 ? (
                <div
                  key={`bg-${i}`}
                  className="absolute w-full bg-white/[0.02]"
                  style={{ top: i * LANE_HEIGHT, height: LANE_HEIGHT }}
                />
              ) : null
            ))}

            {/* Playhead */}
            {currentTime !== undefined && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{
                  left: `${((currentTime - minTime) / duration) * 100}%`,
                  width: 2,
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                }}
              />
            )}

            {/* Events */}
            {assignments.map((a, i) => {
              const lane = laneIndex.get(a.noteNumber);
              if (lane === undefined) return null;

              const x = ((a.startTime - minTime) / duration) * 100;
              const isSelected = a.eventIndex === selectedEventIndex;
              const style = HAND_STYLES[a.assignedHand] ?? HAND_STYLES.raw;
              const fingerLabel = a.finger ? FINGER_ABBREV[a.finger] ?? a.finger : '?';
              const handPrefix = a.assignedHand === 'left' ? 'L' : a.assignedHand === 'right' ? 'R' : '';

              return (
                <button
                  key={`${a.eventIndex ?? i}-${a.startTime}`}
                  className={`absolute flex items-center justify-center rounded-sm transition-all
                    ${isSelected ? 'z-20 ring-2 ring-yellow-400 scale-110' : 'z-10 hover:z-20 hover:scale-105'}`}
                  style={{
                    left: `calc(${x}% - ${EVENT_WIDTH / 2}px)`,
                    top: lane * LANE_HEIGHT + 3,
                    width: EVENT_WIDTH,
                    height: LANE_HEIGHT - 6,
                    backgroundColor: style.bg,
                    opacity: isSelected ? 1 : 0.85,
                  }}
                  onClick={() => onEventClick?.(a.eventIndex ?? i)}
                  title={`${a.startTime.toFixed(3)}s | ${handPrefix}-${fingerLabel} | cost: ${a.cost.toFixed(1)} | ${a.difficulty}`}
                >
                  <span className="text-[7px] font-bold leading-none" style={{ color: style.text }}>
                    {fingerLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time axis */}
      <div className="flex ml-20">
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between text-[10px] text-gray-500" style={{ width: `${contentWidthPct}%` }}>
            {timeLabels.map((tl, i) => (
              <span key={i}>{tl.time.toFixed(1)}s</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
