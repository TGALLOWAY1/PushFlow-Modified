/**
 * Voice identity round-trip tests.
 *
 * Validates that voice IDs and references survive layout operations:
 * clone, promote (active replacement), variant saving, and discard.
 * These tests ensure that the Sound identity contract holds across
 * all workflow transitions.
 */

import { describe, it, expect } from 'vitest';
import { type Voice } from '../../src/types/voice';
import { type Layout, type LayoutRole, createEmptyLayout, cloneLayout } from '../../src/types/layout';

// ============================================================================
// Factories
// ============================================================================

function makeVoice(id: string, name: string, midi: number): Voice {
  return {
    id,
    name,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: midi,
    color: '#ff0000',
  };
}

function makePopulatedLayout(
  id: string,
  name: string,
  role: LayoutRole = 'active',
): Layout {
  const kick = makeVoice('v-kick', 'Kick', 36);
  const snare = makeVoice('v-snare', 'Snare', 38);
  const hihat = makeVoice('v-hihat', 'HiHat', 42);
  const tom = makeVoice('v-tom', 'Tom', 45);

  return {
    ...createEmptyLayout(id, name, role),
    padToVoice: {
      '0,0': kick,
      '0,2': snare,
      '2,4': hihat,
      '4,6': tom,
    },
    placementLocks: { 'v-kick': '0,0' },
    fingerConstraints: { '0,2': 'L2' },
  };
}

function getVoiceIds(layout: Layout): string[] {
  return Object.values(layout.padToVoice).map(v => v.id).sort();
}

function getVoiceMap(layout: Layout): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [pad, voice] of Object.entries(layout.padToVoice)) {
    map[pad] = voice.id;
  }
  return map;
}

// ============================================================================
// Tests: Clone preserves voice identity
// ============================================================================

describe('Voice identity through cloneLayout', () => {
  it('should preserve all voice IDs after cloning to working', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(getVoiceIds(working)).toEqual(getVoiceIds(active));
  });

  it('should preserve voice-to-pad mapping after clone', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(getVoiceMap(working)).toEqual(getVoiceMap(active));
  });

  it('should preserve voice object properties after clone', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    for (const [pad, voice] of Object.entries(active.padToVoice)) {
      const clonedVoice = working.padToVoice[pad];
      expect(clonedVoice.id).toBe(voice.id);
      expect(clonedVoice.name).toBe(voice.name);
      expect(clonedVoice.sourceType).toBe(voice.sourceType);
      expect(clonedVoice.sourceFile).toBe(voice.sourceFile);
      expect(clonedVoice.originalMidiNote).toBe(voice.originalMidiNote);
      expect(clonedVoice.color).toBe(voice.color);
    }
  });

  it('should preserve placement locks referencing voice IDs after clone', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(working.placementLocks).toEqual(active.placementLocks);
    // The locked voice ID should still exist in the cloned layout
    for (const voiceId of Object.keys(working.placementLocks)) {
      const lockedVoice = Object.values(working.padToVoice).find(v => v.id === voiceId);
      expect(lockedVoice).toBeDefined();
    }
  });

  it('should preserve finger constraints after clone', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(working.fingerConstraints).toEqual(active.fingerConstraints);
  });

  it('cloned padToVoice should be a shallow copy (not same reference)', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(working.padToVoice).not.toBe(active.padToVoice);
    // Mutating the clone should not affect the original
    working.padToVoice['6,6'] = makeVoice('v-new', 'New', 99);
    expect(active.padToVoice['6,6']).toBeUndefined();
  });

  it('cloned placementLocks should be a shallow copy (not same reference)', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working Copy', 'working');

    expect(working.placementLocks).not.toBe(active.placementLocks);
    working.placementLocks['v-new'] = '6,6';
    expect(active.placementLocks['v-new']).toBeUndefined();
  });
});

// ============================================================================
// Tests: Promote simulation preserves voice identity
// ============================================================================

describe('Voice identity through promote simulation', () => {
  /**
   * Simulates PROMOTE_CANDIDATE logic from projectState.ts:
   * candidate layout becomes active, old active becomes variant.
   */
  function simulatePromote(active: Layout, candidateLayout: Layout): {
    newActive: Layout;
    savedVariant: Layout;
  } {
    const savedVariant = cloneLayout(active, 'variant-1', `${active.name} (replaced)`, 'variant');
    const newActive: Layout = {
      ...candidateLayout,
      id: 'promoted-1',
      role: 'active' as const,
      baselineId: undefined,
      placementLocks: { ...active.placementLocks },
    };
    return { newActive, savedVariant };
  }

  it('should preserve candidate voice IDs in promoted active layout', () => {
    const active = makePopulatedLayout('active-1', 'Active');

    // Candidate has rearranged pads but same voices
    const candidateLayout: Layout = {
      ...createEmptyLayout('cand-1', 'Candidate', 'active'),
      padToVoice: {
        '2,2': active.padToVoice['0,0'],  // kick moved
        '2,4': active.padToVoice['0,2'],  // snare moved
        '4,2': active.padToVoice['2,4'],  // hihat moved
        '4,4': active.padToVoice['4,6'],  // tom moved
      },
    };

    const { newActive } = simulatePromote(active, candidateLayout);
    expect(getVoiceIds(newActive)).toEqual(getVoiceIds(active));
  });

  it('should preserve original active voice IDs in saved variant', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const candidateLayout: Layout = {
      ...createEmptyLayout('cand-1', 'Candidate', 'active'),
      padToVoice: { ...active.padToVoice },
    };

    const { savedVariant } = simulatePromote(active, candidateLayout);
    expect(getVoiceIds(savedVariant)).toEqual(getVoiceIds(active));
    expect(getVoiceMap(savedVariant)).toEqual(getVoiceMap(active));
  });

  it('should carry forward placement locks from active to promoted layout', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const candidateLayout: Layout = {
      ...createEmptyLayout('cand-1', 'Candidate', 'active'),
      padToVoice: { ...active.padToVoice },
      placementLocks: {}, // Candidate has no locks
    };

    const { newActive } = simulatePromote(active, candidateLayout);
    expect(newActive.placementLocks).toEqual(active.placementLocks);
  });

  it('should keep voice IDs stable across double promote', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const candidate1: Layout = {
      ...createEmptyLayout('cand-1', 'Candidate 1', 'active'),
      padToVoice: { ...active.padToVoice },
    };

    const { newActive: active2 } = simulatePromote(active, candidate1);

    const candidate2: Layout = {
      ...createEmptyLayout('cand-2', 'Candidate 2', 'active'),
      padToVoice: { ...active2.padToVoice },
    };

    const { newActive: active3 } = simulatePromote(active2, candidate2);
    expect(getVoiceIds(active3)).toEqual(getVoiceIds(active));
  });
});

// ============================================================================
// Tests: Variant saving preserves voice identity
// ============================================================================

describe('Voice identity through variant saving', () => {
  it('should preserve voice IDs when saving working layout as variant', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working', 'working');

    // Simulate pad swap in working layout
    const temp = working.padToVoice['0,0'];
    working.padToVoice['0,0'] = working.padToVoice['0,2'];
    working.padToVoice['0,2'] = temp;

    const variant = cloneLayout(working, 'variant-1', 'My Variant', 'variant');

    // Same voice IDs should exist, just in different positions
    expect(getVoiceIds(variant)).toEqual(getVoiceIds(active));
  });

  it('should preserve voice properties through working -> variant chain', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working', 'working');
    const variant = cloneLayout(working, 'variant-1', 'Variant', 'variant');

    const activeVoices = Object.values(active.padToVoice);
    const variantVoices = Object.values(variant.padToVoice);

    for (const activeVoice of activeVoices) {
      const match = variantVoices.find(v => v.id === activeVoice.id);
      expect(match).toBeDefined();
      expect(match!.name).toBe(activeVoice.name);
      expect(match!.originalMidiNote).toBe(activeVoice.originalMidiNote);
      expect(match!.color).toBe(activeVoice.color);
    }
  });
});

// ============================================================================
// Tests: Discard preserves active voice identity
// ============================================================================

describe('Voice identity through discard', () => {
  it('active layout should be unaffected after discarding working layout', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const originalMap = { ...getVoiceMap(active) };
    const originalIds = [...getVoiceIds(active)];

    // Create working and modify it
    const working = cloneLayout(active, 'working-1', 'Working', 'working');
    working.padToVoice['6,6'] = makeVoice('v-extra', 'Extra', 99);

    // "Discard" = just stop using working, active unchanged
    expect(getVoiceMap(active)).toEqual(originalMap);
    expect(getVoiceIds(active)).toEqual(originalIds);
  });

  it('modifying working layout voices should not affect active layout voices', () => {
    const active = makePopulatedLayout('active-1', 'Active');

    // Clone and rearrange
    const working = cloneLayout(active, 'working-1', 'Working', 'working');
    delete working.padToVoice['4,6']; // remove tom from working

    // Active should still have all 4 voices
    expect(Object.keys(active.padToVoice)).toHaveLength(4);
    expect(Object.keys(working.padToVoice)).toHaveLength(3);
  });
});

// ============================================================================
// Tests: Voice uniqueness invariants
// ============================================================================

describe('Voice uniqueness invariants', () => {
  it('each voice should appear at most once per layout', () => {
    const layout = makePopulatedLayout('test-1', 'Test');
    const voiceIds = Object.values(layout.padToVoice).map(v => v.id);
    const uniqueIds = new Set(voiceIds);
    expect(uniqueIds.size).toBe(voiceIds.length);
  });

  it('cloned layout should maintain voice uniqueness', () => {
    const active = makePopulatedLayout('active-1', 'Active');
    const working = cloneLayout(active, 'working-1', 'Working', 'working');
    const voiceIds = Object.values(working.padToVoice).map(v => v.id);
    const uniqueIds = new Set(voiceIds);
    expect(uniqueIds.size).toBe(voiceIds.length);
  });

  it('placement lock voice IDs should reference voices in the layout', () => {
    const layout = makePopulatedLayout('test-1', 'Test');
    const voiceIds = new Set(Object.values(layout.padToVoice).map(v => v.id));
    for (const lockedVoiceId of Object.keys(layout.placementLocks)) {
      expect(voiceIds.has(lockedVoiceId)).toBe(true);
    }
  });

  it('placement lock pad keys should be valid pad positions', () => {
    const layout = makePopulatedLayout('test-1', 'Test');
    for (const padKey of Object.values(layout.placementLocks)) {
      const [row, col] = padKey.split(',').map(Number);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(8);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(8);
    }
  });
});
