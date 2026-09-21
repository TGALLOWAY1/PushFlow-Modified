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
import { getDisplayedExecutionPlan, type SoundStream } from '../state/projectState';
import { useLaneImport } from '../hooks/useLaneImport';
import { type FingerAssignment } from '../../types/executionPlan';
import { RehearsalAudio, type RehearsalHit } from '../audio/rehearsalAudio';

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

  const assignments = getDisplayedExecutionPlan(state)?.fingerAssignments;

  // Timeline shows ALL sound streams, including muted ones (Product Invariant #4:
  // the timeline must never hide a stream). Muted streams are rendered distinctly
  // (dimmed) and remain unmute-able from the sidebar.
  const visibleStreams = state.soundStreams;

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

  // ─── Rehearsal Audio ────────────────────────────────────────────────────

  // One audio engine for the lifetime of the timeline. Created eagerly but only
  // opens an AudioContext when the user actually presses play, since browsers
  // require a gesture before audio may start.
  const audioRef = useRef<RehearsalAudio | null>(null);
  if (audioRef.current === null) audioRef.current = new RehearsalAudio();
  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    audioRef.current?.setOptions(state.rehearsalAudio);
  }, [state.rehearsalAudio]);

  // Every hit in the performance, flattened for the audio scheduler. Muted
  // streams are excluded so the mute buttons affect what you hear, not just
  // what the solver sees.
  const audibleHits = useMemo<RehearsalHit[]>(() => {
    const hits: RehearsalHit[] = [];
    for (const stream of state.soundStreams) {
      if (stream.muted) continue;
      for (const event of stream.events) {
        hits.push({ soundId: stream.id, time: event.startTime, velocity: event.velocity });
      }
    }
    return hits.sort((a, b) => a.time - b.time);
  }, [state.soundStreams]);

  // ─── Playback RAF Loop (with looping) ───────────────────────────────────

  const maxTimeRef = useRef(maxTime);
  const minTimeRef = useRef(minTime);
  useEffect(() => { maxTimeRef.current = maxTime; minTimeRef.current = minTime; }, [maxTime, minTime]);

  // The loop reads live state through refs so the effect can be created once per
  // play/stop rather than torn down and rebuilt on every frame. Rebuilding it each
  // frame (the previous behaviour, caused by depending on state.currentTime) reset
  // the frame clock continuously and made the playhead drift against the audio.
  const clockRef = useRef({
    currentTime: state.currentTime,
    rate: state.playbackRate,
    loopEnabled: state.loopEnabled,
    loopStart: state.loopStart,
    loopEnd: state.loopEnd,
    tempo: state.tempo,
    hits: audibleHits,
  });
  clockRef.current = {
    currentTime: state.currentTime,
    rate: state.playbackRate,
    loopEnabled: state.loopEnabled,
    loopStart: state.loopStart,
    loopEnd: state.loopEnd,
    tempo: state.tempo,
    hits: audibleHits,
  };

  useEffect(() => {
    if (!state.isPlaying) return;

    let handle = 0;
    let lastFrame = performance.now();
    let position = clockRef.current.currentTime;
    const audio = audioRef.current;
    audio?.reset();
    void audio?.resume();

    const loop = (frameTime: number) => {
      const wallDelta = (frameTime - lastFrame) / 1000;
      lastFrame = frameTime;

      // Honour a seek requested while playing before advancing.
      if (seekRef.current !== null) {
        position = seekRef.current;
        seekRef.current = null;
        audio?.reset();
      }

      const {
        rate, loopEnabled, loopStart, loopEnd, tempo, hits,
      } = clockRef.current;

      // Rehearsal speed scales transport time, not wall time.
      const advance = wallDelta * rate;
      const from = position;
      const regionStart = loopEnabled && loopStart !== null ? loopStart : minTimeRef.current;
      const regionEnd = loopEnabled && loopEnd !== null ? loopEnd : maxTimeRef.current;
      let to = position + advance;

      let wrapped = false;
      if (to >= regionEnd) {
        to = regionEnd;
        wrapped = true;
      }

      // Sound the slice of time that just elapsed, so hits land when the playhead
      // crosses them rather than whenever a re-render happens.
      audio?.playMetronomeWindow(from, to, tempo);
      audio?.playWindow(hits, from, to);

      if (wrapped) {
        position = regionStart;
        audio?.reset();
        dispatch({ type: 'SET_CURRENT_TIME', payload: regionStart });
      } else {
        position = to;
        dispatch({ type: 'SET_CURRENT_TIME', payload: to });
      }

      handle = requestAnimationFrame(loop);
    };

    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
    // Intentionally excludes currentTime: the loop owns the playhead while running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, dispatch]);

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

  // Follow the playhead while playing.
  //
  // Nothing scrolled the timeline during playback, so on a real take the cursor
  // walked off the right edge after about twenty seconds and the view stayed
  // frozen at bar 1 for the rest of the performance — the user pressed play and
  // simply could not see what was being played. Scrolls only when the cursor
  // approaches an edge, so the view does not jitter on every frame.
  useEffect(() => {
    if (!state.isPlaying) return;
    const el = scrollContainerRef.current;
    if (!el || zoom <= 0) return;

    const x = (state.currentTime - minTime) * zoom;
    const view = el.clientWidth;
    const margin = view * 0.15;
    if (x < el.scrollLeft + margin || x > el.scrollLeft + view - margin) {
      el.scrollLeft = Math.max(0, x - view / 2);
    }
  }, [state.isPlaying, state.currentTime, zoom, minTime]);


  // ─── Loop Region Selection ──────────────────────────────────────────────

  // Dragging across the bar ruler marks the passage to rehearse. Click (no drag)
  // just moves the playhead, which is what a ruler click normally means.
  const [dragRegion, setDragRegion] = useState<{ from: number; to: number } | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);

  // Timeline x is measured from `minTime`, not from zero. Converting without it
  // put ruler clicks whole bars earlier than the bar clicked, and shaded a loop
  // region over a different passage than the transport actually looped.
  const timeFromRulerEvent = useCallback((clientX: number): number | null => {
    const el = rulerRef.current;
    if (!el || zoom <= 0) return null;
    const rect = el.getBoundingClientRect();
    const t = minTime + (clientX - rect.left) / zoom;
    return Math.min(maxTime, Math.max(minTime, t));
  }, [zoom, minTime, maxTime]);

  const handleRulerMouseDown = useCallback((e: React.MouseEvent) => {
    const t = timeFromRulerEvent(e.clientX);
    if (t === null) return;
    setDragRegion({ from: t, to: t });
  }, [timeFromRulerEvent]);

  const handleRulerMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRegion) return;
    const t = timeFromRulerEvent(e.clientX);
    if (t === null) return;
    setDragRegion({ from: dragRegion.from, to: t });
  }, [dragRegion, timeFromRulerEvent]);

  // Pending seek, read by the playback loop at the top of its next frame. Without
  // it the running loop owned the playhead outright and silently reverted every
  // ruler click, so relocating during rehearsal meant stop, click, start again.
  const seekRef = useRef<number | null>(null);
  const seekTo = useCallback((t: number) => {
    seekRef.current = t;
    dispatch({ type: 'SET_CURRENT_TIME', payload: t });
  }, [dispatch]);

  const handleRulerMouseUp = useCallback(() => {
    if (!dragRegion) return;
    const { from, to } = dragRegion;
    setDragRegion(null);
    // A drag shorter than ~1px of travel is a click, not a region.
    if (Math.abs(to - from) * zoom < 4) {
      seekTo(from);
      return;
    }
    dispatch({ type: 'SET_LOOP_REGION', payload: { start: from, end: to } });
    dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
    seekTo(Math.min(from, to));
  }, [dragRegion, zoom, dispatch, seekTo]);


  // Build per-stream finger assignments (or dummies pre-analysis),
  // then overlay voiceConstraints so user hand/finger selections show immediately
  const streamAssignments = useMemo(() => {
    const map = new Map<string, FingerAssignment[]>();

    if (assignments && assignments.length > 0) {
      // Group assignments onto streams by STABLE VOICE IDENTITY (voiceId), never by
      // MIDI pitch (Product Invariant #5). Pitch keying loses events when two streams
      // share a pitch (last-wins collision) or when a plan is stale. Fall back to
      // pitch only for legacy assignments that predate voiceId.
      const streamIds = new Set(visibleStreams.map(s => s.id));
      const noteToStream = new Map<number, string>();
      for (const s of visibleStreams) {
        if (!noteToStream.has(s.originalMidiNote)) noteToStream.set(s.originalMidiNote, s.id);
      }
      for (const a of assignments) {
        const streamId = (a.voiceId && streamIds.has(a.voiceId))
          ? a.voiceId
          : noteToStream.get(a.noteNumber);
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
      // (including muted streams, which the solver never assigns) get grey
      // "unassigned" pills so they remain visible in the timeline.
      for (const s of visibleStreams) {
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
            costBreakdown: { fingerPreference: 0, handShapeDeviation: 0, alternation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
          }));
          map.set(s.id, unassigned);
        }
      }
    } else {
      // Dummy assignments for pre-analysis rendering — apply constraints if set
      for (const s of visibleStreams) {
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
          costBreakdown: { fingerPreference: 0, handShapeDeviation: 0, alternation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
        }));
        if (dummies.length > 0) map.set(s.id, dummies);
      }
    }
    return map;
  }, [assignments, visibleStreams, state.voiceConstraints]);

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
    // Also select the moment so all simultaneous notes highlight
    const allAssignments = Array.from(streamAssignments.values()).flat();
    const clicked = allAssignments.find(a => a.eventIndex === eventIndex);
    if (clicked) {
      // Find moment index: count distinct start times up to this one
      const uniqueTimes = [...new Set(allAssignments.map(a => a.startTime))].sort((a, b) => a - b);
      const EPSILON = 0.001;
      const momentIdx = uniqueTimes.findIndex(t => Math.abs(t - clicked.startTime) < EPSILON);
      if (momentIdx >= 0) {
        dispatch({ type: 'SELECT_MOMENT', payload: momentIdx });
      }
    }
  }, [dispatch, streamAssignments]);

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

        {/* Rehearsal controls — practising a hard passage means slowing it down,
            looping it, and hearing it. */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-default)]">
          <label className="flex items-center gap-1 text-pf-xs text-[var(--text-tertiary)]">
            Speed
            <select
              className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-pf-sm px-1 py-0.5 text-pf-xs text-[var(--text-primary)]"
              value={state.playbackRate}
              onChange={(e) => dispatch({ type: 'SET_PLAYBACK_RATE', payload: Number(e.target.value) })}
              title="Rehearsal speed — the layout and analysis are unchanged"
            >
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5].map(rate => (
                <option key={rate} value={rate}>{rate}x</option>
              ))}
            </select>
          </label>

          <button
            className={`px-2 py-1 rounded-pf-sm text-pf-xs font-semibold transition-colors ${
              state.loopEnabled
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
            onClick={() => dispatch({ type: 'SET_LOOP_ENABLED', payload: !state.loopEnabled })}
            title={
              state.loopStart !== null && state.loopEnd !== null
                ? `Loop ${state.loopStart.toFixed(2)}s - ${state.loopEnd.toFixed(2)}s`
                : 'Loop the whole performance (shift-drag the beat ruler to set a region)'
            }
          >
            LOOP
          </button>

          <button
            className={`px-2 py-1 rounded-pf-sm text-pf-xs font-semibold transition-colors ${
              state.rehearsalAudio.metronome
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
            onClick={() => dispatch({
              type: 'SET_REHEARSAL_AUDIO',
              payload: { metronome: !state.rehearsalAudio.metronome },
            })}
            title="Click track at the project tempo"
          >
            CLICK
          </button>

          <button
            className={`px-2 py-1 rounded-pf-sm text-pf-xs font-semibold transition-colors ${
              state.rehearsalAudio.hits
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
            onClick={() => dispatch({
              type: 'SET_REHEARSAL_AUDIO',
              payload: { hits: !state.rehearsalAudio.hits },
            })}
            title="Hear each sound as the playhead reaches it"
          >
            SOUND
          </button>

          {state.loopStart !== null && state.loopEnd !== null && (
            <button
              className="px-2 py-1 rounded-pf-sm bg-[var(--bg-card)]/50 text-pf-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => dispatch({ type: 'SET_LOOP_REGION', payload: { start: null, end: null } })}
              title="Clear the loop region"
            >
              ✕ REGION
            </button>
          )}
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
            <div
              ref={rulerRef}
              className="sticky top-0 z-40 bg-[var(--bg-app)] border-b border-[var(--border-default)] cursor-text select-none"
              style={{ height: BAR_HEADER_HEIGHT, width: timelineWidth }}
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              onMouseUp={handleRulerMouseUp}
              onMouseLeave={handleRulerMouseUp}
              title="Click to move the playhead, or drag to mark a passage to loop"
            >
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

            {/* Loop / drag region shading — shows the passage being rehearsed */}
            {(() => {
              const start = dragRegion
                ? Math.min(dragRegion.from, dragRegion.to)
                : state.loopEnabled ? state.loopStart : null;
              const end = dragRegion
                ? Math.max(dragRegion.from, dragRegion.to)
                : state.loopEnabled ? state.loopEnd : null;
              if (start === null || end === null || end <= start) return null;
              return (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: (start - minTime) * zoom,
                    width: (end - start) * zoom,
                    top: TOTAL_HEADER_HEIGHT,
                    height: totalHeight,
                    backgroundColor: 'rgba(59, 130, 246, 0.10)',
                    borderLeft: '1px solid rgba(59, 130, 246, 0.55)',
                    borderRight: '1px solid rgba(59, 130, 246, 0.55)',
                  }}
                />
              );
            })()}

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

            {/* Playhead. Rendered unconditionally: hiding it at position 0 meant
                there was no cursor at the start of a take, or after RESET, so the
                user could not see where playback would begin. */}
            {(
              <div
                className="absolute z-30 pointer-events-none"
                style={{
                  left: Math.max(0, Math.min(totalDuration, state.currentTime - minTime)) * zoom,
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

                    // Difficulty indicator: colored bottom border for analyzed events.
                    // The middle band is 'Medium' (see DifficultyLevel); this tested
                    // 'Moderate', a value the engine never produces, so the bulk of a
                    // typical performance carried no marking at all and the difficulty
                    // map the user rehearses against was effectively blank.
                    const difficulty = a.difficulty as string;
                    const difficultyBorder = isUnplayable
                      ? '2px solid #ef4444'
                      : isRaw
                        ? undefined
                        : difficulty === 'Hard'
                          ? '2px solid #f59e0b'
                          : difficulty === 'Medium'
                            ? '2px solid #a3a3a3'
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
                          // Longhand only: mixing the `border` shorthand with
                          // `borderBottom` makes React drop one of them between
                          // renders, which silently loses the difficulty marker.
                          borderTop: isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderLeft: isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderRight: isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderBottom: difficultyBorder
                            ?? (isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined),
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
