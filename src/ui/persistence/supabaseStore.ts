/**
 * Supabase Store.
 *
 * CRUD operations for all PushFlow data backed by Supabase PostgreSQL.
 * Replaces IndexedDB for projects and localStorage for presets/loop state.
 *
 * All methods throw on failure — callers must handle errors.
 */

import { supabase } from './supabaseClient';
import { type PersistedProject, type ProjectIndexEntry } from './persistedProject';
import { type PerformancePreset } from './presetStorage';
import { type ComposerPreset } from '../../types/composerPreset';

// ============================================================================
// Projects
// ============================================================================

/**
 * Save or update a project in Supabase.
 */
export async function putProject(project: PersistedProject): Promise<void> {
  const eventCount = project.soundStreams.reduce((sum, s) => sum + s.events.length, 0);
  let maxTime = 0;
  for (const s of project.soundStreams) {
    for (const e of s.events) {
      const end = e.startTime + e.duration;
      if (end > maxTime) maxTime = end;
    }
  }
  const beatDuration = 60 / (project.bpm || 120);
  const barDuration = beatDuration * 4;
  const durationBars = barDuration > 0 ? Math.ceil(maxTime / barDuration) : 0;

  const { error } = await supabase.from('pushflow_projects').upsert(
    {
      id: project.id,
      name: project.name,
      bpm: project.bpm,
      sound_count: project.soundStreams.length,
      event_count: eventCount,
      duration_bars: durationBars,
      data: project,
      schema_version: project.schemaVersion,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    },
    { onConflict: 'id' }
  );

  if (error) throw new Error(`Failed to save project: ${error.message}`);
}

/**
 * Load a project by ID from Supabase.
 */
export async function getProject(id: string): Promise<PersistedProject | null> {
  const { data, error } = await supabase
    .from('pushflow_projects')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load project: ${error.message}`);
  return data?.data as PersistedProject | null ?? null;
}

/**
 * Delete a project by ID from Supabase.
 */
export async function deleteProjectFromDb(id: string): Promise<void> {
  const { error } = await supabase
    .from('pushflow_projects')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}

/**
 * List all projects as lightweight index entries.
 * Returns entries sorted by updated_at (most recent first).
 */
export async function listAllProjects(): Promise<ProjectIndexEntry[]> {
  const { data, error } = await supabase
    .from('pushflow_projects')
    .select('id, name, bpm, sound_count, event_count, duration_bars, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to list projects: ${error.message}`);

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    soundCount: row.sound_count,
    eventCount: row.event_count,
    tempo: row.bpm,
    durationBars: row.duration_bars,
  }));
}

/**
 * Load the full persisted state for a project.
 */
export async function getFullProject(id: string): Promise<PersistedProject | null> {
  return getProject(id);
}

// ============================================================================
// Performance Presets
// ============================================================================

/**
 * Load all performance presets.
 */
export async function loadPresetsFromDb(): Promise<PerformancePreset[]> {
  const { data, error } = await supabase
    .from('pushflow_presets')
    .select('data')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load presets: ${error.message}`);
  return (data ?? []).map(row => row.data as PerformancePreset);
}

/**
 * Save a performance preset.
 */
export async function putPreset(preset: PerformancePreset): Promise<void> {
  const { error } = await supabase.from('pushflow_presets').upsert(
    {
      id: preset.id,
      name: preset.name,
      data: preset,
      created_at: new Date(preset.createdAt).toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw new Error(`Failed to save preset: ${error.message}`);
}

/**
 * Delete a performance preset by ID.
 */
export async function deletePresetFromDb(presetId: string): Promise<void> {
  const { error } = await supabase
    .from('pushflow_presets')
    .delete()
    .eq('id', presetId);

  if (error) throw new Error(`Failed to delete preset: ${error.message}`);
}

/**
 * Overwrite all presets (used during migration).
 */
export async function putAllPresets(presets: PerformancePreset[]): Promise<void> {
  if (presets.length === 0) return;
  const rows = presets.map(p => ({
    id: p.id,
    name: p.name,
    data: p,
    created_at: new Date(p.createdAt).toISOString(),
  }));

  const { error } = await supabase.from('pushflow_presets').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to save presets: ${error.message}`);
}

// ============================================================================
// Composer Presets
// ============================================================================

/**
 * Load all composer presets.
 */
export async function loadComposerPresetsFromDb(): Promise<ComposerPreset[]> {
  const { data, error } = await supabase
    .from('pushflow_composer_presets')
    .select('data')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load composer presets: ${error.message}`);
  return (data ?? []).map(row => row.data as ComposerPreset);
}

/**
 * Save or update a composer preset.
 */
export async function putComposerPreset(preset: ComposerPreset): Promise<void> {
  const { error } = await supabase.from('pushflow_composer_presets').upsert(
    {
      id: preset.id,
      name: preset.name,
      data: preset,
      created_at: new Date(preset.createdAt).toISOString(),
      updated_at: new Date(preset.updatedAt).toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw new Error(`Failed to save composer preset: ${error.message}`);
}

/**
 * Delete a composer preset by ID.
 */
export async function deleteComposerPresetFromDb(presetId: string): Promise<void> {
  const { error } = await supabase
    .from('pushflow_composer_presets')
    .delete()
    .eq('id', presetId);

  if (error) throw new Error(`Failed to delete composer preset: ${error.message}`);
}

/**
 * Overwrite all composer presets (used during migration).
 */
export async function putAllComposerPresets(presets: ComposerPreset[]): Promise<void> {
  if (presets.length === 0) return;
  const rows = presets.map(p => ({
    id: p.id,
    name: p.name,
    data: p,
    created_at: new Date(p.createdAt).toISOString(),
    updated_at: new Date(p.updatedAt).toISOString(),
  }));

  const { error } = await supabase.from('pushflow_composer_presets').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to save composer presets: ${error.message}`);
}

// ============================================================================
// Loop States
// ============================================================================

/**
 * Save loop state for a project.
 */
export async function putLoopState(projectId: string, data: unknown): Promise<void> {
  const { error } = await supabase.from('pushflow_loop_states').upsert(
    {
      project_id: projectId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id' }
  );

  if (error) throw new Error(`Failed to save loop state: ${error.message}`);
}

/**
 * Load loop state for a project.
 */
export async function getLoopState(projectId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('pushflow_loop_states')
    .select('data')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load loop state: ${error.message}`);
  return data?.data ?? null;
}

/**
 * Delete loop state for a project.
 */
export async function deleteLoopStateFromDb(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('pushflow_loop_states')
    .delete()
    .eq('project_id', projectId);

  if (error) throw new Error(`Failed to delete loop state: ${error.message}`);
}
