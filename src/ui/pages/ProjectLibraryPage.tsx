/**
 * ProjectLibraryPage.
 *
 * Performance Practice Hub — the homepage.
 * Shows a hero card for the most recent performance, a readiness gauge,
 * a two-row Active Performances grid, and sidebar cards for improvement
 * planning, quick actions, and practice stats.
 *
 * Uses IndexedDB for project listing (async), with localStorage fallback.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { type ProjectState, createEmptyProjectState } from '../state/projectState';
import {
  listProjectsAsync,
  saveProjectAsync,
  deleteProjectAsync,
  loadProjectAsync,
  type ProjectLibraryEntry,
} from '../persistence/projectStorage';
import { generateId } from '../../utils/idGenerator';

import { ContinuePracticingHero } from '../components/Homepage/ContinuePracticingHero';
import { ReadinessScoreCard } from '../components/Homepage/ReadinessScoreCard';
import { PerformanceCard } from '../components/Homepage/PerformanceCard';
import { QuickActionsCard } from '../components/Homepage/QuickActionsCard';
import { PracticeStatsCard } from '../components/Homepage/PracticeStatsCard';
import {
  getReadinessData,
  getPracticeStats,
  getProjectMockData,
} from '../components/Homepage/homepageDemoData';

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>([]);
  const [projectStates, setProjectStates] = useState<Map<string, ProjectState>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load project list from IndexedDB
  const refreshProjects = useCallback(async () => {
    try {
      const entries = await listProjectsAsync();
      setSavedProjects(entries);

      // Load full states for thumbnails
      const stateMap = new Map<string, ProjectState>();
      for (const entry of entries) {
        try {
          const state = await loadProjectAsync(entry.id);
          if (state) stateMap.set(entry.id, state);
        } catch {
          // Skip failed loads
        }
      }
      setProjectStates(stateMap);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Hero project = most recently updated (index 0, already sorted)
  const heroProject = savedProjects.length > 0 ? savedProjects[0] : null;
  // Grid projects = remaining (up to 6 for the 3x2 grid)
  const gridProjects = savedProjects.slice(1, 7);

  // Mock data (stable across renders)
  const readinessData = useMemo(() => getReadinessData(), []);
  const practiceStats = useMemo(() => getPracticeStats(), []);

  // ---- Handlers ----

  const handleNewProject = useCallback(async (queryParams: string = '') => {
    const now = new Date().toISOString();
    const id = generateId('proj');
    const state: ProjectState = {
      ...createEmptyProjectState(),
      id,
      name: 'Untitled Project',
      createdAt: now,
      updatedAt: now,
    };
    await saveProjectAsync(state);
    navigate(`/project/${id}${queryParams}`);
  }, [navigate]);

  const handleRemoveFromHistory = useCallback(async (id: string) => {
    await deleteProjectAsync(id);
    refreshProjects();
  }, [refreshProjects]);

  // ---- Render ----

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto py-12 text-center px-6">
        <p className="text-pf-sm text-[var(--text-secondary)]">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 px-6 py-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-pf-xl font-bold tracking-tight text-[var(--text-primary)]">PUSHFLOW</h1>
          <p className="text-[var(--text-tertiary)] text-pf-sm tracking-wide mt-0.5">Performance Practice Hub</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search..."
              className="pf-input pl-8 pr-3 py-1.5 text-pf-sm w-52"
            />
          </div>
          <button
            onClick={() => handleNewProject()}
            className="pf-btn pf-btn-primary text-pf-sm gap-1.5"
            style={{ background: '#059669' }}
          >
            <Plus size={13} />
            New Performance
          </button>
        </div>
      </div>

      {/* ---- Top Row: Hero + Readiness + Practice Stats ---- */}
      {heroProject ? (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <ContinuePracticingHero
            project={heroProject}
            projectState={projectStates.get(heroProject.id) ?? null}
            mockData={getProjectMockData(heroProject.id)}
            onResume={() => navigate(`/project/${heroProject.id}`)}
            onOpenEditor={() => navigate(`/project/${heroProject.id}`)}
          />
          <div className="flex flex-col gap-4">
            <ReadinessScoreCard data={readinessData} />
            <PracticeStatsCard stats={practiceStats} />
          </div>
        </div>
      ) : (
        <div className="glass-panel-strong p-12 text-center">
          <h2 className="text-pf-lg font-medium mb-2 text-[var(--text-primary)]">Welcome to PushFlow</h2>
          <p className="text-[var(--text-secondary)] text-pf-sm mb-5">
            Create your first performance to get started with layout optimization.
          </p>
          <button
            onClick={() => handleNewProject()}
            className="pf-btn text-pf-sm font-medium text-white px-5 py-2"
            style={{ background: '#059669' }}
          >
            + New Performance
          </button>
        </div>
      )}

      {/* ---- Main Area: Performance Grid + Sidebar ---- */}
      <div className="grid grid-cols-[1fr_340px] gap-4">
        {/* Active Performances */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-pf-sm font-medium text-[var(--text-secondary)]">Active Performances</h2>
            {savedProjects.length > 7 && (
              <span className="text-pf-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
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
                  onClick={() => handleNewProject()}
                  className="rounded-pf-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-panel)] flex items-center justify-center min-h-[180px] hover:border-[var(--border-strong)] transition-colors group"
                >
                  <div className="text-center">
                    <Plus size={18} className="mx-auto text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                    <span className="text-pf-xs text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] mt-1.5 block transition-colors">
                      Add Performance
                    </span>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center">
              <p className="text-pf-sm text-[var(--text-tertiary)]">
                No additional performances yet. Create one to see it here.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <QuickActionsCard 
            onNewProject={handleNewProject} 
            onNavigate={navigate} 
            heroProjectId={heroProject?.id}
          />
        </div>
      </div>
    </div>
  );
}
