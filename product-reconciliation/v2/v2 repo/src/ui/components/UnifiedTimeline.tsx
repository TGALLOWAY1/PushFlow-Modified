/**
 * UnifiedTimeline.
 *
 * Single unified timeline combining lane editing + execution visualization.
 * Shows per-voice swim lanes with event blocks, finger assignment pills (when
 * analysis exists), beat grid, playhead, transport controls, and MIDI import.
 *
 * Replaces the separate LaneToolbar + LaneSidebar + LaneTimeline + TimelinePanel
 * components with one cohesive view rendered in the bottom drawer.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActiveStreams, type SoundStream } from '../state/projectState';
import { useLaneImport } from '../hooks/useLaneImport';
import { type FingerAssignment } from '../../types/executionPlan';

// ─── Constants ───────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 32;
const SIDEBAR_WIDTH = 180;
const MIN_ZOOM = 30;  // px per second minimum
const MAX_ZOOM = 500; // px per second maximum

const FINGER_ABBREV: Record<string, string> = {
  thumb: 'Th', index: 'Ix', middle: 'Md', ring: 'Rg', pinky: 'Pk',
};

const HAND_COLORS: Record<string, { bg: string; text: string }> = {
  left: { bg: '#3b82f6', text: '#dbeafe' },
  right: { bg: '#a855f7', text: '#f3e8ff' },
  Unplayable: { bg: '#ef4444', text: '#fecaca' },
  raw: { bg: '#4b5563', text: '#9ca3af' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function UnifiedTimeline() {
  const { state, dispatch } = useProject();
  const { importFiles } = useLaneImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  const [zoomOverride, setZoomOverride] = useState<number | null>(null); // null = auto-fit
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Lane ↔ Stream Sync ──────────────────────────────────────────────────

  useEffect(() => {
    if (state.performanceLanes.length === 0 && state.soundStreams.length > 0) {
      dispatch({ type: 'POPULATE_LANES_FROM_STREAMS' });
    }
  }, [state.performanceLanes.length, state.soundStreams.length, dispatch]);

  useEffect(() => {
    if (state.performanceLanes.length > 0) {
      dispatch({ type: 'SYNC_STREAMS_FROM_LANES' });
    }
  }, [state.performanceLanes, dispatch]);

  // ─── Derived Data ────────────────────────────────────────────────────────

  const activeStreams = getActiveStreams(state);
  const assignments = state.analysisResult?.executionPlan.fingerAssignments;

  // Filter streams by search
  const visibleStreams = useMemo(() => {
    if (!searchQuery) return activeStreams;
    const q = searchQuery.toLowerCase();
    return activeStreams.filter(s => s.name.toLowerCase().includes(q));
  }, [activeStreams, searchQuery]);

  // Beat duration (used for bar-quantization and grid lines)
  const beatDurationRaw = 60 / (state.tempo || 120);
  const barDuration = beatDurationRaw * 4; // 4 beats per bar

  // Compute time range across all streams, snapped to bar boundaries
  const { minTime, maxTime, totalDuration } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of state.soundStreams) {
      for (const e of s.events) {
        if (e.startTime < min) min = e.startTime;
        const end = e.startTime + e.duration;
        if (end > max) max = end;
      }
    }
    if (min === Infinity) { min = 0; max = barDuration * 4; }
    // Snap min down and max up to bar boundaries
    min = Math.floor(min / barDuration) * barDuration;
    max = Math.ceil(max / barDuration) * barDuration;
    if (max <= min) max = min + barDuration;
    return { minTime: min, maxTime: max, totalDuration: max - min };
  }, [state.soundStreams, barDuration]);

  // ─── Playback RAF Loop (with looping) ───────────────────────────────────

  const maxTimeRef = useRef(maxTime);
  const minTimeRef = useRef(minTime);
  useEffect(() => { maxTimeRef.current = maxTime; minTimeRef.current = minTime; }, [maxTime, minTime]);

  useEffect(() => {
    let handle: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const newTime = state.currentTime + dt;
      if (newTime >= maxTimeRef.current) {
        dispatch({ type: 'SET_CURRENT_TIME', payload: minTimeRef.current });
      } else {
        dispatch({ type: 'TICK_TIME', payload: dt });
      }
      handle = requestAnimationFrame(loop);
    };

    if (state.isPlaying) {
      lastTime = performance.now();
      handle = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(handle);
  }, [state.isPlaying, state.currentTime, dispatch]);

  // Auto-fit zoom: measure container width and fill it with the clip
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const autoFitZoom = containerWidth > 0 && totalDuration > 0
    ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (containerWidth - 20) / totalDuration))
    : MIN_ZOOM;
  const zoom = zoomOverride ?? autoFitZoom;

  // Build per-stream finger assignments (or dummies pre-analysis),
  // then overlay voiceConstraints so user hand/finger selections show immediately
  const streamAssignments = useMemo(() => {
    const map = new Map<string, FingerAssignment[]>();

    if (assignments && assignments.length > 0) {
      // Real assignments — group by noteNumber → stream
      const noteToStream = new Map<number, string>();
      for (const s of activeStreams) {
        noteToStream.set(s.originalMidiNote, s.id);
      }
      for (const a of assignments) {
        const streamId = noteToStream.get(a.noteNumber);
        if (streamId) {
          const constraint = state.voiceConstraints[streamId];
          const overlaid = constraint
            ? {
                ...a,
                assignedHand: constraint.hand ?? a.assignedHand,
                finger: (constraint.finger ?? a.finger) as any,
              }
            : a;
          const list = map.get(streamId) ?? [];
          list.push(overlaid);
          map.set(streamId, list);
        }
      }
    } else {
      // Dummy assignments for pre-analysis rendering — apply constraints if set
      for (const s of activeStreams) {
        const constraint = state.voiceConstraints[s.id];
        const dummies: FingerAssignment[] = s.events.map((e, i) => ({
          eventKey: e.eventKey,
          eventIndex: i,
          noteNumber: s.originalMidiNote,
          startTime: e.startTime,
          assignedHand: (constraint?.hand ?? 'raw') as any,
          finger: (constraint?.finger ?? 'unassigned') as any,
          cost: 0,
          difficulty: 'Easy',
          costBreakdown: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
        }));
        if (dummies.length > 0) map.set(s.id, dummies);
      }
    }
    return map;
  }, [assignments, activeStreams, state.voiceConstraints]);

  // Beat grid lines
  const beatDuration = beatDurationRaw;
  const beatLines = useMemo(() => {
    const lines: Array<{ time: number; x: number; isMeasure: boolean; label: string }> = [];
    const pixelsPerBeat = beatDuration * zoom;

    let stepBeats: number;
    if (pixelsPerBeat < 15) stepBeats = 4;
    else if (pixelsPerBeat < 40) stepBeats = 2;
    else stepBeats = 1;

    const stepSeconds = stepBeats * beatDuration;
    const startBeat = Math.floor(minTime / beatDuration);
    const alignedStart = Math.floor(startBeat / stepBeats) * stepBeats * beatDuration;

    for (let t = alignedStart; t <= maxTime + stepSeconds; t += stepSeconds) {
      const totalBeats = Math.round(t / beatDuration);
      const bar = Math.floor(totalBeats / 4) + 1;
      const beat = (totalBeats % 4) + 1;
      const isMeasure = beat === 1;
      const label = isMeasure ? `${bar}` : `${bar}.${beat}`;

      lines.push({
        time: t,
        x: (t - minTime) * zoom,
        label,
        isMeasure,
      });
    }
    return lines;
  }, [minTime, maxTime, zoom, beatDuration]);

  const timelineWidth = totalDuration * zoom + 100;
  const totalHeight = visibleStreams.length * TRACK_HEIGHT;

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      importFiles(Array.from(files));
    }
    e.target.value = '';
  }, [importFiles]);

  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement;
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = el.scrollTop;
    }
  }, []);

  const handleEventClick = useCallback((eventIndex: number) => {
    dispatch({ type: 'SELECT_EVENT', payload: eventIndex });
  }, [dispatch]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (state.soundStreams.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500 text-sm">
        Import MIDI files or open the Pattern Composer to generate timeline material.
        <div className="mt-3">
          <button
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white transition-colors"
            onClick={handleImportClick}
          >
            Import MIDI Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ─── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 bg-gray-900/40">
        {/* Import */}
        <button
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white transition-colors"
          onClick={handleImportClick}
        >
          Import MIDI
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Info */}
        <span className="text-[11px] text-gray-500">
          {visibleStreams.length} voices, {visibleStreams.reduce((n, s) => n + s.events.length, 0)} events
        </span>

        <div className="flex-1" />

        {/* Search */}
        <input
          type="text"
          placeholder="Filter voices..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            value={zoom}
            onChange={e => setZoomOverride(Number(e.target.value))}
            className="w-20 h-1 accent-blue-500"
          />
        </div>

        {/* Transport */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
          <span className="text-gray-500 font-mono text-xs w-14 text-right">
            {state.currentTime.toFixed(2)}s
          </span>
          <button
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
              state.isPlaying
                ? 'bg-amber-500 text-amber-950'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            }`}
            onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          >
            {state.isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>
          <button
            className="px-2 py-1 rounded bg-gray-700/50 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => {
              dispatch({ type: 'SET_IS_PLAYING', payload: false });
              dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
            }}
          >
            RESET
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: HAND_COLORS.left.bg }} /> L
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: HAND_COLORS.right.bg }} /> R
          </span>
        </div>
      </div>

      {/* ─── Timeline Body ────────────────────────────────────────────────── */}
      <div className="flex" style={{ minHeight: Math.max(totalHeight, 200) }}>
        {/* Voice Sidebar */}
        <div
          ref={sidebarScrollRef}
          className="flex-shrink-0 overflow-hidden border-r border-gray-800"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {visibleStreams.map((stream, i) => (
            <VoiceRow
              key={stream.id}
              stream={stream}
              isEven={i % 2 === 0}
              onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: stream.id })}
            />
          ))}
        </div>

        {/* Scrollable Track Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          <div className="relative" style={{ width: timelineWidth, minHeight: totalHeight }}>
            {/* Beat grid lines */}
            {beatLines.map((line, i) => (
              <div
                key={`beat-${i}`}
                className="absolute top-0 w-px"
                style={{
                  left: line.x,
                  height: totalHeight,
                  backgroundColor: line.isMeasure
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(255,255,255,0.03)',
                }}
              >
                {line.isMeasure && (
                  <span className="absolute -top-0 left-1 text-[8px] text-gray-600 font-mono select-none">
                    {line.label}
                  </span>
                )}
              </div>
            ))}

            {/* Lane dividers + alternating backgrounds */}
            {visibleStreams.map((_, i) => (
              <div key={`track-bg-${i}`}>
                {i % 2 === 1 && (
                  <div
                    className="absolute w-full bg-white/[0.015]"
                    style={{ top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
                  />
                )}
                <div
                  className="absolute w-full border-b border-gray-800/30"
                  style={{ top: (i + 1) * TRACK_HEIGHT }}
                />
              </div>
            ))}

            {/* Playhead */}
            {state.currentTime > 0 && (
              <div
                className="absolute top-0 z-30 pointer-events-none"
                style={{
                  left: (state.currentTime - minTime) * zoom,
                  height: totalHeight,
                  width: 2,
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                }}
              />
            )}

            {/* Event pills per stream (single layer — no duplicate blocks) */}
            {visibleStreams.map((stream, trackIdx) => {
              const trackAssignments = streamAssignments.get(stream.id) ?? [];
              const trackY = trackIdx * TRACK_HEIGHT;

              // Build duration lookup from stream events
              const durationByTime = new Map<number, number>();
              for (const e of stream.events) {
                durationByTime.set(e.startTime, e.duration);
              }

              return (
                <div key={stream.id}>
                  {trackAssignments.map((a, ai) => {
                    const x = (a.startTime - minTime) * zoom;
                    const eventDuration = durationByTime.get(a.startTime) ?? 0.1;
                    const w = Math.max(eventDuration * zoom, 6);
                    const style = HAND_COLORS[a.assignedHand] ?? HAND_COLORS.raw;
                    const hand = a.assignedHand as string;
                    const finger = a.finger as string | null;
                    const isRaw = hand === 'raw' || finger === 'unassigned';
                    const fingerLabel = (finger && finger !== 'unassigned') ? FINGER_ABBREV[finger] ?? finger : '';
                    const isSelected = a.eventIndex === state.selectedEventIndex;
                    const handPrefix = a.assignedHand === 'left' ? 'L' : a.assignedHand === 'right' ? 'R' : '';

                    const pillBg = isRaw ? stream.color : style.bg;
                    const pillText = isRaw ? '#ffffff' : style.text;

                    return (
                      <button
                        key={`pill-${stream.id}-${ai}`}
                        className={`absolute flex items-center justify-center rounded-sm transition-all cursor-pointer
                          ${isSelected ? 'z-20 ring-2 ring-yellow-400 scale-110' : 'z-10 hover:z-20 hover:scale-105'}`}
                        style={{
                          left: x,
                          top: trackY + 4,
                          width: w,
                          height: TRACK_HEIGHT - 8,
                          backgroundColor: pillBg,
                          opacity: isSelected ? 1 : isRaw ? 0.5 : 0.85,
                        }}
                        onClick={() => handleEventClick(a.eventIndex ?? ai)}
                        title={`${a.startTime.toFixed(3)}s${fingerLabel ? ` | ${handPrefix}-${fingerLabel}` : ''}${a.cost ? ` | cost: ${a.cost.toFixed(1)} | ${a.difficulty}` : ''}`}
                      >
                        {fingerLabel && (
                          <span className="text-[7px] font-bold leading-none" style={{ color: pillText }}>
                            {fingerLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VoiceRow({
  stream,
  isEven,
  onToggleMute,
}: {
  stream: SoundStream;
  isEven: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 text-xs border-b border-gray-800/30 transition-colors
        ${isEven ? '' : 'bg-white/[0.015]'}
        ${stream.muted ? 'opacity-40' : ''}`}
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Color swatch */}
      <span
        className="w-2 h-2 rounded-sm flex-shrink-0"
        style={{ backgroundColor: stream.color }}
      />

      {/* Name */}
      <span className="flex-1 truncate text-gray-300 text-[11px]" title={stream.name}>
        {stream.name}
      </span>

      {/* Event count */}
      <span className="text-[9px] text-gray-600 flex-shrink-0">
        {stream.events.length}
      </span>

      {/* Mute toggle */}
      <button
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors
          ${stream.muted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`}
        onClick={e => { e.stopPropagation(); onToggleMute(); }}
        title={stream.muted ? 'Unmute' : 'Mute'}
      >
        {stream.muted ? 'M' : 'M'}
      </button>
    </div>
  );
}
