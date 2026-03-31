/**
 * ProjectLibraryPage.
 *
 * Performance Practice Hub — the homepage.
 * Modern dark design with full-width hero, project card grid,
 * and sidebar with readiness score, quick actions, and practice stats.
 *
 * Uses IndexedDB for project listing (async), with localStorage fallback.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
} from '../components/Homepage/homepageDemoData';

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>([]);
  const [projectStates, setProjectStates] = useState<Map<string, ProjectState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'favorites'>('all');

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
  const gridProjects = useMemo(() => {
    let projects = savedProjects.slice(1);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      projects = projects.filter(p => p.name.toLowerCase().includes(q));
    }
    return projects.slice(0, 6);
  }, [savedProjects, searchQuery]);

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
      <div className="max-w-[1600px] mx-auto py-12 text-center px-8">
        <p className="text-sm text-[var(--text-secondary)] font-body">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 px-8 py-8">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tighter text-[var(--accent-primary)]">
            PushFlow
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="SEARCH PROJECTS..."
              className="w-80 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-10 pr-4 font-label text-xs uppercase tracking-widest text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition-colors"
            />
          </div>
          <button
            onClick={() => handleNewProject()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-card)] border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] font-headline font-bold rounded-xl hover:bg-[var(--accent-primary)]/5 transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </header>

      {/* ---- Hero Section ---- */}
      {heroProject ? (
        <ContinuePracticingHero
          project={heroProject}
          projectState={projectStates.get(heroProject.id) ?? null}
          onResume={() => navigate(`/project/${heroProject.id}`)}
          onOpenEditor={() => navigate(`/project/${heroProject.id}`)}
        />
      ) : (
        <section className="relative rounded-xl overflow-hidden" style={{ minHeight: 300 }}>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #131316 0%, #1a1a2e 30%, #16213e 60%, #0f0f1a 100%)',
            }}
          />
          <div className="relative flex flex-col items-center justify-center text-center p-16" style={{ minHeight: 300 }}>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
              Welcome to PushFlow
            </h2>
            <p className="text-[var(--text-secondary)] text-base font-body mb-6 max-w-md">
              Create your first performance to get started with layout optimization and practice tracking.
            </p>
            <button
              onClick={() => handleNewProject()}
              className="px-7 py-3 bg-gradient-to-br from-[var(--accent-primary)] to-[#1a3fcc] text-white font-headline font-bold rounded-xl flex items-center gap-2 inner-button-shadow hover:scale-[1.02] transition-transform"
            >
              <Plus size={16} />
              New Performance
            </button>
          </div>
        </section>
      )}

      {/* ---- Filter Tabs ---- */}
      <div className="flex items-center gap-4">
        <div className="flex bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-subtle)]">
          {(['all', 'recent', 'favorites'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-5 py-2 text-xs font-label uppercase tracking-widest rounded-lg transition-colors ${
                activeFilter === filter
                  ? 'bg-[var(--bg-card)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Content Grid: Projects + Sidebar ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Project Grid */}
        <div>
          <h2 className="font-label uppercase tracking-[0.15em] text-[var(--text-tertiary)] text-xs font-semibold mb-5">
            Active Performances
          </h2>

          {gridProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {gridProjects.map(entry => (
                <PerformanceCard
                  key={entry.id}
                  project={entry}
                  projectState={projectStates.get(entry.id) ?? null}
                  onOpen={() => navigate(`/project/${entry.id}`)}
                  onDelete={() => handleRemoveFromHistory(entry.id)}
                />
              ))}
              {/* Add placeholder */}
              {gridProjects.length < 6 && (
                <button
                  onClick={() => handleNewProject()}
                  className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-panel)] flex items-center justify-center min-h-[220px] hover:border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/5 transition-all group"
                >
                  <div className="text-center">
                    <span className="material-symbols-outlined text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] text-2xl transition-colors">
                      add
                    </span>
                    <span className="text-xs font-label uppercase tracking-widest text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] mt-2 block transition-colors">
                      Add Performance
                    </span>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-12 text-center">
              <p className="text-sm text-[var(--text-tertiary)] font-body">
                {searchQuery.trim()
                  ? 'No projects match your search.'
                  : 'No additional performances yet. Create one to see it here.'}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <ReadinessScoreCard data={readinessData} />
          <PracticeStatsCard stats={practiceStats} />
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
