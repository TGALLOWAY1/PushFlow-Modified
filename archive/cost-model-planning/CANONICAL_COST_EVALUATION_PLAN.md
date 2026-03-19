# Canonical Cost Evaluation Plan

## 1. Current State of Cost Evaluation

### Architecture Overview

Cost evaluation in the V2 codebase is split across three layers that were built incrementally and never unified into a single canonical pathway.

**Layer 1 — Solver-Internal Cost Functions** (`src/engine/evaluation/costFunction.ts`)

These functions are called thousands of times during beam search expansion:

| Function | Returns | Called By |
|----------|---------|-----------|
| `calculatePoseNaturalness(grip, restingPose, stiffness, handSide, neutralHandCenters)` | scalar | BeamSolver per-grip |
| `calculateTransitionCost(prevPose, currPose, timeDelta)` | scalar | BeamSolver per-step |
| `calculateAlternationCost(prevAssignments, currentAssignments, dt)` | scalar | BeamSolver per-step |
| `calculateHandBalanceCost(leftCount, rightCount)` | scalar | BeamSolver per-step |
| `calculateFingerDominanceCost(grip)` | scalar | Sub-component of poseNaturalness |
| `calculateAttractorCost(current, resting, stiffness)` | scalar | Sub-component of poseNaturalness |
| `calculatePerFingerHomeCost(pose, handSide, neutralHandCenters, weight)` | scalar | Sub-component of poseNaturalness |

These are pure functions with no I/O. They accept pre-computed `HandPose` / grip objects and return scalars. They are individually reusable but are not exposed through any canonical evaluation entry point.

**Layer 2 — Objective Combination and Mapping** (`src/engine/evaluation/objective.ts`)

Two objective models coexist:

| Model | Components | Used For |
|-------|-----------|----------|
| `PerformabilityObjective` (3-component) | poseNaturalness, transitionDifficulty, constraintPenalty | Beam search ranking (primary) |
| `ObjectiveComponents` (7-component) | transition, stretch, poseAttractor, perFingerHome, alternation, handBalance, constraints | Legacy diagnostic display |

Mapping functions bridge between them:

- `combinePerformabilityComponents()` — sums 3 components to scalar for beam ranking
- `objectiveToDifficultyBreakdown()` — maps 7-component → `DifficultyBreakdown` (6 fields: movement, stretch, drift, bounce, fatigue, crossover)
- `performabilityToDifficultyBreakdown()` — maps 3-component → 7-component with approximations
- `objectiveToCanonicalFactors()` — maps 7-component → `DiagnosticFactors` (5 canonical factors)
- `performabilityToCanonicalFactors()` — maps 3-component → 5 canonical factors

The 5 canonical `DiagnosticFactors` are: `transition`, `gripNaturalness`, `alternation`, `handBalance`, `constraintPenalty`.

**Layer 3 — Post-Hoc Analysis** (multiple modules, all operate on `ExecutionPlanResult`)

| Module | Functions | Operates On |
|--------|-----------|-------------|
| `eventMetrics.ts` | `computeEventAnatomicalStretchScore`, `computeCompositeDifficultyScore`, `groupAssignmentsIntoMoments`, `analyzeAssignments` | FingerAssignment[] from plan |
| `transitionAnalyzer.ts` | `analyzeTransition`, `analyzeAllTransitions` | AnalyzedMoment pairs |
| `passageDifficulty.ts` | `scorePassage`, `scorePassagesFromSections`, `scorePassagesFixedWindow` | FingerAssignment[] + section boundaries |
| `difficultyScoring.ts` | `analyzeDifficulty`, `classifyDifficulty`, `computeTradeoffProfile` | ExecutionPlanResult + sections |
| `eventExplainer.ts` | `explainEvent`, `explainTransition`, `identifyHardMoments` | FingerAssignment / Transition objects |
| `baselineCompare.ts` | `compareWithDiagnostics`, `compareWorkingVsActive`, etc. | Two ExecutionPlanResult objects |
| `candidateComparator.ts` | `compareCandidates` | Two CandidateSolution objects |
| `evaluationRecorder.ts` | `extractEvaluationRecords`, `reconstructCostBreakdown` | ExecutionPlanResult |

All of these are standalone and do not call cost functions directly. They read from the `FingerAssignment.costBreakdown` (a `DifficultyBreakdown`) that was populated by the beam solver during search.

### Where Scoring Functions Live

```
src/engine/evaluation/costFunction.ts     — atomic cost computations (solver-internal)
src/engine/evaluation/objective.ts        — objective models + mapping glue
src/engine/evaluation/eventMetrics.ts     — event-level post-hoc metrics
src/engine/evaluation/transitionAnalyzer.ts — transition-level post-hoc metrics
src/engine/evaluation/passageDifficulty.ts  — passage-level aggregation
src/engine/evaluation/difficultyScoring.ts  — full difficulty analysis + tradeoff profiles
src/engine/analysis/eventExplainer.ts     — human-readable event/transition explanations
src/engine/analysis/baselineCompare.ts    — layout comparison with factor deltas
src/engine/analysis/candidateComparator.ts — lighter candidate comparison
src/engine/diagnostics/legacyCosts.ts     — deprecated V1-era cost functions (dead code)
src/engine/debug/evaluationRecorder.ts    — debug trace reconstruction
```

### Whether They Are Domain-Level or Solver-Internal

**Solver-internal** (require BeamSolver context or HandPose pre-computation):
- All functions in `costFunction.ts`
- `combinePerformabilityComponents()` in `objective.ts`
- The beam solver itself (`beamSolver.ts`) — the only code path that produces `FingerAssignment[]` with populated `costBreakdown`

**Domain-level but post-hoc only** (require an already-solved `ExecutionPlanResult`):
- Everything in `eventMetrics.ts`, `transitionAnalyzer.ts`, `passageDifficulty.ts`, `difficultyScoring.ts`
- Everything in `eventExplainer.ts`, `baselineCompare.ts`, `candidateComparator.ts`
- Everything in `evaluationRecorder.ts`

**No domain-level evaluator exists that can take (layout, padFingerAssignment, events) and produce structured cost output without running the full beam solver.**

### Whether They Are Reusable

The individual cost functions in `costFunction.ts` are pure and reusable. But they operate on solver-internal types (`HandPose`, `grip` objects) that are constructed inside the beam search. There is no utility that constructs these from a `Layout` + `PadFingerAssignment` + `Event` without entering the solver.

The post-hoc analysis functions are all reusable but they cannot be called until after a full solve has run.

### Whether They Are Fragmented

Yes. Cost evaluation is fragmented across:

1. **Beam solver construction** — the only place where `HandPose` is built and cost functions are called
2. **Objective mapping** — multiple mapping functions with different component counts (3, 5, 6, 7)
3. **Post-hoc analysis** — separate modules for events, transitions, passages, difficulty, explanations
4. **Legacy diagnostics** — deprecated functions still present
5. **DifficultyBreakdown field names** — use legacy names (movement, stretch, drift, bounce, fatigue, crossover) that do not match the solver's actual terms

---

## 2. Gaps Relative to Refactor Goal

The intended capability is:

```
f(layout, padFingerAssignment, events) = structured cost output
```

The current architecture does not satisfy this. Here is exactly why.

### Gap 1: No Canonical Evaluator Entry Point

There is no function anywhere in the codebase with this signature:

```typescript
evaluatePerformance(layout, padFingerAssignment, events): PerformanceCostBreakdown
```

The only way to get cost output is to run `beamSolver.solve()`, which:
- Performs a full beam search to **find** finger assignments (not evaluate a given one)
- Requires `EngineConfiguration` with beam width, stiffness, resting pose, etc.
- Returns `ExecutionPlanResult` which is a solver output contract, not an evaluation contract
- Cannot accept a pre-defined `PadFingerAssignment` — it discovers finger assignments during search

**Impact**: Manual layouts cannot be evaluated against a known finger assignment. The user's finger ownership decisions are ignored — the solver re-discovers them from scratch.

### Gap 2: PadFingerAssignment Is Not an Input

The concept of `PadFingerAssignment` — a stable mapping of which finger owns which pad — exists in the correction plan (`EVENT_AND_FINGER_CONSTRAINT_CORRECTION_PLAN.md`) but has not been implemented as a first-class input type.

The beam solver tracks `padOwnership` internally as a `Map<string, { hand, finger }>` on `BeamNode`, but this is solver-internal state. There is no way to:
- Provide a pre-defined pad-finger assignment to the evaluator
- Evaluate a layout under a different finger assignment without re-running the solver
- Compare two finger assignments for the same layout

### Gap 3: Event-Level and Transition-Level Evaluation Require Full Solve First

`evaluateEvent(event, layout, padFingerAssignment)` does not exist.

The closest functions (`computeCompositeDifficultyScore`, `explainEvent`) operate on `FingerAssignment` objects that only exist after a full beam solve. They cannot evaluate a single event against a layout and finger assignment directly.

Similarly, `evaluateTransition(fromEvent, toEvent, layout, padFingerAssignment)` does not exist. `analyzeTransition` operates on `AnalyzedMoment` pairs that are post-solve artifacts.

### Gap 4: Duplicated and Inconsistent Scoring Taxonomies

The codebase maintains multiple naming schemes for the same concepts:

| Solver Term | DifficultyBreakdown Field | DiagnosticFactors Field | UI Display Label |
|-------------|--------------------------|------------------------|-----------------|
| poseNaturalness | drift + fatigue + stretch (approximated) | gripNaturalness | "Pose Naturalness" |
| transitionDifficulty | movement | transition | "Movement" |
| constraintPenalty | crossover | constraintPenalty | "Crossover" |
| alternation | bounce | alternation | "Bounce" |
| handBalance | (not in breakdown) | handBalance | (sometimes omitted) |
| fingerDominance | (subsumed into stretch) | (subsumed into gripNaturalness) | (not separately shown) |

The `COST_MODEL_COMPARISON.md` explicitly calls this out: "V3 must not inherit that confusion."

### Gap 5: Output Is Too Opaque for Analysis and Comparison

`ExecutionPlanResult` contains:
- `score: number` — a single scalar (the legacy 100-minus formula, not the objective cost)
- `averageMetrics: DifficultyBreakdown` — uses legacy names
- `diagnostics?: DiagnosticsPayload` — canonical factors, but optional and sometimes absent

There is no output type that directly provides:
- Per-event cost breakdown
- Per-transition cost breakdown
- Aggregate with clear dimension labels
- Debug metadata explaining why each cost was assigned

### Gap 6: Annealing Uses the Wrong Scalar

As documented in `COST_MODEL_COMPARISON.md` Risk 1: the annealing solver uses `averageMetrics.total` from `ExecutionPlanResult`, which is the legacy 7-component average. The beam solver optimizes the 3-component `PerformabilityObjective`. These are different numbers. The annealing solver may accept or reject layouts based on a scalar that doesn't match what the beam solver actually optimized.

### Gap 7: Manual Edit Re-Evaluation Is Not Straightforward

When a user moves one sound or changes one pad's finger ownership, the system:
1. Sets `analysisStale = true`
2. Waits for a 1-second debounce
3. Runs a full `BeamSolver.solve()` (beam width 15)
4. The solver re-discovers finger assignments from scratch
5. The solver ignores the previous finger assignment entirely

There is no incremental re-evaluation. There is no way to say "evaluate this layout with the same finger assignment, except pad X now belongs to finger Y."

### Gap 8: Solver Constraints Don't Express PadFingerAssignment

The `SolverConstraints` type supports `hardAssignments` and `softPreferences` (both per-event-key), but these are solver hints that bias the search — they don't lock in a complete `PadFingerAssignment`. The solver can still override soft preferences.

### Gap 9: UI Pathways Have No Clean Evaluator Call

`useAutoAnalysis.ts` directly instantiates `createBeamSolver()` and calls `.solve()`. There is no intermediate evaluation API. The UI is coupled to the solver.

---

## 3. Proposed Canonical Evaluation Architecture

### Principle

The evaluation stack must be layered so that:
- The **evaluator** can score any valid (layout, padFingerAssignment, events) triple
- The **solver** can use the evaluator internally for its search
- **Analysis tools** can call the evaluator directly without going through the solver
- **UI consumers** can trigger evaluation without knowing about solver internals

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CONSUMERS                            │
│  optimizer · event analysis · grid editor · compare tool    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              CANONICAL EVALUATION API                        │
│                                                             │
│  evaluatePerformance(input): PerformanceCostBreakdown       │
│  evaluateEvent(input): EventCostBreakdown                   │
│  evaluateTransition(input): TransitionCostBreakdown         │
│  compareLayouts(input): LayoutComparisonResult              │
│  validateAssignment(input): AssignmentValidationResult      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              SHARED COST DIMENSIONS                          │
│                                                             │
│  CostDimensions {                                           │
│    poseNaturalness    — grip quality (attractor + home +    │
│                         dominance)                           │
│    transitionCost     — Fitts's Law movement penalty        │
│    constraintPenalty  — feasibility tier penalty             │
│    alternation        — same-finger rapid repetition        │
│    handBalance        — left/right distribution             │
│  }                                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              ATOMIC COST FUNCTIONS                           │
│                                                             │
│  calculatePoseNaturalness(...)                              │
│  calculateTransitionCost(...)                               │
│  calculateAlternationCost(...)                              │
│  calculateHandBalanceCost(...)                              │
│  assessFeasibilityTier(...)                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              CANONICAL INPUT MODELS                          │
│                                                             │
│  Layout                 — padToVoice mapping                │
│  PadFingerAssignment    — pad → {hand, finger} ownership    │
│  PerformanceMoment[]    — time-sliced event sequence        │
│  EvaluationConfig       — resting pose, stiffness, grid     │
└─────────────────────────────────────────────────────────────┘
```

### Module Boundaries

**New module: `src/engine/evaluation/canonicalEvaluator.ts`**

This is the single canonical entry point. It:
- Accepts `Layout`, `PadFingerAssignment`, `PerformanceMoment[]`, and `EvaluationConfig`
- Resolves notes to pads using `MappingResolver`
- Constructs `HandPose` for each moment from the `PadFingerAssignment`
- Calls the existing atomic cost functions
- Returns structured `PerformanceCostBreakdown`

**Existing modules that stay unchanged:**
- `costFunction.ts` — atomic cost computations (no changes needed)
- `MappingResolver` — note-to-pad resolution (no changes needed)
- `feasibility.ts` — grip feasibility checks (no changes needed)
- `biomechanicalModel.ts`, `handPose.ts`, `naturalHandPose.ts` — biomechanical priors (no changes needed)

**Existing modules that get adapted:**
- `beamSolver.ts` — refactored to call canonical evaluator internally
- `objective.ts` — legacy mapping functions deprecated; canonical dimensions become the single source
- `eventMetrics.ts`, `transitionAnalyzer.ts` — may be subsumed into canonical evaluator or kept as post-hoc enrichment

**Existing modules that get removed or deprecated:**
- `legacyCosts.ts` — already deprecated, remove entirely
- `DifficultyBreakdown` type — replace with `CostDimensions`
- `ObjectiveComponents` (7-component) — remove; `CostDimensions` (5 fields) replaces it

---

## 4. Required Code Changes

### Input Model Cleanup

| Change | File | Details |
|--------|------|---------|
| Define `PadFingerAssignment` type | `src/types/padFingerAssignment.ts` (new) | `Record<padKey, { hand: HandSide, finger: FingerType }>` with validation |
| Define `EvaluationConfig` type | `src/types/evaluationConfig.ts` (new) | Subset of EngineConfiguration needed for evaluation: restingPose, stiffness, instrumentConfig, neutralHandCenters |
| Ensure `PerformanceMoment` is canonical event type | `src/types/performanceEvent.ts` | Already defined; ensure all consumers use it |
| Add `PadFingerAssignment` to `ExecutionPlanResult` | `src/types/executionPlan.ts` | Extract pad ownership from solver output into canonical type |

### Event-Level Evaluation

| Change | File | Details |
|--------|------|---------|
| Create `evaluateEvent()` | `src/engine/evaluation/canonicalEvaluator.ts` (new) | Given one `PerformanceMoment` + `Layout` + `PadFingerAssignment` + `EvaluationConfig`, compute `EventCostBreakdown` |
| Build `HandPose` from `PadFingerAssignment` | `src/engine/evaluation/poseBuilder.ts` (new) | Utility: given pad coordinates and finger ownership, construct `HandPose` for a moment |
| Define `EventCostBreakdown` | `src/types/costBreakdown.ts` (new) | `{ dimensions: CostDimensions, feasibilityTier: FeasibilityLevel, perNoteDetail: NoteDetail[], debug?: ... }` |

### Transition-Level Evaluation

| Change | File | Details |
|--------|------|---------|
| Create `evaluateTransition()` | `src/engine/evaluation/canonicalEvaluator.ts` | Given two consecutive moments + shared context, compute `TransitionCostBreakdown` |
| Define `TransitionCostBreakdown` | `src/types/costBreakdown.ts` | `{ dimensions: CostDimensions, timeDelta: number, gridDistance: number, handSwitch: boolean, fingerChange: boolean, speedPressure: number, debug?: ... }` |

### Aggregate Performance Evaluation

| Change | File | Details |
|--------|------|---------|
| Create `evaluatePerformance()` | `src/engine/evaluation/canonicalEvaluator.ts` | Iterates moments, calls `evaluateEvent` + `evaluateTransition`, aggregates |
| Define `PerformanceCostBreakdown` | `src/types/costBreakdown.ts` | `{ total: number, dimensions: CostDimensions, eventCosts: EventCostBreakdown[], transitionCosts: TransitionCostBreakdown[], aggregateMetrics: AggregateMetrics, feasibility: FeasibilityVerdict, debug?: ... }` |

### Shared Cost-Dimension Definitions

| Change | File | Details |
|--------|------|---------|
| Define `CostDimensions` | `src/types/costBreakdown.ts` | The single canonical set: `{ poseNaturalness, transitionCost, constraintPenalty, alternation, handBalance, total }` |
| Define `CostDimensionDetail` | `src/types/costBreakdown.ts` | Optional sub-breakdown: `{ attractor, perFingerHome, fingerDominance }` for poseNaturalness |
| Remove `DifficultyBreakdown` | `src/types/executionPlan.ts` | Replace all references with `CostDimensions` |
| Remove `ObjectiveComponents` | `src/engine/evaluation/objective.ts` | No longer needed |
| Deprecate legacy mapping functions | `src/engine/evaluation/objective.ts` | `objectiveToDifficultyBreakdown`, `performabilityToDifficultyBreakdown`, etc. |

### Solver Integration

| Change | File | Details |
|--------|------|---------|
| Refactor BeamSolver to emit `CostDimensions` | `src/engine/solvers/beamSolver.ts` | Replace `costBreakdown: DifficultyBreakdown` with `costDimensions: CostDimensions` on `FingerAssignment` |
| Extract pad ownership as `PadFingerAssignment` | `src/engine/solvers/beamSolver.ts` | At solve completion, emit `padFingerAssignment` alongside `fingerAssignments` |
| Fix annealing scalar | `src/engine/optimization/annealingSolver.ts` | Use `combinePerformabilityComponents()` total instead of `averageMetrics.total` |
| Accept `PadFingerAssignment` as optional solver constraint | `src/engine/solvers/types.ts` | Allow solver to accept a fixed assignment and only evaluate (not search) |

### UI / Manual-Edit Integration

| Change | File | Details |
|--------|------|---------|
| Replace `createBeamSolver().solve()` with `evaluatePerformance()` in useAutoAnalysis | `src/ui/hooks/useAutoAnalysis.ts` | When a `PadFingerAssignment` exists from a prior solve, reuse it for re-evaluation |
| Add `evaluateEvent()` call to EventDetailPanel | `src/ui/components/EventDetailPanel.tsx` | Enable single-event evaluation on selection |
| Add re-evaluation on manual edit | `src/ui/state/ProjectContext.tsx` | When user moves a sound or changes finger ownership, call `evaluatePerformance()` with the existing assignment |

### Debug / Explainability Output

| Change | File | Details |
|--------|------|---------|
| Define `EvaluationDebugInfo` | `src/types/costBreakdown.ts` | `{ handPoses: HandPose[], gripFeasibilityPerMoment: FeasibilityLevel[], costPerDimensionPerMoment: CostDimensions[], rawDistances: number[] }` |
| Adapt `evaluationRecorder.ts` to use canonical types | `src/engine/debug/evaluationRecorder.ts` | Replace `reconstructCostBreakdown` with canonical `CostDimensions` |
| Adapt `eventExplainer.ts` | `src/engine/analysis/eventExplainer.ts` | Use `CostDimensions` directly instead of mapping through legacy names |

---

## 5. Canonical API Proposal

### Core Evaluation Functions

```typescript
/**
 * Evaluate a single performance moment under a given layout and finger assignment.
 *
 * This is the atomic building block. Everything else is built from this.
 */
function evaluateEvent(input: {
  moment: PerformanceMoment;
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
  prevMomentContext?: PrevMomentContext;  // for alternation detection
}): EventCostBreakdown;

/**
 * Evaluate the transition between two consecutive moments.
 */
function evaluateTransition(input: {
  fromMoment: PerformanceMoment;
  toMoment: PerformanceMoment;
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
}): TransitionCostBreakdown;

/**
 * Evaluate a full performance sequence.
 * Calls evaluateEvent + evaluateTransition for each moment pair.
 */
function evaluatePerformance(input: {
  moments: PerformanceMoment[];
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  config: EvaluationConfig;
  includeDebug?: boolean;
}): PerformanceCostBreakdown;

/**
 * Compare two layout+assignment pairs on the same event sequence.
 */
function compareLayouts(input: {
  moments: PerformanceMoment[];
  layoutA: Layout;
  assignmentA: PadFingerAssignment;
  layoutB: Layout;
  assignmentB: PadFingerAssignment;
  config: EvaluationConfig;
}): LayoutComparisonResult;

/**
 * Validate that a PadFingerAssignment is internally consistent
 * and biomechanically feasible for the given layout.
 */
function validateAssignment(input: {
  layout: Layout;
  padFingerAssignment: PadFingerAssignment;
  moments: PerformanceMoment[];
  config: EvaluationConfig;
}): AssignmentValidationResult;
```

### Why These Names

- `evaluateEvent` / `evaluateTransition` / `evaluatePerformance` — direct, verb-first, describes the action
- `compareLayouts` — the primary comparison workflow; takes two complete (layout + assignment) pairs
- `validateAssignment` — validates feasibility and ownership consistency before evaluation

These names avoid overloaded terms like `score`, `cost`, or `difficulty` in the function name. The output types carry the cost information.

---

## 6. Output Requirements

### CostDimensions (the canonical cost vector)

```typescript
type CostDimensions = {
  poseNaturalness: number;     // grip quality: attractor + perFingerHome + fingerDominance
  transitionCost: number;      // Fitts's Law movement penalty
  constraintPenalty: number;   // feasibility tier penalty (0 for strict, penalty for relaxed/fallback)
  alternation: number;         // same-finger rapid repetition penalty
  handBalance: number;         // left/right distribution penalty
  total: number;               // sum of above
};
```

### EventCostBreakdown

```typescript
type EventCostBreakdown = {
  momentIndex: number;
  timestamp: number;
  dimensions: CostDimensions;
  poseDetail: {
    attractor: number;
    perFingerHome: number;
    fingerDominance: number;
  };
  feasibilityTier: FeasibilityLevel;  // 'feasible' | 'degraded' | 'infeasible'
  noteAssignments: {
    noteNumber: number;
    voiceId?: string;
    padKey: string;
    hand: HandSide;
    finger: FingerType;
  }[];
  debug?: {
    handPose: HandPose;
    gripUsed: object;
  };
};
```

### TransitionCostBreakdown

```typescript
type TransitionCostBreakdown = {
  fromMomentIndex: number;
  toMomentIndex: number;
  fromTimestamp: number;
  toTimestamp: number;
  timeDeltaMs: number;
  dimensions: CostDimensions;
  movement: {
    gridDistance: number;
    speedPressure: number;       // 0-1, tanh-scaled
    handSwitch: boolean;
    fingerChange: boolean;
  };
  debug?: {
    fromHandPose: HandPose;
    toHandPose: HandPose;
    rawFittsLawCost: number;
  };
};
```

### PerformanceCostBreakdown

```typescript
type PerformanceCostBreakdown = {
  total: number;
  dimensions: CostDimensions;                    // aggregated across all moments
  eventCosts: EventCostBreakdown[];
  transitionCosts: TransitionCostBreakdown[];
  aggregateMetrics: {
    averageDimensions: CostDimensions;           // mean per moment
    peakDimensions: CostDimensions;              // worst moment
    peakMomentIndex: number;
    hardMomentCount: number;
    infeasibleMomentCount: number;
    momentCount: number;
    transitionCount: number;
  };
  feasibility: FeasibilityVerdict;
  padFingerAssignment: PadFingerAssignment;      // echo back the assignment used
  debug?: EvaluationDebugInfo;
};
```

### LayoutComparisonResult

```typescript
type LayoutComparisonResult = {
  costA: PerformanceCostBreakdown;
  costB: PerformanceCostBreakdown;
  dimensionDeltas: Record<keyof CostDimensions, number>;  // B minus A
  overallDelta: number;
  winner: 'A' | 'B' | 'tie';
  perMomentDeltas: {
    momentIndex: number;
    deltaTotal: number;
    winnerThisMoment: 'A' | 'B' | 'tie';
  }[];
  layoutChanges: {
    padKey: string;
    voiceA?: string;
    voiceB?: string;
  }[];
  assignmentChanges: {
    padKey: string;
    fingerA?: { hand: HandSide; finger: FingerType };
    fingerB?: { hand: HandSide; finger: FingerType };
  }[];
};
```

### AssignmentValidationResult

```typescript
type AssignmentValidationResult = {
  valid: boolean;
  issues: {
    type: 'ownership_conflict' | 'infeasible_grip' | 'unmapped_note' | 'hand_zone_violation';
    padKey?: string;
    momentIndex?: number;
    message: string;
  }[];
};
```

---

## 7. Integration Strategy

### Optimizer

The beam solver currently owns the only code path that constructs `HandPose` from grip options and evaluates cost. After this refactor:

1. The beam solver continues to use its internal incremental evaluation during search (for performance)
2. At solve completion, the beam solver emits a `PadFingerAssignment` alongside the `ExecutionPlanResult`
3. The final result can be verified by calling `evaluatePerformance()` with the emitted assignment — this provides a consistency check between solver-internal scoring and the canonical evaluator
4. The annealing solver replaces its `averageMetrics.total` usage with `evaluatePerformance().total`

The solver does **not** need to call the canonical evaluator during search. The evaluator is for external consumption and verification.

### Event Analysis

Currently: `useAutoAnalysis` runs a full beam solve, then `explainEvent` / `identifyHardMoments` post-process the result.

After refactor:
- If a `PadFingerAssignment` exists from a prior solve, `evaluatePerformance()` can be called directly
- `evaluateEvent()` enables single-event inspection without processing the full sequence
- `explainEvent()` adapts to consume `EventCostBreakdown` directly instead of mapping from legacy `DifficultyBreakdown`

### Timeline / Performance Analysis

Currently: `analyzeDifficulty` and `computeTradeoffProfile` operate on `ExecutionPlanResult`.

After refactor:
- These functions adapt to consume `PerformanceCostBreakdown`
- Passage difficulty (`scorePassage`) operates on `EventCostBreakdown[]` instead of `FingerAssignment[]`
- Tradeoff profile computation uses `CostDimensions` directly

### Grid Editor / Manual Editing

Currently: any pad change sets `analysisStale = true` and triggers a full re-solve after debounce.

After refactor:
- If the user moves a sound: call `evaluatePerformance()` with the existing `PadFingerAssignment` and the updated `Layout`
- If the user changes finger ownership on a pad: call `evaluatePerformance()` with the updated `PadFingerAssignment`
- Only trigger a full re-solve when the user explicitly requests optimization or when no prior `PadFingerAssignment` exists
- This makes manual editing feedback nearly instant (evaluation is O(N) in moments, not O(beam_width * N))

### Comparison Tooling

Currently: `compareWithDiagnostics` requires two `ExecutionPlanResult` objects with populated diagnostics.

After refactor:
- `compareLayouts()` takes two (layout, assignment) pairs and produces a structured comparison
- No dependency on solver diagnostics
- Works for working-vs-active, candidate-vs-active, candidate-vs-candidate comparisons
- Factor deltas use the canonical `CostDimensions` fields

### Debug Tools

Currently: `evaluationRecorder.ts` reconstructs cost breakdowns from `FingerAssignment` fields.

After refactor:
- `evaluatePerformance({ includeDebug: true })` returns `EvaluationDebugInfo` with per-moment hand poses, grip details, and raw distances
- `OptimizerDebugPage` consumes `PerformanceCostBreakdown` directly instead of reconstructing from `ExecutionPlanResult`

---

## 8. Migration Plan

### Phase 1: Define Canonical Input Contracts

1. Create `src/types/padFingerAssignment.ts` with the `PadFingerAssignment` type
2. Create `src/types/evaluationConfig.ts` with `EvaluationConfig` (extracted from `EngineConfiguration`)
3. Create `src/types/costBreakdown.ts` with `CostDimensions`, `EventCostBreakdown`, `TransitionCostBreakdown`, `PerformanceCostBreakdown`
4. Add factory functions: `createZeroCostDimensions()`, `sumCostDimensions(a, b)`, `averageCostDimensions(list)`

**Validation**: Types compile. No behavioral changes.

### Phase 2: Isolate Existing Cost Dimensions

5. Map existing `DifficultyBreakdown` fields to `CostDimensions` fields in a compatibility layer
6. Add `toCostDimensions(breakdown: DifficultyBreakdown): CostDimensions` bridge function
7. Add `padFingerAssignment: PadFingerAssignment` to `ExecutionPlanResult` output

**Validation**: Existing tests pass with the bridge layer. BeamSolver now emits `PadFingerAssignment`.

### Phase 3: Create Shared Event Evaluator

8. Create `src/engine/evaluation/poseBuilder.ts` — builds `HandPose` from `PadFingerAssignment` + pad coordinates for a given moment
9. Create `evaluateEvent()` in `src/engine/evaluation/canonicalEvaluator.ts`
10. Write focused tests: given a known layout, known assignment, and one moment, verify cost dimensions match expected values

**Validation**: `evaluateEvent()` produces the same `CostDimensions` as the beam solver does for the same input configuration. Test with deterministic fixtures.

### Phase 4: Create Shared Transition Evaluator

11. Create `evaluateTransition()` in the same module
12. Verify against beam solver transition cost for same inputs

**Validation**: Transition costs match beam solver output for identical (pose, timing) inputs.

### Phase 5: Create Aggregate Evaluator

13. Create `evaluatePerformance()` — iterates moments, calls event + transition evaluators, aggregates
14. Create `compareLayouts()` — evaluates both, computes deltas
15. Create `validateAssignment()` — checks ownership consistency and feasibility

**Validation**: `evaluatePerformance()` on a solved layout with the solver's own `PadFingerAssignment` produces totals within tolerance of the solver's reported score. End-to-end golden tests.

### Phase 6: Adapt Optimizer to Consume Canonical Evaluators

16. Fix annealing solver to use canonical total instead of `averageMetrics.total`
17. Add optional "evaluate only" mode to solver: accept `PadFingerAssignment`, skip search, just evaluate
18. Beam solver final output verified against canonical evaluator

**Validation**: Annealing accept/reject decisions use the correct scalar. Solver "evaluate only" mode produces identical results to `evaluatePerformance()`.

### Phase 7: Adapt Analysis and UI to Consume Canonical Evaluators

19. `useAutoAnalysis` calls `evaluatePerformance()` when a `PadFingerAssignment` is available
20. `useAutoAnalysis` only runs full solve when no prior assignment exists
21. `EventDetailPanel`, `DiagnosticsPanel`, `baselineCompare` adapted to use `CostDimensions`
22. `eventExplainer` uses `EventCostBreakdown` directly

**Validation**: UI displays correct values. Manual edit → re-evaluation path works without full solve.

### Phase 8: Remove Duplicated / Legacy Scoring Code

23. Remove `ObjectiveComponents` type
24. Remove `DifficultyBreakdown` type (replace all references with `CostDimensions`)
25. Remove `objectiveToDifficultyBreakdown`, `performabilityToDifficultyBreakdown`, `objectiveToCanonicalFactors`, `performabilityToCanonicalFactors`
26. Remove `legacyCosts.ts` entirely
27. Remove legacy field names from UI (movement→transitionCost, drift→poseNaturalness, bounce→alternation, etc.)

**Validation**: All tests pass. No references to legacy field names remain. Clean compile.

---

## 9. Test Plan

### Manual Layout Evaluation

```
Given: a manually-authored Layout + a manually-defined PadFingerAssignment + an event sequence
When: evaluatePerformance() is called
Then: returns a PerformanceCostBreakdown with correct total, per-moment costs, and feasibility
```

Test with:
- Simple 2-sound layout, 3 events
- 4-sound layout with simultaneous notes
- Layout where one pad is infeasible for the assigned finger

### Single Event Evaluation

```
Given: one PerformanceMoment with 2 simultaneous notes
When: evaluateEvent() is called
Then: returns EventCostBreakdown with poseNaturalness, feasibilityTier, noteAssignments
```

Test with:
- Easy chord (adjacent pads, natural fingers)
- Hard chord (wide stretch, weak fingers)
- Infeasible chord (beyond biomechanical limits)

### Transition Evaluation

```
Given: two consecutive moments with known timing
When: evaluateTransition() is called
Then: returns TransitionCostBreakdown with Fitts's Law cost, speed pressure, hand switch flag
```

Test with:
- Slow transition (large dt, small distance) → low cost
- Fast transition (small dt, large distance) → high cost
- Transition exceeding MAX_HAND_SPEED → infinite/capped cost
- Hand switch transition

### Full Performance Evaluation

```
Given: a 10-moment event sequence
When: evaluatePerformance() is called
Then: total equals sum of event costs + transition costs
And: aggregateMetrics.averageDimensions matches arithmetic mean
And: peakMomentIndex points to the hardest moment
```

### Recomputation After Manual Sound Move

```
Given: a layout evaluated with evaluatePerformance()
When: one sound is moved to a different pad
And: evaluatePerformance() is called with the same PadFingerAssignment
Then: only the affected moments change
And: total reflects the delta correctly
```

### Recomputation After Finger Ownership Change

```
Given: a layout evaluated with evaluatePerformance()
When: one pad's finger ownership is changed in PadFingerAssignment
And: evaluatePerformance() is called with the updated assignment
Then: costs reflect the new finger assignment
And: poseNaturalness changes for affected moments
```

### Consistency Between Optimizer and Canonical Evaluator

```
Given: a beam solver result with PadFingerAssignment extracted
When: evaluatePerformance() is called with the solver's layout and assignment
Then: the total is within numerical tolerance of the solver's reported score
```

This is the critical consistency test. If the canonical evaluator and the solver disagree, there is a bug.

### Rejection of Invalid PadFingerAssignment

```
Given: a PadFingerAssignment where two fingers claim the same pad
When: validateAssignment() is called
Then: returns valid=false with ownership_conflict issue

Given: a PadFingerAssignment where a finger is assigned a pad outside biomechanical reach
When: validateAssignment() is called
Then: returns valid=false with infeasible_grip issue

Given: an event sequence with notes that map to pads not in the PadFingerAssignment
When: evaluatePerformance() is called
Then: returns infeasibleMomentCount > 0 and flags unmapped notes in feasibility
```

### Layout Comparison

```
Given: two different layouts with the same event sequence
When: compareLayouts() is called
Then: dimensionDeltas correctly reflect per-dimension differences
And: winner reflects lower total cost
And: perMomentDeltas shows which moments improved/worsened
And: layoutChanges lists which pads differ
```
