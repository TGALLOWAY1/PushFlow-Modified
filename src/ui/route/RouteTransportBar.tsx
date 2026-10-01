/**
 * The Route's transport bar (S9.2): a slim set of the editor's transport
 * controls, dispatching the same actions, so there is still one transport
 * (T60). Up (Esc, until zoom ships), Play/Stop with the state it is in, LOOP
 * for the item on screen (the whole song at this level), and PRACTICE TEMPO
 * as BPM and percent of the project's tempo (invariant 8: a playback rate,
 * never a second tempo).
 */

import { ArrowUp, Play, Repeat, Square } from 'lucide-react';
import { useProject } from '../state/ProjectContext';
import { useTransport } from '../audio/TransportProvider';
import { loopRegionOf, stepSpeed } from '../audio/transportMath';
import { formatBarRange } from '../../utils/musicalTime';
import { ROUTE_TRANSPORT_HEIGHT } from './routeLayout';
import { ZOOM_REASON } from './RouteRail';

/** What the transport is doing, in the bar's words. */
export type TransportStateWord = 'PLAYING' | 'STOPPED' | 'END OF SONG';

export function transportStateWord(isPlaying: boolean, currentTime: number, songEnd: number): TransportStateWord {
  if (isPlaying) return 'PLAYING';
  return currentTime >= songEnd - 1e-6 ? 'END OF SONG' : 'STOPPED';
}

/**
 * LOOP at the Song level: loops the whole song (no region), or turns Loop off
 * when it already does. A passage looped in the editor shows as such, and
 * LOOP replaces it with the song.
 */
export function useLoopSong(): { looping: boolean; label: string; toggle: () => void } {
  const { state, dispatch } = useProject();
  const region = loopRegionOf({ start: state.loopStart, end: state.loopEnd });
  const loopsSong = state.loopEnabled && region === null;
  const label = state.loopEnabled && region
    ? formatBarRange(region.start, region.end, state.tempo)
    : 'Song';
  const toggle = () => {
    if (loopsSong) {
      dispatch({ type: 'SET_LOOP_ENABLED', payload: false });
      return;
    }
    if (region) dispatch({ type: 'SET_LOOP_REGION', payload: { start: null, end: null } });
    dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
  };
  return { looping: state.loopEnabled, label, toggle };
}

const BUTTON = 'focus-ring h-8 flex items-center gap-1.5 px-2.5 rounded-pf-sm border text-pf-xs font-semibold uppercase tracking-wider transition-colors';

export function RouteTransportBar({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const { state, dispatch } = useProject();
  const { song } = useTransport();
  const loop = useLoopSong();
  const word = transportStateWord(state.isPlaying, state.currentTime, song.end);
  const rate = state.playbackRate;
  const slower = stepSpeed(rate, -1);
  const faster = stepSpeed(rate, 1);

  return (
    <div
      data-testid="route-transport"
      role="group"
      aria-label="Transport"
      className="flex items-center gap-3 px-4 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex-shrink-0"
      style={{ height: ROUTE_TRANSPORT_HEIGHT }}
    >
      <button
        type="button"
        data-testid="route-up"
        disabled
        title={ZOOM_REASON}
        className={`${BUTTON} border-[var(--border-default)] text-[var(--text-tertiary)] disabled:cursor-not-allowed`}
      >
        <ArrowUp size={14} aria-hidden="true" />
        Up
        <kbd className="font-mono text-pf-micro normal-case tracking-normal">Esc</kbd>
      </button>

      <span className="flex items-center gap-2">
        <button
          type="button"
          data-testid="route-play"
          aria-pressed={state.isPlaying}
          onClick={() => dispatch({ type: 'TOGGLE_PLAYING' })}
          title={state.isPlaying ? 'Stop (Space)' : 'Play (Space)'}
          className={`${BUTTON} w-[5.5rem] justify-center ${
            state.isPlaying
              ? 'bg-amber-500 text-amber-950 border-amber-400'
              : 'bg-emerald-700 text-white border-emerald-600 hover:bg-emerald-800'
          }`}
        >
          {state.isPlaying ? <Square size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          {state.isPlaying ? 'Stop' : 'Play'}
        </button>
        <span data-testid="route-state-word" className="text-pf-micro font-semibold tracking-wider text-[var(--text-tertiary)] w-[5.5rem]">
          {word}
        </span>
      </span>

      <button
        type="button"
        data-testid="route-loop"
        aria-pressed={loop.looping}
        onClick={loop.toggle}
        title={loop.looping ? 'Loop on (L)' : 'Loop the song (L)'}
        className={`${BUTTON} ${
          loop.looping
            ? 'border-[var(--accent-primary-soft)] text-[var(--text-primary)] bg-[var(--accent-muted)]'
            : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
        }`}
      >
        <Repeat size={13} aria-hidden="true" />
        Loop
        <span className="normal-case tracking-normal font-normal text-[var(--text-secondary)]">{loop.label}</span>
      </button>

      <span data-testid="route-tempo" className="flex items-center gap-1.5" role="group" aria-label="Practice tempo">
        <span className="text-pf-micro font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Practice tempo</span>
        <button
          type="button"
          data-testid="route-tempo-down"
          aria-label="Slower ([)"
          title="Slower ([)"
          disabled={slower === rate}
          onClick={() => dispatch({ type: 'SET_PLAYBACK_RATE', payload: slower })}
          className={`${BUTTON} w-8 justify-center px-0 border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50`}
        >
          [
        </button>
        <span data-testid="route-tempo-value" className="font-mono text-pf-sm tabular-nums text-[var(--text-primary)] w-[7.5rem] text-center">
          {Math.round(rate * state.tempo)} BPM · {Math.round(rate * 100)}%
        </span>
        <button
          type="button"
          data-testid="route-tempo-up"
          aria-label="Faster (])"
          title="Faster (])"
          disabled={faster === rate}
          onClick={() => dispatch({ type: 'SET_PLAYBACK_RATE', payload: faster })}
          className={`${BUTTON} w-8 justify-center px-0 border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50`}
        >
          ]
        </button>
      </span>

      <div className="flex-1" />

      <p data-testid="route-hints" className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap">
        <kbd className="font-mono">Space</kbd> play · <kbd className="font-mono">L</kbd> loop · <kbd className="font-mono">[ ]</kbd> tempo ·{' '}
        <button type="button" onClick={onOpenShortcuts} className="focus-ring underline decoration-dotted hover:text-[var(--text-secondary)] inline-block leading-6">
          <kbd className="font-mono">?</kbd> all shortcuts
        </button>
      </p>
    </div>
  );
}
