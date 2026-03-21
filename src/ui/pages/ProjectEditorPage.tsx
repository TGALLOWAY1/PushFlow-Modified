/**
 * ProjectEditorPage.
 *
 * Single coupled performance workspace for timeline editing, pattern
 * generation, grid layout assignment, and analysis.
 *
 * Loads project from IndexedDB (async), falls back to localStorage.
 * Provides autosave via useAutoSave hook.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type ProjectState } from '../state/projectState';
import { ProjectProvider } from '../state/ProjectContext';
import { loadProjectAsync, loadProject } from '../persistence/projectStorage';
import { PerformanceWorkspace } from '../components/workspace/PerformanceWorkspace';

export function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initialState, setInitialState] = useState<ProjectState | null | 'loading'>('loading');

  useEffect(() => {
    if (!id) {
      setInitialState(null);
      return;
    }

    // Try async (IndexedDB) first, then sync fallback
    let cancelled = false;
    loadProjectAsync(id)
      .then(state => {
        if (cancelled) return;
        if (state) {
          setInitialState(state);
        } else {
          // Sync fallback for edge cases
          const syncState = loadProject(id);
          setInitialState(syncState);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const syncState = loadProject(id);
        setInitialState(syncState);
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
        <p className="text-pf-sm text-[var(--text-secondary)] mb-4">Project not found.</p>
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
      <ProjectContent />
    </ProjectProvider>
  );
}

function ProjectContent() {
  return <PerformanceWorkspace />;
}
