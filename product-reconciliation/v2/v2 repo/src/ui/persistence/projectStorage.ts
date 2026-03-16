/**
 * Project Storage.
 *
 * localStorage CRUD for project library + JSON file export/import.
 */

import { type ProjectState, createEmptyProjectState } from '../state/projectState';
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
  isDemo: boolean;
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
    isDemo: state.isDemo,
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
    // Strip ephemeral state before persisting
    const persistable: ProjectState = {
      ...state,
      selectedEventIndex: null,
      isProcessing: false,
      error: null,
    };
    const json = JSON.stringify(persistable);
    localStorage.setItem(`${PROJECT_PREFIX}${state.id}`, json);

    // Update index
    const entries = listProjects().filter(e => e.id !== state.id);
    entries.unshift(entryFromState(state));
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
    return validateProjectState(parsed);
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
    selectedEventIndex: null,
    isProcessing: false,
    error: null,
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
    const state = validateProjectState(parsed);
    return { ok: true, state };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid project file';
    return { ok: false, error: message };
  }
}

// ============================================================================
// Validation
// ============================================================================

function validateProjectState(parsed: unknown): ProjectState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project file: root must be an object.');
  }
  const p = parsed as Record<string, unknown>;

  if (typeof p.id !== 'string' || !p.id) {
    throw new Error('Project file missing id.');
  }

  const base = createEmptyProjectState();

  const soundStreams = Array.isArray(p.soundStreams) ? p.soundStreams as ProjectState['soundStreams'] : [];
  const persistedLanes = Array.isArray(p.performanceLanes) ? p.performanceLanes as ProjectState['performanceLanes'] : [];
  const performanceLanes = persistedLanes.length > 0
    ? persistedLanes
    : buildPerformanceLanesFromStreams(soundStreams);
  const sourceFiles = Array.isArray(p.sourceFiles) ? p.sourceFiles as ProjectState['sourceFiles'] : [];

  return {
    ...base,
    id: p.id as string,
    name: typeof p.name === 'string' ? p.name : 'Unnamed Project',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : base.createdAt,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : base.updatedAt,
    isDemo: typeof p.isDemo === 'boolean' ? p.isDemo : false,
    soundStreams,
    tempo: typeof p.tempo === 'number' ? p.tempo : 120,
    instrumentConfig: (p.instrumentConfig && typeof p.instrumentConfig === 'object')
      ? p.instrumentConfig as ProjectState['instrumentConfig']
      : base.instrumentConfig,
    sections: Array.isArray(p.sections) ? p.sections as ProjectState['sections'] : [],
    voiceProfiles: Array.isArray(p.voiceProfiles) ? p.voiceProfiles as ProjectState['voiceProfiles'] : [],
    layouts: Array.isArray(p.layouts) ? p.layouts as ProjectState['layouts'] : [],
    activeLayoutId: typeof p.activeLayoutId === 'string' ? p.activeLayoutId : '',
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
    // Ephemeral state always reset
    selectedEventIndex: null,
    isProcessing: false,
    error: null,
    analysisStale: true,
  };
}
