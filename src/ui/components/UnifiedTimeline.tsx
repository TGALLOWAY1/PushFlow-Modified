/**
 * UnifiedTimeline.
 *
 * Single unified timeline combining lane editing + execution visualization.
 * Shows per-voice swim lanes with event blocks, finger assignment pills (when
 * analysis exists), beat grid, playhead, transport controls, and MIDI import.
 * The pills show the plan of the layout on screen (S3.2), named in the
 * header ("Timeline shows: Candidate B · …"), always as hand+finger ("L2").
 *
 * Replaces the separate LaneToolbar + LaneSidebar + LaneTimeline + TimelinePanel
 * components with one cohesive view rendered in the bottom drawer.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import chroma from 'chroma-js';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan, getInspectedLayout, type SoundStream } from '../state/projectState';
import { inspectedSubject } from '../state/layoutSubject';
import { SubjectChip } from './shared/SubjectChip';
import { useLaneImport } from '../hooks/useLaneImport';
import { type FingerAssignment } from '../../types/executionPlan';
import { RehearsalAudio, type RehearsalHit } from '../audio/rehearsalAudio';
import { TimelineToolbar } from './TimelineToolbar';
import { formatBarBeat, formatBarRange, formatSeconds } from '../../utils/musicalTime';
import {
  BAR_HEADER_HEIGHT,
  BEAT_HEADER_HEIGHT,
  TOTAL_HEADER_HEIGHT,
  TRACK_HEIGHT,
} from './timelineLayout';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 180;
const MIN_ZOOM = 30;  // px per second minimum
const MAX_ZOOM = 500; // px per second maximum

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

/** A labelled pill is at least this wide, so its 11 px "L2" fits (T64). */
const LABELLED_PILL_MIN_WIDTH = 18;

/**
 * Dark or white pill text, whichever contrasts more with the pill as it is
 * seen: its colour at its opacity over the timeline (T64). At least 4.4:1 on
 * every --sound-* colour; a hand tint was 2.3:1 on amber.
 */
function pillTextColor(background: string, opacity: number): string {
  try {
    const seen = chroma.mix('#131313', background, opacity, 'rgb');
    return chroma.contrast(seen, '#ffffff') >= chroma.contrast(seen, '#111827') ? '#ffffff' : '#111827';
  } catch {
    return '#ffffff';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface UnifiedTimelineProps {
  /** Stream IDs to highlight (e.g., from a selected placed preset instance). */
  highlightedStreamIds?: Set<string>;
  /**
   * False while the drawer shows another tab. The timeline stays mounted (so
   * playback carries on), and re-measures its container when shown again.
   */
  isVisible?: boolean;
}

export function UnifiedTimeline({ highlightedStreamIds, isVisible = true }: UnifiedTimelineProps = {}) {
  const { state, dispatch } = useProject();
  const { importFiles } = useLaneImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The scroll container is also kept as state, so the width observer attaches
  // whenever it mounts, including after the empty state gives way to the first
  // import (T50: an import that left the duration unchanged never measured).
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollContainer = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollEl(el);
  }, []);
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
  // Sounds on the layout on screen; the others' notes are drawn outlined, as
  // not placed yet (S3.3, T25), and never hidden (invariant 4).
  const shownLayout = getInspectedLayout(state);
  const placedSoundIds = useMemo(
    () => new Set(Object.values(shownLayout.padToVoice).map(v => v.id)),
    [shownLayout],
  );

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

  // Auto-fit zoom: measure the scroll container and fill it with the clip. The
  // observer attaches when the container mounts (callback ref) and again when
  // the drawer shows the timeline: while hidden it measures 0, so a window
  // resize during that time is caught only on return (T60).
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollEl;
    if (!el || !isVisible) return;
    const measure = () => {
      // A hidden container reports 0; keep the last real width until shown.
      if (el.clientWidth > 0) setContainerWidth(prev => (prev === el.clientWidth ? prev : el.clientWidth));
    };
    measure();
    // Re-measure after a frame to catch layout shifts from content changes
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [scrollEl, isVisible]);

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

  // Return: the start, or the loop start while looping a region. Playback keeps
  // its state, so Return while playing restarts the passage (T61's Return).
  const handleReturn = useCallback(() => {
    const start = state.loopEnabled && state.loopStart !== null ? state.loopStart : minTime;
    seekTo(start);
  }, [state.loopEnabled, state.loopStart, minTime, seekTo]);

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
      // share a pitch (last-wins collision) or when a plan is stale. An assignment
      // that names no known Sound belongs to no lane; its Sound still shows below
      // as unassigned.
      const streamIds = new Set(visibleStreams.map(s => s.id));
      for (const a of assignments) {
        const streamId = (a.voiceId && streamIds.has(a.voiceId)) ? a.voiceId : undefined;
        if (streamId) {
          // Show the Execution Plan, not the preference. Overwriting the plan
          // with the user's preference meant that as soon as any preference was
          // set, every pill displayed it — even for events where the solver chose
          // a different finger, a different hand, or could not play the event at
          // all. The costs and the verdict were computed from the plan, so the
          // fingering on screen and the numbers beside it described different
          // performances, and a preference the solver had NOT honoured looked
          // honoured. Divergence is marked instead of hidden.
          const constraint = state.voiceConstraints[streamId];
          const diverges = !!constraint
            && a.assignedHand !== 'Unplayable'
            && ((constraint.hand !== undefined && constraint.hand !== a.assignedHand)
              || (constraint.finger !== undefined && constraint.finger !== a.finger));
          const list = map.get(streamId) ?? [];
          list.push(diverges ? { ...a, constraintDiverges: true } as FingerAssignment : a);
          map.set(streamId, list);
        }
      }

      // Render unassigned streams: streams with events but no solver assignments
      // (muted streams, and since S3.3 unplaced ones, which the analysis never
      // scores) get "unassigned" pills so they remain visible in the timeline.
      // Their index is negative: they are no event of the plan (a click selects
      // the planned event at the same time, if any).
      for (const s of visibleStreams) {
        if (!map.has(s.id) && s.events.length > 0) {
          const constraint = state.voiceConstraints[s.id];
          const unassigned: FingerAssignment[] = s.events.map((e, i) => ({
            eventKey: e.eventKey,
            eventIndex: -1 - i,
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
          eventIndex: -1 - i,
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

  const handleEventClick = useCallback((clickedIndex: number, startTime: number) => {
    // A note the plan doesn't cover (unplaced or muted) selects the planned
    // event at the same time, so its whole moment still highlights; with none
    // there is nothing to select.
    const eventIndex = clickedIndex >= 0 ? clickedIndex
      : assignments?.find(a => a.eventIndex !== undefined && Math.abs(a.startTime - startTime) < 0.001)?.eventIndex;
    if (eventIndex === undefined || eventIndex < 0) return;
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
  }, [dispatch, streamAssignments, assignments]);

  // ─── Render ──────────────────────────────────────────────────────────────

  // One staged empty state, at the grid (T44): the timeline only says what it will show.
  if (state.soundStreams.length === 0) {
    return (
      <div data-testid="timeline-empty" className="px-6 py-12 text-center text-[var(--text-tertiary)] text-pf-sm">
        Your Sounds' notes appear here once you import MIDI or build a pattern in the Composer.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ─── Toolbar: transport cluster + secondary controls (T05) ──────────── */}
      <TimelineToolbar
        soundCount={visibleStreams.length}
        onImportClick={handleImportClick}
        zoom={zoom}
        minZoom={effectiveMinZoom}
        maxZoom={MAX_ZOOM}
        isAutoFit={zoomOverride === null}
        onZoom={z => setZoomOverride(z)}
        onFit={() => setZoomOverride(null)}
        onReturn={handleReturn}
        regionStart={minTime}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ─── Timeline Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Voice Sidebar */}
        <div
          ref={sidebarScrollRef}
          className="flex-shrink-0 overflow-y-auto border-r border-[var(--border-subtle)]"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* The header's corner names the layout whose plan the pills show (S3.2). */}
          <div
            data-testid="timeline-header"
            className="sticky top-0 z-40 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex flex-col justify-center gap-1 px-2"
            style={{ height: TOTAL_HEADER_HEIGHT }}
          >
            <span className="text-pf-micro text-[var(--text-tertiary)]">Timeline shows</span>
            <SubjectChip subject={inspectedSubject(state)} testId="timeline-subject" />
          </div>
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
          ref={setScrollContainer}
          data-testid="timeline-scroll"
          className="flex-1 min-w-0 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          <div className="relative" style={{ width: timelineWidth, minWidth: '100%', minHeight: totalHeight + TOTAL_HEADER_HEIGHT }}>
            {/* ─── Sticky Beat Header ──────────────────────────────── */}
            {/* Row 1: Bar numbers */}
            <div
              ref={rulerRef}
              data-testid="timeline-ruler"
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
              {/* The loop region reads in bars ("Bars 3–4", T43). */}
              {state.loopEnabled && state.loopStart !== null && state.loopEnd !== null && (
                <span
                  data-testid="timeline-loop-label"
                  className="absolute top-1 px-1.5 rounded-pf-sm bg-sky-500/20 border border-sky-400/40 text-[11px] leading-4 text-sky-200 pointer-events-none whitespace-nowrap"
                  style={{ left: Math.max(0, (Math.min(state.loopStart, state.loopEnd) - minTime) * zoom) + 2 }}
                >
                  {formatBarRange(state.loopStart, state.loopEnd, state.tempo)}
                </span>
              )}
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
                    className="absolute w-full border-b border-border-subtle/30"
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
              // Not on the grid shown: outlined in the Sound's colour, never
              // filled or red, since nothing about these notes is judged yet.
              const unplaced = !placedSoundIds.has(stream.id);

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

                    const isUnplayable = hand === 'Unplayable' && !unplaced;
                    // Always use sound color for pill background; only override for unplayable
                    const pillBg = isUnplayable ? '#ef4444' : stream.color;
                    const pillOpacity = isSelected ? 1 : unplaced ? 0.9 : isRaw ? 0.5 : isUnplayable ? 0.6 : 0.85;
                    // Readable on any Sound colour; the L/R letter carries the hand.
                    // An outlined pill's text sits on the timeline itself.
                    const pillText = unplaced ? 'var(--text-primary)' : pillTextColor(pillBg, pillOpacity);
                    const unplacedBorder = `1.5px solid ${stream.color}`;
                    const pillWidth = fingerLabel ? Math.max(w, LABELLED_PILL_MIN_WIDTH) : w;

                    // Difficulty indicator: colored bottom border for analyzed events.
                    // The middle band is 'Medium' (see DifficultyLevel); this tested
                    // 'Moderate', a value the engine never produces, so the bulk of a
                    // typical performance carried no marking at all and the difficulty
                    // map the user rehearses against was effectively blank.
                    const difficulty = a.difficulty as string;
                    const difficultyBorder = isUnplayable
                      ? '2px solid #ef4444'
                      : isRaw || unplaced
                        ? undefined
                        : difficulty === 'Hard'
                          ? '2px solid #f59e0b'
                          : difficulty === 'Medium'
                            ? '2px solid #a3a3a3'
                            : undefined;

                    // A strike that breaks one of the structural rules (hand
                    // separation, one finger per sound) is outlined, so the few
                    // places the plan had to give way can be found by eye.
                    const relaxed = a.relaxedConstraints ?? [];
                    const relaxedNote = relaxed.length === 0 ? '' : ` | rule relaxed: ${relaxed
                      .map(kind => kind === 'hand-zone'
                        ? 'hand outside its zone'
                        : "not this sound's own finger")
                      .join(', ')}`;

                    return (
                      <button
                        key={`pill-${stream.id}-${ai}`}
                        data-testid="timeline-pill"
                        data-sound-id={stream.id}
                        data-event-key={a.eventKey}
                        data-start={a.startTime}
                        data-finger={fingerLabel ? `${handPrefix}${fingerLabel}` : ''}
                        data-placement={unplaced ? 'unplaced' : undefined}
                        className={`absolute flex items-center justify-center rounded-sm transition-all cursor-pointer
                          ${isSelected ? 'z-20 ring-2 ring-yellow-400 scale-110' : 'z-10 hover:z-20 hover:scale-105'}`}
                        style={{
                          left: x,
                          top: trackY + 4,
                          width: pillWidth,
                          height: TRACK_HEIGHT - 8,
                          backgroundColor: unplaced ? 'transparent' : pillBg,
                          opacity: pillOpacity,
                          // Longhand only: mixing the `border` shorthand with
                          // `borderBottom` makes React drop one of them between
                          // renders, which silently loses the difficulty marker.
                          borderTop: unplaced ? unplacedBorder : isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderLeft: unplaced ? unplacedBorder : isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderRight: unplaced ? unplacedBorder : isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderBottom: unplaced ? unplacedBorder : difficultyBorder
                            ?? (isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined),
                          outline: relaxed.length > 0 ? '1.5px dashed #c084fc' : undefined,
                          outlineOffset: relaxed.length > 0 ? 1 : undefined,
                        }}
                        onClick={() => handleEventClick(a.eventIndex ?? ai, a.startTime)}
                        title={`${formatBarBeat(a.startTime, state.tempo)} (${formatSeconds(a.startTime)})${unplaced ? ' · not placed yet' : ''}${fingerLabel ? ` · ${handPrefix}${fingerLabel}` : ''}${a.cost ? ` · ${a.difficulty}` : ''}${a.constraintDiverges ? ' · differs from your finger preference' : ''}${relaxedNote.replace(' | ', ' · ')}`}
                      >
                        {a.constraintDiverges && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: '#fbbf24' }}
                          />
                        )}
                        {fingerLabel && (
                          <span className="text-[11px] font-bold leading-none" style={{ color: pillText }}>
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
      className={`flex items-center gap-1.5 px-2 text-pf-sm border-b border-border-subtle/30 transition-colors
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
