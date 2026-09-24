/**
 * Undo step names.
 *
 * Each recorded step is named after the user intent that made it, so the Undo
 * and Redo buttons can say what they will do ("Undo: Discard"). Compound
 * gestures pass their own name to transact(); a single dispatch is named here.
 */

import { type ProjectAction } from './projectState';

const ACTION_LABELS: Partial<Record<ProjectAction['type'], string>> = {
  RENAME_PROJECT: 'Rename project',
  SET_TEMPO: 'Tempo change',
  RENAME_SOUND: 'Rename Sound',
  TOGGLE_MUTE: 'Mute',
  SOLO_STREAM: 'Solo',
  SET_SOUND_COLOR: 'Sound color',
  SET_VOICE_CONSTRAINT: 'Finger preference',
  REORDER_STREAMS: 'Reorder Sounds',
  ASSIGN_VOICE_TO_PAD: 'Place Sound',
  BULK_ASSIGN_PADS: 'Place Sounds',
  MERGE_ASSIGN_PADS: 'Place Sounds',
  REMOVE_VOICE_FROM_PAD: 'Remove from pad',
  SWAP_PADS: 'Swap pads',
  SET_FINGER_CONSTRAINT: 'Finger preference',
  TOGGLE_PLACEMENT_LOCK: 'Lock',
  CREATE_WORKING_LAYOUT: 'Start draft',
  DISCARD_WORKING_LAYOUT: 'Discard',
  PROMOTE_WORKING_LAYOUT: 'Promote',
  PROMOTE_CANDIDATE: 'Promote',
  PROMOTE_VARIANT: 'Promote',
  DELETE_VARIANT: 'Delete variant',
  SAVE_AS_VARIANT: 'Save as variant',
  LOAD_SAVED_VARIANT: 'Load variant',
  RENAME_LAYOUT: 'Rename layout',
  APPLY_GENERATION_TO_LAYOUT: 'Use candidate',
  SUGGEST_STARTING_LAYOUT: 'Suggest layout',
  SET_INSTRUMENT_CONFIG: 'Instrument settings',
  IMPORT_LANES: 'Import',
  UPSERT_LANE_SOURCE: 'Replace source file',
  REMOVE_LANE_SOURCE: 'Remove source file',
  RENAME_LANE: 'Rename Sound',
  SET_LANE_COLOR: 'Sound color',
  REORDER_LANES: 'Reorder Sounds',
  SET_LANE_GROUP: 'Group',
  TOGGLE_LANE_MUTE: 'Mute',
  TOGGLE_LANE_SOLO: 'Solo',
  TOGGLE_LANE_HIDDEN: 'Hide Sound',
  DELETE_LANE: 'Delete Sound',
  CREATE_LANE_GROUP: 'New group',
  RENAME_LANE_GROUP: 'Rename group',
  SET_LANE_GROUP_COLOR: 'Group color',
  REORDER_LANE_GROUPS: 'Reorder groups',
  DELETE_LANE_GROUP: 'Delete group',
};

/** The undo step name for a single recorded dispatch. */
export function historyLabelFor(action: ProjectAction): string {
  return ACTION_LABELS[action.type] ?? 'Edit';
}
