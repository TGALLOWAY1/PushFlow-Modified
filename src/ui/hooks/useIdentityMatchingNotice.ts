/**
 * One-time note for S1a.3 (T18): Sounds are now matched to pads by identity,
 * never by MIDI pitch, so scores of existing projects can change. Shown once
 * per browser, and only for a project created before the change shipped (a
 * newer project never saw pitch-matched scores).
 */

import { useEffect } from 'react';
import { useToast } from '../components/shared/Toast';
import { type ProjectState } from '../state/projectState';

export const IDENTITY_MATCHING_NOTICE_KEY = 'pf.notice.identity-matching';
/** When Sounds stopped being matched by pitch (S1a.3). */
export const IDENTITY_MATCHING_SHIPPED = '2026-09-24T00:00:00.000Z';
export const IDENTITY_MATCHING_MESSAGE = 'Scores changed: Sounds are now matched by identity, not pitch.';

type NoticeInput = Pick<ProjectState, 'createdAt' | 'soundStreams'>;

/** Whether the note is due: an older project with Sounds, in a browser that has not seen it. */
export function shouldShowIdentityMatchingNotice(
  state: NoticeInput,
  storage: Pick<Storage, 'getItem'> | null,
): boolean {
  if (state.soundStreams.length === 0) return false;
  const created = new Date(state.createdAt).getTime();
  if (!(created < new Date(IDENTITY_MATCHING_SHIPPED).getTime())) return false;
  try {
    return storage?.getItem(IDENTITY_MATCHING_NOTICE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function useIdentityMatchingNotice(state: Pick<ProjectState, 'id'> & NoticeInput): void {
  const toast = useToast();
  const { id, createdAt, soundStreams } = state;
  const soundCount = soundStreams.length;
  useEffect(() => {
    const storage = typeof localStorage === 'undefined' ? null : localStorage;
    if (!shouldShowIdentityMatchingNotice({ createdAt, soundStreams }, storage)) return;
    try {
      storage?.setItem(IDENTITY_MATCHING_NOTICE_KEY, '1');
    } catch {
      // Storage unavailable: the note still shows this once.
    }
    toast.show({ message: IDENTITY_MATCHING_MESSAGE, durationMs: 12_000 });
    // Re-checked when the project or its Sound count changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, createdAt, soundCount, toast]);
}
