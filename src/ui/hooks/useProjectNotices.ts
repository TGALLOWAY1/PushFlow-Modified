/**
 * Shows the one-time notices a project carries (S4.4: the mute-as-exclusion
 * migration's, projectNotices.ts) when it opens, each once, and drops them, so
 * the project is saved without them.
 */

import { useEffect, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { useToast } from '../components/shared/Toast';
import { projectNoticeMessage } from '../state/projectNotices';

/** Long enough to read two sentences and find the menu they point to. */
export const PROJECT_NOTICE_MS = 15_000;

export function useProjectNotices(): void {
  const { state, dispatch } = useProject();
  const toast = useToast();
  // Each notice once, even when effects run twice (StrictMode) before the dismissal lands.
  const shown = useRef(new Set<string>());
  const { id, pendingNotices, soundStreams } = state;

  useEffect(() => {
    for (const notice of pendingNotices) {
      const key = `${id}:${notice.id}`;
      if (shown.current.has(key)) continue;
      shown.current.add(key);
      const message = projectNoticeMessage(notice, soundStreams);
      if (message) toast.show({ message, durationMs: PROJECT_NOTICE_MS });
      dispatch({ type: 'DISMISS_NOTICE', payload: notice.id });
    }
  }, [id, pendingNotices, soundStreams, toast, dispatch]);
}
