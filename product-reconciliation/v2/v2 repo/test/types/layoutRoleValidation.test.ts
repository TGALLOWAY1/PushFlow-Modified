/**
 * Phase 6: Layout role validation tests.
 *
 * Validates that validateLayoutRole and isLayoutRoleValid correctly
 * enforce role invariants for active, working, and variant layouts.
 */

import { describe, it, expect } from 'vitest';
import {
  type Layout,
  createEmptyLayout,
  cloneLayout,
  validateLayoutRole,
  isLayoutRoleValid,
} from '../../src/types/layout';

// ============================================================================
// Tests: validateLayoutRole
// ============================================================================

describe('validateLayoutRole', () => {
  it('should pass for a valid active layout', () => {
    const layout = createEmptyLayout('active-001', 'My Active', 'active');
    const violations = validateLayoutRole(layout);
    expect(violations).toHaveLength(0);
  });

  it('should flag active layout with baselineId', () => {
    const layout: Layout = {
      ...createEmptyLayout('active-001', 'My Active', 'active'),
      baselineId: 'some-other-layout',
    };

    const violations = validateLayoutRole(layout);

    expect(violations).toHaveLength(1);
    expect(violations[0].field).toBe('baselineId');
    expect(violations[0].expected).toContain('undefined');
  });

  it('should pass for a valid working layout with baselineId', () => {
    const active = createEmptyLayout('active-001', 'Active', 'active');
    const working = cloneLayout(active, 'working-001', 'Working Copy', 'working');

    const violations = validateLayoutRole(working);

    expect(violations).toHaveLength(0);
    expect(working.baselineId).toBe('active-001');
  });

  it('should flag working layout without baselineId', () => {
    const layout = createEmptyLayout('working-001', 'Working', 'working');
    // No baselineId set

    const violations = validateLayoutRole(layout);

    expect(violations).toHaveLength(1);
    expect(violations[0].field).toBe('baselineId');
  });

  it('should pass for a valid variant layout with baselineId and savedAt', () => {
    const active = createEmptyLayout('active-001', 'Active', 'active');
    const variant = cloneLayout(active, 'variant-001', 'Saved Variant', 'variant');
    // cloneLayout sets savedAt for variants

    const violations = validateLayoutRole(variant);

    expect(violations).toHaveLength(0);
    expect(variant.baselineId).toBe('active-001');
    expect(variant.savedAt).toBeTruthy();
  });

  it('should flag variant layout without baselineId', () => {
    const layout: Layout = {
      ...createEmptyLayout('variant-001', 'Bad Variant', 'variant'),
      savedAt: new Date().toISOString(),
    };

    const violations = validateLayoutRole(layout);

    expect(violations.some(v => v.field === 'baselineId')).toBe(true);
  });

  it('should flag variant layout without savedAt', () => {
    const layout: Layout = {
      ...createEmptyLayout('variant-001', 'Bad Variant', 'variant'),
      baselineId: 'active-001',
      // No savedAt
    };

    const violations = validateLayoutRole(layout);

    expect(violations.some(v => v.field === 'savedAt')).toBe(true);
  });

  it('should flag variant layout missing both baselineId and savedAt', () => {
    const layout = createEmptyLayout('variant-001', 'Bad Variant', 'variant');

    const violations = validateLayoutRole(layout);

    expect(violations).toHaveLength(2);
    expect(violations.map(v => v.field)).toContain('baselineId');
    expect(violations.map(v => v.field)).toContain('savedAt');
  });
});

// ============================================================================
// Tests: isLayoutRoleValid
// ============================================================================

describe('isLayoutRoleValid', () => {
  it('should return true for valid active layout', () => {
    const layout = createEmptyLayout('a', 'Active', 'active');
    expect(isLayoutRoleValid(layout)).toBe(true);
  });

  it('should return false for active layout with baselineId', () => {
    const layout: Layout = {
      ...createEmptyLayout('a', 'Active', 'active'),
      baselineId: 'x',
    };
    expect(isLayoutRoleValid(layout)).toBe(false);
  });

  it('should return true for valid working layout', () => {
    const active = createEmptyLayout('a', 'Active', 'active');
    const working = cloneLayout(active, 'w', 'Working', 'working');
    expect(isLayoutRoleValid(working)).toBe(true);
  });

  it('should return false for working layout without baselineId', () => {
    const layout = createEmptyLayout('w', 'Working', 'working');
    expect(isLayoutRoleValid(layout)).toBe(false);
  });
});
