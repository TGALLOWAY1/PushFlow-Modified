/**
 * Optimization Debugging Framework — Public API.
 *
 * Import everything from this barrel:
 *   import { generateCandidateReport, validateExecutionPlan, ... } from '../engine/debug';
 */

// Types
export type {
  OptimizationEvaluationRecord,
  EventCostBreakdown,
  CandidateReport,
  FingerUsageBreakdown,
  HandUsageBreakdown,
  CostTotals,
  ConstraintViolationSummary,
  IrrationalAssignment,
  IrrationalSeverity,
  ConstraintViolation,
  VisualizationData,
  EventCostTimelinePoint,
  FingerUsageTimelinePoint,
  MovementDistanceTimelinePoint,
  ZoneViolationEvent,
  SanityCheckResult,
  SanityCheckReport,
} from './types';

// Part 1: Evaluation Recorder
export { extractEvaluationRecords } from './evaluationRecorder';

// Part 2: Candidate Report
export { generateCandidateReport } from './candidateReport';

// Part 3: Irrational Detector
export { detectIrrationalAssignments } from './irrationalDetector';

// Part 4: Constraint Validator
export { validateExecutionPlan } from './constraintValidator';

// Part 5: Visualization Data
export { generateVisualizationData } from './visualizationData';

// Part 8: Sanity Checks
export {
  runSanityChecks,
  runSanityChecksWithLogging,
  DEFAULT_THRESHOLDS,
  type SanityCheckThresholds,
} from './sanityChecks';
