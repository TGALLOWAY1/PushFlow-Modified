/**
 * EvaluationConfig: The subset of engine configuration needed
 * for canonical cost evaluation.
 *
 * This is deliberately separate from EngineConfiguration (which includes
 * solver-specific parameters like beamWidth). The evaluator only needs
 * biomechanical priors and instrument geometry.
 */

import { type RestingPose, type InstrumentConfig } from './performance';
import { type NeutralHandCentersResult } from '../engine/prior/handPose';

/**
 * Configuration needed to evaluate cost for a layout + assignment + events.
 *
 * Consumers should construct this once per evaluation context.
 * The evaluator does not need solver parameters (beam width, annealing config, etc.).
 */
export interface EvaluationConfig {
  /** Home positions for left and right hands. */
  restingPose: RestingPose;
  /** Attractor stiffness (0.0-1.0). Controls how strongly hands are pulled to resting pose. */
  stiffness: number;
  /** Instrument grid configuration (rows, cols, bottomLeftNote). */
  instrumentConfig: InstrumentConfig;
  /** Pre-computed neutral hand centers. If null, per-finger home cost is skipped. */
  neutralHandCenters: NeutralHandCentersResult | null;
}
