/**
 * Recovered drafts (S1a.2; roadmap P1a "Generate only proposes").
 *
 * Preview, Load Draft and a candidate or variant Promote replace the
 * Working/Test Layout. A draft that would be lost is kept in a separate
 * "Recovered drafts" list (deduped by layout hash, capped at 5), which is saved
 * with the project (decision Q1) and never mixed into the variants.
 */

import { describe, it, expect } from 'vitest';
import {
  projectReducer,
  RECOVERED_DRAFTS_CAP,
  type ProjectState,
  type ProjectAction,
} from '../../../src/ui/state/projectState';
import { hashLayout } from '../../../src/engine/mapping/mappingResolver';
import {
  serializeProject,
  deserializeProject,
  validateAndMigrateRaw,
} from '../../../src/ui/persistence/projectSerializer';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution } from '../../../src/types/candidateSolution';
import { importTestMidi1 } from '../../helpers/testMidi1';

const reduce = (state: ProjectState, ...actions: ProjectAction[]) => actions.reduce(projectReducer, state);

/** Places the first Sounds on these pads, one ASSIGN each (a hand-made draft). */
function handDraft(state: ProjectState, pads: string[]): ProjectState {
  return reduce(state, ...pads.map((padKey, i) => ({
    type: 'ASSIGN_VOICE_TO_PAD' as const,
    payload: { padKey, stream: state.soundStreams[i] },
  })));
}

const padsOf = (layout: Layout | null | undefined) =>
  Object.entries(layout?.padToVoice ?? {}).map(([k, v]) => `${k}=${v.id}`).sort();

function fakeCandidate(id: string, state: ProjectState, pads: string[]): CandidateSolution {
  const padToVoice: Layout['padToVoice'] = {};
  pads.forEach((padKey, i) => {
    const s = state.soundStreams[i];
    padToVoice[padKey] = { id: s.id, name: s.name, color: s.color, originalMidiNote: s.originalMidiNote, sourceType: 'midi_track', sourceFile: '' };
  });
  const layout: Layout = { ...state.activeLayout, id: `${id}-layout`, padToVoice, placementLocks: {}, fingerConstraints: {}, role: 'working' };
  return {
    id,
    layout,
    executionPlan: { layoutBinding: { layoutId: layout.id, layoutHash: hashLayout(layout), layoutRole: 'working' } },
    metadata: { strategy: 'test', seed: 0 },
  } as unknown as CandidateSolution;
}

async function withCandidatesAndVariant() {
  let state: ProjectState = { ...(await importTestMidi1()), id: 'proj-recovered' };
  // A saved variant and two candidates, then a hand-made draft on other pads.
  state = handDraft(state, ['3,3', '3,4']);
  state = reduce(state, { type: 'SAVE_AS_VARIANT', payload: { name: 'My named variant', source: 'working' } });
  state = reduce(state, { type: 'DISCARD_WORKING_LAYOUT' });
  state = reduce(state, { type: 'SET_CANDIDATES', payload: [fakeCandidate('cand-a', state, ['4,4', '4,5']), fakeCandidate('cand-b', state, ['5,5', '5,6'])] });
  state = handDraft(state, ['0,0', '0,7', '7,3']);
  return state;
}

describe('an explicit action that replaces a hand-made draft keeps it in Recovered drafts', () => {
  const cases: Array<[string, (s: ProjectState) => ProjectAction]> = [
    ['Preview', () => ({ type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } })],
    ['Load Draft', s => ({ type: 'LOAD_SAVED_VARIANT', payload: { variantId: s.savedVariants[0].id } })],
    ['a candidate Promote', () => ({ type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } })],
    ['a variant Promote', s => ({ type: 'PROMOTE_VARIANT', payload: { variantId: s.savedVariants[0].id } })],
  ];

  for (const [name, actionFor] of cases) {
    it(`${name} (P1a-2c), and it survives a save and reload`, async () => {
      const before = await withCandidatesAndVariant();
      const draft = before.workingLayout!;
      const after = projectReducer(before, actionFor(before));

      expect(padsOf(after.workingLayout)).not.toEqual(padsOf(draft));
      expect(after.recoveredDrafts).toHaveLength(1);
      const kept = after.recoveredDrafts[0];
      expect(padsOf(kept)).toEqual(padsOf(draft));
      expect({ id: kept.id, provenance: kept.provenance }).toEqual({ id: draft.id, provenance: 'recovered' });
      // Never mixed into the variants.
      expect(after.savedVariants.some(v => v.id === kept.id)).toBe(false);

      const reloaded = deserializeProject(validateAndMigrateRaw(JSON.parse(JSON.stringify(serializeProject(after)))));
      expect(reloaded.recoveredDrafts.map(padsOf)).toEqual([padsOf(draft)]);
    });
  }

  it('Restore makes the kept draft the Working/Test Layout again and takes it off the list', async () => {
    const before = await withCandidatesAndVariant();
    const draft = before.workingLayout!;
    const previewed = projectReducer(before, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    const restored = projectReducer(previewed, { type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: draft.id } });
    expect(padsOf(restored.workingLayout)).toEqual(padsOf(draft));
    expect(restored.workingLayout!.role).toBe('working');
    expect(restored.workingLayout!.baselineId).toBe(restored.activeLayout.id);
    // The previewed candidate is still in the list, so it isn't kept again.
    expect(restored.recoveredDrafts).toEqual([]);
  });

  it('Restore after a Promote puts the draft back over the new Active Layout', async () => {
    const before = await withCandidatesAndVariant();
    const draft = before.workingLayout!;
    const promoted = projectReducer(before, { type: 'PROMOTE_CANDIDATE', payload: { candidateId: 'cand-b' } });
    expect(promoted.workingLayout).toBeNull();
    const restored = projectReducer(promoted, { type: 'RESTORE_RECOVERED_DRAFT', payload: { layoutId: draft.id } });
    expect(padsOf(restored.workingLayout)).toEqual(padsOf(draft));
    expect(padsOf(restored.activeLayout)).toEqual(padsOf(before.candidates[1].layout));
  });

  it('Delete removes a recovered draft', async () => {
    const before = await withCandidatesAndVariant();
    const kept = projectReducer(before, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    const deleted = projectReducer(kept, { type: 'DELETE_RECOVERED_DRAFT', payload: { layoutId: before.workingLayout!.id } });
    expect(deleted.recoveredDrafts).toEqual([]);
  });
});

describe('a draft that is still recoverable elsewhere is not kept', () => {
  it('when it matches the incoming layout, the Active Layout, a saved variant or a candidate', async () => {
    const base = await withCandidatesAndVariant();
    const preview = (s: ProjectState, candidateId: string) =>
      projectReducer(s, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId } });

    // A previewed candidate replaced by another candidate: still in the candidate list.
    const a = preview(base, 'cand-a');
    expect(preview(a, 'cand-b').recoveredDrafts).toHaveLength(1); // only the hand draft, from the first Preview
    // A draft equal to a saved variant, replaced by a Preview.
    const loaded = projectReducer({ ...base, workingLayout: null }, { type: 'LOAD_SAVED_VARIANT', payload: { variantId: base.savedVariants[0].id } });
    expect(preview(loaded, 'cand-a').recoveredDrafts).toEqual([]);
    // No draft at all, or an empty one.
    expect(preview({ ...base, workingLayout: null }, 'cand-a').recoveredDrafts).toEqual([]);
    const emptied = reduce(base, ...Object.keys(base.workingLayout!.padToVoice).map(padKey => ({ type: 'REMOVE_VOICE_FROM_PAD' as const, payload: { padKey } })));
    expect(preview(emptied, 'cand-a').recoveredDrafts).toEqual([]);
  });
});

describe('P1a-3: Recovered drafts are deduped by hash and capped at 5', () => {
  async function autoKeep(times: number) {
    let state = await withCandidatesAndVariant();
    const namedVariant = state.savedVariants[0];
    const history: ProjectState[] = [];
    for (let i = 0; i < times; i++) {
      // A new hand-made draft each time (another Sound on row 6), then Preview.
      state = projectReducer(state, { type: 'ASSIGN_VOICE_TO_PAD', payload: { padKey: `6,${i}`, stream: state.soundStreams[3 + (i % 4)] } });
      state = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
      history.push(state);
    }
    return { state, namedVariant, history };
  }

  it('after 5 auto-keeps, the user-named variant is still visible', async () => {
    const { state, namedVariant } = await autoKeep(5);
    expect(state.recoveredDrafts).toHaveLength(5);
    expect(state.savedVariants.map(v => v.name)).toContain(namedVariant.name);
    expect(state.savedVariants.find(v => v.id === namedVariant.id)).toBeDefined();
  });

  it('a sixth keep prunes the oldest', async () => {
    // The first Preview kept the hand-made draft; five more keeps follow it.
    const { history } = await autoKeep(6);
    const five = history[4];
    const six = history[5];
    expect(RECOVERED_DRAFTS_CAP).toBe(5);
    expect(five.recoveredDrafts).toHaveLength(5);
    expect(six.recoveredDrafts).toHaveLength(5);
    expect(six.recoveredDrafts.slice(0, 4).map(padsOf)).toEqual(five.recoveredDrafts.slice(1).map(padsOf));
    // The newest entry is the draft the sixth Preview replaced (the one with row 6, column 5).
    expect(Object.keys(six.recoveredDrafts[4].padToVoice)).toContain('6,5');
  });

  it('keeping a draft whose hash is already in the list replaces the older copy', async () => {
    let state = await withCandidatesAndVariant();
    const draft = state.workingLayout!;
    state = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-a' } });
    // Rebuild the same hand-made draft by hand and replace it again.
    state = { ...state, workingLayout: { ...draft, id: 'rebuilt' } };
    state = projectReducer(state, { type: 'APPLY_GENERATION_TO_LAYOUT', payload: { candidateId: 'cand-b' } });
    expect(state.recoveredDrafts.map(l => l.id)).toEqual(['rebuilt']);
  });
});
