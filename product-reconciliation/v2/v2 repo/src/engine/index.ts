/**
 * Engine barrel exports.
 *
 * Central import point for the PushFlow engine.
 */

// Surface model
export { ALL_PADS, adjacentPads, manhattanDistance, padRegion, samePad } from './surface/padGrid';
export { getDefaultHandZones, getPreferredHand, zoneViolationScore } from './surface/handZone';

// Biomechanical model (canonical source of truth)
export {
  MAX_HAND_SPAN,
  MAX_REACH_GRID_UNITS,
  MAX_SPEED_UNITS_PER_SEC,
  MAX_HAND_SPEED,
  FINGER_PAIR_MAX_SPAN_STRICT,
  FINGER_PAIR_MAX_SPAN_RELAXED,
  THUMB_DELTA,
  THUMB_DELTA_RELAXED,
  FINGER_ORDER,
  FINGER_DOMINANCE_COST,
  FALLBACK_GRIP_PENALTY as BIOMECHANICAL_FALLBACK_PENALTY,
  RELAXED_GRIP_PENALTY as BIOMECHANICAL_RELAXED_PENALTY,
  RELAXED_SPAN_MULTIPLIER,
  ACTIVATION_COST,
  CHORD_PENALTY_THRESHOLD,
  MAX_FINGER_SPAN_STRICT,
  pairKey,
  calculateGridDistance,
  DEFAULT_HAND_MODEL,
  type HandModel,
  type GripRejection,
  type ConstraintRuleName,
} from './prior/biomechanicalModel';

// Prior (ergonomic model)
export { generateValidGripsWithTier, type GripDiagnosticOptions } from './prior/feasibility';
export {
  resolveNeutralPadPositions,
  getNeutralPadPositionsFromPose0,
  computeNeutralHandCenters,
  getNeutralHandCenters,
  restingPoseFromNeutralPadPositions,
  midiToNoteName,
  DEFAULT_HAND_POSE,
} from './prior/handPose';
export {
  fingerIdToEngineKey,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  poseHasAssignments,
} from './prior/naturalHandPose';
export {
  FINGER_WEIGHTS,
  decayFatigue,
  accumulateFatigue,
} from './prior/ergonomicConstants';

// Diagnostics
export {
  FATIGUE_ACCUMULATION_RATE,
  FATIGUE_DECAY_RATE,
  MAX_FATIGUE,
} from './diagnostics/fatigueModel';

// Mapping
export { buildNoteToPadIndex, buildVoiceIdToPadIndex, resolveNoteToPad, resolveEventToPad, hashLayout } from './mapping/mappingResolver';
export { computeMappingCoverage } from './mapping/mappingCoverage';
export { seedLayoutFromPose0 } from './mapping/seedFromPose';

// Evaluation (primary scoring model)
export {
  calculatePoseNaturalness,
  calculateTransitionCost,
  calculateAttractorCost,
  calculateFingerDominanceCost,
  calculatePerFingerHomeCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
  FALLBACK_GRIP_PENALTY,
  RELAXED_GRIP_PENALTY,
} from './evaluation/costFunction';
export {
  type PerformabilityObjective,
  type LegacyObjectiveComponents,
  combinePerformabilityComponents,
  createZeroPerformabilityComponents,
  performabilityToDifficultyBreakdown,
  combineComponents,
  createZeroComponents,
  objectiveToDifficultyBreakdown,
  objectiveToCanonicalFactors,
  objectiveToGripDetail,
  performabilityToCanonicalFactors,
} from './evaluation/objective';

export {
  computeEventAnatomicalStretchScore,
  computeCompositeDifficultyScore,
  groupAssignmentsIntoMoments,
  analyzeAssignments,
} from './evaluation/eventMetrics';
export { analyzeTransition, analyzeAllTransitions } from './evaluation/transitionAnalyzer';
export { scorePassage, scorePassagesFromSections, scorePassagesFixedWindow } from './evaluation/passageDifficulty';
export { analyzeDifficulty, classifyDifficulty, computeTradeoffProfile, roleWeightedScore } from './evaluation/difficultyScoring';
export { checkPlanFreshness, getEffectiveLayoutBinding, type FreshnessCheck } from './evaluation/executionPlanValidation';

// Structure analysis
export { groupEventsByTime, getPolyphonyTimeline, getMaxPolyphony } from './structure/eventGrouping';
export { computeDensityProfile, classifyDensity } from './structure/densityAnalysis';
export { detectSections } from './structure/sectionDetection';
export { buildCooccurrenceGraph } from './structure/cooccurrence';
export { buildTransitionGraph } from './structure/transitionGraph';
export { inferVoiceRoles } from './structure/roleInference';
export { analyzePerformance } from './structure/performanceAnalyzer';

// Solvers
export { BeamSolver, createBeamSolver } from './solvers/beamSolver';

// Optimization
export { AnnealingSolver, createAnnealingSolver } from './optimization/annealingSolver';
export { applyRandomMutation, getEmptyPads } from './optimization/mutationService';
export { generateCandidates, type CandidateGenerationResult } from './optimization/multiCandidateGenerator';
export { rankCandidates, filterPareto, compositeScore, compareDimensions } from './optimization/candidateRanker';

// Pattern generation (rudiment/ostinato candidate generator)
export { RudimentGenerator } from './rudiment/patternGenerator';
export { getMotifSeed, getAllMotifFamilies, type MotifSeed } from './rudiment/motifLibrary';
export {
  mirror, rotate, accentShift, subdivisionInsertion,
  densityLift, sparseReduction, callResponseSwap,
  applyTransform, ALL_TRANSFORMS,
  type TransformName,
} from './rudiment/transforms';
export { buildPhrase } from './rudiment/phraseBuilder';
export {
  coordinateHands,
  anchorAlignmentScore, interlockScore, collisionPressureScore,
  independenceScore, phraseCoherenceScore,
  type CoordinationScores,
} from './rudiment/coordination';
export {
  computeDensity, computeSyncopationRatio, computeIndependenceScore,
  computeRepetitionScore, computePhraseCoherenceScore,
  computeCollisionPressureScore, computeAllMetrics,
} from './rudiment/coherenceMetrics';
export { filterAndDiversify } from './rudiment/candidateFilter';
export {
  generateCandidateSolutions, patternToPerformance, patternToLayout,
  SOUND_CLASS_MIDI_MAP, type PipelineConfig,
} from './rudiment/patternToPipeline';

// Analysis (explainability)
export { analyzePassages, getHardestPassages } from './analysis/passageAnalyzer';
export { compareCandidates, summarizeComparison } from './analysis/candidateComparator';
export { explainConstraints, identifyBottlenecks } from './analysis/constraintExplainer';

// Diversity measurement (Phase 4: baseline-aware candidates)
export {
  computeLayoutDiversity,
  classifyDiversityLevel,
  isTrivialDuplicate,
  filterTrivialDuplicates,
  buildBaselineDiffSummary,
  explainLowDiversity,
  buildGenerationSummary,
} from './analysis/diversityMeasurement';

// Baseline-aware compare (Phase 5)
export {
  compareWithDiagnostics,
  compareWorkingVsActive,
  compareCandidateVsActive,
  compareCandidateVsCandidate,
  type CompareMode,
  type FactorDelta,
  type BaselineComparison,
} from './analysis/baselineCompare';

// Event-level diagnostic explanations (Phase 5)
export {
  explainEvent,
  explainTransition,
  identifyHardMoments,
  type EventExplanation,
  type TransitionExplanation,
  type HardMomentReport,
} from './analysis/eventExplainer';
