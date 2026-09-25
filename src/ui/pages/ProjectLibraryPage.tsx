/**
 * ProjectLibraryPage: the Library, where projects start and are reopened.
 *
 * S2.3 (T51, T52, T53): "Import MIDI" is the primary way in. It accepts a
 * MIDI file (a new project named after it, nothing placed) or a PushFlow
 * project file, recognised by content. "Open demo project" does the same with
 * the bundled TEST MIDI 1. The hero is the project opened last; every card
 * shows real data only, a thumbnail of the layout the project opens on, and
 * one "⋯" menu (Rename, Duplicate, Export, Delete with a 10 s Undo).
 *
 * Uses IndexedDB for project listing (async), with localStorage fallback.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search } from 'lucide-react';
import { type ProjectState } from '../state/projectState';
import {
  listProjectsAsync,
  saveProjectAsync,
  loadProjectAsync,
  exportProjectToFile,
  importProjectFromFile,
  listBackedUpProjectIds,
  downloadProjectBackup,
  renameProjectAsync,
  duplicateProjectAsync,
  deleteProjectWithUndo,
  restoreDeletedProject,
  type ProjectLibraryEntry,
} from '../persistence/projectStorage';
import {
  DEMO_PROJECT_NAME,
  fetchDemoMidi,
  newProjectState,
  pickedFileKind,
  projectFromMidiFiles,
} from '../persistence/newProject';
import { lastOpenedProject } from '../persistence/projectIndex';
import { generateId } from '../../utils/idGenerator';
import { uniqueName } from '../../utils/uniqueName';
import { saveSerializedLoopState } from '../persistence/loopStorage';
import { useToast } from '../components/shared/Toast';

import { ProjectHero } from '../components/Homepage/ProjectHero';
import { ProjectCard } from '../components/Homepage/ProjectCard';
import { type ProjectMenuActions } from '../components/Homepage/ProjectMenu';
import { QuickActionsCard } from '../components/Homepage/QuickActionsCard';
import { LibraryStatsCard } from '../components/Homepage/LibraryStatsCard';

const DELETE_UNDO_MS = 10_000;

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : 'unknown error');

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>([]);
  const [projectStates, setProjectStates] = useState<Map<string, ProjectState>>(new Map());
  const [backedUpIds, setBackedUpIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

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
      // After the loads above, which back up and migrate old records.
      try {
        setBackedUpIds(await listBackedUpProjectIds());
      } catch {
        setBackedUpIds(new Set());
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // The hero is the project opened last; the grid lists the rest (or, while
  // searching, every match), most recently opened or created first.
  const heroProject = useMemo(() => lastOpenedProject(savedProjects), [savedProjects]);
  const gridProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) return savedProjects.filter(p => p.name.toLowerCase().includes(q));
    return savedProjects.filter(p => p.id !== heroProject?.id);
  }, [savedProjects, searchQuery, heroProject]);

  // ---- Starting projects ----

  const handleNewProject = useCallback(async (queryParams: string = '') => {
    const state = newProjectState();
    await saveProjectAsync(state);
    navigate(`/project/${state.id}${queryParams}`);
  }, [navigate]);

  /** A new project from MIDI files (the picked file, or the demo), saved and opened with nothing placed. */
  const startFromMidi = useCallback(async (files: File[], name?: string) => {
    const { state, importedCount } = await projectFromMidiFiles(files, name);
    await saveProjectAsync(state);
    toast.show({ message: `Created "${state.name}" · ${importedCount} ${importedCount === 1 ? 'Sound' : 'Sounds'}, nothing placed yet` });
    navigate(`/project/${state.id}`);
  }, [navigate, toast]);

  const handleOpenDemo = useCallback(async () => {
    setImportError(null);
    setBusy('Opening the demo project…');
    try {
      await startFromMidi([await fetchDemoMidi()], DEMO_PROJECT_NAME);
    } catch (err) {
      setImportError(`The demo project couldn't be opened: ${errorText(err)}`);
    } finally {
      setBusy(null);
    }
  }, [startFromMidi]);

  const importProjectFile = useCallback(async (file: File) => {
    const result = await importProjectFromFile(file);
    if (!result.ok) {
      setImportError(`"${file.name}" isn't a PushFlow project file PushFlow can read (${result.error}).`);
      return;
    }
    // Never overwrite an existing project on import: a colliding id gets a new
    // one, and the copy a numbered name.
    let state = result.state;
    const existing = await loadProjectAsync(state.id);
    if (existing) {
      state = { ...state, id: generateId('proj'), name: uniqueName(state.name, savedProjects.map(p => p.name)) };
    }
    // Imported, not opened yet.
    await saveProjectAsync({ ...state, lastOpenedAt: '' });
    // The Composer's pattern travels with the file; put it back under the
    // imported project's id (which may be new).
    if (result.composerPattern) saveSerializedLoopState(state.id, result.composerPattern);
    await refreshProjects();
    const id = state.id;
    toast.show({ message: `Imported "${state.name}"`, action: { label: 'Open', onClick: () => navigate(`/project/${id}`) } });
  }, [refreshProjects, savedProjects, toast, navigate]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError(null);
    setBusy(`Importing "${file.name}"…`);
    try {
      const kind = await pickedFileKind(file);
      if (kind === 'midi') {
        try {
          await startFromMidi([file]);
        } catch (err) {
          setImportError(`"${file.name}" couldn't be read as MIDI: ${errorText(err)}`);
        }
      } else if (kind === 'project') {
        await importProjectFile(file);
      } else {
        setImportError(`"${file.name}" isn't a MIDI file (.mid or .midi) or a PushFlow project file (.pushflow.json).`);
      }
    } finally {
      setBusy(null);
    }
  }, [startFromMidi, importProjectFile]);

  // ---- One menu for the hero and the cards ----

  const handleRenameDone = useCallback(async (entry: ProjectLibraryEntry, name: string | null) => {
    setRenamingId(null);
    if (!name || name === entry.name) return;
    await renameProjectAsync(entry.id, name);
    await refreshProjects();
  }, [refreshProjects]);

  const handleDuplicate = useCallback(async (entry: ProjectLibraryEntry) => {
    const copyId = await duplicateProjectAsync(entry.id, savedProjects.map(p => p.name));
    if (!copyId) return;
    await refreshProjects();
    toast.show({ message: `Duplicated "${entry.name}"`, action: { label: 'Open', onClick: () => navigate(`/project/${copyId}`) } });
  }, [savedProjects, refreshProjects, toast, navigate]);

  const handleExportProject = useCallback(async (id: string) => {
    const state = projectStates.get(id) ?? await loadProjectAsync(id);
    if (!state) return;
    // The file carries the Composer's pattern too (it lives in localStorage
    // until P8 moves it into the project), and the toast says so (T57).
    const { composerPatternIncluded } = exportProjectToFile(state);
    toast.show({ message: composerPatternIncluded ? 'Exported · Composer pattern included' : 'Exported' });
  }, [projectStates, toast]);

  // Deleting acts at once; Undo within 10 s puts the stored record back
  // exactly (same id, layouts and variants), with its backups (T53).
  const handleDeleteProject = useCallback(async (entry: ProjectLibraryEntry) => {
    const deleted = await deleteProjectWithUndo(entry.id);
    if (!deleted) return;
    await refreshProjects();
    toast.show({
      message: `Deleted "${entry.name}"`,
      durationMs: DELETE_UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          void restoreDeletedProject(deleted).then(async () => {
            await refreshProjects();
            toast.show({ message: `Restored "${entry.name}"` });
          });
        },
      },
    });
  }, [refreshProjects, toast]);

  const actionsFor = (entry: ProjectLibraryEntry): ProjectMenuActions => ({
    onRename: () => setRenamingId(entry.id),
    onDuplicate: () => { void handleDuplicate(entry); },
    onExport: () => { void handleExportProject(entry.id); },
    onDownloadBackup: backedUpIds.has(entry.id) ? () => { void downloadProjectBackup(entry.id, entry.name); } : undefined,
    onDelete: () => { void handleDeleteProject(entry); },
  });

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
      <header className="flex items-center justify-between gap-6">
        <h1 className="font-headline text-2xl font-bold tracking-tighter text-accent-primary-soft">
          PushFlow
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="w-72 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-9 pr-4 text-pf-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary-soft)] focus:border-[var(--accent-primary-soft)] placeholder:text-[var(--text-tertiary)] outline-none transition-colors"
            />
          </div>
          <input
            ref={importInputRef}
            type="file"
            data-testid="library-import-input"
            accept=".mid,.midi,audio/midi,audio/x-midi,.json,application/json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            data-testid="library-import-midi"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white font-headline font-bold rounded-xl transition-colors"
            title="Start a project from a MIDI file (.mid, .midi), or import a PushFlow project file"
          >
            <Upload size={16} aria-hidden="true" />
            Import MIDI
          </button>
          <button
            type="button"
            onClick={() => { void handleNewProject(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-primary)] font-headline font-bold rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            New project
          </button>
        </div>
      </header>

      {busy && (
        <p role="status" className="text-pf-sm text-[var(--text-secondary)]">{busy}</p>
      )}

      {importError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-pf-sm text-red-200">{importError}</p>
          <button
            type="button"
            className="text-red-200 hover:text-white text-pf-sm"
            onClick={() => setImportError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---- Hero: the project opened last ---- */}
      {heroProject ? (
        <ProjectHero
          project={heroProject}
          projectState={projectStates.get(heroProject.id) ?? null}
          renaming={renamingId === heroProject.id}
          onRenameDone={name => { void handleRenameDone(heroProject, name); }}
          onOpen={() => navigate(`/project/${heroProject.id}`)}
          actions={actionsFor(heroProject)}
        />
      ) : (
        <section data-testid="library-welcome" className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)]" style={{ minHeight: 280 }}>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #131316 0%, #1a1a2e 30%, #16213e 60%, #0f0f1a 100%)' }}
          />
          <div className="relative flex flex-col items-center justify-center text-center p-14" style={{ minHeight: 280 }}>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
              Welcome to PushFlow
            </h2>
            <p className="text-[var(--text-secondary)] text-base font-body mb-6 max-w-lg">
              Import a MIDI file to start a project: each pitch becomes a Sound for you to place on the Push grid.
              Or open the demo to look around first.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="px-6 py-3 bg-accent-primary hover:bg-accent-hover text-white font-headline font-bold rounded-xl flex items-center gap-2 transition-colors"
              >
                <Upload size={16} aria-hidden="true" />
                Import a MIDI file
              </button>
              <button
                type="button"
                data-testid="library-open-demo"
                onClick={() => { void handleOpenDemo(); }}
                className="px-6 py-3 border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-headline font-medium rounded-xl transition-colors"
              >
                Open demo project
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---- Content Grid: Projects + Sidebar ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div>
          <h2 className="text-pf-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-5">
            {searchQuery.trim() ? 'Search results' : 'Your projects'}
          </h2>

          {gridProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {gridProjects.map(entry => (
                <ProjectCard
                  key={entry.id}
                  project={entry}
                  projectState={projectStates.get(entry.id) ?? null}
                  renaming={renamingId === entry.id}
                  onRenameDone={name => { void handleRenameDone(entry, name); }}
                  onOpen={() => navigate(`/project/${entry.id}`)}
                  actions={actionsFor(entry)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-12 text-center">
              <p className="text-pf-sm text-[var(--text-tertiary)] font-body">
                {searchQuery.trim()
                  ? 'No projects match your search.'
                  : 'No other projects yet. Import a MIDI file or start a new project to see it here.'}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <LibraryStatsCard projects={savedProjects} />
          <QuickActionsCard
            onNewProject={handleNewProject}
            onOpenDemo={() => { void handleOpenDemo(); }}
            onNavigate={navigate}
            heroProjectId={heroProject?.id}
          />
        </div>
      </div>
    </div>
  );
}
