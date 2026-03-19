/**
 * ProjectLibraryPage.
 *
 * Performance Practice Hub — the homepage.
 * Shows a hero card for the most recent performance, a readiness gauge,
 * a two-row Active Performances grid, and sidebar cards for improvement
 * planning, quick actions, and practice stats.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { type ProjectState, createEmptyProjectState } from '../state/projectState';
import {
  listProjects,
  loadProject,
  saveProject,
  removeFromIndex,
  type ProjectLibraryEntry,
} from '../persistence/projectStorage';
import { generateId } from '../../utils/idGenerator';

import { ContinuePracticingHero } from '../components/Homepage/ContinuePracticingHero';
import { ReadinessScoreCard } from '../components/Homepage/ReadinessScoreCard';
import { PerformanceCard } from '../components/Homepage/PerformanceCard';
import { ImprovementPlanCard } from '../components/Homepage/ImprovementPlanCard';
import { SuggestedSimilaritiesCard } from '../components/Homepage/SuggestedSimilaritiesCard';
import { QuickActionsCard } from '../components/Homepage/QuickActionsCard';
import { PracticeStatsCard } from '../components/Homepage/PracticeStatsCard';
import {
  getReadinessData,
  getImprovementPlan,
  getSuggestedSimilarities,
  getPracticeStats,
  getProjectMockData,
} from '../components/Homepage/homepageDemoData';

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>(() => listProjects());

  // Load full ProjectState for each project (for MiniGridPreview thumbnails)
  const projectStates = useMemo(() => {
    const map = new Map<string, ProjectState>();
    for (const entry of savedProjects) {
      const state = loadProject(entry.id);
      if (state) map.set(entry.id, state);
    }
    return map;
  }, [savedProjects]);

  // Hero project = most recently updated (index 0, already sorted)
  const heroProject = savedProjects.length > 0 ? savedProjects[0] : null;
  // Grid projects = remaining (up to 6 for the 3x2 grid)
  const gridProjects = savedProjects.slice(1, 7);

  // Mock data (stable across renders)
  const readinessData = useMemo(() => getReadinessData(), []);
  const improvementPlan = useMemo(() => getImprovementPlan(), []);
  const similarities = useMemo(() => getSuggestedSimilarities(), []);
  const practiceStats = useMemo(() => getPracticeStats(), []);

  // ---- Handlers ----

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

  const handleRemoveFromHistory = useCallback((id: string) => {
    removeFromIndex(id);
    setSavedProjects(listProjects());
  }, []);

  // ---- Render ----

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">PUSHFLOW</h1>
          <p className="text-gray-500 text-[11px] tracking-wide">Performance Practice Hub</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-gray-800 rounded-lg text-gray-400 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-48"
            />
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors"
          >
            <Plus size={14} />
            New Performance
          </button>
        </div>
      </div>

      {/* ---- Top Row: Hero + Readiness ---- */}
      {heroProject ? (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <ContinuePracticingHero
            project={heroProject}
            projectState={projectStates.get(heroProject.id) ?? null}
            mockData={getProjectMockData(heroProject.id)}
            onResume={() => navigate(`/project/${heroProject.id}`)}
            onOpenEditor={() => navigate(`/project/${heroProject.id}`)}
          />
          <ReadinessScoreCard data={readinessData} />
        </div>
      ) : (
        <div className="glass-panel-strong rounded-xl p-12 text-center">
          <h2 className="text-lg font-medium mb-2">Welcome to PushFlow</h2>
          <p className="text-gray-400 text-sm mb-4">
            Create your first performance to get started with layout optimization.
          </p>
          <button
            onClick={handleNewProject}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            + New Performance
          </button>
        </div>
      )}

      {/* ---- Main Area: Performance Grid + Sidebar ---- */}
      <div className="grid grid-cols-[1fr_340px] gap-4">
        {/* Active Performances */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400">Active Performances</h2>
            {savedProjects.length > 7 && (
              <span className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
                View all {savedProjects.length - 1}
              </span>
            )}
          </div>

          {gridProjects.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {gridProjects.map(entry => (
                <PerformanceCard
                  key={entry.id}
                  project={entry}
                  projectState={projectStates.get(entry.id) ?? null}
                  mockData={getProjectMockData(entry.id)}
                  onOpen={() => navigate(`/project/${entry.id}`)}
                  onDelete={() => handleRemoveFromHistory(entry.id)}
                />
              ))}
              {/* Add placeholder if fewer than 6 */}
              {gridProjects.length < 6 && (
                <button
                  onClick={handleNewProject}
                  className="glass-panel rounded-lg p-3 border-dashed flex items-center justify-center min-h-[180px] hover:border-gray-600 transition-colors group"
                >
                  <div className="text-center">
                    <Plus size={20} className="mx-auto text-gray-600 group-hover:text-gray-500 transition-colors" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-500 mt-1 block transition-colors">
                      Add Performance
                    </span>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-lg p-8 text-center">
              <p className="text-xs text-gray-500">
                No additional performances yet. Create one to see it here.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ImprovementPlanCard items={improvementPlan} />
          <SuggestedSimilaritiesCard items={similarities} />
          <QuickActionsCard onNewProject={handleNewProject} onNavigate={navigate} />
          <PracticeStatsCard stats={practiceStats} />
        </div>
      </div>
    </div>
  );
}
