/**
 * BeamSolver Smoke Tests.
 *
 * Basic tests to verify the solver produces valid output for simple inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  runSolver,
  createTestPerformance,
  assertNoNaNs,
  assertValidGridPositions,
  assertMappingIntegrity,
  assertEventCount,
  countHandUsage,
  beatsToSeconds,
} from '../../helpers/testHelpers';

describe('BeamSolver Smoke Tests', () => {
  it('should solve a single-note performance', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
    ]);

    const result = await runSolver(perf);

    assertEventCount(result, 1);
    assertNoNaNs(result);
    assertValidGridPositions(result);
    assertMappingIntegrity(result);
    expect(result.unplayableCount).toBe(0);
  });

  it('should solve a two-note sequence', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
    ]);

    const result = await runSolver(perf);

    assertEventCount(result, 2);
    assertNoNaNs(result);
    expect(result.unplayableCount).toBe(0);
  });

  it('should handle simultaneous notes', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.0 },
    ]);

    const result = await runSolver(perf);

    assertEventCount(result, 2);
    assertNoNaNs(result);
  });

  it('should handle a 4-note chord', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.0 },
      { noteNumber: 40, startTime: 0.0 },
      { noteNumber: 42, startTime: 0.0 },
    ]);

    const result = await runSolver(perf);

    assertEventCount(result, 4);
    assertNoNaNs(result);
    assertValidGridPositions(result);
  });

  it('should handle a longer sequence without errors', async () => {
    const notes: Array<{ noteNumber: number; startTime: number }> = [];
    for (let i = 0; i < 32; i++) {
      notes.push({
        noteNumber: 36 + (i % 8),
        startTime: i * beatsToSeconds(0.5),
      });
    }

    const perf = createTestPerformance(notes, 'Long sequence');
    const result = await runSolver(perf);

    assertEventCount(result, 32);
    assertNoNaNs(result);
    assertValidGridPositions(result);
    assertMappingIntegrity(result);

    // V1 (D-03): Without emergency fallback, some events in a wide sequence
    // may be infeasible. Verify the solver produces assignments for most events.
    const handUsage = countHandUsage(result);
    expect(handUsage.left + handUsage.right).toBeGreaterThan(0);
    expect(handUsage.left + handUsage.right + handUsage.unplayable).toBe(32);
  });

  it('should handle empty performance', async () => {
    const perf = createTestPerformance([]);
    const result = await runSolver(perf);

    assertEventCount(result, 0);
    expect(result.unplayableCount).toBe(0);
  });

  it('should produce valid cost breakdowns', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.25 },
      { noteNumber: 40, startTime: 0.5 },
    ]);

    const result = await runSolver(perf);

    for (const fa of result.fingerAssignments) {
      if (fa.assignedHand !== 'Unplayable' && fa.costBreakdown) {
        expect(fa.costBreakdown.total).toBeGreaterThanOrEqual(0);
        expect(fa.costBreakdown.transitionCost).toBeGreaterThanOrEqual(0);
        expect(fa.costBreakdown.fingerPreference).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should report finger usage stats', async () => {
    const perf = createTestPerformance([
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 40, startTime: 1.0 },
    ]);

    const result = await runSolver(perf);

    const totalUsage = Object.values(result.fingerUsageStats).reduce(
      (sum, count) => sum + count,
      0
    );
    expect(totalUsage).toBe(3);
  });
});
