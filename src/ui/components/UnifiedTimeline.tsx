/**
 * UnifiedTimeline.
 *
 * Single unified timeline combining lane editing + execution visualization.
 * Shows per-voice swim lanes with event blocks, finger assignment pills (when
 * analysis exists), beat grid, the loop strip and the playhead, and MIDI
 * import. The pills show the plan of the layout on screen (S3.2), named in the
 * header ("Timeline shows: Candidate B · …"), always as hand+finger ("L2").
 *
 * Playback is the workspace's transport (S4.3a, TransportProvider), not the
 * timeline's: the timeline draws its playhead and loop and seeks through it,
 * so switching the drawer to the Composer never touches playback. Its own
 * controls (+ MIDI, Zoom, Fit) sit in the drawer's tab row while it is shown.
 *
 * Replaces the separate LaneToolbar + LaneSidebar + LaneTimeline + TimelinePanel
 * components with one cohesive view rendered in the bottom drawer.
 */

import { useState, useMemo, useRef, useEffect, useCallback, useContext, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import chroma from 'chroma-js';
import { Ban, VolumeX } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan, getInspectedLayout, type SoundStream } from '../state/projectState';
import { inspectedSubject } from '../state/layoutSubject';
import { SubjectChip } from './shared/SubjectChip';
import { useLaneImport } from '../hooks/useLaneImport';
import { type FingerAssignment } from '../../types/executionPlan';
import { eventAtTime, eventOfNote, getEventTimeline, resolveEventKey } from '../analysis/eventTimeline';
import { useTransport, useTransportPosition } from '../audio/TransportProvider';
import { orderSounds } from '../state/soundOrder';
import { silentLabel, silentReason, type SilentReason } from '../audio/audibility';
import { loopRegionOf } from '../audio/transportMath';
import { DrawerToolbarSlot, TimelineToolbar } from './TimelineToolbar';
import { TimelineRuler } from './TimelineRuler';
import { formatBarBeat, formatSeconds } from '../../utils/musicalTime';
import { fingerLabel as fingerLabelOf, fingerName, handColor } from '../../utils/fingerNotation';
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
  const toolbarSlot = useContext(DrawerToolbarSlot);
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

  // Timeline shows ALL sound streams, muted and excluded ones too (Product
  // Invariant #4: the timeline must never hide a stream). A muted Sound keeps
  // its analysed pills, with a speaker-off glyph on its lane; an excluded one
  // gets "not analysed" placeholder pills and a glyph (S4.4). The lanes follow
  // the Sounds panel's one order: its groups, then Ungrouped (S5.1, T45).
  const visibleStreams = useMemo(
    () => orderSounds(state.soundStreams, state.performanceLanes, state.laneGroups),
    [state.soundStreams, state.performanceLanes, state.laneGroups],
  );
  const soundIds = useMemo(() => state.soundStreams.map(s => s.id), [state.soundStreams]);
  const audition = { mutedSoundIds: state.mutedSoundIds, soloedSoundIds: state.soloedSoundIds };

  // Beat duration (used for bar-quantization and grid lines)
  const beatDurationRaw = 60 / (state.tempo || 120);
  const barDuration = beatDurationRaw * 4; // 4 beats per bar

  // The span the transport plays, from the bar line at or before the first
  // note to the one at or after the last note's end (transportMath.songSpan):
  // what the ruler draws is what Play, Return and Loop use.
  const { song } = useTransport();
  const minTime = song.start;
  const maxTime = song.end;
  const totalDuration = maxTime - minTime;

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

  // A loop being dragged out on the ruler, shaded over the lanes as it moves.
  const [loopPreview, setLoopPreview] = useState<{ start: number; end: number } | null>(null);


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
      // (Sounds excluded from analysis, and since S3.3 unplaced ones, which the
      // analysis never scores) get "unassigned" pills so they remain visible.
      // Their index is negative: they are no note of the plan. A click still
      // selects the whole event they belong to (S4.1).
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

  // ─── The selected event (S4.1) ─────────────────────────────────────────
  // Its notes light up by eventKey; an excluded Sound's notes, which belong to
  // no event, light up with the event struck at their time.
  const timeline = getEventTimeline(state);
  const selectedEvent = resolveEventKey(timeline, state.selectedMomentKey);
  const excludedNotesAtSelection = useMemo(() => {
    const keys = new Set<string>();
    if (!selectedEvent) return keys;
    for (const list of streamAssignments.values()) {
      for (const a of list) {
        if (a.eventKey === undefined || timeline.byNoteKey.has(a.eventKey)) continue;
        if (eventAtTime(timeline, a.startTime) === selectedEvent) keys.add(a.eventKey);
      }
    }
    return keys;
  }, [timeline, selectedEvent, streamAssignments]);
  const inSelectedEvent = (a: FingerAssignment) => !!selectedEvent && (a.eventKey !== undefined
    ? selectedEvent.noteKeys.has(a.eventKey) || excludedNotesAtSelection.has(a.eventKey)
    : eventAtTime(timeline, a.startTime) === selectedEvent);

  // ─── Auto-scroll to selected event ────────────────────────────────────
  const selectedStart = selectedEvent?.startTime ?? null;
  const prevSelectedRef = useRef(state.selectedMomentKey);
  useEffect(() => {
    if (
      selectedStart === null ||
      state.selectedMomentKey === prevSelectedRef.current ||
      !scrollContainerRef.current
    ) {
      prevSelectedRef.current = state.selectedMomentKey;
      return;
    }
    prevSelectedRef.current = state.selectedMomentKey;

    const x = (selectedStart - minTime) * zoom;
    const container = scrollContainerRef.current;
    const viewWidth = container.clientWidth;

    // Only scroll if the event is outside the visible area
    const scrollLeft = container.scrollLeft;
    if (x < scrollLeft || x > scrollLeft + viewWidth - 40) {
      container.scrollTo({ left: Math.max(0, x - viewWidth / 3), behavior: 'smooth' });
    }
  }, [state.selectedMomentKey, selectedStart, minTime, zoom]);

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

  // A click on any note selects its whole event (S4.1): by the note's eventKey,
  // whether or not the plan covers it (an unplaced Sound's note); an excluded
  // Sound's note, which belongs to no event, selects the event at its time.
  // With no event there, there is nothing to select.
  const handleNoteClick = useCallback((note: FingerAssignment) => {
    const event = eventOfNote(timeline, note);
    if (!event) return;
    dispatch({
      type: 'SELECT_EVENT',
      payload: { key: event.key, startTime: event.startTime, ...(note.eventKey !== undefined ? { noteKey: note.eventKey } : {}) },
    });
  }, [dispatch, timeline]);

  // ─── Render ──────────────────────────────────────────────────────────────

  // One staged empty state, at the grid (T44): the timeline only says what it will show.
  if (state.soundStreams.length === 0) {
    return (
      <div data-testid="timeline-empty" className="px-6 py-10 text-center text-[var(--text-tertiary)] text-pf-sm">
        Your Sounds' notes appear here once you import MIDI or build a pattern in the Composer.
      </div>
    );
  }

  // Its controls go in the drawer's tab row while it is shown (S4.3a), or
  // above it where there is no drawer (a component on its own).
  const toolbar = (
    <TimelineToolbar
      soundCount={visibleStreams.length}
      onImportClick={handleImportClick}
      zoom={zoom}
      minZoom={effectiveMinZoom}
      maxZoom={MAX_ZOOM}
      isAutoFit={zoomOverride === null}
      onZoom={z => setZoomOverride(z)}
      onFit={() => setZoomOverride(null)}
    />
  );
  // The lanes' loop shading: a loop being dragged, else the loop that plays.
  const shading = loopPreview ?? (state.loopEnabled ? loopRegionOf({ start: state.loopStart, end: state.loopEnd }) : null);

  return (
    <div className="flex flex-col h-full">
      {toolbarSlot ? (isVisible ? createPortal(toolbar, toolbarSlot) : null) : toolbar}
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
              silent={silentReason(stream.id, audition, soundIds)}
              isInstanceHighlighted={highlightedStreamIds?.has(stream.id) ?? false}
              onSelect={() => dispatch({ type: 'SELECT_STREAM', payload: stream.id })}
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
            {/* Row 1: the loop strip, the bar numbers and the playhead's handle (S4.3a) */}
            <TimelineRuler
              minTime={minTime}
              maxTime={maxTime}
              zoom={zoom}
              width={timelineWidth}
              bars={headerBars}
              barWidth={barWidth}
              onPreview={setLoopPreview}
            />
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

            {/* Loop shading — the passage being rehearsed, or being dragged out */}
            {shading && (
              <div
                data-testid="timeline-loop-shading"
                className="absolute pointer-events-none"
                style={{
                  left: (shading.start - minTime) * zoom,
                  width: (shading.end - shading.start) * zoom,
                  top: TOTAL_HEADER_HEIGHT,
                  height: totalHeight,
                  backgroundColor: 'rgba(59, 130, 246, 0.10)',
                  borderLeft: '1px solid rgba(59, 130, 246, 0.55)',
                  borderRight: '1px solid rgba(59, 130, 246, 0.55)',
                }}
              />
            )}

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
              // The selected Sound's lane: a neutral tint, like its notes' outline (T28).
              const isSoundSelected = state.selectedStreamId === stream.id;
              return (
                <div key={`track-bg-${i}`}>
                  {isSoundSelected ? (
                    <div
                      data-testid="timeline-lane-selected"
                      className="absolute w-full bg-white/[0.05] border-l-2 border-l-slate-200/70"
                      style={{ top: TOTAL_HEADER_HEIGHT + i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
                    />
                  ) : isHighlighted ? (
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
            <PlayheadLine
              minTime={minTime}
              totalDuration={totalDuration}
              zoom={zoom}
              height={totalHeight}
              scrollRef={scrollContainerRef}
            />

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
              // The selected Sound (a pad click, or its row in the Sounds panel):
              // all its notes are outlined, so its hits can be found (T28).
              const soundSelected = state.selectedStreamId === stream.id;

              return (
                <div key={stream.id}>
                  {trackAssignments.map((a, ai) => {
                    const x = (a.startTime - minTime) * zoom;
                    const eventDuration = durationByTime.get(a.startTime) ?? 0.1;
                    const w = Math.max(eventDuration * zoom, 6);

                    const hand = a.assignedHand as string;
                    const finger = a.finger as string | null;
                    const isRaw = hand === 'raw' || finger === 'unassigned';
                    // "L2" (the one notation, S4.2); '' for a note no finger plays yet.
                    const fingerLabel = fingerLabelOf(a.assignedHand, a.finger);
                    const isSelected = inSelectedEvent(a);
                    // The hand's colour as the pill's left edge (T42); the letter is the second cue.
                    const handEdge = unplaced || isRaw ? null : handColor(a.assignedHand);

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
                      ? '2px solid var(--difficulty-unplayable)'
                      : isRaw || unplaced
                        ? undefined
                        : difficulty === 'Hard'
                          ? '2px solid var(--difficulty-hard)'
                          : difficulty === 'Medium'
                            ? '2px solid var(--difficulty-medium)'
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
                        data-finger={fingerLabel}
                        data-placement={unplaced ? 'unplaced' : undefined}
                        data-excluded={stream.excluded ? 'true' : undefined}
                        data-selected={isSelected ? 'true' : undefined}
                        data-sound-selected={soundSelected ? 'true' : undefined}
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
                          borderLeft: unplaced ? unplacedBorder : isRaw ? '1px dashed rgba(255,255,255,0.2)' : handEdge ? `3px solid ${handEdge}` : undefined,
                          borderRight: unplaced ? unplacedBorder : isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined,
                          borderBottom: unplaced ? unplacedBorder : difficultyBorder
                            ?? (isRaw ? '1px dashed rgba(255,255,255,0.2)' : undefined),
                          outline: relaxed.length > 0 ? '1.5px dashed #c084fc' : undefined,
                          outlineOffset: relaxed.length > 0 ? 1 : undefined,
                        }}
                        onClick={() => handleNoteClick(a)}
                        title={`${formatBarBeat(a.startTime, state.tempo)} (${formatSeconds(a.startTime)})${stream.excluded ? ' · not analysed: excluded from analysis' : unplaced ? ' · not placed yet' : ''}${fingerLabel ? ` · ${fingerLabel} (${fingerName(a.assignedHand, a.finger)})` : ''}${a.cost ? ` · ${a.difficulty}` : ''}${a.constraintDiverges ? ' · differs from your finger preference' : ''}${relaxedNote.replace(' | ', ' · ')}`}
                      >
                        {/* The selected Sound's notes (S4.2, T28): a neutral outline, kept apart from the event's ring. */}
                        {soundSelected && (
                          <span aria-hidden="true" className="absolute -inset-[3px] rounded border-2 border-slate-200/80 pointer-events-none" />
                        )}
                        {a.constraintDiverges && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: '#fbbf24' }}
                          />
                        )}
                        {fingerLabel && (
                          <span className="text-[11px] font-bold leading-none" style={{ color: pillText }}>
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

/**
 * The playhead over the lanes, redrawn from the transport every frame while it
 * plays (the rest of the timeline doesn't re-render). It also keeps itself in
 * view: on a real take the cursor used to walk off the right edge after about
 * twenty seconds, and the view stayed at bar 1 for the rest of it. It scrolls
 * only when the cursor nears an edge, so the view doesn't jitter every frame.
 */
function PlayheadLine({ minTime, totalDuration, zoom, height, scrollRef }: {
  minTime: number;
  totalDuration: number;
  zoom: number;
  height: number;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { state } = useProject();
  const position = useTransportPosition();
  const x = Math.max(0, Math.min(totalDuration, position - minTime)) * zoom;

  useEffect(() => {
    if (!state.isPlaying) return;
    const el = scrollRef.current;
    if (!el || zoom <= 0) return;
    const view = el.clientWidth;
    const margin = view * 0.15;
    if (x < el.scrollLeft + margin || x > el.scrollLeft + view - margin) {
      el.scrollLeft = Math.max(0, x - view / 2);
    }
  }, [state.isPlaying, x, zoom, scrollRef]);

  return (
    <div
      data-testid="timeline-playhead"
      className="absolute z-30 pointer-events-none"
      style={{
        left: x,
        top: TOTAL_HEADER_HEIGHT,
        height,
        width: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
      }}
    />
  );
}

/**
 * A lane's header (S5.1, T45): a click selects its Sound in every panel (its
 * Sounds row, its pad, its notes); a double-click renames it. Solo and Mute
 * live in the Sounds row only, one glance away; the lane shows a speaker-off
 * glyph while its Sound is silent in rehearsal, and a slashed circle while it
 * is excluded from analysis (S4.4).
 */
function VoiceRow({
  stream,
  isEven,
  isGlobalSelected,
  silent,
  isInstanceHighlighted = false,
  onSelect,
  onRename,
}: {
  stream: SoundStream;
  isEven: boolean;
  isGlobalSelected: boolean;
  silent: SilentReason | null;
  isInstanceHighlighted?: boolean;
  onSelect: () => void;
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
        ${isGlobalSelected ? 'bg-white/[0.07] border-l-2 border-l-slate-200/70' : isInstanceHighlighted ? 'bg-violet-500/10 border-l-2 border-l-violet-400' : isEven ? '' : 'bg-white/[0.015]'}`}
      style={{ height: TRACK_HEIGHT }}
    >
      {editing ? (
        <>
          <span aria-hidden="true" className="w-2 h-2 rounded-pf-sm flex-shrink-0" style={{ backgroundColor: stream.color }} />
          <input
            ref={inputRef}
            aria-label={`Rename ${stream.name}`}
            className="flex-1 min-w-0 bg-[var(--bg-input)] border border-blue-500 rounded-pf-sm px-1 py-0 text-pf-sm text-[var(--text-primary)] outline-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
            }}
          />
        </>
      ) : (
        <button
          type="button"
          data-testid="timeline-lane-header"
          data-sound-id={stream.id}
          aria-pressed={isGlobalSelected}
          className="focus-ring flex-1 min-w-0 flex items-center gap-1.5 h-full text-left rounded-pf-sm"
          data-excluded={stream.excluded ? 'true' : undefined}
          data-silent={silent ?? undefined}
          title={`${stream.name}${stream.excluded ? ' · excluded from analysis' : ''}${silent ? ` · ${silentLabel(silent)}` : ''} · click to select it, double-click to rename`}
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); setEditing(true); } }}
        >
          <span aria-hidden="true" className="w-2 h-2 rounded-pf-sm flex-shrink-0" style={{ backgroundColor: stream.color }} />
          <span className={`flex-1 truncate text-pf-sm ${stream.excluded ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'}`}>{stream.name}</span>
          {stream.excluded && <Ban data-testid="lane-excluded" size={11} aria-hidden="true" className="flex-shrink-0 text-[var(--text-tertiary)]" />}
          {silent && <VolumeX data-testid="lane-silent" size={11} aria-hidden="true" className="flex-shrink-0 text-[var(--text-tertiary)]" />}
        </button>
      )}
    </div>
  );
}
