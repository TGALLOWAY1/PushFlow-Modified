/**
 * The timeline's toolbar (T05, T56).
 *
 * A fixed-width transport cluster that is always visible: Play/Stop, Return,
 * position, Speed, Loop, Metronome and Hits. The secondary controls (+ MIDI,
 * the Sound count, zoom and clearing the loop region) follow while they fit
 * the measured width and move into a "⋯" menu when they don't. Desktop-only:
 * the toolbar measures itself; there are no breakpoints.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Play, Repeat, SkipBack, Square, Timer, Volume2 } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { Popover } from './shared/Overlay';
import { formatBarBeat, formatBarRange, formatRate, formatSeconds } from '../../utils/musicalTime';
import {
  TIMELINE_TOOLBAR_HEIGHT,
  TOOLBAR_GAP,
  TOOLBAR_MORE_WIDTH,
  TOOLBAR_PADDING,
  TRANSPORT_CLUSTER_WIDTH,
  TRANSPORT_WIDTHS,
  fitSecondaryControls,
  type SecondaryControl,
} from './timelineLayout';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

export interface TimelineToolbarProps {
  soundCount: number;
  onImportClick: () => void;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  isAutoFit: boolean;
  onZoom: (zoom: number) => void;
  onFit: () => void;
  /** Go to the start, or to the loop start while looping a region; playback keeps its state. */
  onReturn: () => void;
  /** Where the timeline starts (its first bar line): the position never reads earlier. */
  regionStart: number;
}

/** An on/off transport toggle: aria-pressed, and filled vs outlined as well as colour. */
function ToggleButton({ pressed, onClick, width, icon, label, title, testId }: {
  pressed: boolean;
  onClick: () => void;
  width: number;
  icon: ReactNode;
  label: string;
  title: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={`flex-shrink-0 h-7 flex items-center justify-center gap-1 rounded-pf-sm text-pf-xs font-semibold whitespace-nowrap transition-colors ${
        pressed
          ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60'
          : 'bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
      }`}
      style={{ width }}
    >
      {icon}
      {label}
    </button>
  );
}

export function TimelineToolbar({
  soundCount, onImportClick, zoom, minZoom, maxZoom, isAutoFit, onZoom, onFit, onReturn, regionStart,
}: TimelineToolbarProps) {
  const { state, dispatch } = useProject();

  // Measure the toolbar to decide which secondary controls fit.
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  useEffect(() => {
    if (!toolbarEl) return;
    const measure = () => {
      const w = toolbarEl.clientWidth;
      if (w > 0) setToolbarWidth(prev => (prev === w ? prev : w));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbarEl);
    return () => observer.disconnect();
  }, [toolbarEl]);

  const hasRegion = state.loopStart !== null && state.loopEnd !== null;
  const { inline, overflow } = useMemo(() => {
    const present = new Set<SecondaryControl>(['import', 'count', 'zoom']);
    if (hasRegion) present.add('clearLoop');
    // Before the first measurement, show everything in the menu rather than overflow the row.
    return toolbarWidth > 0
      ? fitSecondaryControls(toolbarWidth, present)
      : { inline: [] as SecondaryControl[], overflow: [...present] };
  }, [toolbarWidth, hasRegion]);

  const moreRef = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenuAt(null), []);
  const openMenu = () => {
    const r = moreRef.current?.getBoundingClientRect();
    if (r) setMenuAt({ x: r.right - 220, y: r.bottom + 4 });
  };
  // Nothing left to show in the menu (a region was cleared from it): close it.
  useEffect(() => {
    if (menuAt && overflow.length === 0) setMenuAt(null);
  }, [menuAt, overflow.length]);

  const secondary = (id: SecondaryControl, inMenu: boolean): ReactNode => {
    switch (id) {
      case 'import':
        return (
          <button
            key={id}
            type="button"
            data-testid="timeline-import"
            className={`pf-btn pf-btn-subtle text-pf-xs h-7 ${inMenu ? 'w-full justify-start' : 'flex-shrink-0'}`}
            style={inMenu ? undefined : { width: 72 }}
            onClick={() => { closeMenu(); onImportClick(); }}
            title="Import more MIDI files into this project"
          >
            + MIDI
          </button>
        );
      case 'count':
        return (
          <span
            key={id}
            data-testid="timeline-sound-count"
            className={`text-pf-sm text-[var(--text-tertiary)] whitespace-nowrap ${inMenu ? 'px-1' : 'flex-shrink-0 text-center'}`}
            style={inMenu ? undefined : { width: 72 }}
          >
            {soundCount} {soundCount === 1 ? 'Sound' : 'Sounds'}
          </span>
        );
      case 'zoom':
        return (
          <div key={id} className="flex items-center gap-1.5 flex-shrink-0" style={inMenu ? undefined : { width: 164 }}>
            <label className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)]">
              Zoom
              <input
                type="range"
                aria-label="Timeline zoom"
                min={minZoom}
                max={maxZoom}
                value={Math.max(minZoom, Math.min(maxZoom, zoom))}
                onChange={e => onZoom(Math.max(minZoom, Number(e.target.value)))}
                className="w-20 h-1 accent-blue-500"
              />
            </label>
            <button
              type="button"
              aria-pressed={isAutoFit}
              className={`px-1.5 py-0.5 text-pf-xs rounded-pf-sm transition-colors ${
                isAutoFit
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                  : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
              }`}
              onClick={onFit}
              title="Fit: the whole performance fills the timeline's width"
            >
              Fit
            </button>
          </div>
        );
      case 'clearLoop':
        return (
          <button
            key={id}
            type="button"
            data-testid="timeline-clear-loop"
            className={`pf-btn pf-btn-ghost text-pf-xs h-7 ${inMenu ? 'w-full justify-start' : 'flex-shrink-0'}`}
            style={inMenu ? undefined : { width: 88 }}
            onClick={() => dispatch({ type: 'SET_LOOP_REGION', payload: { start: null, end: null } })}
            title={hasRegion ? `Clear the loop region (${formatBarRange(state.loopStart!, state.loopEnd!, state.tempo)})` : 'Clear the loop region'}
          >
            ✕ Clear loop
          </button>
        );
    }
  };

  return (
    <div
      ref={setToolbarEl}
      data-testid="timeline-toolbar"
      className="flex items-center flex-nowrap overflow-hidden border-b border-[var(--border-subtle)] bg-bg-panel/40 flex-shrink-0"
      style={{ height: TIMELINE_TOOLBAR_HEIGHT, gap: TOOLBAR_GAP, paddingLeft: TOOLBAR_PADDING / 2, paddingRight: TOOLBAR_PADDING / 2 }}
    >
      {/* Transport cluster: always visible, fixed widths. */}
      <div data-testid="transport" className="flex items-center flex-shrink-0" style={{ gap: TOOLBAR_GAP, width: TRANSPORT_CLUSTER_WIDTH }}>
        <button
          type="button"
          data-testid="transport-play"
          className={`flex-shrink-0 h-7 flex items-center justify-center gap-1 rounded-pf-sm text-pf-xs font-bold transition-colors ${
            state.isPlaying
              ? 'bg-amber-500 text-amber-950 border border-amber-400'
              : 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500'
          }`}
          style={{ width: TRANSPORT_WIDTHS.play }}
          onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          title={state.isPlaying ? 'Stop playback' : 'Play from the playhead'}
        >
          {state.isPlaying
            ? <Square size={11} fill="currentColor" aria-hidden="true" />
            : <Play size={11} fill="currentColor" aria-hidden="true" />}
          {state.isPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          type="button"
          data-testid="transport-return"
          aria-label="Return to start"
          className="flex-shrink-0 h-7 flex items-center justify-center rounded-pf-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          style={{ width: TRANSPORT_WIDTHS.return }}
          onClick={onReturn}
          title="Return to the start (the loop start while looping a region)"
        >
          <SkipBack size={13} aria-hidden="true" />
        </button>
        <span
          data-testid="transport-position"
          className="flex-shrink-0 text-[var(--text-secondary)] font-mono text-pf-sm text-right tabular-nums whitespace-nowrap"
          style={{ width: TRANSPORT_WIDTHS.position }}
          title={`Playhead: bar.beat.sixteenth · ${formatSeconds(Math.max(regionStart, state.currentTime))}`}
        >
          {formatBarBeat(Math.max(regionStart, state.currentTime), state.tempo)}
        </span>
        <label
          className="flex-shrink-0 flex items-center gap-1 text-pf-xs text-[var(--text-tertiary)] whitespace-nowrap"
          style={{ width: TRANSPORT_WIDTHS.speed }}
        >
          Speed
          <select
            data-testid="transport-speed"
            className="min-w-0 flex-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-pf-sm px-1 py-0.5 text-pf-xs text-[var(--text-primary)]"
            value={state.playbackRate}
            onChange={(e) => dispatch({ type: 'SET_PLAYBACK_RATE', payload: Number(e.target.value) })}
            title="Rehearsal speed — the layout and analysis are unchanged"
          >
            {SPEEDS.map(rate => (
              <option key={rate} value={rate}>{formatRate(rate, state.tempo)}</option>
            ))}
          </select>
        </label>
        <ToggleButton
          testId="transport-loop"
          pressed={state.loopEnabled}
          onClick={() => dispatch({ type: 'SET_LOOP_ENABLED', payload: !state.loopEnabled })}
          width={TRANSPORT_WIDTHS.loop}
          icon={<Repeat size={12} aria-hidden="true" />}
          label="Loop"
          title={hasRegion
            ? `Loop ${formatBarRange(state.loopStart!, state.loopEnd!, state.tempo)}`
            : 'Loop the whole performance (drag across the bar ruler to set a region)'}
        />
        <ToggleButton
          testId="transport-metronome"
          pressed={state.rehearsalAudio.metronome}
          onClick={() => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { metronome: !state.rehearsalAudio.metronome } })}
          width={TRANSPORT_WIDTHS.metronome}
          icon={<Timer size={12} aria-hidden="true" />}
          label="Metronome"
          title="Click track at the project tempo"
        />
        <ToggleButton
          testId="transport-hits"
          pressed={state.rehearsalAudio.hits}
          onClick={() => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { hits: !state.rehearsalAudio.hits } })}
          width={TRANSPORT_WIDTHS.hits}
          icon={<Volume2 size={12} aria-hidden="true" />}
          label="Hits"
          title="Hear each Sound as the playhead reaches it"
        />
      </div>

      <span className="flex-1 min-w-0" />

      {/* Secondary controls that fit, then the menu for the rest. */}
      {inline.map(id => secondary(id, false))}
      {overflow.length > 0 && (
        <button
          ref={moreRef}
          type="button"
          data-testid="timeline-more"
          aria-label="More timeline controls"
          aria-haspopup="dialog"
          aria-expanded={menuAt !== null}
          className="flex-shrink-0 h-7 flex items-center justify-center rounded-pf-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          style={{ width: TOOLBAR_MORE_WIDTH }}
          onClick={() => (menuAt ? closeMenu() : openMenu())}
          title="More timeline controls"
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      )}
      {menuAt && (
        <Popover
          x={menuAt.x}
          y={menuAt.y}
          role="dialog"
          ariaLabel="More timeline controls"
          onClose={closeMenu}
          returnFocusTo={moreRef.current}
          testId="timeline-more-menu"
          className="w-[220px] flex flex-col gap-2 p-2 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        >
          {overflow.map(id => secondary(id, true))}
        </Popover>
      )}
    </div>
  );
}
