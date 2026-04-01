/**
 * Project Serializer.
 *
 * Converts between in-memory ProjectState and the persisted PersistedProject shape.
 * Centralizes all serialization/deserialization, validation, and default-filling.
 *
 * Key invariant: ephemeral UI state (selection, playback) is NEVER persisted.
 * Candidates and analysis results ARE persisted so they survive refresh.
 */

import {
  type PersistedProject,
  PERSISTED_SCHEMA_VERSION,
} from './persistedProject';
import {
  type ProjectState,
  createEmptyProjectState,
  PROJECT_STATE_VERSION,
} from '../state/projectState';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { type CostToggles, ALL_COSTS_ENABLED } from '../../types/costToggles';
import { type OptimizerMethodKey } from '../../engine/optimization/optimizerInterface';
import { type GreedyLayoutStrategy } from '../../engine/optimization/greedyCandidatePipeline';
import { buildLegacySourceFile, buildPerformanceLanesFromStreams } from '../state/streamsToLanes';

// ============================================================================
// Serialize: ProjectState → PersistedProject
// ============================================================================

/**
 * Extract durable project data from in-memory state.
 * Strips all computed/ephemeral data.
 */
export function serializeProject(state: ProjectState): PersistedProject {
  return {
    id: state.id,
    name: state.name,
    bpm: state.tempo,

    // Layouts — merge workingLayout into activeLayout so edits survive refresh
    // The workingLayout contains uncommitted pad edits; if it exists, it's what
    // the user is actually looking at, so persist it as the active layout.
    activeLayout: state.workingLayout ?? state.activeLayout,
    savedVariants: state.savedVariants,

    // Sound state
    soundStreams: state.soundStreams,

    // Instrument config
    instrumentConfig: state.instrumentConfig,
    sections: state.sections,
    voiceProfiles: state.voiceProfiles,

    // Constraints
    voiceConstraints: state.voiceConstraints,

    // Performance lanes
    performanceLanes: state.performanceLanes,
    laneGroups: state.laneGroups,
    sourceFiles: state.sourceFiles,

    // Engine config (user preferences)
    engineConfig: state.engineConfig,
    optimizerMethod: state.optimizerMethod,
    greedyStrategy: state.greedyStrategy,
    costToggles: state.costToggles,

    // Metadata
    createdAt: state.createdAt,
    updatedAt: new Date().toISOString(),
    schemaVersion: PERSISTED_SCHEMA_VERSION,

    // Analysis / Candidates
    candidates: state.candidates.length > 0 ? state.candidates : undefined,
    analysisResult: state.analysisResult ?? undefined,
  };
}

// ============================================================================
// Deserialize: PersistedProject → ProjectState
// ============================================================================

/**
 * Reconstruct a full ProjectState from persisted data.
 * Fills in defaults for missing fields and resets all ephemeral state.
 * Candidates and analysis are restored if present in the persisted data.
 */
export function deserializeProject(persisted: PersistedProject): ProjectState {
  const base = createEmptyProjectState();

  const soundStreams = Array.isArray(persisted.soundStreams)
    ? persisted.soundStreams
    : [];

  const performanceLanes = Array.isArray(persisted.performanceLanes) && persisted.performanceLanes.length > 0
    ? persisted.performanceLanes
    : buildPerformanceLanesFromStreams(soundStreams);

  const sourceFiles = Array.isArray(persisted.sourceFiles)
    ? persisted.sourceFiles
    : [];

  return {
    ...base,
    version: PROJECT_STATE_VERSION,

    // Identity
    id: persisted.id,
    name: persisted.name || 'Unnamed Project',
    createdAt: persisted.createdAt || base.createdAt,
    updatedAt: persisted.updatedAt || base.updatedAt,

    // Sound
    soundStreams,
    tempo: typeof persisted.bpm === 'number' ? persisted.bpm : 120,

    // Instrument
    instrumentConfig: persisted.instrumentConfig ?? base.instrumentConfig,
    sections: Array.isArray(persisted.sections) ? persisted.sections : [],
    voiceProfiles: Array.isArray(persisted.voiceProfiles) ? persisted.voiceProfiles : [],

    // Layouts
    activeLayout: persisted.activeLayout
      ? ensureLayoutDefaults(persisted.activeLayout, 'active')
      : base.activeLayout,
    workingLayout: null, // Always null on load (session-scoped)
    savedVariants: Array.isArray(persisted.savedVariants)
      ? persisted.savedVariants.map(l => ensureLayoutDefaults(l, 'variant'))
      : [],

    // Constraints
    voiceConstraints: (persisted.voiceConstraints && typeof persisted.voiceConstraints === 'object')
      ? persisted.voiceConstraints
      : {},

    // Performance lanes
    performanceLanes,
    laneGroups: Array.isArray(persisted.laneGroups) ? persisted.laneGroups : [],
    sourceFiles: sourceFiles.length > 0 || performanceLanes.length === 0
      ? sourceFiles
      : [buildLegacySourceFile(soundStreams)],

    // Engine config
    engineConfig: persisted.engineConfig ?? base.engineConfig,
    optimizerMethod: isValidOptimizerMethod(persisted.optimizerMethod)
      ? persisted.optimizerMethod
      : base.optimizerMethod,
    greedyStrategy: isValidGreedyStrategy(persisted.greedyStrategy)
      ? persisted.greedyStrategy
      : base.greedyStrategy,
    costToggles: isValidCostToggles(persisted.costToggles)
      ? persisted.costToggles
      : ALL_COSTS_ENABLED,

    // Analysis — restore if present in persisted data
    analysisResult: persisted.analysisResult 
      ? { ...persisted.analysisResult, layout: ensureLayoutDefaults(persisted.analysisResult.layout, 'variant') }
      : null,
    candidates: Array.isArray(persisted.candidates) 
      ? persisted.candidates.map(c => ({
          ...c,
          layout: ensureLayoutDefaults(c.layout, 'variant')
        }))
      : [],
    selectedCandidateId: null,

    // Ephemeral — always reset
    selectedEventIndex: null,
    selectedMomentIndex: null,
    selectedStreamId: null,
    compareCandidateId: null,
    isProcessing: false,
    error: null,
    analysisStale: !persisted.analysisResult,
    manualCostResult: null,
    moveHistory: null,
    moveHistoryStopReason: null,
    moveHistoryIndex: null,
    currentTime: 0,
    isPlaying: false,
  };
}

// ============================================================================
// Validation from raw JSON (for import / localStorage migration)
// ============================================================================

/**
 * Validate and migrate a raw parsed object into a PersistedProject.
 * Handles legacy V1/V2 localStorage format as well as the new IndexedDB format.
 */
export function validateAndMigrateRaw(parsed: unknown): PersistedProject {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project data: root must be an object.');
  }
  const p = parsed as Record<string, unknown>;

  if (typeof p.id !== 'string' || !p.id) {
    throw new Error('Project data missing id.');
  }

  // If this is already a PersistedProject (has schemaVersion), return with defaults
  if (typeof p.schemaVersion === 'number') {
    return applyPersistedDefaults(p as Partial<PersistedProject> & { id: string });
  }

  // Legacy localStorage format: convert
  return migrateLegacyToPersistedProject(p);
}

// ============================================================================
// Internal Helpers
// ============================================================================

function ensureLayoutDefaults(layout: any, role: Layout['role']): Layout {
  // Migrate legacy 'cells' to 'padToVoice'
  const padToVoiceRaw = layout.padToVoice ?? layout.cells ?? {};
  const padToVoice: Record<string, Voice> = {};

  // Migrate internal Voice objects (field rename: voiceId -> id)
  for (const [key, voice] of Object.entries(padToVoiceRaw)) {
    if (voice && typeof voice === 'object') {
      const v = voice as any;
      padToVoice[key] = {
        ...v,
        id: v.id ?? v.voiceId,
      } as Voice;
    }
  }

  return {
    ...layout,
    role: layout.role ?? role,
    placementLocks: layout.placementLocks ?? {},
    padToVoice,
  };
}

function isValidOptimizerMethod(m: unknown): m is OptimizerMethodKey {
  return typeof m === 'string' && ['beam', 'annealing', 'greedy'].includes(m);
}

function isValidGreedyStrategy(s: unknown): s is GreedyLayoutStrategy {
  return typeof s === 'string' && ['all', 'natural-pose', 'cluster', 'coordination', 'novelty', 'structural'].includes(s);
}

function isValidCostToggles(t: unknown): t is CostToggles {
  return t != null && typeof t === 'object' && !Array.isArray(t);
}

/**
 * Apply defaults to a partially valid PersistedProject.
 */
function applyPersistedDefaults(p: Partial<PersistedProject> & { id: string }): PersistedProject {
  const base = createEmptyProjectState();
  return {
    id: p.id,
    name: p.name || 'Unnamed Project',
    bpm: typeof p.bpm === 'number' ? p.bpm : 120,
    activeLayout: p.activeLayout
      ? ensureLayoutDefaults(p.activeLayout, 'active')
      : base.activeLayout,
    savedVariants: Array.isArray(p.savedVariants)
      ? p.savedVariants.map(l => ensureLayoutDefaults(l, 'variant'))
      : [],
    soundStreams: Array.isArray(p.soundStreams) ? p.soundStreams : [],
    instrumentConfig: p.instrumentConfig ?? base.instrumentConfig,
    sections: Array.isArray(p.sections) ? p.sections : [],
    voiceProfiles: Array.isArray(p.voiceProfiles) ? p.voiceProfiles : [],
    voiceConstraints: (p.voiceConstraints && typeof p.voiceConstraints === 'object')
      ? p.voiceConstraints as PersistedProject['voiceConstraints']
      : {},
    performanceLanes: Array.isArray(p.performanceLanes) ? p.performanceLanes : [],
    laneGroups: Array.isArray(p.laneGroups) ? p.laneGroups : [],
    sourceFiles: Array.isArray(p.sourceFiles) ? p.sourceFiles : [],
    engineConfig: p.engineConfig ?? base.engineConfig,
    optimizerMethod: isValidOptimizerMethod(p.optimizerMethod) ? p.optimizerMethod : 'greedy',
    greedyStrategy: isValidGreedyStrategy(p.greedyStrategy) ? p.greedyStrategy : 'all',
    costToggles: isValidCostToggles(p.costToggles) ? p.costToggles : ALL_COSTS_ENABLED,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
    schemaVersion: PERSISTED_SCHEMA_VERSION,
  };
}

/**
 * Migrate a legacy localStorage ProjectState to PersistedProject shape.
 * Handles both V1 (layouts[] + activeLayoutId) and V2 (activeLayout + savedVariants).
 */
function migrateLegacyToPersistedProject(p: Record<string, unknown>): PersistedProject {
  const base = createEmptyProjectState();
  const savedVersion = typeof p.version === 'number' ? p.version : 1;

  // Determine layout model
  let activeLayout: Layout;
  let savedVariants: Layout[];

  if (savedVersion < 2 || (!p.activeLayout && Array.isArray(p.layouts))) {
    // V1 format: layouts[] + activeLayoutId
    const layouts = Array.isArray(p.layouts) ? p.layouts as Layout[] : [];
    const activeLayoutId = typeof p.activeLayoutId === 'string' ? p.activeLayoutId : '';
    let found = layouts.find(l => l.id === activeLayoutId);
    if (!found && layouts.length > 0) found = layouts[0];

    if (found) {
      activeLayout = ensureLayoutDefaults(found, 'active');
      savedVariants = layouts
        .filter(l => l.id !== found!.id)
        .map(l => ensureLayoutDefaults(l, 'variant'));
    } else {
      activeLayout = base.activeLayout;
      savedVariants = [];
    }
  } else {
    activeLayout = (p.activeLayout && typeof p.activeLayout === 'object')
      ? ensureLayoutDefaults(p.activeLayout as Layout, 'active')
      : base.activeLayout;
    savedVariants = Array.isArray(p.savedVariants)
      ? (p.savedVariants as Layout[]).map(l => ensureLayoutDefaults(l, 'variant'))
      : [];
  }

  const soundStreams = Array.isArray(p.soundStreams)
    ? p.soundStreams as PersistedProject['soundStreams']
    : [];

  return {
    id: p.id as string,
    name: typeof p.name === 'string' ? p.name : 'Unnamed Project',
    bpm: typeof p.tempo === 'number' ? p.tempo : 120,
    activeLayout,
    savedVariants,
    soundStreams,
    instrumentConfig: (p.instrumentConfig && typeof p.instrumentConfig === 'object')
      ? p.instrumentConfig as PersistedProject['instrumentConfig']
      : base.instrumentConfig,
    sections: Array.isArray(p.sections) ? p.sections as PersistedProject['sections'] : [],
    voiceProfiles: Array.isArray(p.voiceProfiles) ? p.voiceProfiles as PersistedProject['voiceProfiles'] : [],
    voiceConstraints: (p.voiceConstraints && typeof p.voiceConstraints === 'object' && !Array.isArray(p.voiceConstraints))
      ? p.voiceConstraints as PersistedProject['voiceConstraints']
      : {},
    performanceLanes: Array.isArray(p.performanceLanes)
      ? p.performanceLanes as PersistedProject['performanceLanes']
      : buildPerformanceLanesFromStreams(soundStreams),
    laneGroups: Array.isArray(p.laneGroups) ? p.laneGroups as PersistedProject['laneGroups'] : [],
    sourceFiles: Array.isArray(p.sourceFiles) ? p.sourceFiles as PersistedProject['sourceFiles'] : [],
    engineConfig: (p.engineConfig && typeof p.engineConfig === 'object')
      ? p.engineConfig as PersistedProject['engineConfig']
      : base.engineConfig,
    optimizerMethod: isValidOptimizerMethod(p.optimizerMethod)
      ? p.optimizerMethod
      : 'greedy',
    greedyStrategy: isValidGreedyStrategy((p as Record<string, unknown>).greedyStrategy)
      ? (p as Record<string, unknown>).greedyStrategy as GreedyLayoutStrategy
      : 'all',
    costToggles: isValidCostToggles(p.costToggles)
      ? p.costToggles as PersistedProject['costToggles']
      : ALL_COSTS_ENABLED,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
    schemaVersion: PERSISTED_SCHEMA_VERSION,
  };
}
