/**
 * ProjectLibraryPage.
 *
 * Browse, create, open, and manage projects.
 * MIDI import happens inside the editor workspace via useLaneImport.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ProjectState, createEmptyProjectState } from '../state/projectState';
import { listProjects, saveProject, removeFromIndex, clearProjectIndex, type ProjectLibraryEntry } from '../persistence/projectStorage';
import { generateId } from '../../utils/idGenerator';

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>(() => listProjects());

  // ---- New Blank Project ----

  const handleNewProject = useCallback(() => {
    const now = new Date().toISOString();
    const id = generateId('proj');

    const state: ProjectState = {
      ...createEmptyProjectState(),
      id,
      name: 'Untitled Project',
      createdAt: now,
      updatedAt: now,
    };

    saveProject(state);
    setSavedProjects(listProjects());
    navigate(`/project/${id}`);
  }, [navigate]);

  // ---- Project Actions ----

  const handleOpenProject = useCallback((id: string) => {
    navigate(`/project/${id}`);
  }, [navigate]);

  const handleRemoveFromHistory = useCallback((id: string) => {
    removeFromIndex(id);
    setSavedProjects(listProjects());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearProjectIndex();
    setSavedProjects([]);
  }, []);

  // ---- Render ----

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">PushFlow</h1>
        <p className="text-gray-400 text-sm">Performance Ergonomics Optimizer for Ableton Push 3</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium text-white transition-colors"
          onClick={handleNewProject}
        >
          + New Project
        </button>
        <button
          className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500/80 rounded text-sm font-medium text-white transition-colors"
          onClick={() => navigate('/validator')}
        >
          Constraint Validator
        </button>
        <button
          className="px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500/80 rounded text-sm font-medium text-white transition-colors"
          onClick={() => navigate('/temporal-evaluator')}
        >
          Temporal Evaluator
        </button>
      </div>

      {/* Saved Projects */}
      {savedProjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400">Your Projects</h2>
            <button
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
              onClick={handleClearHistory}
            >
              Clear All
            </button>
          </div>
          <div className="space-y-1">
            {savedProjects.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => handleOpenProject(entry.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{entry.name}</span>
                    {entry.difficulty && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        entry.difficulty === 'Easy' ? 'bg-green-500/15 text-green-400' :
                        entry.difficulty === 'Moderate' ? 'bg-yellow-500/15 text-yellow-400' :
                        entry.difficulty === 'Hard' ? 'bg-orange-500/15 text-orange-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {entry.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {entry.soundCount} sounds, {entry.eventCount} events
                    <span className="mx-1">·</span>
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  className="text-gray-600 hover:text-gray-400 text-sm px-1.5 py-0.5 transition-colors"
                  onClick={e => { e.stopPropagation(); handleRemoveFromHistory(entry.id); }}
                  title="Remove from history"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
