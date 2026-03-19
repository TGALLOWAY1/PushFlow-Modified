/**
 * Project Storage.
 *
 * localStorage CRUD for project library + JSON file export/import.
 *
 * V3 migration: Converts V1 format (layouts[] + activeLayoutId) to
 * V2 format (activeLayout + workingLayout + savedVariants).
 */

import { type ProjectState, createEmptyProjectState, PROJECT_STATE_VERSION } from '../state/projectState';
import { type Layout } from '../../types/layout';
import { type CostToggles, ALL_COSTS_ENABLED } from '../../types/costToggles';
import { type OptimizerMethodKey } from '../../engine/optimization/optimizerInterface';
import { buildLegacySourceFile, buildPerformanceLanesFromStreams } from '../state/streamsToLanes';

const INDEX_KEY = 'pushflow_projects';
const PROJECT_PREFIX = 'pushflow_project_';

// ============================================================================
// Library Index
// ============================================================================

export interface ProjectLibraryEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  soundCount: number;
  eventCount: number;
  difficulty: string | null;
}

export function listProjects(): ProjectLibraryEntry[] {
  try {
    const json = localStorage.getItem(INDEX_KEY);
    if (!json) return [];
    return JSON.parse(json) as ProjectLibraryEntry[];
  } catch {
    return [];
  }
}

function saveIndex(entries: ProjectLibraryEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function entryFromState(state: ProjectState): ProjectLibraryEntry {
  const totalEvents = state.soundStreams.reduce((sum, s) => sum + s.events.length, 0);
  const difficulty = state.analysisResult?.difficultyAnalysis?.overallScore != null
    ? classifyDifficulty(state.analysisResult.difficultyAnalysis.overallScore)
    : null;

  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    soundCount: state.soundStreams.length,
    eventCount: totalEvents,
    difficulty,
  };
}

function classifyDifficulty(score: number): string {
  if (score <= 0.2) return 'Easy';
  if (score <= 0.45) return 'Moderate';
  if (score <= 0.7) return 'Hard';
  return 'Extreme';
}

// ============================================================================
// Project CRUD
// ============================================================================

export function saveProject(state: ProjectState): void {
  try {
    const now = new Date().toISOString();
    // Strip ephemeral and session-scoped state before persisting
    const persistable: ProjectState = {
      ...state,
      version: PROJECT_STATE_VERSION,
      updatedAt: now,
      workingLayout: null, // Session-scoped: strip working layout
      selectedEventIndex: null,
      selectedMomentIndex: null,
      compareCandidateId: null,
      isProcessing: false,
      error: null,
      analysisStale: true,
      // Strip ephemeral optimizer state
      manualCostResult: null,
      moveHistory: null,
      moveHistoryIndex: null,
      // Strip deprecated fields
      layouts: undefined,
      activeLayoutId: undefined,
    };
    const json = JSON.stringify(persistable);
    localStorage.setItem(`${PROJECT_PREFIX}${state.id}`, json);

    // Update index with fresh timestamp
    const stateForEntry = { ...state, updatedAt: now };
    const entries = listProjects().filter(e => e.id !== state.id);
    entries.unshift(entryFromState(stateForEntry));
    saveIndex(entries);
  } catch (err) {
    console.error('Failed to save project:', err);
  }
}

export function loadProject(id: string): ProjectState | null {
  try {
    const json = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return validateAndMigrateProjectState(parsed);
  } catch (err) {
    console.error('Failed to load project:', err);
    return null;
  }
}

export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
    const entries = listProjects().filter(e => e.id !== id);
    saveIndex(entries);
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
}

/** Remove a project from the library index without deleting its data from localStorage. */
export function removeFromIndex(id: string): void {
  try {
    const entries = listProjects().filter(e => e.id !== id);
    saveIndex(entries);
  } catch (err) {
    console.error('Failed to remove from index:', err);
  }
}

/** Clear the entire project library index. Project data remains in localStorage. */
export function clearProjectIndex(): void {
  try {
    saveIndex([]);
  } catch (err) {
    console.error('Failed to clear project index:', err);
  }
}

// ============================================================================
// JSON File Export/Import
// ============================================================================

export function exportProjectToFile(state: ProjectState): void {
  const persistable: ProjectState = {
    ...state,
    version: PROJECT_STATE_VERSION,
    updatedAt: new Date().toISOString(),
    workingLayout: null,
    selectedEventIndex: null,
    selectedMomentIndex: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: true,
    manualCostResult: null,
    moveHistory: null,
    moveHistoryIndex: null,
    layouts: undefined,
    activeLayoutId: undefined,
  };
  const json = JSON.stringify(persistable, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pushflow.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; state: ProjectState }
  | { ok: false; error: string };

export async function importProjectFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const state = validateAndMigrateProjectState(parsed);
    return { ok: true, state };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid project file';
    return { ok: false, error: message };
  }
}

// ============================================================================
// Migration: V1 format (layouts[] + activeLayoutId) -> V2 format
// ============================================================================

/**
 * Ensure a layout has the V3 fields (role, placementLocks).
 * Adds defaults for layouts loaded from the old format.
 */
function ensureLayoutV3Fields(layout: Layout, role: Layout['role']): Layout {
  return {
    ...layout,
    role: layout.role ?? role,
    placementLocks: layout.placementLocks ?? {},
  };
}

/**
 * Migrate a V1-format project state to V2 format.
 *
 * V1 format: layouts[] array + activeLayoutId string
 * V2 format: activeLayout object + workingLayout null + savedVariants[]
 */
function migrateFromV1(p: Record<string, unknown>): {
  activeLayout: Layout;
  savedVariants: Layout[];
} {
  const layouts = Array.isArray(p.layouts) ? p.layouts as Layout[] : [];
  const activeLayoutId = typeof p.activeLayoutId === 'string' ? p.activeLayoutId : '';

  // Find the active layout
  let activeLayout = layouts.find(l => l.id === activeLayoutId);
  if (!activeLayout && layouts.length > 0) {
    activeLayout = layouts[0]; // Fallback to first layout
  }

  if (!activeLayout) {
    // No layouts at all: create empty active
    const base = createEmptyProjectState();
    return { activeLayout: base.activeLayout, savedVariants: [] };
  }

  // All other layouts become saved variants
  const savedVariants = layouts
    .filter(l => l.id !== activeLayout!.id)
    .map(l => ensureLayoutV3Fields(l, 'variant'));

  return {
    activeLayout: ensureLayoutV3Fields(activeLayout, 'active'),
    savedVariants,
  };
}

// ============================================================================
// Validation and Migration
// ============================================================================

function validateAndMigrateProjectState(parsed: unknown): ProjectState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project file: root must be an object.');
  }
  const p = parsed as Record<string, unknown>;

  if (typeof p.id !== 'string' || !p.id) {
    throw new Error('Project file missing id.');
  }

  const base = createEmptyProjectState();
  const savedVersion = typeof p.version === 'number' ? p.version : 1;

  // Determine layout model
  let activeLayout: Layout;
  let savedVariants: Layout[];

  if (savedVersion < 2 || (!p.activeLayout && Array.isArray(p.layouts))) {
    // V1 format: migrate from layouts[] + activeLayoutId
    const migrated = migrateFromV1(p);
    activeLayout = migrated.activeLayout;
    savedVariants = migrated.savedVariants;
  } else {
    // V2 format: use activeLayout directly
    activeLayout = (p.activeLayout && typeof p.activeLayout === 'object')
      ? ensureLayoutV3Fields(p.activeLayout as Layout, 'active')
      : base.activeLayout;
    savedVariants = Array.isArray(p.savedVariants)
      ? (p.savedVariants as Layout[]).map(l => ensureLayoutV3Fields(l, 'variant'))
      : [];
  }

  const soundStreams = Array.isArray(p.soundStreams) ? p.soundStreams as ProjectState['soundStreams'] : [];
  const persistedLanes = Array.isArray(p.performanceLanes) ? p.performanceLanes as ProjectState['performanceLanes'] : [];
  const performanceLanes = persistedLanes.length > 0
    ? persistedLanes
    : buildPerformanceLanesFromStreams(soundStreams);
  const sourceFiles = Array.isArray(p.sourceFiles) ? p.sourceFiles as ProjectState['sourceFiles'] : [];

  return {
    ...base,
    version: PROJECT_STATE_VERSION,
    id: p.id as string,
    name: typeof p.name === 'string' ? p.name : 'Unnamed Project',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : base.createdAt,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : base.updatedAt,
    soundStreams,
    tempo: typeof p.tempo === 'number' ? p.tempo : 120,
    instrumentConfig: (p.instrumentConfig && typeof p.instrumentConfig === 'object')
      ? p.instrumentConfig as ProjectState['instrumentConfig']
      : base.instrumentConfig,
    sections: Array.isArray(p.sections) ? p.sections as ProjectState['sections'] : [],
    voiceProfiles: Array.isArray(p.voiceProfiles) ? p.voiceProfiles as ProjectState['voiceProfiles'] : [],
    activeLayout,
    workingLayout: null, // Session-scoped: always null on load
    savedVariants,
    analysisResult: null,
    candidates: Array.isArray(p.candidates) ? p.candidates as ProjectState['candidates'] : [],
    selectedCandidateId: typeof p.selectedCandidateId === 'string' ? p.selectedCandidateId : null,
    engineConfig: (p.engineConfig && typeof p.engineConfig === 'object')
      ? p.engineConfig as ProjectState['engineConfig']
      : base.engineConfig,
    voiceConstraints: (p.voiceConstraints && typeof p.voiceConstraints === 'object' && !Array.isArray(p.voiceConstraints))
      ? p.voiceConstraints as ProjectState['voiceConstraints']
      : {},
    performanceLanes,
    laneGroups: Array.isArray(p.laneGroups) ? p.laneGroups as ProjectState['laneGroups'] : [],
    sourceFiles: sourceFiles.length > 0 || performanceLanes.length === 0
      ? sourceFiles
      : [buildLegacySourceFile(soundStreams)],
    // Optimizer config (persisted)
    optimizerMethod: (typeof p.optimizerMethod === 'string' && ['beam', 'annealing', 'greedy'].includes(p.optimizerMethod))
      ? p.optimizerMethod as OptimizerMethodKey
      : base.optimizerMethod,
    costToggles: (p.costToggles && typeof p.costToggles === 'object' && !Array.isArray(p.costToggles))
      ? p.costToggles as CostToggles
      : ALL_COSTS_ENABLED,
    // Ephemeral state always reset
    selectedEventIndex: null,
    selectedMomentIndex: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: true,
    manualCostResult: null,
    moveHistory: null,
    moveHistoryIndex: null,
    currentTime: 0,
    isPlaying: false,
  };
}
