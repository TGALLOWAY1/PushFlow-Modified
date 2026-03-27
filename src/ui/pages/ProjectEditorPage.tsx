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
import { loadProjectAsync } from '../persistence/projectStorage';
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

    // Load from Supabase
    let cancelled = false;
    loadProjectAsync(id)
      .then(state => {
        if (cancelled) return;
        setInitialState(state);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load project:', err);
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
