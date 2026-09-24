/**
 * The document/session split (S1a.1, T02).
 *
 * Undo covers the document only. These tests pin which fields are which, that
 * restoring a document keeps the session, and that a project saved by main
 * before the split loads and re-saves with identical document fields.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  createEmptyProjectState,
  projectReducer,
  type ProjectState,
} from '../../../src/ui/state/projectState';
import {
  DOCUMENT_FIELDS,
  pickDocument,
  documentChanged,
  restoreDocument,
} from '../../../src/ui/state/projectDocument';
import {
  serializeProject,
  deserializeProject,
  validateAndMigrateRaw,
} from '../../../src/ui/persistence/projectSerializer';
import { deepEqual } from '../../../src/utils/deepEqual';
import { importTestMidi1 } from '../../helpers/testMidi1';

/** Session fields, as listed in the tracker's S1a.1 field table. */
const SESSION_FIELDS = [
  'updatedAt',
  'analysisResult', 'candidates', 'selectedCandidateId',
  'engineConfig', 'optimizerMethod', 'greedyStrategy', 'costToggles',
  'selectedEventIndex', 'selectedMomentIndex', 'selectedStreamId', 'compareCandidateId',
  'isProcessing', 'error', 'analysisStale', 'manualCostResult',
  'moveHistory', 'iterationTrace', 'moveHistoryStopReason', 'moveHistoryIndex',
  'currentTime', 'isPlaying', 'playbackRate', 'loopEnabled', 'loopStart', 'loopEnd',
  'countInBars', 'rehearsalAudio',
];

const FIXTURE = path.resolve(__dirname, '../../fixtures/projects/saved-by-main.json');

describe('document/session field table', () => {
  it('classifies every ProjectState field exactly once', () => {
    const all = Object.keys(createEmptyProjectState()).sort();
    const doc = DOCUMENT_FIELDS.filter(k => k !== 'layouts' && k !== 'activeLayoutId');
    expect([...doc, ...SESSION_FIELDS].sort()).toEqual(all);
    expect(doc.filter(k => SESSION_FIELDS.includes(k))).toEqual([]);
  });

  it('puts user-edited project content in the document', () => {
    for (const key of ['activeLayout', 'workingLayout', 'savedVariants', 'soundStreams', 'voiceConstraints',
      'performanceLanes', 'laneGroups', 'sourceFiles', 'sections', 'instrumentConfig', 'voiceProfiles',
      'tempo', 'name']) {
      expect(DOCUMENT_FIELDS).toContain(key);
    }
  });
});

describe('documentChanged', () => {
  it('ignores session-only changes', () => {
    const s = createEmptyProjectState();
    const t = projectReducer(s, { type: 'SET_IS_PLAYING', payload: true });
    expect(documentChanged(pickDocument(s), pickDocument(t))).toBe(false);
  });

  it('treats a structurally equal rebuild as no change', async () => {
    const s = await importTestMidi1();
    const synced = projectReducer(s, { type: 'SYNC_STREAMS_FROM_LANES' });
    expect(synced.soundStreams).not.toBe(s.soundStreams);
    expect(documentChanged(pickDocument(s), pickDocument(synced))).toBe(false);
  });

  it('sees a pad edit', async () => {
    const s = await importTestMidi1();
    const t = projectReducer(s, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: s.soundStreams[0] } });
    expect(documentChanged(pickDocument(s), pickDocument(t))).toBe(true);
  });
});

describe('restoreDocument', () => {
  it('swaps the document and keeps the session', async () => {
    const before = await importTestMidi1();
    let s: ProjectState = projectReducer(before, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: before.soundStreams[0] } });
    s = { ...s, isPlaying: true, currentTime: 4.2, selectedEventIndex: 7, moveHistory: [], candidates: [], analysisStale: false };

    const restored = restoreDocument(s, pickDocument(before));
    expect(restored.workingLayout).toBeNull();
    expect({
      isPlaying: restored.isPlaying,
      currentTime: restored.currentTime,
      selectedEventIndex: restored.selectedEventIndex,
      moveHistory: restored.moveHistory,
    }).toEqual({ isPlaying: true, currentTime: 4.2, selectedEventIndex: 7, moveHistory: [] });
    // The layout changed under the analysis, so it must re-resolve.
    expect(restored.analysisStale).toBe(true);
    expect(restored.updatedAt >= s.updatedAt).toBe(true);
  });

  it('clears a candidate selection when the layouts change, and the event selection when the Sounds change', async () => {
    const before = await importTestMidi1();
    const placed = projectReducer(before, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: before.soundStreams[0] } });
    const selected: ProjectState = { ...placed, selectedCandidateId: 'cand-a', selectedEventIndex: 4, selectedMomentIndex: 2 };

    const layoutOnly = restoreDocument(selected, pickDocument(before));
    expect({ c: layoutOnly.selectedCandidateId, e: layoutOnly.selectedEventIndex, m: layoutOnly.selectedMomentIndex })
      .toEqual({ c: null, e: 4, m: 2 });

    const empty = projectReducer(before, { type: 'RESET' });
    const soundsToo = restoreDocument(selected, pickDocument(empty));
    expect({ e: soundsToo.selectedEventIndex, m: soundsToo.selectedMomentIndex }).toEqual({ e: null, m: null });

    const unchanged = restoreDocument(selected, pickDocument(selected));
    expect({ c: unchanged.selectedCandidateId, e: unchanged.selectedEventIndex }).toEqual({ c: 'cand-a', e: 4 });
  });
});

describe('persistence round trip', () => {
  it('a project saved by main loads and re-saves with identical document fields', () => {
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const loaded = deserializeProject(validateAndMigrateRaw(saved));
    const resaved = serializeProject(loaded) as unknown as Record<string, unknown>;

    // The fixture is schema 1; the only differences are the S1a.2 migration's.
    expect(saved.schemaVersion).toBe(1);
    const { updatedAt: _a, ...savedFields } = saved;
    const { updatedAt: _b, ...resavedFields } = resaved;
    expect(resavedFields).toEqual({ ...savedFields, schemaVersion: 2, recoveredDrafts: [] });

    // And the document slice survives a second load unchanged.
    const reloaded = deserializeProject(validateAndMigrateRaw(JSON.parse(JSON.stringify(resaved))));
    expect(deepEqual(pickDocument(reloaded), pickDocument(loaded))).toBe(true);
  });

  it('the fixture exercises a draft, a lock, a preference, a variant and a group', () => {
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    expect(saved.workingLayout).not.toBeNull();
    expect(Object.keys(saved.workingLayout.placementLocks)).toHaveLength(1);
    expect(Object.keys(saved.voiceConstraints)).toHaveLength(1);
    expect(saved.savedVariants.length).toBeGreaterThan(0);
    expect(saved.laneGroups).toHaveLength(1);
  });
});
