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
import { getActiveStreams, getDisplayedExecutionPlan, type SoundStream } from '../state/projectState';
import { useLaneImport } from '../hooks/useLaneImport';
import { type FingerAssignment } from '../../types/executionPlan';

// ─── Constants ───────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 32;
const SIDEBAR_WIDTH = 180;
const MIN_ZOOM = 30;  // px per second minimum
const MAX_ZOOM = 500; // px per second maximum
const BAR_HEADER_HEIGHT = 40;  // Bar number row
const BEAT_HEADER_HEIGHT = 20; // Beat subdivision row
const TOTAL_HEADER_HEIGHT = BAR_HEADER_HEIGHT + BEAT_HEADER_HEIGHT;

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const HAND_COLORS: Record<string, { bg: string; text: string }> = {
  left: { bg: '#3b82f6', text: '#dbeafe' },
  right: { bg: '#a855f7', text: '#f3e8ff' },
  Unplayable: { bg: '#ef4444', text: '#fecaca' },
  raw: { bg: '#4b5563', text: '#9ca3af' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface UnifiedTimelineProps {
  /** Stream IDs to highlight (e.g., from a selected placed preset instance). */
  highlightedStreamIds?: Set<string>;
}

export function UnifiedTimeline({ highlightedStreamIds }: UnifiedTimelineProps = {}) {
  const { state, dispatch } = useProject();
  const { importFiles } = useLaneImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  const [zoomOverride, setZoomOverride] = useState<number | null>(null); // null = auto-fit

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
  const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;

  const visibleStreams = activeStreams;

  // Beat duration (used for bar-quantization and grid lines)
  const beatDurationRaw = 60 / (state.tempo || 120);
  const barDuration = beatDurationRaw * 4; // 4 beats per bar

  // Compute time range across all streams, snapped to bar boundaries for grid lines
  // but using raw content extent for zoom calculation
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
    // Snap min down and max up to bar boundaries (for grid lines)
    min = Math.floor(min / barDuration) * barDuration;
    max = Math.ceil(max / barDuration) * barDuration;
    if (max <= min) max = min + barDuration;
    return {
      minTime: min,
      maxTime: max,
      totalDuration: max - min,
    };
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
  // Re-measure when totalDuration changes (e.g. after MIDI import)
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    // Re-measure after a frame to catch layout shifts from content changes
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [totalDuration]);

  // Auto-fit: scale so full bar-snapped duration fills the container width exactly
  const autoFitZoom = containerWidth > 0 && totalDuration > 0
    ? Math.max(MIN_ZOOM, containerWidth / totalDuration)
    : MIN_ZOOM;
  // Minimum zoom is the auto-fit level (max zoom-out shows all content)
  const effectiveMinZoom = Math.max(MIN_ZOOM, autoFitZoom);
  const zoom = zoomOverride !== null ? Math.max(effectiveMinZoom, zoomOverride) : autoFitZoom;

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

      // Render unassigned streams: streams with events but no solver assignments
      // get grey "unassigned" pills so they remain visible in the timeline
      for (const s of activeStreams) {
        if (!map.has(s.id) && s.events.length > 0) {
          const constraint = state.voiceConstraints[s.id];
          const unassigned: FingerAssignment[] = s.events.map((e, i) => ({
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
          map.set(s.id, unassigned);
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

  // Bar/beat header data
  const barWidth = barDuration * zoom;
  const beatWidth = beatDuration * zoom;
  const headerBars = useMemo(() => {
    const bars: Array<{ barNum: number; x: number }> = [];
    const startBar = Math.floor(minTime / barDuration);
    const endBar = Math.ceil(maxTime / barDuration);
    for (let b = startBar; b < endBar; b++) {
      bars.push({ barNum: b + 1, x: (b * barDuration - minTime) * zoom });
    }
    return bars;
  }, [minTime, maxTime, barDuration, zoom]);

  const headerBeats = useMemo(() => {
    const beats: Array<{ beatNum: number; x: number; isMeasureStart: boolean }> = [];
    const startBeat = Math.floor(minTime / beatDuration);
    const endBeat = Math.ceil(maxTime / beatDuration);
    for (let b = startBeat; b < endBeat; b++) {
      const beatInBar = (b % 4) + 1;
      beats.push({
        beatNum: beatInBar,
        x: (b * beatDuration - minTime) * zoom,
        isMeasureStart: beatInBar === 1,
      });
    }
    return beats;
  }, [minTime, maxTime, beatDuration, zoom]);

  // In auto-fit mode, match container exactly; when manually zoomed, add padding
  const isAutoFit = zoomOverride === null;
  const timelineWidth = isAutoFit
    ? Math.max(containerWidth, totalDuration * zoom)
    : totalDuration * zoom + 100;
  const totalHeight = visibleStreams.length * TRACK_HEIGHT;

  // ─── Auto-scroll to selected event ────────────────────────────────────
  const prevSelectedRef = useRef(state.selectedEventIndex);
  useEffect(() => {
    if (
      state.selectedEventIndex === null ||
      state.selectedEventIndex === prevSelectedRef.current ||
      !scrollContainerRef.current
    ) {
      prevSelectedRef.current = state.selectedEventIndex;
      return;
    }
    prevSelectedRef.current = state.selectedEventIndex;

    // Find the startTime of the selected event from assignments
    const allAssignments = Array.from(streamAssignments.values()).flat();
    const selected = allAssignments.find(a => a.eventIndex === state.selectedEventIndex);
    if (!selected) return;

    const x = (selected.startTime - minTime) * zoom;
    const container = scrollContainerRef.current;
    const viewWidth = container.clientWidth;

    // Only scroll if the event is outside the visible area
    const scrollLeft = container.scrollLeft;
    if (x < scrollLeft || x > scrollLeft + viewWidth - 40) {
      container.scrollTo({ left: Math.max(0, x - viewWidth / 3), behavior: 'smooth' });
    }
  }, [state.selectedEventIndex, streamAssignments, minTime, zoom]);

  // ─── Selected moment time (for multi-note highlighting) ─────────────────
  // When an event is selected, compute its startTime so all pills at that same
  // start time highlight together (a "moment" = all notes with coincident starts).
  const selectedMomentTime = useMemo(() => {
    if (state.selectedEventIndex === null) return null;
    const allA = Array.from(streamAssignments.values()).flat();
    const sel = allA.find(a => a.eventIndex === state.selectedEventIndex);
    return sel?.startTime ?? null;
  }, [state.selectedEventIndex, streamAssignments]);

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
      <div className="px-6 py-12 text-center text-[var(--text-tertiary)] text-pf-sm">
        Import MIDI files or open the Pattern Composer to generate timeline material.
        <div className="mt-3">
          <button
            className="pf-btn pf-btn-primary text-pf-sm"
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
    <div className="flex flex-col h-full">
      {/* ─── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/40 flex-shrink-0">
        {/* Import */}
        <button
          className="pf-btn pf-btn-primary text-pf-xs"
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
        <span className="text-pf-sm text-[var(--text-tertiary)]">
          {visibleStreams.length} sounds
        </span>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <span className="text-pf-xs text-[var(--text-tertiary)]">Zoom</span>
          <input
            type="range"
            min={effectiveMinZoom}
            max={MAX_ZOOM}
            value={Math.max(effectiveMinZoom, Math.min(MAX_ZOOM, zoom))}
            onChange={e => setZoomOverride(Math.max(effectiveMinZoom, Number(e.target.value)))}
            className="w-20 h-1 accent-blue-500"
          />
          <button
            className={`px-1.5 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
              zoomOverride === null
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
            onClick={() => setZoomOverride(null)}
            title="Auto-fit: fill container with MIDI content"
          >
            Fit
          </button>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-default)]">
          <span className="text-[var(--text-tertiary)] font-mono text-pf-sm w-14 text-right">
            {state.currentTime.toFixed(2)}s
          </span>
          <button
            className={`px-2.5 py-1 rounded-pf-sm text-pf-xs font-bold transition-colors ${
              state.isPlaying
                ? 'bg-amber-500 text-amber-950'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            }`}
            onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          >
            {state.isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>
          <button
            className="px-2 py-1 rounded-pf-sm bg-[var(--bg-card)]/50 text-pf-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => {
              dispatch({ type: 'SET_IS_PLAYING', payload: false });
              dispatch({ type: 'SET_CURRENT_TIME', payload: 0 });
            }}
          >
            RESET
          </button>
        </div>

      </div>

      {/* ─── Timeline Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Voice Sidebar */}
        <div
          ref={sidebarScrollRef}
          className="flex-shrink-0 overflow-y-auto border-r border-[var(--border-subtle)]"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Header spacer to align with beat header */}
          <div className="sticky top-0 z-40 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]" style={{ height: TOTAL_HEADER_HEIGHT }} />
          {visibleStreams.map((stream, i) => (
            <VoiceRow
              key={stream.id}
              stream={stream}
              isEven={i % 2 === 0}
              isGlobalSelected={state.selectedStreamId === stream.id}
              isInstanceHighlighted={highlightedStreamIds?.has(stream.id) ?? false}
              onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: stream.id })}
              onSolo={() => dispatch({ type: 'SOLO_STREAM', payload: stream.id })}
              onRename={(name) => dispatch({ type: 'RENAME_SOUND', payload: { streamId: stream.id, name } })}
            />
          ))}
        </div>

        {/* Scrollable Track Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-w-0 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          <div className="relative" style={{ width: timelineWidth, minWidth: '100%', minHeight: totalHeight + TOTAL_HEADER_HEIGHT }}>
            {/* ─── Sticky Beat Header ──────────────────────────────── */}
            {/* Row 1: Bar numbers */}
            <div className="sticky top-0 z-40 bg-[var(--bg-app)] border-b border-[var(--border-default)]" style={{ height: BAR_HEADER_HEIGHT, width: timelineWidth }}>
              <div className="flex" style={{ height: BAR_HEADER_HEIGHT, width: timelineWidth }}>
                {headerBars.map(bar => (
                  <div
                    key={`bar-${bar.barNum}`}
                    className="text-center text-pf-sm font-medium text-[var(--text-secondary)] border-l border-[var(--border-default)] flex items-end justify-center pb-1"
                    style={{ width: barWidth, minWidth: barWidth, flexShrink: 0 }}
                  >
                    {bar.barNum}
                  </div>
                ))}
              </div>
            </div>
            {/* Row 2: Beat subdivisions */}
            <div className="sticky z-40 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]" style={{ height: BEAT_HEADER_HEIGHT, top: BAR_HEADER_HEIGHT, width: timelineWidth }}>
              <div className="flex" style={{ height: BEAT_HEADER_HEIGHT, width: timelineWidth }}>
                {headerBeats.map((beat, i) => (
                  <div
                    key={`subbeat-${i}`}
                    className="text-center text-pf-xs text-[var(--text-tertiary)] flex items-center justify-center"
                    style={{ width: beatWidth, minWidth: beatWidth, flexShrink: 0 }}
                  >
                    {beat.beatNum}
                  </div>
                ))}
              </div>
            </div>

            {/* Beat grid lines (offset below header) */}
            {beatLines.map((line, i) => (
              <div
                key={`beat-${i}`}
                className="absolute w-px"
                style={{
                  left: line.x,
                  top: TOTAL_HEADER_HEIGHT,
                  height: totalHeight,
                  backgroundColor: line.isMeasure
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(255,255,255,0.03)',
                }}
              />
            ))}

            {/* Lane dividers + alternating backgrounds + instance highlight */}
            {visibleStreams.map((stream, i) => {
              const isHighlighted = highlightedStreamIds?.has(stream.id) ?? false;
              return (
                <div key={`track-bg-${i}`}>
                  {isHighlighted ? (
                    <div
                      className="absolute w-full"
                      style={{
                        top: TOTAL_HEADER_HEIGHT + i * TRACK_HEIGHT,
                        height: TRACK_HEIGHT,
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        borderLeft: '2px solid rgba(139, 92, 246, 0.4)',
                      }}
                    />
                  ) : i % 2 === 1 ? (
                    <div
                      className="absolute w-full bg-white/[0.015]"
                      style={{ top: TOTAL_HEADER_HEIGHT + i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
                    />
                  ) : null}
                  <div
                    className="absolute w-full border-b border-[var(--border-subtle)]/30"
                    style={{ top: TOTAL_HEADER_HEIGHT + (i + 1) * TRACK_HEIGHT }}
                  />
                </div>
              );
            })}

            {/* Playhead */}
            {state.currentTime > 0 && (
              <div
                className="absolute z-30 pointer-events-none"
                style={{
                  left: (state.currentTime - minTime) * zoom,
                  top: TOTAL_HEADER_HEIGHT,
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
              const trackY = TOTAL_HEADER_HEIGHT + trackIdx * TRACK_HEIGHT;

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

                    const hand = a.assignedHand as string;
                    const finger = a.finger as string | null;
                    const isRaw = hand === 'raw' || finger === 'unassigned';
                    const fingerLabel = (finger && finger !== 'unassigned') ? FINGER_ABBREV[finger] ?? finger : '';
                    const isSelected = a.eventIndex === state.selectedEventIndex
                      || (selectedMomentTime !== null && Math.abs(a.startTime - selectedMomentTime) < 0.001);
                    const handPrefix = a.assignedHand === 'left' ? 'L' : a.assignedHand === 'right' ? 'R' : '';

                    const isUnplayable = hand === 'Unplayable';
                    // Always use sound color for pill background; only override for unplayable
                    const pillBg = isUnplayable ? '#ef4444' : stream.color;
                    const pillText = isRaw ? '#ffffff' : (HAND_COLORS[a.assignedHand] ?? HAND_COLORS.raw).text;

                    // Difficulty indicator: colored bottom border for analyzed events
                    const difficulty = a.difficulty as string;
                    const difficultyBorder = !isRaw && difficulty === 'Hard'
                      ? '2px solid #f59e0b'
                      : !isRaw && difficulty === 'Moderate'
                        ? '2px solid #a3a3a3'
                        : isUnplayable
                          ? '2px solid #ef4444'
                          : undefined;

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
                          opacity: isSelected ? 1 : isRaw ? 0.5 : isUnplayable ? 0.6 : 0.85,
                          border: isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderBottom: difficultyBorder,
                        }}
                        onClick={() => handleEventClick(a.eventIndex ?? ai)}
                        title={`${a.startTime.toFixed(3)}s${fingerLabel ? ` | ${handPrefix}-${fingerLabel}` : ''}${a.cost ? ` | cost: ${a.cost.toFixed(1)} | ${a.difficulty}` : ''}`}
                      >
                        {fingerLabel && (
                          <span className="text-[7px] font-bold leading-none" style={{ color: pillText }}>
                            {handPrefix}{fingerLabel}
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
  isGlobalSelected,
  isInstanceHighlighted = false,
  onToggleMute,
  onSolo,
  onRename,
}: {
  stream: SoundStream;
  isEven: boolean;
  isGlobalSelected: boolean;
  isInstanceHighlighted?: boolean;
  onToggleMute: () => void;
  onSolo: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stream.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== stream.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  useEffect(() => {
    if (editing) {
      setDraft(stream.name);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, stream.name]);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 text-pf-sm border-b border-[var(--border-subtle)]/30 transition-colors
        ${isGlobalSelected ? 'bg-blue-500/15 border-l-2 border-l-blue-400' : isInstanceHighlighted ? 'bg-violet-500/10 border-l-2 border-l-violet-400' : isEven ? '' : 'bg-white/[0.015]'}
        ${stream.muted ? 'opacity-40' : ''}`}
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Color swatch */}
      <span
        className="w-2 h-2 rounded-pf-sm flex-shrink-0"
        style={{ backgroundColor: stream.color }}
      />

      {/* Name (double-click to rename) */}
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-[var(--bg-input)] border border-blue-500 rounded-pf-sm px-1 py-0 text-pf-sm text-[var(--text-primary)] outline-none"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="flex-1 truncate text-[var(--text-secondary)] text-pf-sm cursor-text"
          title={`${stream.name} (double-click to rename)`}
          onDoubleClick={() => setEditing(true)}
        >
          {stream.name}
        </span>
      )}

      {/* Solo */}
      <button
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-pf-xs transition-colors bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:bg-amber-500/20 hover:text-amber-400"
        onClick={e => { e.stopPropagation(); onSolo(); }}
        title="Solo"
      >
        S
      </button>

      {/* Mute toggle */}
      <button
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-pf-sm text-pf-xs transition-colors
          ${stream.muted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
        onClick={e => { e.stopPropagation(); onToggleMute(); }}
        title={stream.muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>
    </div>
  );
}
