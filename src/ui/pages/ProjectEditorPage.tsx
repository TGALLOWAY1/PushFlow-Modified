/**
 * ProjectEditorPage.
 *
 * Single coupled performance workspace for timeline editing, pattern
 * generation, grid layout assignment, and analysis.
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectProvider } from '../state/ProjectContext';
import { loadProject } from '../persistence/projectStorage';
import { PerformanceWorkspace } from '../components/workspace/PerformanceWorkspace';

export function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const initialState = useMemo(() => {
    if (!id) return null;
    return loadProject(id);
  }, [id]);

  if (!initialState) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-400 mb-4">Project not found.</p>
        <button
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
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
