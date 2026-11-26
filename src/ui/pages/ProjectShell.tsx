/**
 * ProjectShell (S9.2).
 *
 * The parent of a project's pages: the editor at /project/:id and the
 * Performance Route at /project/:id/route. It loads the project once and
 * holds what both pages share, so switching between them keeps the project,
 * its undo history and the transport (playback carries on):
 * - ProjectProvider (the project and its history);
 * - LayoutActionsProvider (one Promote and Keep, and the warning before the
 *   page closes while unkept candidates exist, S3.3);
 * - ViewSettingsProvider and TransportProvider (S4.3a: one transport).
 *
 * Loads from IndexedDB, falling back to localStorage. Each page runs its own
 * autosave and analysis hooks.
 */

import { Suspense, useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { type ProjectState } from '../state/projectState';
import { ProjectProvider } from '../state/ProjectContext';
import { loadProjectAsync, markProjectOpened } from '../persistence/projectStorage';
import { LayoutActionsProvider } from '../hooks/useLayoutActions';
import { ViewSettingsProvider } from '../state/viewSettings';
import { TransportProvider } from '../audio/TransportProvider';

export function ProjectShell() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initialState, setInitialState] = useState<ProjectState | null | 'loading'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    setInitialState('loading');
    if (!id) {
      setInitialState(null);
      return;
    }

    // Storage owns legacy recovery and the backup-before-migration boundary.
    let cancelled = false;
    loadProjectAsync(id)
      .then(state => {
        if (cancelled) return;
        if (state) {
          // Opening is recorded for the Library (last opened, T52) without
          // touching updatedAt, and the loaded state carries the same time so
          // a later autosave writes it back unchanged.
          const openedAt = new Date().toISOString();
          setInitialState({ ...state, lastOpenedAt: openedAt });
          void markProjectOpened(id, openedAt).catch(() => {});
        } else {
          setInitialState(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
        setInitialState(null);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (initialState === 'loading') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-pf-sm text-[var(--text-secondary)]">Loading project...</p>
      </div>
    );
  }

  if (!initialState) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p role={loadFailed ? 'alert' : undefined} className="text-pf-sm text-[var(--text-secondary)] mb-4">
          {loadFailed ? 'Could not open project. Try reopening it from the Library.' : 'Project not found.'}
        </p>
        <button
          className="pf-btn pf-btn-subtle text-pf-sm"
          onClick={() => navigate('/')}
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <ProjectProvider initialState={initialState}>
      <LayoutActionsProvider>
        <ViewSettingsProvider>
          <TransportProvider>
            {/* A page still loading suspends here, inside the providers, so
                the project and the transport stay mounted while it does. */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </TransportProvider>
        </ViewSettingsProvider>
      </LayoutActionsProvider>
    </ProjectProvider>
  );
}
