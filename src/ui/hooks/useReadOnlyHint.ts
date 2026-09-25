/**
 * Looking never writes (S3.2, T01): while the grid shows a layout edits don't
 * go to, every edit gesture (a drop from the Sounds or Presets panel, a pad
 * drag, click-to-place, the pad menu, the pad's ×, Delete, the selected note's
 * finger controls) is refused with a hint saying how to edit it instead. The
 * reducer refuses the edit too (isLayoutEditAction); this is what the user sees.
 */

import { useCallback, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { isReplayingTrace, resolveInspectedLayout, type ProjectState } from '../state/projectState';
import { useToast } from '../components/shared/Toast';

/** The hint for a candidate, a saved variant or a recovered draft. */
export const USE_AS_DRAFT_HINT = 'Use as my draft to edit';
/** The hint while the Active Layout is viewed over a differing draft. */
export const VIEWING_ACTIVE_HINT = 'Viewing Active · Back to my draft to edit';
/** The hint while the grid replays a step of the optimizer trace. */
export const REPLAY_HINT = 'Exit the trace replay to edit';

/** Why the layout on screen can't be edited, or null when it can. */
export function readOnlyHint(state: ProjectState): string | null {
  const shown = resolveInspectedLayout(state);
  if (shown.readOnly) return shown.role === 'active' ? VIEWING_ACTIVE_HINT : USE_AS_DRAFT_HINT;
  return isReplayingTrace(state) ? REPLAY_HINT : null;
}

/** Hints shown within this many ms of the last one are dropped (a drag fires dragover many times a second). */
const HINT_INTERVAL_MS = 1500;

/**
 * The hint for the layout on screen, and `refuse()`: when the layout is read-only
 * it shows the hint in a toast and returns true (the caller then does nothing),
 * otherwise it returns false.
 */
export function useReadOnlyHint(): { hint: string | null; refuse: () => boolean } {
  const { state } = useProject();
  const toast = useToast();
  const hint = readOnlyHint(state);
  const hintRef = useRef(hint);
  hintRef.current = hint;
  const last = useRef<{ id: number; at: number } | null>(null);

  const refuse = useCallback(() => {
    const current = hintRef.current;
    if (!current) return false;
    const now = Date.now();
    if (last.current && now - last.current.at < HINT_INTERVAL_MS) return true;
    if (last.current) toast.dismiss(last.current.id);
    last.current = { id: toast.show({ message: current, durationMs: 4000 }), at: now };
    return true;
  }, [toast]);

  return { hint, refuse };
}
