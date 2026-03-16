/**
 * Loop Editor Reducer.
 *
 * Pure reducer for the loop editor's local state.
 * Handles config changes, lane CRUD, cell toggling, and playback.
 */

import {
  type LoopState,
  type LoopConfig,
  type LoopLane,
  type LoopEvent,
  type LoopCellKey,
  loopCellKey,
  stepsPerBar,
  totalSteps,
} from '../../types/loopEditor';
import { type RudimentType } from '../../types/rudiment';
import { type PatternRecipe, type PatternResult, type RandomRecipeConstraints } from '../../types/patternRecipe';
import { generateRudiment } from '../../engine/rudiment/rudimentGenerator';
import { assignLanesToPads } from '../../engine/rudiment/padAssignment';
import { assignFingers } from '../../engine/rudiment/fingerAssigner';
import { scoreComplexity } from '../../engine/rudiment/complexityScorer';
import { compilePattern } from '../../engine/pattern/patternEngine';
import { generateRandomRecipe } from '../../engine/pattern/randomRecipeGenerator';
import { generateId } from '../../utils/idGenerator';

// ============================================================================
// Actions
// ============================================================================

export type LoopEditorAction =
  // Config
  | { type: 'SET_BAR_COUNT'; payload: 4 | 8 | 16 }
  | { type: 'SET_SUBDIVISION'; payload: LoopConfig['subdivision'] }
  | { type: 'SET_BPM'; payload: number }
  // Lane management
  | { type: 'ADD_LANE'; payload: LoopLane }
  | { type: 'RENAME_LANE'; payload: { laneId: string; name: string } }
  | { type: 'DELETE_LANE'; payload: string }
  | { type: 'REORDER_LANES'; payload: string[] }
  | { type: 'SET_LANE_COLOR'; payload: { laneId: string; color: string } }
  | { type: 'SET_LANE_MIDI_NOTE'; payload: { laneId: string; midiNote: number | null } }
  | { type: 'TOGGLE_LANE_MUTE'; payload: string }
  | { type: 'TOGGLE_LANE_SOLO'; payload: string }
  // Event editing
  | { type: 'TOGGLE_CELL'; payload: { laneId: string; stepIndex: number } }
  | { type: 'SET_CELL_VELOCITY'; payload: { laneId: string; stepIndex: number; velocity: number } }
  | { type: 'CLEAR_ALL_EVENTS' }
  // Playback
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_PLAYHEAD'; payload: number }
  // Bulk
  | { type: 'LOAD_LOOP_STATE'; payload: LoopState }
  | { type: 'GENERATE_TEST_PATTERN' }
  // Rudiment
  | { type: 'GENERATE_RUDIMENT'; payload: { rudimentType: RudimentType } }
  | { type: 'CLEAR_RUDIMENT_RESULT' }
  // Pattern
  | { type: 'GENERATE_PATTERN'; payload: { recipe: PatternRecipe; seed?: number } }
  | { type: 'GENERATE_RANDOM_PATTERN'; payload: { seed: number; constraints?: RandomRecipeConstraints } }
  | { type: 'CLEAR_PATTERN_RESULT' };

// ============================================================================
// Reducer
// ============================================================================

export function loopEditorReducer(state: LoopState, action: LoopEditorAction): LoopState {
  switch (action.type) {
    // ---- Config ----

    case 'SET_BAR_COUNT':
      return { ...state, config: { ...state.config, barCount: action.payload }, rudimentResult: null, patternResult: null };

    case 'SET_SUBDIVISION':
      return { ...state, config: { ...state.config, subdivision: action.payload }, events: new Map(), rudimentResult: null, patternResult: null };

    case 'SET_BPM':
      return { ...state, config: { ...state.config, bpm: Math.max(20, Math.min(300, action.payload)) } };

    // ---- Lane management ----

    case 'ADD_LANE':
      return { ...state, lanes: [...state.lanes, action.payload] };

    case 'RENAME_LANE':
      return {
        ...state,
        lanes: state.lanes.map(l =>
          l.id === action.payload.laneId ? { ...l, name: action.payload.name } : l
        ),
      };

    case 'DELETE_LANE': {
      const newEvents = new Map(state.events);
      for (const key of newEvents.keys()) {
        if (key.startsWith(action.payload + ':')) {
          newEvents.delete(key);
        }
      }
      return {
        ...state,
        lanes: state.lanes.filter(l => l.id !== action.payload),
        events: newEvents,
        rudimentResult: null,
        patternResult: null,
      };
    }

    case 'REORDER_LANES': {
      const idToLane = new Map(state.lanes.map(l => [l.id, l]));
      const reordered = action.payload
        .map((id, i) => {
          const lane = idToLane.get(id);
          return lane ? { ...lane, orderIndex: i } : null;
        })
        .filter((l): l is LoopLane => l !== null);
      return { ...state, lanes: reordered };
    }

    case 'SET_LANE_COLOR':
      return {
        ...state,
        lanes: state.lanes.map(l =>
          l.id === action.payload.laneId ? { ...l, color: action.payload.color } : l
        ),
      };

    case 'SET_LANE_MIDI_NOTE':
      return {
        ...state,
        lanes: state.lanes.map(l =>
          l.id === action.payload.laneId ? { ...l, midiNote: action.payload.midiNote } : l
        ),
      };

    case 'TOGGLE_LANE_MUTE':
      return {
        ...state,
        lanes: state.lanes.map(l =>
          l.id === action.payload ? { ...l, isMuted: !l.isMuted } : l
        ),
      };

    case 'TOGGLE_LANE_SOLO':
      return {
        ...state,
        lanes: state.lanes.map(l =>
          l.id === action.payload ? { ...l, isSolo: !l.isSolo } : l
        ),
      };

    // ---- Event editing ----

    case 'TOGGLE_CELL': {
      const key = loopCellKey(action.payload.laneId, action.payload.stepIndex);
      const newEvents = new Map(state.events);
      if (newEvents.has(key)) {
        newEvents.delete(key);
      } else {
        newEvents.set(key, {
          laneId: action.payload.laneId,
          stepIndex: action.payload.stepIndex,
          velocity: 100,
        });
      }
      return { ...state, events: newEvents, rudimentResult: null, patternResult: null };
    }

    case 'SET_CELL_VELOCITY': {
      const key = loopCellKey(action.payload.laneId, action.payload.stepIndex);
      const existing = state.events.get(key);
      if (!existing) return state;
      const newEvents = new Map(state.events);
      newEvents.set(key, { ...existing, velocity: action.payload.velocity });
      return { ...state, events: newEvents };
    }

    case 'CLEAR_ALL_EVENTS':
      return { ...state, events: new Map(), rudimentResult: null, patternResult: null };

    // ---- Playback ----

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'SET_PLAYHEAD':
      return { ...state, playheadStep: action.payload };

    // ---- Bulk ----

    case 'LOAD_LOOP_STATE':
      return action.payload;

    case 'GENERATE_TEST_PATTERN':
      return { ...generateTestPattern(state), rudimentResult: null, patternResult: null };

    // ---- Rudiment ----

    case 'GENERATE_RUDIMENT': {
      const { rudimentType } = action.payload;
      const { lanes, events } = generateRudiment(rudimentType, state.config);
      const padAssignments = assignLanesToPads(lanes, rudimentType);
      const fingerAssignments = assignFingers(events, padAssignments, state.config);
      const complexity = scoreComplexity(events, lanes, state.config, fingerAssignments);
      return {
        ...state,
        lanes,
        events,
        rudimentResult: { rudimentType, padAssignments, fingerAssignments, complexity },
      };
    }

    case 'CLEAR_RUDIMENT_RESULT':
      return { ...state, rudimentResult: null };

    // ---- Pattern Generation ----

    case 'GENERATE_PATTERN': {
      const { recipe, seed } = action.payload;
      return applyPatternRecipe(state, recipe, seed);
    }

    case 'GENERATE_RANDOM_PATTERN': {
      const { seed, constraints } = action.payload;
      const recipe = generateRandomRecipe(seed, constraints);
      return applyPatternRecipe(state, recipe, seed);
    }

    case 'CLEAR_PATTERN_RESULT':
      return { ...state, patternResult: null };

    default:
      return state;
  }
}

// ============================================================================
// Initial State
// ============================================================================

export function createInitialLoopState(): LoopState {
  return {
    config: {
      barCount: 8,
      subdivision: '1/8',
      bpm: 120,
      beatsPerBar: 4,
    },
    lanes: [],
    events: new Map(),
    isPlaying: false,
    playheadStep: 0,
    rudimentResult: null,
    patternResult: null,
  };
}

// ============================================================================
// Pattern Recipe Application
// ============================================================================

/**
 * Compile a pattern recipe and run the full pipeline:
 * compile → assign pads → assign fingers → score complexity.
 */
function applyPatternRecipe(
  state: LoopState,
  recipe: PatternRecipe,
  seed?: number,
): LoopState {
  const { lanes, events } = compilePattern(recipe, state.config, seed);
  const padAssignments = assignLanesToPads(lanes, 'auto');
  const fingerAssignments = assignFingers(events, padAssignments, state.config);
  const complexity = scoreComplexity(events, lanes, state.config, fingerAssignments);

  const patternResult: PatternResult = {
    source: { type: 'recipe', recipeId: recipe.id, recipeName: recipe.name },
    recipe,
    padAssignments,
    fingerAssignments,
    complexity,
  };

  return {
    ...state,
    lanes,
    events,
    rudimentResult: null,
    patternResult,
  };
}

// ============================================================================
// Test Pattern Generator
// ============================================================================

const LANE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#eab308', '#3b82f6', '#a855f7'];

function generateTestPattern(state: LoopState): LoopState {
  let lanes = state.lanes;
  const spb = stepsPerBar(state.config.subdivision);

  // If no lanes, create defaults
  if (lanes.length === 0) {
    lanes = [
      { id: generateId('llane'), name: 'Kick', color: LANE_COLORS[0], midiNote: 36, orderIndex: 0, isMuted: false, isSolo: false },
      { id: generateId('llane'), name: 'Snare', color: LANE_COLORS[1], midiNote: 38, orderIndex: 1, isMuted: false, isSolo: false },
      { id: generateId('llane'), name: 'Closed Hat', color: LANE_COLORS[2], midiNote: 42, orderIndex: 2, isMuted: false, isSolo: false },
      { id: generateId('llane'), name: 'Open Hat', color: LANE_COLORS[3], midiNote: 46, orderIndex: 3, isMuted: false, isSolo: false },
      { id: generateId('llane'), name: 'Bass 1', color: LANE_COLORS[4], midiNote: 36, orderIndex: 4, isMuted: false, isSolo: false },
      { id: generateId('llane'), name: 'Lead Chop', color: LANE_COLORS[5], midiNote: 60, orderIndex: 5, isMuted: false, isSolo: false },
    ];
  }

  const steps = totalSteps({ ...state.config });
  const newEvents = new Map<LoopCellKey, LoopEvent>();
  const beatSize = Math.max(1, spb / 4);

  for (let step = 0; step < steps; step++) {
    const posInBar = step % spb;

    // Kick: beats 1 and 3
    if (lanes[0] && (posInBar === 0 || posInBar === 2 * beatSize)) {
      const key = loopCellKey(lanes[0].id, step);
      newEvents.set(key, { laneId: lanes[0].id, stepIndex: step, velocity: 110 });
    }
    // Snare: beats 2 and 4
    if (lanes[1] && (posInBar === beatSize || posInBar === 3 * beatSize)) {
      const key = loopCellKey(lanes[1].id, step);
      newEvents.set(key, { laneId: lanes[1].id, stepIndex: step, velocity: 100 });
    }
    // Closed Hat: every step
    if (lanes[2]) {
      const key = loopCellKey(lanes[2].id, step);
      newEvents.set(key, { laneId: lanes[2].id, stepIndex: step, velocity: 80 });
    }
    // Open Hat: beats 2-and and 4-and (offbeat)
    if (lanes[3] && spb >= 8 && (posInBar === beatSize + beatSize / 2 || posInBar === 3 * beatSize + beatSize / 2)) {
      const key = loopCellKey(lanes[3].id, step);
      newEvents.set(key, { laneId: lanes[3].id, stepIndex: step, velocity: 90 });
    }
    // Bass: beats 1 and syncopated accent before beat 4
    if (lanes[4] && (posInBar === 0 || (spb >= 8 && posInBar === 3 * beatSize - beatSize / 2))) {
      const key = loopCellKey(lanes[4].id, step);
      newEvents.set(key, { laneId: lanes[4].id, stepIndex: step, velocity: 100 });
    }
    // Lead Chop: sparse hits (beat 2-and of bars 1, 3, 5, 7)
    if (lanes[5] && spb >= 4) {
      const barIndex = Math.floor(step / spb);
      if (barIndex % 2 === 0 && posInBar === Math.floor(beatSize * 1.5)) {
        const key = loopCellKey(lanes[5].id, step);
        newEvents.set(key, { laneId: lanes[5].id, stepIndex: step, velocity: 85 });
      }
    }
  }

  return { ...state, lanes, events: newEvents };
}
