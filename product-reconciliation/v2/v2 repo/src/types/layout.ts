/**
 * Layout types for the Push 3 pad assignment artifact.
 *
 * A Layout is a static assignment from musical identities (voices)
 * to pad positions on the 8x8 Push 3 surface.
 *
 * Canonical terminology:
 * - Layout: the full pad-assignment artifact
 * - padToVoice: the mapping data structure (was "cells" in Version1)
 * - padKey(): coordinate string (was "cellKey()" in Version1)
 *
 * V3 workflow roles:
 * - Active Layout: the committed baseline (read-mostly, changed only by Promote)
 * - Working/Test Layout: a session-scoped exploratory draft (created on first edit)
 * - Saved Layout Variant: a durable named alternative (kept for comparison)
 */

import { type Voice } from './voice';

/** Layout origin mode - tracks how the layout was created. */
export type LayoutMode = 'manual' | 'optimized' | 'random' | 'auto' | 'none';

/**
 * LayoutRole: the workflow role of a layout in the project.
 *
 * - 'active': the committed baseline
 * - 'working': the session-scoped exploratory draft
 * - 'variant': a durable named alternative
 */
export type LayoutRole = 'active' | 'working' | 'variant';

/**
 * Layout: A complete pad assignment configuration.
 *
 * Maps pad positions ("row,col" keys) to Voice objects.
 * This is the first core output artifact of the system.
 */
export interface Layout {
  /** Unique identifier. */
  id: string;
  /** Display name for this layout. */
  name: string;
  /**
   * Assignment: pad key ("row,col") -> Voice.
   * This is the core mapping data structure.
   */
  padToVoice: Record<string, Voice>;
  /** Per-pad soft finger constraints, e.g., { "2,3": "L1" }. Solver prefers but does not require. */
  fingerConstraints: Record<string, string>;
  /**
   * Explicit placement locks: voice ID -> pad key.
   * Hard constraints: the solver must not move these voices.
   * These survive promote/discard and are the canonical user-facing placement rule.
   */
  placementLocks: Record<string, string>;
  /** Cached score (null if invalidated). */
  scoreCache: number | null;
  /** How this layout was created. */
  layoutMode?: LayoutMode;
  /** The workflow role of this layout. */
  role: LayoutRole;
  /**
   * If this is a working layout or variant, which layout it was branched from.
   * For active layouts, this is undefined.
   */
  baselineId?: string;
  /** Version number (incremented on save). */
  version?: number;
  /** ISO timestamp when saved. */
  savedAt?: string;
}

/**
 * Create an empty layout with the given id, name, and role.
 */
export function createEmptyLayout(id: string, name: string, role: LayoutRole = 'active'): Layout {
  return {
    id,
    name,
    padToVoice: {},
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'none',
    role,
  };
}

/**
 * Clone a layout with a new id, name, and role.
 * Used when creating a working copy or saving as a variant.
 */
export function cloneLayout(
  source: Layout,
  id: string,
  name: string,
  role: LayoutRole,
): Layout {
  return {
    ...source,
    id,
    name,
    role,
    baselineId: source.id,
    scoreCache: null,
    savedAt: role === 'variant' ? new Date().toISOString() : undefined,
    placementLocks: { ...source.placementLocks },
    padToVoice: { ...source.padToVoice },
    fingerConstraints: { ...source.fingerConstraints },
  };
}
