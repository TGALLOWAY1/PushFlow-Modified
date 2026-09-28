/**
 * The transport bar (S4.3a; T05, T58, T60 part): the workspace's one
 * transport, above the drawer's Timeline | Composer tabs. It stays in view,
 * and keeps playing, whichever tab is shown and with the drawer collapsed.
 *
 * Play/Stop, Return (to the loop start while looping a region), the playhead
 * (bar.beat.sixteenth, drawn from the transport every frame), Speed with its
 * BPM, Loop with its presets, Metronome with the count-in, and Hits. Fixed
 * widths and no breakpoints (desktop-only): a window too narrow for it
 * scrolls it.
 *
 * Loop off plays once to the end; Loop on repeats the loop region, or the
 * whole song when there is none. A region is dragged out on the timeline
 * ruler's loop strip, or set here from the playhead: "This bar" or two bars.
 *
 * The count-in (S4.3b, T59) sits in the Metronome's menu, as in a DAW: Off, 1
 * bar or 2 bars of clicks before playback starts from stopped, while the grid
 * counts 1-2-3-4. Its menu half shows the bars while it is on.
 *
 * Hits' menu (S4.4, T59) holds the practice mix: the click's and the hits'
 * levels, and "Hands: Both / L / R", which silences and dims the other hand.
 * Its half shows the hand while one is chosen. None of it is saved or ever
 * changes the analysis.
 */

import { useRef, useState } from 'react';
import { ChevronDown, Gauge, Play, Repeat, SkipBack, Square, Timer, Volume2 } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { useTransport, useTransportPosition } from '../../audio/TransportProvider';
import { COUNT_IN_CHOICES, REHEARSAL_SPEEDS, barsAt, loopRegionOf } from '../../audio/transportMath';
import { Popover } from '../shared/Overlay';
import { IconButton } from '../shared/IconButton';
import { ToggleButton } from '../shared/ToggleButton';
import { formatBarBeat, formatBarRange, formatRate, formatSeconds } from '../../../utils/musicalTime';
import { HANDS_FILTERS } from '../../audio/handsFilter';
import {
  HITS_MENU_WIDTH,
  LOOP_MENU_WIDTH,
  METRONOME_MENU_WIDTH,
  TRANSPORT_BAR_HEIGHT,
  TRANSPORT_GAP,
  TRANSPORT_PADDING,
  TRANSPORT_WIDTHS,
} from './transportLayout';

/** "a 1-bar count-in", for titles; null when it is off. */
export function countInPhrase(bars: number): string | null {
  return bars > 0 ? `a ${bars}-bar count-in` : null;
}

const MENU_BUTTON = 'focus-ring h-7 flex items-center justify-center rounded-r-pf-sm border border-l-0 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors';

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

  // The Metronome's menu: the count-in.
  const clickMenuButton = useRef<HTMLButtonElement>(null);
  const [clickMenuAt, setClickMenuAt] = useState<{ x: number; y: number } | null>(null);
  const countIn = COUNT_IN_CHOICES.find(c => c.bars === state.countInBars) ?? COUNT_IN_CHOICES[0]!;
  const countInWords = countInPhrase(state.countInBars);

  // Hits' menu: the levels and the Hands filter (S4.4).
  const mixMenuButton = useRef<HTMLButtonElement>(null);
  const [mixMenuAt, setMixMenuAt] = useState<{ x: number; y: number } | null>(null);
  const hands = HANDS_FILTERS.find(f => f.id === state.handsFilter) ?? HANDS_FILTERS[0]!;
  const handsOn = state.handsFilter !== 'both';

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
          title={state.isPlaying ? 'Stop playback' : `Play from the playhead${countInWords ? ` after ${countInWords}` : ''}`}
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
          <Gauge size={12} aria-hidden="true" className="flex-shrink-0" />
          <select
            data-testid="transport-speed"
            aria-label="Speed"
            className="min-w-0 flex-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-pf-sm px-1 py-0.5 text-pf-xs text-[var(--text-primary)]"
            value={state.playbackRate}
            onChange={(e) => dispatch({ type: 'SET_PLAYBACK_RATE', payload: Number(e.target.value) })}
            title="Rehearsal speed — the layout and analysis are unchanged"
          >
            {REHEARSAL_SPEEDS.map(rate => (
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
            className={MENU_BUTTON}
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
        {/* Metronome: the toggle and, joined to it, the count-in. */}
        <div className="flex items-center flex-shrink-0" style={{ width: TRANSPORT_WIDTHS.metronome }}>
          <ToggleButton
            testId="transport-metronome"
            pressed={state.rehearsalAudio.metronome}
            onPressedChange={pressed => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { metronome: pressed } })}
            icon={<Timer size={12} />}
            label="Metronome"
            title="Click track at the project tempo"
            className="h-7 rounded-r-none"
            style={{ width: TRANSPORT_WIDTHS.metronome - METRONOME_MENU_WIDTH }}
          />
          <button
            ref={clickMenuButton}
            type="button"
            data-testid="transport-count-in"
            data-bars={state.countInBars}
            aria-label={`Count-in: ${countIn.label}`}
            aria-haspopup="dialog"
            aria-expanded={clickMenuAt !== null}
            title={`Count-in: ${countIn.label} · clicks before playback starts`}
            className={`${MENU_BUTTON} gap-px ${state.countInBars > 0 ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]' : ''}`}
            style={{ width: METRONOME_MENU_WIDTH }}
            onClick={() => {
              if (clickMenuAt) { setClickMenuAt(null); return; }
              const r = clickMenuButton.current?.getBoundingClientRect();
              if (r) setClickMenuAt({ x: r.left, y: r.bottom + 4 });
            }}
          >
            {state.countInBars > 0 && (
              <span aria-hidden="true" className="text-pf-xs font-semibold tabular-nums leading-none">{state.countInBars}</span>
            )}
            <ChevronDown size={state.countInBars > 0 ? 10 : 12} aria-hidden="true" />
          </button>
        </div>
        {/* Hits: the toggle and, joined to it, the levels and the Hands filter (S4.4). */}
        <div className="flex items-center flex-shrink-0" style={{ width: TRANSPORT_WIDTHS.hits }}>
          <ToggleButton
            testId="transport-hits"
            pressed={state.rehearsalAudio.hits}
            onPressedChange={pressed => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { hits: pressed } })}
            icon={<Volume2 size={12} />}
            label="Hits"
            title="Hear each Sound as the playhead reaches it"
            className="h-7 rounded-r-none"
            style={{ width: TRANSPORT_WIDTHS.hits - HITS_MENU_WIDTH }}
          />
          <button
            ref={mixMenuButton}
            type="button"
            data-testid="transport-mix"
            data-hands={state.handsFilter}
            aria-label={`Levels and hands: ${hands.label}`}
            aria-haspopup="dialog"
            aria-expanded={mixMenuAt !== null}
            title={`Click and hits levels, and which hand you hear: ${hands.label}`}
            className={`${MENU_BUTTON} gap-px ${handsOn ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]' : ''}`}
            style={{ width: HITS_MENU_WIDTH }}
            onClick={() => {
              if (mixMenuAt) { setMixMenuAt(null); return; }
              const r = mixMenuButton.current?.getBoundingClientRect();
              if (r) setMixMenuAt({ x: r.left, y: r.bottom + 4 });
            }}
          >
            {handsOn && (
              <span aria-hidden="true" className="text-pf-xs font-semibold leading-none">{hands.short}</span>
            )}
            <ChevronDown size={handsOn ? 10 : 12} aria-hidden="true" />
          </button>
        </div>
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

      {mixMenuAt && (
        <Popover
          x={mixMenuAt.x}
          y={mixMenuAt.y}
          role="dialog"
          ariaLabel="Levels and hands"
          onClose={() => setMixMenuAt(null)}
          returnFocusTo={mixMenuButton.current}
          testId="transport-mix-menu"
          className="w-[264px] py-2 px-3 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] flex flex-col gap-2.5"
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-pf-sm font-semibold text-[var(--text-primary)] mb-1">Levels</legend>
            {([
              ['clickLevel', 'Click', 'The metronome and the count-in'],
              ['hitsLevel', 'Hits', 'The Sounds, and pads you play to hear them'],
            ] as const).map(([key, label, hint]) => {
              const percent = Math.round(state.rehearsalAudio[key] * 100);
              return (
                <label key={key} className="flex items-center gap-2 text-pf-xs text-[var(--text-secondary)]" title={hint}>
                  <span className="w-9 flex-shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={percent}
                    data-testid={`level-${key === 'clickLevel' ? 'click' : 'hits'}`}
                    aria-label={`${label} level`}
                    aria-valuetext={`${percent}%`}
                    className="flex-1 min-w-0 accent-[var(--accent-primary)]"
                    onChange={e => dispatch({ type: 'SET_REHEARSAL_AUDIO', payload: { [key]: Number(e.target.value) / 100 } })}
                  />
                  <span className="w-9 flex-shrink-0 text-right tabular-nums">{percent}%</span>
                </label>
              );
            })}
          </fieldset>
          <fieldset>
            <legend className="text-pf-sm font-semibold text-[var(--text-primary)]">Hands</legend>
            <div className="mt-1.5 flex gap-1.5">
              {HANDS_FILTERS.map(choice => (
                <label
                  key={choice.id}
                  title={choice.label}
                  className={`flex-1 flex items-center justify-center h-7 rounded-pf-sm border text-pf-xs cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-[var(--border-focus)] ${
                    choice.id === state.handsFilter
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)] text-[var(--text-primary)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="hands-filter"
                    className="sr-only"
                    data-testid={`hands-${choice.id}`}
                    aria-label={choice.label}
                    checked={choice.id === state.handsFilter}
                    onChange={() => dispatch({ type: 'SET_HANDS_FILTER', payload: choice.id })}
                  />
                  {choice.id === 'both' ? 'Both' : choice.id === 'left' ? 'Left' : 'Right'}
                </label>
              ))}
            </div>
            <p className="mt-2 text-pf-micro leading-snug text-[var(--text-tertiary)]">
              Practise one hand: the other hand&rsquo;s strikes are silent and its pads dimmed. Which hand plays each note is the plan&rsquo;s. The analysis doesn&rsquo;t change.
            </p>
          </fieldset>
        </Popover>
      )}

      {clickMenuAt && (
        <Popover
          x={clickMenuAt.x}
          y={clickMenuAt.y}
          role="dialog"
          ariaLabel="Count-in"
          onClose={() => setClickMenuAt(null)}
          returnFocusTo={clickMenuButton.current}
          testId="transport-count-in-menu"
          className="w-[252px] py-2 px-3 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        >
          <fieldset>
            <legend className="text-pf-sm font-semibold text-[var(--text-primary)]">Count-in</legend>
            <div className="mt-1.5 flex gap-1.5">
              {COUNT_IN_CHOICES.map(choice => (
                <label
                  key={choice.bars}
                  className={`flex-1 flex items-center justify-center gap-1 h-7 rounded-pf-sm border text-pf-xs cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-[var(--border-focus)] ${
                    choice.bars === state.countInBars
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)] text-[var(--text-primary)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="count-in"
                    className="sr-only"
                    data-testid={`count-in-${choice.bars}`}
                    checked={choice.bars === state.countInBars}
                    onChange={() => dispatch({ type: 'SET_COUNT_IN_BARS', payload: choice.bars })}
                  />
                  {choice.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-pf-micro leading-snug text-[var(--text-tertiary)]">
            Clicks before playback starts, counted 1‑2‑3‑4 over the grid, so your hands are on the pads when the music comes in. Rehearse always counts in at least a bar.
          </p>
        </Popover>
      )}
    </div>
  );
}
