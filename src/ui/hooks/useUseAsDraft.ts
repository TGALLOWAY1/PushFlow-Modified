/**
 * "Use as my draft" (S3.2, T01): the one way a candidate, a saved variant or a
 * recovered draft becomes the Working/Test Layout. Looking at it never did;
 * this is the named action, one undo step, confirmed by a toast with Undo.
 *
 * When a draft that differs from Active would be replaced, the caller first
 * asks (UseAsDraftButton): "Save my draft as a variant first" keeps it as a
 * Saved Layout Variant in the same step, "Replace (undoable)" replaces it, and
 * the reducer still keeps it in Recovered drafts (S1a.2), so it survives a
 * reload even past Undo's reach.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { hasWorkingChanges, type ProjectAction, type ProjectState } from '../state/projectState';
import { candidateSubject, layoutSubject } from '../state/layoutSubject';
import { suggestVariantName } from '../state/variantNames';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../components/shared/Toast';
import { draftKeptBy, type DraftReplacingAction } from './useDraftReplacement';

/** A layout that can become the draft. */
export interface DraftSource {
  kind: 'candidate' | 'variant' | 'recovered';
  id: string;
}

/** The undo step's name, and the Undo button's ("Undo: Use as my draft"). */
export const USE_AS_DRAFT_LABEL = 'Use as my draft';

function actionFor(source: DraftSource): DraftReplacingAction {
  switch (source.kind) {
    case 'candidate': return { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: source.id } };
    case 'variant': return { type: 'LOAD_SAVED_VARIANT', payload: { variantId: source.id } };
    case 'recovered': return { type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: source.id } };
  }
}

/** How the toast names the source: "Candidate A", "Wide hands", "Draft of Default". */
function sourceName(state: ProjectState, source: DraftSource): string | null {
  if (source.kind === 'candidate') {
    const candidate = state.candidates.find(c => c.id === source.id);
    return candidate ? candidateSubject(state.candidates, candidate).chip : null;
  }
  const layout = source.kind === 'variant'
    ? state.savedVariants.find(v => v.id === source.id)
    : (state.recoveredDrafts ?? []).find(l => l.id === source.id);
  return layout ? layoutSubject(layout, source.kind).name : null;
}

export function useUseAsDraft() {
  const { state, dispatch, transact, undo, undoLabel } = useProject();
  const toast = useToast();
  const toastRef = useRef<number | null>(null);

  // The toast's Undo is offered only while this step is the one Undo reverts.
  useEffect(() => {
    if (toastRef.current !== null && undoLabel !== USE_AS_DRAFT_LABEL) {
      toast.dismiss(toastRef.current);
      toastRef.current = null;
    }
  }, [undoLabel, toast]);

  /** A draft that differs from Active would be replaced: ask first. */
  const needsChoice = hasWorkingChanges(state);

  const apply = useCallback((source: DraftSource, options: { saveDraftFirst?: boolean } = {}) => {
    const name = sourceName(state, source);
    if (!name) return;
    const action = actionFor(source);
    const draft = state.workingLayout;
    const saveFirst = !!options.saveDraftFirst && !!draft && hasWorkingChanges(state);
    // "Default – 25 Sep 14:02", numbered when taken, as the reducer will keep it.
    const savedName = saveFirst ? suggestVariantName(draft!.name, state.savedVariants.map(v => v.name)) : null;
    const { keptId } = saveFirst ? { keptId: undefined } : draftKeptBy(state, action);

    transact(USE_AS_DRAFT_LABEL, () => {
      if (savedName) {
        const saveAction: ProjectAction = {
          type: 'SAVE_AS_VARIANT',
          payload: { name: savedName, source: 'working', variantId: generateId('variant') },
        };
        dispatch(saveAction);
      }
      dispatch(action);
    });

    if (toastRef.current !== null) toast.dismiss(toastRef.current);
    toastRef.current = toast.show({
      message: `${name} is now your draft${savedName
        ? ` · your draft was saved as "${savedName}"`
        : keptId ? ' · your old draft is in Recovered drafts' : ''}`,
      action: { label: 'Undo', onClick: undo },
    });
  }, [state, dispatch, transact, undo, toast]);

  return { needsChoice, apply };
}
