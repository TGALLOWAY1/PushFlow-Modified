/**
 * The transport bar (S4.3a; T05, T58, T60 part): the workspace's one
 * transport, above the drawer's Timeline | Composer tabs. It stays in view,
 * and keeps playing, whichever tab is shown and with the drawer collapsed.
 *
 * Play/Stop, Return (to the loop start while looping a region), the playhead
 * (bar.beat.sixteenth, drawn from the transport every frame), Speed with its
 * BPM, Loop with its presets, Metronome and Hits. Fixed widths and no
 * breakpoints (desktop-only): a window too narrow for it scrolls it.
 *
 * Loop off plays once to the end; Loop on repeats the loop region, or the
 * whole song when there is none. A region is dragged out on the timeline
 * ruler's loop strip, or set here from the playhead: "This bar" or two bars.
 */

import { useRef, useState } from 'react';
import { ChevronDown, Play, Repeat, SkipBack, Square, Timer, Volume2 } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { useTransport, useTransportPosition } from '../../audio/TransportProvider';
import { barsAt, loopRegionOf } from '../../audio/transportMath';
import { Popover } from '../shared/Overlay';
import { IconButton } from '../shared/IconButton';
import { ToggleButton } from '../shared/ToggleButton';
import { formatBarBeat, formatBarRange, formatRate, formatSeconds } from '../../../utils/musicalTime';
import {
  LOOP_MENU_WIDTH,
  TRANSPORT_BAR_HEIGHT,
  TRANSPORT_GAP,
  TRANSPORT_PADDING,
  TRANSPORT_WIDTHS,
} from './transportLayout';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

/** The playhead, redrawn from the transport every frame while it plays; nothing else in the bar re-renders. */
function PositionReadout({ songStart, tempo }: { songStart: number; tempo: number }) {
  const position = Math.max(songStart, useTransportPosition());
  return (
    <span
      data-testid="transport-position"
      className="flex-shrink-0 text-[var(--text-secondary)] font-mono text-pf-sm text-right tabular-nums whitespace-nowrap"
      style={{ width: TRANSPORT_WIDTHS.position }}
      title={`Playhead: bar.beat.sixteenth · ${formatSeconds(position)}`}
    >
      {formatBarBeat(position, tempo)}
    </span>
  );
}

/** A loop region as its bars and its bar.beat bounds: "Bars 3–4 (3.1.1–5.1.1)". */
export function describeLoop(start: number, end: number, tempo: number): string {
  return `${formatBarRange(start, end, tempo)} (${formatBarBeat(start, tempo)}–${formatBarBeat(end, tempo)})`;
}

export function TransportBar() {
  const { state, dispatch } = useProject();
  const transport = useTransport();
  const region = loopRegionOf({ start: state.loopStart, end: state.loopEnd });

  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const openMenu = () => {
    const r = menuButton.current?.getBoundingClientRect();
    if (r) setMenuAt({ x: r.left, y: r.bottom + 4 });
  };

  // Presets take the bar the playhead is in. The engine is read here, when
  // the menu opens, rather than subscribed to: the bar doesn't redraw per frame.
  const [presetBase, setPresetBase] = useState(0);
  const loopPreset = (bars: 1 | 2 | 'song') => {
    setMenuAt(null);
    if (bars === 'song') {
      dispatch({ type: 'SET_LOOP_REGION', payload: { start: null, end: null } });
    } else {
      const next = barsAt(presetBase, state.tempo, bars);
      dispatch({ type: 'SET_LOOP_REGION', payload: next });
      // Stopped, Play starts at the loop; playing, the loop takes over from where it is.
      if (!state.isPlaying) transport.seek(next.start);
    }
    dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
  };
  const thisBar = barsAt(presetBase, state.tempo, 1);
  const twoBars = barsAt(presetBase, state.tempo, 2);

  const loopTitle = region
    ? `Loop ${describeLoop(region.start, region.end, state.tempo)}`
    : 'Loop the whole song · or drag on the ruler’s loop strip to loop a passage';

  return (
    <div
      data-testid="transport-bar"
      role="group"
      aria-label="Transport"
      className="flex items-center flex-nowrap overflow-x-auto overflow-y-hidden border-b border-[var(--border-subtle)] bg-bg-panel/40 flex-shrink-0"
      style={{ height: TRANSPORT_BAR_HEIGHT, gap: TRANSPORT_GAP, paddingLeft: TRANSPORT_PADDING / 2, paddingRight: TRANSPORT_PADDING / 2 }}
    >
      <div data-testid="transport" className="flex items-center flex-shrink-0" style={{ gap: TRANSPORT_GAP }}>
        <button
          type="button"
          data-testid="transport-play"
          className={`focus-ring flex-shrink-0 h-7 flex items-center justify-center gap-1 rounded-pf-sm text-pf-xs font-bold transition-colors ${
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
        <IconButton
          label="Return to start"
          title="Return to the start (the loop start while looping a region)"
          testId="transport-return"
          size={28}
          className="border border-[var(--border-default)] text-[var(--text-secondary)]"
          style={{ width: TRANSPORT_WIDTHS.return }}
          onClick={transport.returnToStart}
        >
          <SkipBack size={13} />
        </IconButton>
        <PositionReadout songStart={transport.song.start} tempo={state.tempo} />
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
        {/* Loop: the toggle and, joined to it, its presets. */}
        <div className="flex items-center flex-shrink-0" style={{ width: TRANSPORT_WIDTHS.loop }}>
          <ToggleButton
            testId="transport-loop"
            pressed={state.loopEnabled}
            onPressedChange={pressed => dispatch({ type: 'SET_LOOP_ENABLED', payload: pressed })}
            icon={<Repeat size={12} />}
            label="Loop"
            title={loopTitle}
            className="h-7 rounded-r-none"
            style={{ width: TRANSPORT_WIDTHS.loop - LOOP_MENU_WIDTH }}
          />
          <button
            ref={menuButton}
            type="button"
            data-testid="transport-loop-menu"
            aria-label="Loop presets"
            aria-haspopup="dialog"
            aria-expanded={menuAt !== null}
            title="Loop presets: this bar, two bars, the whole song"
            className="focus-ring h-7 flex items-center justify-center rounded-r-pf-sm border border-l-0 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            style={{ width: LOOP_MENU_WIDTH }}
            onClick={() => {
              if (menuAt) { setMenuAt(null); return; }
              setPresetBase(transport.engine ? transport.engine.position() : state.currentTime);
              openMenu();
            }}
          >
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </div>
        <ToggleButton
          testId="transport-metronome"
          pressed={state.rehearsalAudio.metronome}
          onPressedChange={pressed => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { metronome: pressed } })}
          icon={<Timer size={12} />}
          label="Metronome"
          title="Click track at the project tempo"
          className="h-7 flex-shrink-0"
          style={{ width: TRANSPORT_WIDTHS.metronome }}
        />
        <ToggleButton
          testId="transport-hits"
          pressed={state.rehearsalAudio.hits}
          onPressedChange={pressed => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { hits: pressed } })}
          icon={<Volume2 size={12} />}
          label="Hits"
          title="Hear each Sound as the playhead reaches it"
          className="h-7 flex-shrink-0"
          style={{ width: TRANSPORT_WIDTHS.hits }}
        />
      </div>

      {menuAt && (
        <Popover
          x={menuAt.x}
          y={menuAt.y}
          role="dialog"
          ariaLabel="Loop presets"
          onClose={() => setMenuAt(null)}
          returnFocusTo={menuButton.current}
          testId="transport-loop-presets"
          className="w-[240px] py-1 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        >
          <button
            type="button"
            data-testid="loop-preset-bar"
            className="w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => loopPreset(1)}
          >
            This bar · {formatBarRange(thisBar.start, thisBar.end, state.tempo)}
          </button>
          <button
            type="button"
            data-testid="loop-preset-two-bars"
            className="w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => loopPreset(2)}
          >
            Two bars · {formatBarRange(twoBars.start, twoBars.end, state.tempo)}
          </button>
          <button
            type="button"
            data-testid="loop-preset-song"
            className="w-full px-3 py-1.5 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => loopPreset('song')}
          >
            The whole song
          </button>
          <p className="px-3 pt-1.5 pb-1 mt-1 border-t border-[var(--border-subtle)] text-pf-micro text-[var(--text-tertiary)]">
            Or drag on the ruler&rsquo;s loop strip: it snaps to bars; hold Shift for beats, Alt for no snapping.
          </p>
        </Popover>
      )}
    </div>
  );
}
