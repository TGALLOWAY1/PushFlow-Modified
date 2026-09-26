/**
 * Draft-replacing actions with their "Your draft was kept" toast.
 *
 * Use as my draft, Edit as draft, a candidate or variant Promote and Restore
 * replace the Working/Test Layout. The reducer keeps a draft that would
 * otherwise be lost in Recovered drafts (keepReplacedDraft in projectState.ts);
 * this hook runs the action and, when a draft was kept, says so with a Restore
 * action, and names a recovered draft pruned to make room.
 */

import { useCallback } from 'react';
import { useProject } from '../state/ProjectContext';
import { projectReducer, type ProjectAction, type ProjectState } from '../state/projectState';
import { useToast } from '../components/shared/Toast';
import { hashLayout } from '@/engine';

export type DraftReplacingAction = Extract<ProjectAction, {
  type: 'APPLY_GENERATION_TO_LAYOUT' | 'LOAD_SAVED_VARIANT' | 'PROMOTE_CANDIDATE' | 'PROMOTE_VARIANT' | 'RESTORE_RECOVERED_DRAFT';
}>;

/**
 * What an action would do to the draft, read by running the pure reducer: the
 * id of the draft it would keep in Recovered drafts (or undefined), and
 * whether an older recovered draft would be pruned to make room.
 */
export function draftKeptBy(state: ProjectState, action: DraftReplacingAction): { keptId?: string; pruned: boolean } {
  const before = state.recoveredDrafts ?? [];
  const after = projectReducer(state, action).recoveredDrafts ?? [];
  const draft = state.workingLayout;
  const keptId = draft && after.some(l => l.id === draft.id && !before.includes(l)) ? draft.id : undefined;
  // Gone from the list, but not restored and not replaced by the kept draft (same hash).
  const restoredId = action.type === 'RESTORE_RECOVERED_DRAFT' ? action.payload.layoutId : null;
  const keptHash = keptId && draft ? hashLayout(draft) : null;
  const pruned = before.some(old =>
    old.id !== restoredId && !after.some(l => l.id === old.id) && hashLayout(old) !== keptHash);
  return { keptId, pruned };
}

export function useDraftReplacement() {
  const { state, dispatch, transact } = useProject();
  const toast = useToast();

  return useCallback((action: DraftReplacingAction, options?: { label?: string; alsoDispatch?: ProjectAction[] }) => {
    // The reducer is pure, so running it here says exactly what the dispatch will keep.
    const { keptId, pruned } = draftKeptBy(state, action);

    const run = () => {
      for (const extra of options?.alsoDispatch ?? []) dispatch(extra);
      dispatch(action);
    };
    if (options?.label) transact(options.label, run);
    else run();

    if (keptId) {
      toast.show({
        message: pruned
          ? 'Your draft was kept in Recovered drafts · the oldest recovered draft was removed'
          : 'Your draft was kept in Recovered drafts',
        action: {
          label: 'Restore',
          onClick: () => dispatch({ type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: keptId } }),
        },
      });
    }
  }, [state, dispatch, transact, toast]);
}
