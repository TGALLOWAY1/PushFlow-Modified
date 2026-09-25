// @vitest-environment happy-dom
/**
 * S2.3 · starting and managing projects from the Library (T51, T52, T53).
 *
 * P2-5c: a MIDI file becomes a project named after it, with its Sounds and
 * nothing placed (bottomLeftNote 36). P2-7: Delete takes the project away at
 * once and Undo brings back the stored record exactly. Opening a project is
 * recorded without making it look edited.
 *
 * indexedDbStore is an in-memory fake, as in projectStorageMigration.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

const projects = new Map<string, Record<string, unknown>>();
const backups = new Map<string, { key: string; projectId: string; fromVersion: number; createdAt: string; record: unknown }>();

vi.mock('../../../src/ui/persistence/indexedDbStore', () => ({
  putProject: vi.fn(async (p: { id: string }) => { projects.set(p.id, structuredClone(p) as never); }),
  getProject: vi.fn(async (id: string) => structuredClone(projects.get(id) ?? null)),
  deleteProjectFromDb: vi.fn(async (id: string) => { projects.delete(id); }),
  listAllProjects: vi.fn(async () => []),
  getFullProject: vi.fn(async (id: string) => projects.get(id) ?? null),
  backupKey: (id: string, v: number) => `${id}@v${v}`,
  putBackup: vi.fn(async (b: { key: string }) => { backups.set(b.key, structuredClone(b) as never); }),
  listBackups: vi.fn(async () => [...backups.values()]),
  deleteBackupsForProject: vi.fn(async (projectId: string) => {
    for (const [key, b] of backups) if (b.projectId === projectId) backups.delete(key);
  }),
}));

import {
  saveProjectAsync,
  loadProjectAsync,
  markProjectOpened,
  renameProjectAsync,
  duplicateProjectAsync,
  deleteProjectWithUndo,
  restoreDeletedProject,
} from '../../../src/ui/persistence/projectStorage';
import { newProjectState, pickedFileKind, projectFromMidiFiles, projectNameFromFile } from '../../../src/ui/persistence/newProject';
import { loadSerializedLoopState, saveSerializedLoopState } from '../../../src/ui/persistence/loopStorage';
import { TEST_MIDI_1_PATH, suggestedTestMidi1 } from '../../helpers/testMidi1';

const midiFile = () => new File([fs.readFileSync(TEST_MIDI_1_PATH)], 'TEST MIDI 1.mid', { type: 'audio/midi' });

beforeEach(() => {
  projects.clear();
  backups.clear();
  localStorage.clear();
  localStorage.setItem('pushflow_idb_migrated', 'true');
});

describe('a project from a MIDI file (P2-5c)', () => {
  it('is named after the file, has its 7 Sounds, and places nothing (invariants 5 and 7)', async () => {
    const { state, importedCount } = await projectFromMidiFiles([midiFile()]);
    expect(state.name).toBe('TEST MIDI 1');
    expect(importedCount).toBe(7);
    expect(state.soundStreams).toHaveLength(7);
    expect(state.soundStreams.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(l => `TEST MIDI 1 ${l}`));
    expect(Object.keys(state.activeLayout.padToVoice)).toEqual([]);
    expect(state.workingLayout).toBeNull();
    expect(state.instrumentConfig.bottomLeftNote).toBe(36);
    expect(state.lastOpenedAt).toBe(state.createdAt);
  });

  it('takes a given name (the demo)', async () => {
    const { state } = await projectFromMidiFiles([midiFile()], 'Demo · TEST MIDI 1');
    expect(state.name).toBe('Demo · TEST MIDI 1');
    expect(projectNameFromFile('groove.MIDI')).toBe('groove');
  });

  it('tells a MIDI file from a project file by content, not by name', async () => {
    expect(await pickedFileKind(new File([fs.readFileSync(TEST_MIDI_1_PATH)], 'song.json'))).toBe('midi');
    expect(await pickedFileKind(new File(['  {"id":"p"}'], 'song.mid'))).toBe('project');
    expect(await pickedFileKind(new File(['hello'], 'notes.txt'))).toBe('unknown');
  });
});

describe('Library actions', () => {
  it('opening is recorded without touching updatedAt', async () => {
    const state = { ...newProjectState('Song'), updatedAt: '2026-09-01T00:00:00.000Z', lastOpenedAt: '2026-09-01T00:00:00.000Z' };
    await saveProjectAsync(state);
    const savedUpdatedAt = projects.get(state.id)!.updatedAt;
    expect(await markProjectOpened(state.id, '2026-09-25T10:00:00.000Z')).toBe(true);
    expect(projects.get(state.id)!.lastOpenedAt).toBe('2026-09-25T10:00:00.000Z');
    expect(projects.get(state.id)!.updatedAt).toBe(savedUpdatedAt);
    expect(await markProjectOpened('missing')).toBe(false);
  });

  it('renames, and duplicates under a new id with a numbered name and its Composer pattern', async () => {
    const state = await suggestedTestMidi1();
    const original = { ...state, id: 'orig', name: 'Song' };
    await saveProjectAsync(original);
    saveSerializedLoopState('orig', { lanes: [], events: [], config: {} } as never);

    expect(await renameProjectAsync('orig', '  Song v2 ')).toBe(true);
    expect(projects.get('orig')!.name).toBe('Song v2');

    const copyId = await duplicateProjectAsync('orig', ['Song v2', 'Song v2 (copy)']);
    expect(copyId).toBeTruthy();
    expect(copyId).not.toBe('orig');
    const copy = await loadProjectAsync(copyId!);
    expect(copy?.name).toBe('Song v2 (copy) (2)');
    expect(copy?.lastOpenedAt).toBe('');
    expect(copy?.workingLayout?.padToVoice).toEqual(original.workingLayout?.padToVoice);
    expect(copy?.soundStreams.map(s => s.id)).toEqual(original.soundStreams.map(s => s.id));
    expect(loadSerializedLoopState(copyId!)).toEqual(loadSerializedLoopState('orig'));
  });

  it('P2-7: Delete removes the project and its backups; Undo restores the stored record exactly', async () => {
    let state = await suggestedTestMidi1();
    state = { ...state, id: 'keep', name: 'Keep me' };
    await saveProjectAsync(state);
    projects.set('keep', { ...projects.get('keep')!, savedVariants: [{ id: 'v1', name: 'Wide', padToVoice: {} }] });
    backups.set('keep@v1', { key: 'keep@v1', projectId: 'keep', fromVersion: 1, createdAt: '2026-09-01T00:00:00Z', record: { id: 'keep' } });
    const stored = structuredClone(projects.get('keep'));

    const deleted = await deleteProjectWithUndo('keep');
    expect(deleted).not.toBeNull();
    expect(projects.has('keep')).toBe(false);
    expect(backups.size).toBe(0);

    await restoreDeletedProject(deleted!);
    expect(projects.get('keep')).toEqual(stored);
    expect([...backups.keys()]).toEqual(['keep@v1']);
    expect(await deleteProjectWithUndo('missing')).toBeNull();
  });
});
