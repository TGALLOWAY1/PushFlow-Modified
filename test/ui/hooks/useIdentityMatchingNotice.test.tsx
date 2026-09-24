// @vitest-environment happy-dom
/**
 * The one-time "Scores changed" note (S1a.3, T18): shown once per browser,
 * only for a project created before Sounds stopped being matched by pitch.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToastProvider } from '../../../src/ui/components/shared/Toast';
import {
  IDENTITY_MATCHING_MESSAGE,
  IDENTITY_MATCHING_NOTICE_KEY,
  shouldShowIdentityMatchingNotice,
  useIdentityMatchingNotice,
} from '../../../src/ui/hooks/useIdentityMatchingNotice';
import { type SoundStream } from '../../../src/ui/state/projectState';

const sound: SoundStream = { id: 's1', name: 'Kick', color: '#444', originalMidiNote: 36, events: [], muted: false };
const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-12-01T00:00:00.000Z';

function Host({ createdAt, sounds }: { createdAt: string; sounds: SoundStream[] }) {
  useIdentityMatchingNotice({ id: 'p1', createdAt, soundStreams: sounds });
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('shouldShowIdentityMatchingNotice', () => {
  const storage = (seen: boolean) => ({ getItem: (key: string) => (seen && key === IDENTITY_MATCHING_NOTICE_KEY ? '1' : null) });

  it('is due for an older project with Sounds that this browser has not seen', () => {
    expect(shouldShowIdentityMatchingNotice({ createdAt: OLD, soundStreams: [sound] }, storage(false))).toBe(true);
  });

  it('is not due for a newer project, an empty project, or after it was shown', () => {
    expect(shouldShowIdentityMatchingNotice({ createdAt: NEW, soundStreams: [sound] }, storage(false))).toBe(false);
    expect(shouldShowIdentityMatchingNotice({ createdAt: OLD, soundStreams: [] }, storage(false))).toBe(false);
    expect(shouldShowIdentityMatchingNotice({ createdAt: OLD, soundStreams: [sound] }, storage(true))).toBe(false);
  });
});

describe('useIdentityMatchingNotice', () => {
  it('shows the note once and remembers it', () => {
    render(<ToastProvider><Host createdAt={OLD} sounds={[sound]} /></ToastProvider>);
    expect(screen.getByTestId('toast').textContent).toContain(IDENTITY_MATCHING_MESSAGE);
    expect(localStorage.getItem(IDENTITY_MATCHING_NOTICE_KEY)).toBe('1');
    cleanup();
    render(<ToastProvider><Host createdAt={OLD} sounds={[sound]} /></ToastProvider>);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('shows nothing for a project created after the change', () => {
    render(<ToastProvider><Host createdAt={NEW} sounds={[sound]} /></ToastProvider>);
    expect(screen.queryByTestId('toast')).toBeNull();
    expect(localStorage.getItem(IDENTITY_MATCHING_NOTICE_KEY)).toBeNull();
  });
});
