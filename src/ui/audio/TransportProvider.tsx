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
 *   here");
 * - SET_CURRENT_TIME moves it, stopped or playing (useTransport().seek does
 *   the same from the transport's own controls);
 * - when it stops, by Stop or at the end with Loop off, where it stopped goes
 *   back into currentTime.
 * While it plays, currentTime is not updated every frame: the position lives
 * in the engine, and the few components that draw it subscribe to it
 * (useTransportPosition), so the rest of the editor doesn't re-render 60 times
 * a second.
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
import { type SoundStream } from '../state/projectState';
import { RehearsalAudio, type RehearsalHit } from './rehearsalAudio';
import { TransportEngine, transportModeFromStorage } from './transportEngine';
import { loopRegionOf, songSpan, type SongSpan } from './transportMath';
import { setLiveTransport } from './liveTransport';

export interface TransportApi {
  /** Moves the playhead; while playing, playback carries on from there. */
  seek(to: number): void;
  /** Return: the loop start while looping a region, else the song's start. Playback keeps its state. */
  returnToStart(): void;
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
      dispatch({ type: 'SET_IS_PLAYING', payload: false });
      dispatch({ type: 'SET_CURRENT_TIME', payload: at });
    };
    return () => { engine.onEnded = undefined; };
  }, [engine, dispatch]);

  useEffect(() => {
    const moved = state.currentTime !== syncedTime.current;
    syncedTime.current = state.currentTime;
    if (state.isPlaying) {
      if (!engine.isRunning()) engine.play(state.currentTime);
      else if (moved) engine.seek(state.currentTime);
    } else if (engine.isRunning()) {
      const at = engine.stop();
      syncedTime.current = at;
      if (at !== state.currentTime) dispatch({ type: 'SET_CURRENT_TIME', payload: at });
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

  const api = useMemo<TransportApi>(() => ({ seek, returnToStart, song, engine }), [seek, returnToStart, song, engine]);
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
    song,
    engine: null,
  };
  return api ?? fallback;
}

const noSubscription = () => () => {};

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
