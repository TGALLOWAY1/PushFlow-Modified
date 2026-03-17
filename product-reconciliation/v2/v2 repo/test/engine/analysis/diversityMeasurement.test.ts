/**
 * Phase 4: Diversity Measurement Tests.
 *
 * Tests layout diversity metrics, duplicate detection, diff summaries,
 * low-diversity explanations, and end-to-end generator integration.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type CandidateSolution, type TradeoffProfile } from '../../../src/types/candidateSolution';
import { type Voice } from '../../../src/types/voice';
import {
  computeLayoutDiversity,
  classifyDiversityLevel,
  isTrivialDuplicate,
  filterTrivialDuplicates,
  buildBaselineDiffSummary,
  explainLowDiversity,
  buildGenerationSummary,
} from '../../../src/engine/analysis/diversityMeasurement';

// ============================================================================
// Test Factories
// ============================================================================

function makeVoice(id: string, name: string, midi: number): Voice {
  return {
    id,
    name,
    sourceType: 'midi_track',
    sourceFile: 'test.mid',
    originalMidiNote: midi,
    color: '#000',
  };
}

const v1 = makeVoice('v1', 'Kick', 36);
const v2 = makeVoice('v2', 'Snare', 38);
const v3 = makeVoice('v3', 'HiHat', 42);
const v4 = makeVoice('v4', 'Clap', 39);
const v5 = makeVoice('v5', 'Tom1', 45);
const v6 = makeVoice('v6', 'Tom2', 47);
const v7 = makeVoice('v7', 'Crash', 49);
const v8 = makeVoice('v8', 'Ride', 51);

function makeLayout(padToVoice: Record<string, Voice>, overrides?: Partial<Layout>): Layout {
  return {
    id: 'test-layout',
    name: 'Test Layout',
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active' as const,
    ...overrides,
  };
}

function makeCandidate(layout: Layout, strategy: string = 'test'): CandidateSolution {
  return {
    id: `cand-${strategy}`,
    layout,
    executionPlan: {
      score: 100,
      unplayableCount: 0,
      hardCount: 0,
      fingerAssignments: [],
      fingerUsageStats: {},
      fatigueMap: {},
      averageDrift: 0,
      averageMetrics: { fingerPreference: 0, handShapeDeviation: 0, transitionCost: 0, handBalance: 0, constraintPenalty: 0, total: 0 },
    },
    difficultyAnalysis: {
      overallScore: 0.5,
      passages: [],
      bindingConstraints: [],
    },
    tradeoffProfile: {
      playability: 0.7,
      compactness: 0.5,
      handBalance: 0.6,
      transitionEfficiency: 0.8,
    },
    metadata: {
      strategy,
      seed: 42,
    },
  };
}

// ============================================================================
// computeLayoutDiversity
// ============================================================================

describe('computeLayoutDiversity', () => {
  it('should return zero diversity for identical layouts', () => {
    const layout = makeLayout({ '0,0': v1, '0,1': v2, '1,0': v3 });
    const metrics = computeLayoutDiversity(layout, layout);

    expect(metrics.voicesMoved).toBe(0);
    expect(metrics.totalVoices).toBe(3);
    expect(metrics.moveFraction).toBe(0);
    expect(metrics.averageDisplacement).toBe(0);
    expect(metrics.maxDisplacement).toBe(0);
    expect(metrics.placementDiffs).toHaveLength(0);
  });

  it('should detect a single voice move', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2, '1,0': v3 });
    const candidate = makeLayout({ '0,0': v1, '0,1': v2, '2,0': v3 }); // v3 moved from 1,0 to 2,0

    const metrics = computeLayoutDiversity(candidate, baseline);

    expect(metrics.voicesMoved).toBe(1);
    expect(metrics.totalVoices).toBe(3);
    expect(metrics.moveFraction).toBeCloseTo(1 / 3);
    expect(metrics.averageDisplacement).toBe(1); // Manhattan distance 1,0→2,0 = 1
    expect(metrics.maxDisplacement).toBe(1);
    expect(metrics.placementDiffs).toHaveLength(1);
    expect(metrics.placementDiffs[0].voiceId).toBe('v3');
    expect(metrics.placementDiffs[0].baselinePad).toBe('1,0');
    expect(metrics.placementDiffs[0].candidatePad).toBe('2,0');
  });

  it('should detect multiple voice moves with correct distances', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4 });
    // Move v1: 0,0 → 3,3 (distance 6), move v3: 1,0 → 5,5 (distance 9)
    const candidate = makeLayout({ '3,3': v1, '0,1': v2, '5,5': v3, '1,1': v4 });

    const metrics = computeLayoutDiversity(candidate, baseline);

    expect(metrics.voicesMoved).toBe(2);
    expect(metrics.totalVoices).toBe(4);
    expect(metrics.moveFraction).toBe(0.5);
    expect(metrics.averageDisplacement).toBe(7.5); // (6 + 9) / 2
    expect(metrics.maxDisplacement).toBe(9);
  });

  it('should handle voices added in candidate but not in baseline', () => {
    const baseline = makeLayout({ '0,0': v1 });
    const candidate = makeLayout({ '0,0': v1, '1,1': v2 }); // v2 is new

    const metrics = computeLayoutDiversity(candidate, baseline);

    expect(metrics.voicesMoved).toBe(1);
    expect(metrics.totalVoices).toBe(2);
    expect(metrics.placementDiffs[0].baselinePad).toBeNull();
    expect(metrics.placementDiffs[0].candidatePad).toBe('1,1');
    expect(metrics.placementDiffs[0].manhattanDistance).toBeNull();
  });

  it('should handle voices removed in candidate', () => {
    const baseline = makeLayout({ '0,0': v1, '1,1': v2 });
    const candidate = makeLayout({ '0,0': v1 }); // v2 removed

    const metrics = computeLayoutDiversity(candidate, baseline);

    expect(metrics.voicesMoved).toBe(1);
    expect(metrics.placementDiffs[0].baselinePad).toBe('1,1');
    expect(metrics.placementDiffs[0].candidatePad).toBeNull();
    expect(metrics.placementDiffs[0].manhattanDistance).toBeNull();
  });

  it('should handle empty layouts', () => {
    const empty = makeLayout({});
    const metrics = computeLayoutDiversity(empty, empty);

    expect(metrics.voicesMoved).toBe(0);
    expect(metrics.totalVoices).toBe(0);
    expect(metrics.moveFraction).toBe(0);
  });

  it('should handle all voices moved', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2, '0,2': v3 });
    const candidate = makeLayout({ '7,7': v1, '7,6': v2, '7,5': v3 });

    const metrics = computeLayoutDiversity(candidate, baseline);

    expect(metrics.voicesMoved).toBe(3);
    expect(metrics.moveFraction).toBe(1);
  });
});

// ============================================================================
// classifyDiversityLevel
// ============================================================================

describe('classifyDiversityLevel', () => {
  it('should classify identical as identical', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 0, totalVoices: 10, moveFraction: 0,
      averageDisplacement: 0, maxDisplacement: 0, placementDiffs: [],
    });
    expect(level).toBe('identical');
  });

  it('should classify 1 voice moved as trivial', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 1, totalVoices: 10, moveFraction: 0.1,
      averageDisplacement: 1, maxDisplacement: 1, placementDiffs: [],
    });
    expect(level).toBe('trivial');
  });

  it('should classify very small fraction as trivial', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 2, totalVoices: 50, moveFraction: 0.04,
      averageDisplacement: 3, maxDisplacement: 5, placementDiffs: [],
    });
    expect(level).toBe('trivial');
  });

  it('should classify 15% moved as low', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 3, totalVoices: 20, moveFraction: 0.15,
      averageDisplacement: 2, maxDisplacement: 4, placementDiffs: [],
    });
    expect(level).toBe('low');
  });

  it('should classify 35% moved as moderate', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 7, totalVoices: 20, moveFraction: 0.35,
      averageDisplacement: 3, maxDisplacement: 6, placementDiffs: [],
    });
    expect(level).toBe('moderate');
  });

  it('should classify 80% moved as high', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 8, totalVoices: 10, moveFraction: 0.8,
      averageDisplacement: 4, maxDisplacement: 7, placementDiffs: [],
    });
    expect(level).toBe('high');
  });

  it('should classify 100% moved as high', () => {
    const level = classifyDiversityLevel({
      voicesMoved: 5, totalVoices: 5, moveFraction: 1.0,
      averageDisplacement: 5, maxDisplacement: 10, placementDiffs: [],
    });
    expect(level).toBe('high');
  });
});

// ============================================================================
// isTrivialDuplicate
// ============================================================================

describe('isTrivialDuplicate', () => {
  it('should detect identical layouts as trivial duplicates', () => {
    const layout = makeLayout({ '0,0': v1, '0,1': v2 });
    const a = makeCandidate(layout, 'a');
    const b = makeCandidate(layout, 'b');

    expect(isTrivialDuplicate(a, b)).toBe(true);
  });

  it('should detect single-voice change as trivial duplicate', () => {
    const layoutA = makeLayout({ '0,0': v1, '0,1': v2, '1,0': v3 });
    const layoutB = makeLayout({ '0,0': v1, '0,1': v2, '1,1': v3 }); // v3 moved 1 pad
    const a = makeCandidate(layoutA, 'a');
    const b = makeCandidate(layoutB, 'b');

    expect(isTrivialDuplicate(a, b)).toBe(true);
  });

  it('should not flag substantially different layouts as duplicates', () => {
    const layoutA = makeLayout({ '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4 });
    const layoutB = makeLayout({ '7,7': v1, '7,6': v2, '6,7': v3, '6,6': v4 });
    const a = makeCandidate(layoutA, 'a');
    const b = makeCandidate(layoutB, 'b');

    expect(isTrivialDuplicate(a, b)).toBe(false);
  });
});

// ============================================================================
// filterTrivialDuplicates
// ============================================================================

describe('filterTrivialDuplicates', () => {
  it('should keep all candidates when no duplicates', () => {
    const candidates = [
      makeCandidate(makeLayout({ '0,0': v1, '0,1': v2 }), 'a'),
      makeCandidate(makeLayout({ '7,7': v1, '7,6': v2 }), 'b'),
    ];

    const [filtered, removed] = filterTrivialDuplicates(candidates);

    expect(filtered).toHaveLength(2);
    expect(removed).toBe(0);
  });

  it('should remove duplicates and keep first occurrence', () => {
    const layout = makeLayout({ '0,0': v1, '0,1': v2 });
    const candidates = [
      makeCandidate(layout, 'first'),
      makeCandidate(layout, 'duplicate1'),
      makeCandidate(makeLayout({ '7,7': v1, '7,6': v2 }), 'different'),
      makeCandidate(layout, 'duplicate2'),
    ];

    const [filtered, removed] = filterTrivialDuplicates(candidates);

    expect(filtered).toHaveLength(2);
    expect(removed).toBe(2);
    expect(filtered[0].metadata.strategy).toBe('first');
    expect(filtered[1].metadata.strategy).toBe('different');
  });

  it('should handle empty candidate list', () => {
    const [filtered, removed] = filterTrivialDuplicates([]);

    expect(filtered).toHaveLength(0);
    expect(removed).toBe(0);
  });

  it('should handle single candidate', () => {
    const [filtered, removed] = filterTrivialDuplicates([
      makeCandidate(makeLayout({ '0,0': v1 }), 'only'),
    ]);

    expect(filtered).toHaveLength(1);
    expect(removed).toBe(0);
  });
});

// ============================================================================
// buildBaselineDiffSummary
// ============================================================================

describe('buildBaselineDiffSummary', () => {
  it('should report identical for same layout', () => {
    const layout = makeLayout({ '0,0': v1, '0,1': v2 });
    const candidate = makeCandidate(layout);

    const diff = buildBaselineDiffSummary(candidate, layout);

    expect(diff.diversityLevel).toBe('identical');
    expect(diff.summary).toContain('Identical');
    expect(diff.metrics.voicesMoved).toBe(0);
  });

  it('should report meaningful diff for moved voices', () => {
    const baseline = makeLayout({
      '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4,
      '2,0': v5, '2,1': v6, '3,0': v7, '3,1': v8,
    });
    const candidateLayout = makeLayout({
      '0,0': v1, '0,1': v2, '5,5': v3, '5,6': v4,
      '6,5': v5, '6,6': v6, '3,0': v7, '3,1': v8,
    });
    const candidate = makeCandidate(candidateLayout);

    const diff = buildBaselineDiffSummary(candidate, baseline);

    expect(diff.metrics.voicesMoved).toBe(4);
    expect(diff.metrics.totalVoices).toBe(8);
    expect(diff.diversityLevel).toBe('moderate');
    expect(diff.summary).toContain('4 of 8');
  });

  it('should include tradeoff deltas when baseline profile provided', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2 });
    const candidateLayout = makeLayout({ '7,7': v1, '7,6': v2 });
    const candidate = makeCandidate(candidateLayout);
    candidate.tradeoffProfile.playability = 0.9;

    const baselineProfile: TradeoffProfile = {
      playability: 0.5,
      compactness: 0.5,
      handBalance: 0.6,
      transitionEfficiency: 0.8,
    };

    const diff = buildBaselineDiffSummary(candidate, baseline, baselineProfile);

    expect(diff.tradeoffDeltas).toBeDefined();
    expect(diff.tradeoffDeltas!.playability).toBeCloseTo(0.4);
  });

  it('should omit negligible tradeoff deltas', () => {
    const layout = makeLayout({ '0,0': v1 });
    const candidate = makeCandidate(makeLayout({ '7,7': v1 }));

    const baselineProfile: TradeoffProfile = {
      playability: 0.7,
      compactness: 0.5,
      handBalance: 0.6,
      transitionEfficiency: 0.8,
    };

    const diff = buildBaselineDiffSummary(candidate, layout, baselineProfile);

    // Dimensions where delta < 0.005 should be omitted
    if (diff.tradeoffDeltas) {
      for (const [, delta] of Object.entries(diff.tradeoffDeltas)) {
        expect(Math.abs(delta)).toBeGreaterThan(0.005);
      }
    }
  });
});

// ============================================================================
// explainLowDiversity
// ============================================================================

describe('explainLowDiversity', () => {
  it('should return explanation for empty candidate list', () => {
    const baseline = makeLayout({ '0,0': v1 });
    const explanation = explainLowDiversity([], baseline);

    expect(explanation).toBeDefined();
    expect(explanation).toContain('No candidates');
  });

  it('should return undefined when candidates are diverse', () => {
    const baseline = makeLayout({
      '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4,
    });
    // Candidate with >50% voices moved → high diversity
    const diverseCandidate = makeCandidate(makeLayout({
      '7,7': v1, '7,6': v2, '6,7': v3, '6,6': v4,
    }));

    const explanation = explainLowDiversity([diverseCandidate], baseline);

    expect(explanation).toBeUndefined();
  });

  it('should explain when all candidates are identical to baseline', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2 });
    const identicalCandidate = makeCandidate(baseline);

    const explanation = explainLowDiversity([identicalCandidate], baseline);

    expect(explanation).toBeDefined();
  });

  it('should explain when most voices are locked', () => {
    const baseline = makeLayout(
      { '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4 },
      {
        placementLocks: {
          v1: '0,0', v2: '0,1', v3: '1,0', v4: '1,1',
        },
      },
    );
    const candidate = makeCandidate(baseline);

    const explanation = explainLowDiversity([candidate], baseline);

    expect(explanation).toBeDefined();
    expect(explanation).toContain('placement locks');
  });

  it('should explain when only 1-2 voices exist', () => {
    const baseline = makeLayout({ '0,0': v1 });
    const candidate = makeCandidate(baseline);

    const explanation = explainLowDiversity([candidate], baseline);

    expect(explanation).toBeDefined();
    expect(explanation).toContain('1 voice');
  });

  it('should explain when empty layout has no assignments', () => {
    const baseline = makeLayout({});
    const candidate = makeCandidate(baseline);

    const explanation = explainLowDiversity([candidate], baseline);

    expect(explanation).toBeDefined();
    expect(explanation).toContain('no voice assignments');
  });
});

// ============================================================================
// buildGenerationSummary
// ============================================================================

describe('buildGenerationSummary', () => {
  it('should report no duplicates when all unique', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2 });
    const candidates = [
      makeCandidate(makeLayout({ '0,0': v1, '0,1': v2 })),
      makeCandidate(makeLayout({ '7,7': v1, '7,6': v2 })),
    ];

    const summary = buildGenerationSummary(2, 0, candidates, baseline);

    expect(summary.candidatesGenerated).toBe(2);
    expect(summary.duplicatesRemoved).toBe(0);
    expect(summary.candidatesReturned).toBe(2);
  });

  it('should report duplicates removed', () => {
    const baseline = makeLayout({ '0,0': v1 });
    const candidates = [
      makeCandidate(makeLayout({ '7,7': v1 })),
    ];

    const summary = buildGenerationSummary(3, 2, candidates, baseline);

    expect(summary.candidatesGenerated).toBe(3);
    expect(summary.duplicatesRemoved).toBe(2);
    expect(summary.candidatesReturned).toBe(1);
  });

  it('should flag low diversity when candidates are too similar', () => {
    const baseline = makeLayout({ '0,0': v1, '0,1': v2 });
    const candidates = [
      makeCandidate(baseline), // Identical to baseline
    ];

    const summary = buildGenerationSummary(3, 2, candidates, baseline);

    expect(summary.isLowDiversity).toBe(true);
    expect(summary.lowDiversityExplanation).toBeDefined();
  });

  it('should not flag low diversity when candidates are diverse', () => {
    const baseline = makeLayout({
      '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4,
    });
    const candidates = [
      makeCandidate(makeLayout({
        '7,7': v1, '7,6': v2, '6,7': v3, '6,6': v4,
      })),
    ];

    const summary = buildGenerationSummary(1, 0, candidates, baseline);

    expect(summary.isLowDiversity).toBe(false);
    expect(summary.lowDiversityExplanation).toBeUndefined();
  });
});

// ============================================================================
// Integration: diversity summary text quality
// ============================================================================

describe('diff summary text quality', () => {
  it('should produce single-voice summary for trivial change', () => {
    const baseline = makeLayout({
      '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4,
      '2,0': v5, '2,1': v6, '3,0': v7, '3,1': v8,
    });
    // Move only v1 from 0,0 to 0,2
    const candidateLayout = makeLayout({
      '0,2': v1, '0,1': v2, '1,0': v3, '1,1': v4,
      '2,0': v5, '2,1': v6, '3,0': v7, '3,1': v8,
    });
    const candidate = makeCandidate(candidateLayout);

    const diff = buildBaselineDiffSummary(candidate, baseline);

    expect(diff.diversityLevel).toBe('trivial');
    expect(diff.summary).toContain('1 voice');
    expect(diff.summary).toContain('Kick');
  });

  it('should include displacement info for moderate changes', () => {
    const baseline = makeLayout({
      '0,0': v1, '0,1': v2, '1,0': v3, '1,1': v4,
      '2,0': v5, '2,1': v6, '3,0': v7, '3,1': v8,
    });
    // Move 4 voices substantially
    const candidateLayout = makeLayout({
      '0,0': v1, '0,1': v2, '5,5': v3, '5,6': v4,
      '6,5': v5, '6,6': v6, '3,0': v7, '3,1': v8,
    });
    const candidate = makeCandidate(candidateLayout);

    const diff = buildBaselineDiffSummary(candidate, baseline);

    expect(diff.summary).toContain('avg displacement');
    expect(diff.summary).toContain('pads');
  });
});
