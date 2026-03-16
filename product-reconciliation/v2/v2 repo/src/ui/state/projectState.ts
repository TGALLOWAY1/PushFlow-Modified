/**
 * Project State.
 *
 * Central state type for the PushFlow project-based editor.
 * Replaces the old EngineState with project lifecycle, sound streams,
 * undo/redo support, and analysis caching.
 */

import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type Layout } from '../../types/layout';
import { type Section, type VoiceProfile } from '../../types/performanceStructure';
import { type PerformanceLane, type LaneGroup, type SourceFile } from '../../types/performanceLane';
import { type LaneAction, isLaneAction, lanesReducer } from './lanesReducer';

// ============================================================================
// Sound Stream Model
// ============================================================================

/** A single timing event within a sound stream. */
export interface SoundEvent {
  startTime: number;
  duration: number;
  velocity: number;
  eventKey: string;
}

/**
 * SoundStream: An independent timing track for a single sound.
 *
 * After MIDI import, each unique pitch becomes a SoundStream.
 * The timing data is preserved independently of the original MIDI pitch.
 * Muting a stream excludes it from grid, timeline, and analysis.
 */
export interface SoundStream {
  id: string;
  name: string;
  color: string;
  originalMidiNote: number;
  events: SoundEvent[];
  muted: boolean;
}

// ============================================================================
// Project State
// ============================================================================

export interface ProjectState {
  // Identity
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;

  // Sound Streams (canonical performance data)
  soundStreams: SoundStream[];
  tempo: number;
  instrumentConfig: InstrumentConfig;
  sections: Section[];
  voiceProfiles: VoiceProfile[];

  // Layouts
  layouts: Layout[];
  activeLayoutId: string;

  // Analysis cache
  analysisResult: CandidateSolution | null;
  candidates: CandidateSolution[];
  selectedCandidateId: string | null;

  // Config
  engineConfig: EngineConfiguration;

  // Voice-level constraints (hand/finger per voice, key is stream ID)
  voiceConstraints: Record<string, { hand?: 'left' | 'right'; finger?: string }>;

  // Performance Lanes (pre-editor authoring data)
  performanceLanes: PerformanceLane[];
  laneGroups: LaneGroup[];
  sourceFiles: SourceFile[];

  // Ephemeral UI state (not persisted, not in undo stack)
  selectedEventIndex: number | null;
  compareCandidateId: string | null;
  isProcessing: boolean;
  error: string | null;
  analysisStale: boolean;

  // Transport
  currentTime: number;
  isPlaying: boolean;
}

// ============================================================================
// Derived Performance
// ============================================================================

/**
 * Build a Performance object from unmuted SoundStreams for solver consumption.
 */
export function getActivePerformance(state: ProjectState): Performance {
  const activeStreams = state.soundStreams.filter(s => !s.muted);
  const events = activeStreams.flatMap(stream =>
    stream.events.map(e => ({
      noteNumber: stream.originalMidiNote,
      startTime: e.startTime,
      duration: e.duration,
      velocity: e.velocity,
      eventKey: e.eventKey,
    }))
  ).sort((a, b) => a.startTime - b.startTime);

  return { events, tempo: state.tempo, name: state.name };
}

/** Get the active layout from the project state. */
export function getActiveLayout(state: ProjectState): Layout | null {
  return state.layouts.find(l => l.id === state.activeLayoutId) ?? null;
}

/** Get only unmuted sound streams. */
export function getActiveStreams(state: ProjectState): SoundStream[] {
  return state.soundStreams.filter(s => !s.muted);
}

// ============================================================================
// Actions
// ============================================================================

export type ProjectAction =
  // Project lifecycle
  | { type: 'LOAD_PROJECT'; payload: ProjectState }
  | { type: 'RESET' }

  // Sound streams
  | { type: 'RENAME_SOUND'; payload: { streamId: string; name: string } }
  | { type: 'TOGGLE_MUTE'; payload: string }
  | { type: 'SET_SOUND_COLOR'; payload: { streamId: string; color: string } }
  | { type: 'SET_VOICE_CONSTRAINT'; payload: { streamId: string; hand?: 'left' | 'right' | null; finger?: string | null } }

  // Layout editing
  | { type: 'ADD_LAYOUT'; payload: Layout }
  | { type: 'SET_ACTIVE_LAYOUT'; payload: string }
  | { type: 'ASSIGN_VOICE_TO_PAD'; payload: { padKey: string; stream: SoundStream } }
  | { type: 'BULK_ASSIGN_PADS'; payload: Layout['padToVoice'] }
  | { type: 'REMOVE_VOICE_FROM_PAD'; payload: { padKey: string } }
  | { type: 'SWAP_PADS'; payload: { padKeyA: string; padKeyB: string } }
  | { type: 'SET_FINGER_CONSTRAINT'; payload: { padKey: string; constraint: string | null } }

  // Analysis
  | { type: 'SET_ANALYSIS_RESULT'; payload: CandidateSolution | null }
  | { type: 'SET_CANDIDATES'; payload: CandidateSolution[] }
  | { type: 'SELECT_CANDIDATE'; payload: string | null }
  | { type: 'MARK_ANALYSIS_STALE' }

  // Ephemeral UI
  | { type: 'SELECT_EVENT'; payload: number | null }
  | { type: 'SET_COMPARE_CANDIDATE'; payload: string | null }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

  // Transport
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'TICK_TIME'; payload: number }
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'TOGGLE_PLAYING' }

  // Performance Lanes (delegated to lanesReducer)
  | LaneAction;

/** Actions that should NOT be recorded in the undo stack. */
const EPHEMERAL_ACTIONS = new Set<ProjectAction['type']>([
  'SELECT_EVENT',
  'SET_COMPARE_CANDIDATE',
  'SET_PROCESSING',
  'SET_ERROR',
  'MARK_ANALYSIS_STALE',
  'SET_ANALYSIS_RESULT',
  'SET_CANDIDATES',
  'SELECT_CANDIDATE',
  'TOGGLE_LANE_GROUP_COLLAPSE',
  'SET_CURRENT_TIME',
  'TICK_TIME',
  'SET_IS_PLAYING',
  'TOGGLE_PLAYING',
]);

export function isEphemeralAction(action: ProjectAction): boolean {
  return EPHEMERAL_ACTIONS.has(action.type);
}

// ============================================================================
// Reducer
// ============================================================================

/** Helper: update the active layout in the layouts array. */
function updateActiveLayout(
  state: ProjectState,
  updater: (layout: Layout) => Layout
): ProjectState {
  const now = new Date().toISOString();
  return {
    ...state,
    updatedAt: now,
    analysisStale: true,
    layouts: state.layouts.map(l =>
      l.id === state.activeLayoutId
        ? { ...updater(l), scoreCache: null }
        : l
    ),
  };
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  // Delegate lane/group actions to the dedicated lanes reducer
  if (isLaneAction(action.type)) {
    return lanesReducer(state, action as LaneAction);
  }

  switch (action.type) {
    case 'LOAD_PROJECT':
      return {
        ...action.payload,
        // Reset ephemeral state
        selectedEventIndex: null,
        compareCandidateId: null,
        isProcessing: false,
        error: null,
        analysisStale: true,
        currentTime: 0,
        isPlaying: false,
      };

    case 'RESET':
      return createEmptyProjectState();

    // -- Sound streams --

    case 'RENAME_SOUND':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        soundStreams: state.soundStreams.map(s =>
          s.id === action.payload.streamId ? { ...s, name: action.payload.name } : s
        ),
      };

    case 'TOGGLE_MUTE':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        analysisStale: true,
        soundStreams: state.soundStreams.map(s =>
          s.id === action.payload ? { ...s, muted: !s.muted } : s
        ),
      };

    case 'SET_SOUND_COLOR':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        soundStreams: state.soundStreams.map(s =>
          s.id === action.payload.streamId ? { ...s, color: action.payload.color } : s
        ),
      };

    case 'SET_VOICE_CONSTRAINT': {
      const { streamId, hand, finger } = action.payload;
      const current = state.voiceConstraints[streamId] ?? {};
      const updated = { ...current };
      if (hand === null) delete updated.hand;
      else if (hand !== undefined) updated.hand = hand;
      if (finger === null) delete updated.finger;
      else if (finger !== undefined) updated.finger = finger;
      const next = { ...state.voiceConstraints };
      if (Object.keys(updated).length === 0) delete next[streamId];
      else next[streamId] = updated;
      return { ...state, updatedAt: new Date().toISOString(), voiceConstraints: next, analysisStale: true };
    }

    // -- Layout editing --

    case 'ADD_LAYOUT':
      return {
        ...state,
        updatedAt: new Date().toISOString(),
        layouts: [...state.layouts, action.payload],
      };

    case 'SET_ACTIVE_LAYOUT':
      return {
        ...state,
        activeLayoutId: action.payload,
        analysisStale: true,
        selectedEventIndex: null,
      };

    case 'ASSIGN_VOICE_TO_PAD':
      return updateActiveLayout(state, layout => {
        const { padKey, stream } = action.payload;
        
        // Strip out existing assignments of this stream (acts as Move instead of Copy)
        const newPadToVoice = { ...layout.padToVoice };
        for (const [key, v] of Object.entries(newPadToVoice)) {
          if (v.id === stream.id) {
            delete newPadToVoice[key];
          }
        }
        
        const voice = {
          id: stream.id,
          name: stream.name,
          sourceType: 'midi_track' as const,
          sourceFile: '',
          originalMidiNote: stream.originalMidiNote,
          color: stream.color,
        };
        newPadToVoice[padKey] = voice;
        return {
          ...layout,
          padToVoice: newPadToVoice,
          layoutMode: 'manual',
        };
      });

    case 'BULK_ASSIGN_PADS':
      // Atomically replaces the entire padToVoice with the provided mapping.
      // Used by auto-assign (Generate from scratch) to populate pads in one update.
      return updateActiveLayout(state, layout => ({
        ...layout,
        padToVoice: action.payload,
        layoutMode: 'auto',
      }));

    case 'REMOVE_VOICE_FROM_PAD':
      return updateActiveLayout(state, layout => {
        const { [action.payload.padKey]: _, ...rest } = layout.padToVoice;
        return { ...layout, padToVoice: rest, layoutMode: 'manual' };
      });

    case 'SWAP_PADS':
      return updateActiveLayout(state, layout => {
        const { padKeyA, padKeyB } = action.payload;
        const voiceA = layout.padToVoice[padKeyA];
        const voiceB = layout.padToVoice[padKeyB];
        const newPadToVoice = { ...layout.padToVoice };
        if (voiceA) newPadToVoice[padKeyB] = voiceA;
        else delete newPadToVoice[padKeyB];
        if (voiceB) newPadToVoice[padKeyA] = voiceB;
        else delete newPadToVoice[padKeyA];
        return { ...layout, padToVoice: newPadToVoice, layoutMode: 'manual' };
      });

    case 'SET_FINGER_CONSTRAINT':
      return updateActiveLayout(state, layout => {
        const { padKey, constraint } = action.payload;
        const newConstraints = { ...layout.fingerConstraints };
        if (constraint) newConstraints[padKey] = constraint;
        else delete newConstraints[padKey];
        return { ...layout, fingerConstraints: newConstraints };
      });

    // -- Analysis --

    case 'SET_ANALYSIS_RESULT':
      return { ...state, analysisResult: action.payload, analysisStale: false };

    case 'SET_CANDIDATES':
      return {
        ...state,
        candidates: action.payload,
        selectedCandidateId: action.payload[0]?.id ?? null,
        compareCandidateId: null,
        isProcessing: false,
      };

    case 'SELECT_CANDIDATE':
      return { ...state, selectedCandidateId: action.payload };

    case 'MARK_ANALYSIS_STALE':
      return { ...state, analysisStale: true };

    // -- Ephemeral UI --

    case 'SELECT_EVENT':
      return { ...state, selectedEventIndex: action.payload };

    case 'SET_COMPARE_CANDIDATE':
      return { ...state, compareCandidateId: action.payload };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isProcessing: false };

    // -- Transport --
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };

    case 'TICK_TIME':
      return { ...state, currentTime: state.currentTime + action.payload };

    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'TOGGLE_PLAYING':
      return { ...state, isPlaying: !state.isPlaying };

    default:
      return state;
  }
}

// ============================================================================
// Empty State
// ============================================================================

export function createEmptyProjectState(): ProjectState {
  return {
    id: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemo: false,
    soundStreams: [],
    tempo: 120,
    instrumentConfig: {
      id: 'default',
      name: 'Push 3',
      rows: 8,
      cols: 8,
      bottomLeftNote: 36,
      layoutMode: 'drum_64',
    },
    sections: [],
    voiceProfiles: [],
    layouts: [],
    activeLayoutId: '',
    analysisResult: null,
    candidates: [],
    selectedCandidateId: null,
    engineConfig: {
      beamWidth: 30,
      stiffness: 0.3,
      restingPose: {
        left: { centroid: { x: 1.5, y: 3.5 }, fingers: {} },
        right: { centroid: { x: 5.5, y: 3.5 }, fingers: {} },
      },
    },
    voiceConstraints: {},
    performanceLanes: [],
    laneGroups: [],
    sourceFiles: [],
    selectedEventIndex: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: false,
    currentTime: 0,
    isPlaying: false,
  };
}
