/**
 * Composer Workspace Reducer.
 *
 * Manages placed preset instances in the workspace assembly.
 * This state persists with the project.
 */

import {
  type ComposerWorkspaceState,
  type PlacedPresetInstance,
  type PresetPad,
  type PresetBoundingBox,
  createInitialComposerWorkspaceState,
} from '../../types/composerPreset';
// mirrorPads is called by PerformanceWorkspace before dispatching MIRROR_INSTANCE

// ============================================================================
// Actions
// ============================================================================

export type ComposerWorkspaceAction =
  | { type: 'PLACE_PRESET'; instance: PlacedPresetInstance }
  | { type: 'REMOVE_INSTANCE'; instanceId: string }
  | { type: 'SELECT_INSTANCE'; instanceId: string | null }
  | { type: 'MIRROR_INSTANCE'; instanceId: string; mirroredPads: PresetPad[]; boundingBox: PresetBoundingBox }
  | { type: 'CLEAR_ALL_INSTANCES' }
  | { type: 'LOAD_WORKSPACE'; state: ComposerWorkspaceState };

// ============================================================================
// Reducer
// ============================================================================

export function composerWorkspaceReducer(
  state: ComposerWorkspaceState,
  action: ComposerWorkspaceAction,
): ComposerWorkspaceState {
  switch (action.type) {
    case 'PLACE_PRESET':
      return {
        ...state,
        placedInstances: [...state.placedInstances, action.instance],
        selectedInstanceId: action.instance.id,
      };

    case 'REMOVE_INSTANCE':
      return {
        ...state,
        placedInstances: state.placedInstances.filter(
          inst => inst.id !== action.instanceId
        ),
        selectedInstanceId:
          state.selectedInstanceId === action.instanceId
            ? null
            : state.selectedInstanceId,
      };

    case 'SELECT_INSTANCE':
      return {
        ...state,
        selectedInstanceId: action.instanceId,
      };

    case 'MIRROR_INSTANCE':
      return {
        ...state,
        placedInstances: state.placedInstances.map(inst => {
          if (inst.id !== action.instanceId) return inst;
          return {
            ...inst,
            isMirrored: !inst.isMirrored,
            pads: action.mirroredPads,
            boundingBox: action.boundingBox,
          };
        }),
      };

    case 'CLEAR_ALL_INSTANCES':
      return createInitialComposerWorkspaceState();

    case 'LOAD_WORKSPACE':
      return action.state;

    default:
      return state;
  }
}
