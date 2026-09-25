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
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

/** Session fields, as listed in the tracker's S1a.1 field table. */
const SESSION_FIELDS = [
  'updatedAt', 'lastOpenedAt',
  'analysisResult', 'candidates', 'inspectedLayout', 'inspectedAnalysis', 'generationSummary',
  'engineConfig', 'optimizerMethod', 'greedyStrategy', 'costToggles',
  'selectedEventIndex', 'selectedMomentIndex', 'selectedStreamId', 'armedStreamId', 'selectedPadKey', 'compareCandidateId',
  'isProcessing', 'error', 'analysisStale', 'manualCostResult',
  'moveHistory', 'iterationTrace', 'moveHistoryStopReason', 'moveHistoryIndex', 'lastGenerationRun',
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
    const rebuilt = { ...s, soundStreams: structuredClone(s.soundStreams) };
    expect(rebuilt.soundStreams).not.toBe(s.soundStreams);
    expect(documentChanged(pickDocument(s), pickDocument(rebuilt))).toBe(false);
  });

  // S2.3 (T52): every editor mount syncs Sounds from lanes; an equal rebuild
  // must not bump updatedAt, or opening a project re-saves it as edited.
  it('a sync that rebuilds the same Sounds returns the state untouched', async () => {
    const s = await importTestMidi1();
    expect(projectReducer(s, { type: 'SYNC_STREAMS_FROM_LANES' })).toBe(s);
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

  it('ends an inspection when the layouts change (S3.2), and the event selection when the Sounds change', async () => {
    const before = await importTestMidi1();
    const placed = projectReducer(before, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: '3,3', stream: before.soundStreams[0] } });
    const candidate = { id: 'cand-a', layout: { ...placed.workingLayout!, id: 'cand-a-layout', padToVoice: {} } } as unknown as CandidateSolution;
    const inspected = { kind: 'candidate' as const, id: 'cand-a' };
    const selected: ProjectState = { ...placed, candidates: [candidate], inspectedLayout: inspected, selectedEventIndex: 4, selectedMomentIndex: 2 };

    // Undo shows what it undid: the layout edits go to.
    const layoutOnly = restoreDocument(selected, pickDocument(before));
    expect({ c: layoutOnly.inspectedLayout, e: layoutOnly.selectedEventIndex, m: layoutOnly.selectedMomentIndex })
      .toEqual({ c: null, e: 4, m: 2 });

    const empty = projectReducer(before, { type: 'RESET' });
    const soundsToo = restoreDocument(selected, pickDocument(empty));
    expect({ e: soundsToo.selectedEventIndex, m: soundsToo.selectedMomentIndex }).toEqual({ e: null, m: null });

    const unchanged = restoreDocument(selected, pickDocument(selected));
    expect({ c: unchanged.inspectedLayout, e: unchanged.selectedEventIndex }).toEqual({ c: inspected, e: 4 });

    // An inspected variant the restored document no longer has is not inspected either.
    const saved = projectReducer(placed, { type: 'SAVE_AS_VARIANT', payload: { name: 'Kept', source: 'working' } });
    const onVariant = projectReducer(saved, { type: 'INSPECT_LAYOUT', payload: { kind: 'variant', id: saved.savedVariants[0]!.id } });
    expect(onVariant.inspectedLayout?.kind).toBe('variant');
    expect(restoreDocument(onVariant, pickDocument(placed)).inspectedLayout).toBeNull();
  });
});

describe('persistence round trip', () => {
  it('a project saved by main loads and re-saves with identical document fields', () => {
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const loaded = deserializeProject(validateAndMigrateRaw(saved));
    const resaved = serializeProject(loaded) as unknown as Record<string, unknown>;

    // The fixture is schema 1; the only differences are the migrations' (S1a.2
    // adds recoveredDrafts; S1a.4's ghost-lock pruning finds nothing to prune).
    expect(saved.schemaVersion).toBe(1);
    const { updatedAt: _a, ...savedFields } = saved;
    const { updatedAt: _b, ...resavedFields } = resaved;
    // S2.3's migration starts lastOpenedAt at the saved updatedAt. S3.2's takes
    // the role words out of the layout names: "Default (suggested)" is a
    // suggestion called Default, and "Default (suggested) (draft)" a draft of it.
    expect(saved.activeLayout.name).toBe('Default (suggested)');
    expect(saved.workingLayout.name).toBe('Default (suggested) (draft)');
    expect(resavedFields).toEqual({
      ...savedFields,
      schemaVersion: 5,
      recoveredDrafts: [],
      lastOpenedAt: saved.updatedAt,
      activeLayout: { ...saved.activeLayout, name: 'Default', provenance: 'suggested' },
      workingLayout: { ...saved.workingLayout, name: 'Default' },
    });

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
