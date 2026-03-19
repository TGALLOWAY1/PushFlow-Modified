/**
 * Persisted Project Shape.
 *
 * Defines the exact durable fields stored in IndexedDB.
 * Intentionally excludes computed/derived data (costs, analysis results,
 * difficulty scores) which are recomputed after load.
 */

import { type Layout } from '../../types/layout';
import { type InstrumentConfig } from '../../types/performance';
import { type Section, type VoiceProfile } from '../../types/performanceStructure';
import { type PerformanceLane, type LaneGroup, type SourceFile } from '../../types/performanceLane';
import { type EngineConfiguration } from '../../types/engineConfig';
import { type CostToggles } from '../../types/costToggles';
import { type OptimizerMethodKey } from '../../engine/optimization/optimizerInterface';
import { type SoundStream } from '../state/projectState';

// ============================================================================
// Schema Version
// ============================================================================

/**
 * Current persisted schema version.
 * Bump this when the persisted shape changes in a breaking way.
 */
export const PERSISTED_SCHEMA_VERSION = 1;

// ============================================================================
// Persisted Project Document
// ============================================================================

/**
 * The exact shape written to IndexedDB.
 * Only durable project data — no costs, no analysis, no ephemeral UI state.
 */
export interface PersistedProject {
  /** Unique project identifier. */
  id: string;
  /** User-facing project name. */
  name: string;
  /** BPM / tempo. */
  bpm: number;

  // --- Layouts ---
  /** Committed baseline layout. */
  activeLayout: Layout;
  /** Durable named alternative layouts. */
  savedVariants: Layout[];

  // --- Sound State ---
  /** Independent timing tracks (one per sound). */
  soundStreams: SoundStream[];

  // --- Instrument Config ---
  instrumentConfig: InstrumentConfig;
  sections: Section[];
  voiceProfiles: VoiceProfile[];

  // --- Constraints ---
  /** Per-voice hand/finger preferences. */
  voiceConstraints: Record<string, { hand?: 'left' | 'right'; finger?: string }>;

  // --- Performance Lanes (authoring data) ---
  performanceLanes: PerformanceLane[];
  laneGroups: LaneGroup[];
  sourceFiles: SourceFile[];

  // --- Engine Config (user preferences, not computed) ---
  engineConfig: EngineConfiguration;
  optimizerMethod: OptimizerMethodKey;
  costToggles: CostToggles;

  // --- Metadata ---
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

// ============================================================================
// Project Library Entry (lightweight index)
// ============================================================================

export interface ProjectIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  soundCount: number;
  eventCount: number;
}
