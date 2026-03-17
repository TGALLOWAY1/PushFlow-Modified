/**
 * Engine configuration types.
 *
 * Controls solver behavior, biomechanical cost parameters,
 * and objective weighting.
 */

import { type RestingPose } from './performance';
import { type InstrumentConfig } from './performance';
import { type Layout } from './layout';

/**
 * EngineConfiguration: Parameters for the beam search solver.
 */
export interface EngineConfiguration {
  /** Beam width: number of top candidates to keep at each step. */
  beamWidth: number;
  /** Stiffness (alpha): attractor force pulling hands to resting pose. 0.0-1.0. */
  stiffness: number;
  /** Home positions for left and right hands. */
  restingPose: RestingPose;
}

/**
 * Engine constants for biomechanical calculations.
 *
 * Note: finger preference is modelled separately in costFunction.ts
 * via FINGER_PREFERENCE_COST — not here.
 */
export interface EngineConstants {
  maxSpan: number;
  minSpan: number;
  idealReach: number;
  maxReach: number;
  activationCost: number;
  crossoverPenaltyWeight: number;
  fatigueRecoveryRate?: number;
}

/** Default engine constants based on biomechanical research. */
export const DEFAULT_ENGINE_CONSTANTS: EngineConstants = {
  maxSpan: 4,
  minSpan: 0,
  idealReach: 2,
  maxReach: 4,
  activationCost: 5.0,
  crossoverPenaltyWeight: 20.0,
  fatigueRecoveryRate: 0.5,
};

/**
 * Neutral pad positions: mapping from finger IDs to pad coordinates.
 * Used by the beam solver for attractor calculations.
 */
export type NeutralPadPositions = Record<string, { row: number; col: number }>;

/**
 * Neutral hand centers: computed centroid for each hand.
 */
export interface NeutralHandCenters {
  left: { x: number; y: number } | null;
  right: { x: number; y: number } | null;
}

/**
 * SolverConfig: Configuration passed to solver factory functions.
 */
export interface SolverConfig {
  instrumentConfig: InstrumentConfig;
  layout?: Layout | null;
  /**
   * Declares which workflow role the source layout occupies.
   * Carried through to ExecutionPlanResult.metadata for traceability.
   * Callers should always set this so downstream consumers know whether
   * the plan was computed against an active, working, or variant layout.
   */
  sourceLayoutRole?: import('./layout').LayoutRole;
  engineConstants?: EngineConstants;
  neutralPadPositionsOverride?: NeutralPadPositions | null;
  mappingResolverMode?: 'strict' | 'allow-fallback';
  seed?: number;
  annealingConfig?: AnnealingConfig;
}

// ============================================================================
// Optimization Mode and Annealing Configuration
// ============================================================================

/** Optimization mode: controls solver intensity. */
export type OptimizationMode = 'fast' | 'deep';

/**
 * AnnealingConfig: Parameters for the simulated annealing solver.
 *
 * Fast mode uses conservative defaults matching the original hardcoded values.
 * Deep mode increases budget and adds restarts for harder performances.
 */
export interface AnnealingConfig {
  /** Number of SA iterations per restart. */
  iterations: number;
  /** Initial temperature for Metropolis criterion. */
  initialTemp: number;
  /** Cooling rate applied each iteration (close to 1.0 = slow cooling). */
  coolingRate: number;
  /** Number of SA restarts (0 = single trajectory). */
  restartCount: number;
  /** Beam width for fast cost evaluation during SA. */
  fastBeamWidth: number;
  /** Beam width for final high-quality evaluation. */
  finalBeamWidth: number;
  /** Whether to include zone transfer mutation operator. */
  useZoneTransfer?: boolean;
}

/**
 * Fast annealing configuration.
 * Matches the original hardcoded values exactly for backward compatibility.
 */
export const FAST_ANNEALING_CONFIG: AnnealingConfig = {
  iterations: 3000,
  initialTemp: 500,
  coolingRate: 0.997,
  restartCount: 0,
  fastBeamWidth: 12,
  finalBeamWidth: 50,
  useZoneTransfer: false,
};

/**
 * Deep annealing configuration.
 * More iterations, restarts, wider beam, and zone transfer for complex performances.
 */
export const DEEP_ANNEALING_CONFIG: AnnealingConfig = {
  iterations: 8000,
  initialTemp: 500,
  coolingRate: 0.9985,
  restartCount: 3,
  fastBeamWidth: 16,
  finalBeamWidth: 50,
  useZoneTransfer: true,
};
