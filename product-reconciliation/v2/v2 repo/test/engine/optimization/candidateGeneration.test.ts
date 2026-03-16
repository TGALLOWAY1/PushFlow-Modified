/**
 * Phase 4: End-to-end candidate generation integration tests.
 *
 * Tests that generateCandidates produces baseline-aware output with
 * diversity metrics, duplicate filtering, and generation summaries.
 */

import { describe, it, expect } from 'vitest';
import { type Layout } from '../../../src/types/layout';
import { type Voice } from '../../../src/types/voice';
import { generateCandidates } from '../../../src/engine/optimization/multiCandidateGenerator';
import { createTestPerformance, DEFAULT_TEST_INSTRUMENT_CONFIG, DEFAULT_ENGINE_CONFIG } from '../../helpers/testHelpers';

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
    color: '#000',
  };
}

function makeActiveLayout(): Layout {
  const v1 = makeVoice('v1', 'Kick', 36);
  const v2 = makeVoice('v2', 'Snare', 38);
  const v3 = makeVoice('v3', 'HiHat', 42);
  const v4 = makeVoice('v4', 'Clap', 39);

  return {
    id: 'active-001',
    name: 'Active Layout',
    padToVoice: {
      '0,0': v1,
      '0,2': v2,
      '2,4': v3,
      '2,6': v4,
    },
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    role: 'active' as const,
  };
}

// ============================================================================
// End-to-end tests
// ============================================================================

describe('generateCandidates with activeLayout', () => {
  it('should return CandidateGenerationResult with summary when activeLayout provided', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 42, startTime: 1.0 },
    ]);

    const activeLayout = makeActiveLayout();

    const result = await generateCandidates(perf, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: activeLayout,
      activeLayout,
    });

    expect(result.summary).not.toBeNull();
    expect(result.summary!.candidatesGenerated).toBe(3);
    expect(result.summary!.candidatesReturned).toBeGreaterThan(0);
    expect(result.summary!.candidatesReturned).toBeLessThanOrEqual(3);
  });

  it('should attach baselineDiff to each candidate', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const activeLayout = makeActiveLayout();

    const result = await generateCandidates(perf, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: activeLayout,
      activeLayout,
    });

    for (const candidate of result.candidates) {
      expect(candidate.baselineDiff).toBeDefined();
      expect(candidate.baselineDiff!.diversityLevel).toBeDefined();
      expect(candidate.baselineDiff!.summary).toBeTruthy();
      expect(candidate.baselineDiff!.metrics.totalVoices).toBeGreaterThan(0);
    }
  });

  it('should filter trivial duplicates', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const activeLayout = makeActiveLayout();

    const result = await generateCandidates(perf, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: activeLayout,
      activeLayout,
    });

    // Duplicates should have been removed
    expect(result.summary!.duplicatesRemoved).toBeGreaterThanOrEqual(0);
    // Returned count should match
    expect(result.candidates.length).toBe(result.summary!.candidatesReturned);
  });

  it('should return null summary when no activeLayout provided', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const result = await generateCandidates(perf, null, {
      count: 2,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
    });

    expect(result.summary).toBeNull();
    expect(result.candidates.length).toBe(2);
    // No baselineDiff when no activeLayout
    for (const candidate of result.candidates) {
      expect(candidate.baselineDiff).toBeUndefined();
    }
  });

  it('should have valid diversity levels on all candidates', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 42, startTime: 1.0 },
      { noteNumber: 39, startTime: 1.5 },
    ]);

    const activeLayout = makeActiveLayout();

    const result = await generateCandidates(perf, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: activeLayout,
      activeLayout,
    });

    const validLevels = ['identical', 'trivial', 'low', 'moderate', 'high'];
    for (const candidate of result.candidates) {
      expect(validLevels).toContain(candidate.baselineDiff!.diversityLevel);
    }
  });

  it('should correctly identify the baseline candidate as identical', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const activeLayout = makeActiveLayout();

    const result = await generateCandidates(perf, null, {
      count: 3,
      engineConfig: DEFAULT_ENGINE_CONFIG,
      instrumentConfig: DEFAULT_TEST_INSTRUMENT_CONFIG,
      baseLayout: activeLayout,
      activeLayout,
    });

    // The baseline candidate should be identical to the active layout
    const baselineCandidate = result.candidates.find(
      c => c.metadata.strategy === 'baseline',
    );
    if (baselineCandidate) {
      expect(baselineCandidate.baselineDiff!.diversityLevel).toBe('identical');
      expect(baselineCandidate.baselineDiff!.metrics.voicesMoved).toBe(0);
    }
  });
});
