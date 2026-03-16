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
 */

import { type Voice } from './voice';

/** Layout origin mode - tracks how the layout was created. */
export type LayoutMode = 'manual' | 'optimized' | 'random' | 'auto' | 'none';

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
  /** Per-pad finger constraints, e.g., "L1", "R5". */
  fingerConstraints: Record<string, string>;
  /** Cached score (null if invalidated). */
  scoreCache: number | null;
  /** How this layout was created. */
  layoutMode?: LayoutMode;
  /** Version number (incremented on save). */
  version?: number;
  /** ISO timestamp when saved. */
  savedAt?: string;
}

/**
 * Create an empty layout with the given id and name.
 */
export function createEmptyLayout(id: string, name: string): Layout {
  return {
    id,
    name,
    padToVoice: {},
    fingerConstraints: {},
    scoreCache: null,
    layoutMode: 'none',
  };
}
