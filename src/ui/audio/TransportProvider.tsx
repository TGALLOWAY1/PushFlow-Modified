/**
 * The workspace's transport (S4.3a; T58, T60 part), for everything under the
 * workspace: the transport bar above the drawer tabs, the timeline and the
 * grid. The timeline no longer owns playback, so a drawer tab switch never
 * touches it.
 *
 * The engine (transportEngine.ts) is the one clock. Project state says
 * whether it plays (isPlaying) and where it rests (currentTime), and holds
 * the loop and speed (rehearsal preferences, saved with the project, never
 * analysis inputs). This provider keeps the two in step:
 * - isPlaying starts and stops the engine (the Play button, Space, "Play from
 *   here", Rehearse); a start counts in as set (countInBars, S4.3b), or as a
 *   useTransport().play call asks;
 * - SET_CURRENT_TIME moves it, stopped or playing (useTransport().seek does
 *   the same from the transport's own controls);
 * - when it stops, by Stop or at the end with Loop off, where it stopped goes
 *   back into currentTime, with the event there (PLAYBACK_STOPPED: the one
 *   current moment, S4.3b).
 * While it plays, currentTime is not updated every frame: the position lives
 * in the engine, and the few components that draw it subscribe to it
 * (useTransportPosition, usePlayheadEventIndex, useCountIn), so the rest of
 * the editor doesn't re-render 60 times a second.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedExecutionPlan, type ProjectState, type SoundStream } from '../state/projectState';
import { getEventTimeline, type EventTimeline } from '../analysis/eventTimeline';
import { playheadEventIndex } from '../analysis/selectionModel';
import { type FingerAssignment } from '../../types/executionPlan';
import { RehearsalAudio, type RehearsalHit } from './rehearsalAudio';
import { TransportEngine, transportModeFromStorage, type CountInBeat } from './transportEngine';
import { loopRegionOf, songSpan, type SongSpan } from './transportMath';
import { setLiveTransport } from './liveTransport';

export interface PlayRequest {
  /** Where to start; the playhead when left out. */
  from?: number;
  /** Bars of count-in; the count-in set (countInBars) when left out. */
  countInBars?: number;
}

export interface TransportApi {
  /** Moves the playhead; while playing, playback carries on from there. */
  seek(to: number): void;
  /** Return: the loop start while looping a region, else the song's start. Playback keeps its state. */
  returnToStart(): void;
  /** Starts playback (S4.3b); while playing, only moves the playhead to `from`. */
  play(request?: PlayRequest): void;
  /**
   * Rehearse (S4.3b, T10): loops `region` at `rate`. Stopped, plays it from its
   * start after `countInBars` of count-in; playing, carries on, and moves to its
   * start when the playhead is outside it.
   */
  rehearse(region: { start: number; end: number }, rate: number, countInBars: number): void;
  /** The span the timeline draws and the transport plays. */
  song: SongSpan;
  /** The engine; null outside a workspace (component tests). */
  engine: TransportEngine | null;
}

const TransportContext = createContext<TransportApi | null>(null);

/** Every hit in the performance, in time order. Muted Sounds are silent. */
export function audibleHits(streams: readonly SoundStream[]): RehearsalHit[] {
  const hits: RehearsalHit[] = [];
  for (const stream of streams) {
    if (stream.muted) continue;
    for (const event of stream.events) {
      hits.push({ soundId: stream.id, time: event.startTime, velocity: event.velocity });
    }
  }
  return hits.sort((a, b) => a.time - b.time);
}

/** The start Return goes to: the loop region's while looping one, else the song's. */
function returnTarget(song: SongSpan, loop: { enabled: boolean; start: number | null; end: number | null }): number {
  const region = loop.enabled ? loopRegionOf(loop) : null;
  return region ? region.start : song.start;
}

/**
 * The event the grid shows at playhead position `time` (S4.3b): the last one
 * the plan on screen plays at or before it, as during playback; null before
 * the first, or with no plan.
 */
export function playheadEvent(state: ProjectState, time: number): { key: string; index: number } | null {
  const timeline = getEventTimeline(state);
  const index = playheadEventIndex(timeline, getDisplayedExecutionPlan(state)?.fingerAssignments, time);
  const event = index === null ? undefined : timeline.events[index];
  return event ? { key: event.key, index: event.index } : null;
}

export function TransportProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useProject();
  // Cheap to make: the AudioContext and the ticker's worker come on first Play.
  const engineRef = useRef<TransportEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new TransportEngine({ audio: new RehearsalAudio(), mode: transportModeFromStorage() });
  }
  const engine = engineRef.current;

  useEffect(() => {
    setLiveTransport(engine);
    return () => {
      // Released, not destroyed: a StrictMode remount plays again on the next Play.
      engine.dispose();
      setLiveTransport(null);
    };
  }, [engine]);

  // What there is to play, and how: before Play below, so a first Play has them.
  const song = useMemo(() => songSpan(state.soundStreams, state.tempo), [state.soundStreams, state.tempo]);
  const hits = useMemo(() => audibleHits(state.soundStreams), [state.soundStreams]);
  useEffect(() => {
    engine.setMaterial({ hits, tempo: state.tempo, song });
  }, [engine, hits, state.tempo, song]);
  useEffect(() => {
    engine.setLoop({ enabled: state.loopEnabled, start: state.loopStart, end: state.loopEnd });
  }, [engine, state.loopEnabled, state.loopStart, state.loopEnd]);
  useEffect(() => {
    engine.setRate(state.playbackRate);
  }, [engine, state.playbackRate]);
  useEffect(() => {
    engine.setAudioOptions(state.rehearsalAudio);
  }, [engine, state.rehearsalAudio]);

  // The resting position the engine was last given (or gave back); NaN until the first sync.
  const syncedTime = useRef(Number.NaN);

  useEffect(() => {
    engine.onEnded = at => {
      syncedTime.current = at;
      // The song is over: no event to hold on the grid (a picked one stays).
      dispatch({ type: 'SET_IS_PLAYING', payload: false });
      dispatch({ type: 'PLAYBACK_STOPPED', payload: { time: at, momentKey: null } });
    };
    return () => { engine.onEnded = undefined; };
  }, [engine, dispatch]);

  // The count-in the next start asks for (play({ countInBars })); else the one set.
  const countInRequest = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const moved = state.currentTime !== syncedTime.current;
    syncedTime.current = state.currentTime;
    if (state.isPlaying) {
      if (!engine.isRunning()) {
        const countInBars = countInRequest.current ?? stateRef.current.countInBars;
        countInRequest.current = null;
        engine.play(state.currentTime, { countInBars });
      } else if (moved) engine.seek(state.currentTime);
    } else if (engine.isRunning()) {
      const at = engine.stop();
      syncedTime.current = at;
      // Stopped mid-song: the event at the playhead is the current moment (S4.3b).
      dispatch({ type: 'PLAYBACK_STOPPED', payload: { time: at, momentKey: playheadEvent(stateRef.current, at)?.key ?? null } });
    } else if (moved) {
      engine.seek(state.currentTime);
    }
  }, [engine, dispatch, state.isPlaying, state.currentTime]);

  const loopRef = useRef({ enabled: state.loopEnabled, start: state.loopStart, end: state.loopEnd });
  loopRef.current = { enabled: state.loopEnabled, start: state.loopStart, end: state.loopEnd };

  const seek = useCallback((to: number) => {
    const target = Math.max(0, to);
    // Straight to the engine: while playing, currentTime may already hold this value.
    engine.seek(target);
    syncedTime.current = target;
    dispatch({ type: 'SET_CURRENT_TIME', payload: target });
  }, [engine, dispatch]);

  const returnToStart = useCallback(() => {
    seek(returnTarget(song, loopRef.current));
  }, [seek, song]);

  // Starting goes through isPlaying like the Play button, so the loop and
  // speed dispatched with it (Rehearse) are the engine's before it starts.
  const play = useCallback(({ from, countInBars }: PlayRequest = {}) => {
    if (engine.isRunning()) {
      if (from !== undefined) seek(from);
      return;
    }
    countInRequest.current = countInBars ?? null;
    if (from !== undefined) dispatch({ type: 'SET_CURRENT_TIME', payload: Math.max(0, from) });
    dispatch({ type: 'SET_IS_PLAYING', payload: true });
  }, [engine, dispatch, seek]);

  const rehearse = useCallback((region: { start: number; end: number }, rate: number, countInBars: number) => {
    dispatch({ type: 'SET_LOOP_REGION', payload: region });
    dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
    dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate });
    if (!engine.isRunning()) {
      play({ from: region.start, countInBars });
      return;
    }
    // Playing: the engine takes the loop now (the effects above will find it
    // set), so a move into it starts under it rather than under the old one.
    engine.setLoop({ enabled: true, start: region.start, end: region.end });
    engine.setRate(rate);
    const at = engine.position();
    if (at < region.start || at >= region.end) seek(region.start);
  }, [engine, dispatch, play, seek]);

  const api = useMemo<TransportApi>(
    () => ({ seek, returnToStart, play, rehearse, song, engine }),
    [seek, returnToStart, play, rehearse, song, engine],
  );
  return <TransportContext.Provider value={api}>{children}</TransportContext.Provider>;
}

/**
 * The transport's controls. Outside a workspace (component tests) it works on
 * project state alone: a seek sets currentTime.
 */
export function useTransport(): TransportApi {
  const api = useContext(TransportContext);
  const { state, dispatch } = useProject();
  const song = useMemo(() => songSpan(state.soundStreams, state.tempo), [state.soundStreams, state.tempo]);
  const loop = { enabled: state.loopEnabled, start: state.loopStart, end: state.loopEnd };
  const fallback: TransportApi = {
    seek: to => dispatch({ type: 'SET_CURRENT_TIME', payload: Math.max(0, to) }),
    returnToStart: () => dispatch({ type: 'SET_CURRENT_TIME', payload: returnTarget(song, loop) }),
    play: ({ from } = {}) => {
      if (from !== undefined) dispatch({ type: 'SET_CURRENT_TIME', payload: Math.max(0, from) });
      if (!state.isPlaying) dispatch({ type: 'SET_IS_PLAYING', payload: true });
    },
    rehearse: (region, rate) => {
      dispatch({ type: 'SET_LOOP_REGION', payload: region });
      dispatch({ type: 'SET_LOOP_ENABLED', payload: true });
      dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate });
      if (!state.isPlaying || state.currentTime < region.start || state.currentTime >= region.end) {
        dispatch({ type: 'SET_CURRENT_TIME', payload: region.start });
      }
      if (!state.isPlaying) dispatch({ type: 'SET_IS_PLAYING', payload: true });
    },
    song,
    engine: null,
  };
  return api ?? fallback;
}

const noSubscription = () => () => {};

/**
 * The count-in's click while the transport counts in (S4.3b), else null.
 * Re-renders once per click, not per frame.
 */
export function useCountIn(): CountInBeat | null {
  const api = useContext(TransportContext);
  const engine = api?.engine ?? null;
  return useSyncExternalStore(engine ? engine.subscribe : noSubscription, () => (engine ? engine.countIn : null));
}

/**
 * While playing, the event at the playhead under `assignments` (its index in
 * `timeline`), as the grid shows it; null when stopped. Re-renders only when
 * it changes, so a panel can follow the music (S4.3b: the current moment)
 * without redrawing every frame.
 */
export function usePlayheadEventIndex(
  timeline: EventTimeline,
  assignments: readonly FingerAssignment[] | null | undefined,
): number | null {
  const api = useContext(TransportContext);
  const { state } = useProject();
  const engine = api?.engine ?? null;
  const playing = state.isPlaying;
  const fallbackTime = state.currentTime;
  return useSyncExternalStore(
    engine ? engine.subscribe : noSubscription,
    () => (playing ? playheadEventIndex(timeline, assignments, engine ? engine.snapshot : fallbackTime) : null),
  );
}

/**
 * The playhead, for components that draw it: the engine's position while it
 * plays (a re-render per animation frame), else currentTime.
 */
export function useTransportPosition(): number {
  const api = useContext(TransportContext);
  const { state } = useProject();
  const engine = api?.engine ?? null;
  const live = useSyncExternalStore(
    engine ? engine.subscribe : noSubscription,
    () => (engine ? engine.snapshot : null),
  );
  // Until the engine has stopped (its effect runs after this render), its
  // position is the true one; stopped, currentTime already holds any seek.
  if (engine && live !== null && (state.isPlaying || engine.isRunning())) return live;
  return state.currentTime;
}
