/**
 * Composer Preset Types.
 *
 * A ComposerPreset is the core artifact of the Composer reverse workflow.
 * It bundles up to three things into one authored unit:
 *   1. Quantized event pattern (always present)
 *   2. Relative pad layout (optional — may be assigned after save)
 *   3. Finger assignments per pad (included with pad layout)
 *
 * A preset can be saved with just the pattern data (empty pads array).
 * Layout and finger assignments can be added later before placing on the grid.
 * Presets are stored with relative coordinates so they can be placed
 * at any valid position on the 8×8 Push grid via translation.
 */

import { type FingerType, type HandSide } from './fingerModel';
import { type LoopConfig, type LoopLane, type LoopEvent, type LoopCellKey } from './loopEditor';

// ============================================================================
// Relative Coordinate System
// ============================================================================

/** A pad position relative to the preset's bounding box origin (0,0 = bottom-left). */
export interface RelativePadPosition {
  /** Row offset from bottom of bounding box (0 = lowest row). */
  rowOffset: number;
  /** Column offset from left of bounding box (0 = leftmost col). */
  colOffset: number;
}

// ============================================================================
// Preset Pad
// ============================================================================

/** A single pad in a preset with its voice slot and finger assignment. */
export interface PresetPad {
  /** Relative position within the preset's bounding box. */
  position: RelativePadPosition;
  /** Lane ID this pad is linked to (connects pad → events). */
  laneId: string;
  /**
   * Finger that plays this pad: the Sound's finger preference when the preset
   * was saved, or null when there was none (Save Preset never invents one, T65).
   */
  finger: FingerType | null;
  /** Hand that plays this pad, or null when no preference was recorded. */
  hand: HandSide | null;
  /**
   * Where hand and finger came from. 'preference': the Sound's finger
   * preference when the preset was saved, applied (as a soft preference) on
   * placement. 'unverified' (or absent, in presets saved before this was
   * recorded): made up by Save Preset (hand from the column, index finger),
   * shown as unverified and never applied (F9-12).
   */
  fingerSource?: PresetFingerSource;
}

export type PresetFingerSource = 'preference' | 'unverified';

// ============================================================================
// Handedness
// ============================================================================

/** Handedness classification for mirror eligibility. */
export type PresetHandedness = 'left' | 'right' | 'both';

// ============================================================================
// Bounding Box
// ============================================================================

/** Size of the preset's relative grid. */
export interface PresetBoundingBox {
  /** Number of rows spanned (max rowOffset + 1). */
  rows: number;
  /** Number of columns spanned (max colOffset + 1). */
  cols: number;
}

// ============================================================================
// Composer Preset
// ============================================================================

/**
 * The core authored artifact: layout + fingers + events as one unit.
 *
 * This is NOT a PerformancePreset (which stores loop state without layout/finger data).
 * A ComposerPreset is a fundamentally different concept: a reusable performance object
 * that can be placed and combined in the workspace.
 */
export interface ComposerPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  /** Relative pad layout with finger assignments. Empty if pattern saved before layout assignment. */
  pads: PresetPad[];

  /** Event pattern data. */
  config: LoopConfig;
  lanes: LoopLane[];
  /** Serialized as [key, event][] for JSON compatibility. */
  events: [LoopCellKey, LoopEvent][];

  /** Derived metadata (computed on save, used for filtering/preview). */
  handedness: PresetHandedness;
  mirrorEligible: boolean;
  boundingBox: PresetBoundingBox;

  /** User-facing metadata. */
  tags: string[];
  category?: string;
}

// ============================================================================
// Placed Preset Instance
// ============================================================================

/**
 * A placed instance of a preset in the workspace.
 *
 * Contains a snapshot of preset data at placement time so the instance
 * is self-contained and survives preset edits/deletion.
 */
export interface PlacedPresetInstance {
  id: string;
  /** Reference to source preset (for UI linking, may be stale). */
  presetId: string;
  /** Snapshot of name at placement time. */
  presetName: string;

  /** Absolute anchor position on the 8×8 grid (where bounding box origin maps). */
  anchorRow: number;
  anchorCol: number;

  /** Whether this instance is mirrored relative to the original preset. */
  isMirrored: boolean;

  /** Snapshot of preset data (may be mirrored). */
  pads: PresetPad[];
  config: LoopConfig;
  lanes: LoopLane[];
  events: [LoopCellKey, LoopEvent][];
  boundingBox: PresetBoundingBox;
}

// ============================================================================
// Workspace Assembly State
// ============================================================================

/** Ephemeral drag preview state (not persisted). */
export interface PresetDragPreview {
  presetId: string;
  anchorRow: number;
  anchorCol: number;
  isMirrored: boolean;
  isValid: boolean;
  pads: PresetPad[];
  boundingBox: PresetBoundingBox;
}

/** State for the Composer workspace assembly. */
export interface ComposerWorkspaceState {
  placedInstances: PlacedPresetInstance[];
  selectedInstanceId: string | null;
}

// ============================================================================
// Pure Helpers
// ============================================================================

/** Compute bounding box from a set of preset pads. */
export function computeBoundingBox(pads: PresetPad[]): PresetBoundingBox {
  if (pads.length === 0) return { rows: 0, cols: 0 };
  let maxRow = 0;
  let maxCol = 0;
  for (const pad of pads) {
    if (pad.position.rowOffset > maxRow) maxRow = pad.position.rowOffset;
    if (pad.position.colOffset > maxCol) maxCol = pad.position.colOffset;
  }
  return { rows: maxRow + 1, cols: maxCol + 1 };
}

/** Determine handedness from preset pads. */
export function computeHandedness(pads: PresetPad[]): PresetHandedness {
  if (pads.length === 0) return 'both';
  let hasLeft = false;
  let hasRight = false;
  for (const pad of pads) {
    if (pad.hand === 'left') hasLeft = true;
    if (pad.hand === 'right') hasRight = true;
    if (hasLeft && hasRight) return 'both';
  }
  if (!hasLeft && !hasRight) return 'both'; // no hand recorded on any pad
  return hasLeft ? 'left' : 'right';
}

/** Determine mirror eligibility (single-hand presets only). */
export function isMirrorEligible(handedness: PresetHandedness): boolean {
  return handedness === 'left' || handedness === 'right';
}

/**
 * Normalize pad positions to be relative to bounding box origin.
 * Shifts all positions so the minimum row/col offset is 0.
 */
export function normalizePadPositions(pads: PresetPad[]): PresetPad[] {
  if (pads.length === 0) return [];
  let minRow = Infinity;
  let minCol = Infinity;
  for (const pad of pads) {
    if (pad.position.rowOffset < minRow) minRow = pad.position.rowOffset;
    if (pad.position.colOffset < minCol) minCol = pad.position.colOffset;
  }
  if (minRow === 0 && minCol === 0) return pads;
  return pads.map(pad => ({
    ...pad,
    position: {
      rowOffset: pad.position.rowOffset - minRow,
      colOffset: pad.position.colOffset - minCol,
    },
  }));
}

/** Whether a pad's hand and finger are a real preference (and so may be applied). */
export function isPresetFingerVerified(pad: PresetPad): boolean {
  return pad.fingerSource === 'preference';
}

/** Whether any of a preset's pads carries fingering that is not applied (blank pads carry none). */
export function hasUnverifiedFingering(pads: PresetPad[]): boolean {
  return pads.some(pad => pad.finger != null && !isPresetFingerVerified(pad));
}

/** Whether a preset records a hand on any pad. */
export function hasRecordedHands(pads: PresetPad[]): boolean {
  return pads.some(pad => pad.hand != null);
}

/**
 * Whether a preset can be mirrored: it has pads, and they are played by one
 * hand or by no recorded hand (mirroring then only flips the columns).
 */
export function canMirrorPreset(pads: PresetPad[]): boolean {
  if (pads.length === 0) return false;
  return !hasRecordedHands(pads) || isMirrorEligible(computeHandedness(pads));
}

const FINGER_NUMBER: Record<FingerType, number> = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };

/**
 * The finger constraint ('L2') placing this pad applies, or null when its
 * fingering is unverified and must not be applied (F9-12).
 */
export function presetPadFingerConstraint(pad: PresetPad): string | null {
  if (!isPresetFingerVerified(pad) || !pad.hand || !pad.finger) return null;
  return `${pad.hand === 'left' ? 'L' : 'R'}${FINGER_NUMBER[pad.finger] ?? 2}`;
}

/** Create the initial empty composer workspace state. */
export function createInitialComposerWorkspaceState(): ComposerWorkspaceState {
  return {
    placedInstances: [],
    selectedInstanceId: null,
  };
}
