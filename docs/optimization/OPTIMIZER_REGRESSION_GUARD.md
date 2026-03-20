# Optimizer Regression Guard

Summary of regressions found and fixes applied. This document exists to prevent
the same issues from recurring.

## What Regressed

### 1. `isProcessing` never reset after greedy generation (Critical)

**File:** `src/ui/hooks/useAutoAnalysis.ts`

The greedy optimization path dispatched `SET_PROCESSING: true` at the start but
never dispatched `SET_PROCESSING: false` on the success path. Only the error
`catch` block reset it.

**Impact:** After the first greedy generation completed, `isProcessing` stayed
`true` permanently. This blocked auto-analysis from running (it checks
`state.isProcessing` as a guard), making the timeline appear unresponsive and
causing the trace to appear "gone" since subsequent analysis never triggered.

**Fix:** Added `dispatch({ type: 'SET_PROCESSING', payload: false })` at the
end of the greedy success path.

### 2. `stopReason` dropped on the floor (Medium)

**File:** `src/ui/state/projectState.ts`

The `SET_MOVE_HISTORY` action accepted `{ moves, stopReason }` in its payload
but only stored `moves` in state. The `stopReason` was silently discarded.

**Impact:** `MoveTracePanel` accepts a `stopReason` prop and renders it as a
user-facing label ("Reached local minimum", "Hit iteration limit", etc.), but
it was never receiving it because:
1. State didn't store it
2. `PerformanceWorkspace` and `PerformanceAnalysisPanel` never passed it

**Fix:**
- Added `moveHistoryStopReason: string | null` to `ProjectState`
- Updated the `SET_MOVE_HISTORY` reducer to store `stopReason`
- Updated both rendering locations to pass `stopReason` to `MoveTracePanel`
- Updated serializer to initialize the new field

### 3. No restart support in greedy optimizer (Medium)

**File:** `src/engine/optimization/greedyOptimizer.ts`

The greedy optimizer ran a single trajectory per call. While `useAutoAnalysis`
ran it 3 times with different seeds to create 3 candidates, each run was
independent — there was no within-run restart/exploration behavior.

**Impact:** The greedy optimizer was purely a one-shot local search with no
ability to escape local minima within a single candidate generation.

**Fix:**
- Added `restartCount` to `OptimizerConfig` interface
- Refactored `GreedyOptimizer.optimize()` to delegate to `runSingleAttempt()`
- Added restart loop: runs `1 + restartCount` attempts with diversified seeds
- Best result across attempts is kept; traces from all attempts are merged
- Each move record now carries `attemptIndex` to identify which attempt produced it
- `useAutoAnalysis` now passes `restartCount: 2` for non-baseline candidates

### 4. Missing `attemptIndex` on trace entries

**File:** `src/engine/optimization/optimizerInterface.ts`

The `OptimizerMove` interface had no field to indicate which restart attempt
produced a trace entry. When restarts are used, the user needs to know which
attempt each move belongs to.

**Fix:** Added `attemptIndex?: number` to `OptimizerMove`.

## How Greedy Stochastic/Restart Behavior Now Works

### Single candidate generation:
1. **Attempt 0** runs with the configured seed. If `seed=0`, no noise is added
   (deterministic baseline). If `seed>0`, stochastic noise is added to greedy
   placement scoring.
2. Each **restart** (attempts 1 through `restartCount`) uses a different derived
   seed (`baseSeed + attempt * 7919`) to produce a different initial layout.
3. After each attempt completes, the best-cost result is kept.
4. Move histories from all attempts are merged so the trace shows the full
   exploration story.

### Multi-candidate generation (via useAutoAnalysis):
- **Candidate 0** (seed=0, restartCount=0): Deterministic baseline, single pass
- **Candidate 1** (seed=1, restartCount=2): 3 attempts with stochastic noise
- **Candidate 2** (seed=2, restartCount=2): 3 attempts with different noise

### Deterministic mode:
- Set `seed=0` and `restartCount=0` (or omit both)
- Greedy init uses no noise, hill-climbing is inherently deterministic
- Produces identical results across runs (verified by test)

## How Optimization Trace Is Preserved

### Production chain:
1. `GreedyOptimizer.runSingleAttempt()` builds `moveHistory: OptimizerMove[]`
2. `GreedyOptimizer.optimize()` merges traces from all restart attempts
3. `useAutoAnalysis` dispatches `SET_MOVE_HISTORY` with moves + stopReason
4. `projectState` reducer stores both in `state.moveHistory` and `state.moveHistoryStopReason`
5. `MoveTracePanel` renders the trace with phase filtering, step navigation, and stop reason

### Display locations:
- **PerformanceWorkspace** right panel (Layouts tab) — always visible when trace exists
- **PerformanceAnalysisPanel** (collapsible section) — shown alongside cost analysis

### Lifecycle:
- Trace is ephemeral (not persisted to localStorage) — this is intentional
- Trace is cleared at the start of each new generation run
- Trace survives within the session until a new generation replaces it
- `moveHistoryIndex` enables step-through navigation

## What Future Agents Must Not Break

See `CLAUDE.md` sections:
- **Core Functionality Preservation Contract** — defines what is core
- **Do Not Regress** — explicit rules against common regression patterns
- **Canonical Optimizer Output Contract** — required output fields and trace shapes
- **Solver Change Checklist** — verification steps for any solver-related change

### Quick reference:
1. Every greedy run must produce `moveHistory` with `phase` and `description`
2. `stopReason` must flow from optimizer → state → MoveTracePanel
3. `isProcessing` must be reset on all code paths (success AND error)
4. Deterministic mode (seed=0) must be reproducible
5. Cost diagnostics must remain factorized (5 canonical dimensions)
6. Changing solver internals must not break trace rendering
7. Restart behavior must not be simplified away without explicit approval

## Tests Added

`test/engine/optimization/greedyOptimizerTrace.test.ts`:
- Trace production: moveHistory is non-empty with required fields
- Trace shape: every entry has iteration, type, description, costs, phase
- Stop reason: valid enum value returned
- Telemetry: wall clock, initial/final cost, improvement present
- Diagnostics: factorized dimensions, not collapsed
- Deterministic mode: seed=0 produces identical results
- Seed diversity: different seeds can produce different placements
- Restart (restartCount=0): single-attempt trace
- Restart (restartCount=2): multi-attempt trace with distinct attemptIndex values
- Best-across-restarts: output has valid layout and cost
- Output contract: all required OptimizerOutput fields present
