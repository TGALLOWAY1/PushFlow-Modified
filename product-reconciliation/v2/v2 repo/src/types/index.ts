/**
 * Canonical type exports for PushFlow.
 *
 * All domain types should be imported from this barrel file.
 */

// Grid and surface
export * from './padGrid';
export * from './fingerModel';

// Performance data
export * from './performanceEvent';
export * from './performance';
export * from './voice';

// Layout and mapping
export * from './layout';

// Execution plan
export * from './executionPlan';

// Diagnostics (Phase 3: canonical factor names and feasibility)
export * from './diagnostics';

// Performance structure analysis
export * from './performanceStructure';

// Candidate solutions
export * from './candidateSolution';

// Ergonomic prior
export * from './ergonomicPrior';

// Engine configuration
export * from './engineConfig';

// Performance lanes
export * from './performanceLane';

// Pattern candidate (rudiment/ostinato generator)
export * from './patternCandidate';
