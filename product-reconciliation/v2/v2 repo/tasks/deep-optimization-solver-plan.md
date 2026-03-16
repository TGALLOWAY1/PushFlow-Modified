# Deep Optimization Solver — Engineering Plan

> **Status**: Implementation-ready plan
> **Date**: 2026-03-13
> **Scope**: Add a Deep Optimization mode to the AnnealingSolver without destabilizing the existing Fast path

---

## 1. Current Solver Assessment

### 1.1 Architecture Overview

The optimization pipeline has two solver layers:

| Layer | Module | Purpose |
|-------|--------|---------|
| **BeamSolver** | `src/engine/solvers/beamSolver.ts` | Given a fixed Layout, produces an ExecutionPlan by beam search over finger assignments. This is the **cost function** for layout quality. |
| **AnnealingSolver** | `src/engine/optimization/annealingSolver.ts` | Mutates the Layout across iterations, evaluating each mutation via BeamSolver. This is the **layout optimizer**. |
| **MultiCandidateGenerator** | `src/engine/optimization/multiCandidateGenerator.ts` | Generates 3 diverse starting layouts (baseline, compact-right, compact-left), optionally runs annealing on each. |

The current flow for full generation (`useAutoAnalysis.generateFull`) is:
1. `generateCandidates()` with `useAnnealing: false` — only beam search, no layout optimization
2. Three diverse layout strategies are evaluated
3. Best candidate is selected

**Critical finding**: `useAnnealing` is hardcoded to `false` in `useAutoAnalysis.ts:224`. The AnnealingSolver exists and works but is **never invoked** through the normal UI flow. Users currently get layout evaluation, not layout optimization.

### 1.2 Current AnnealingSolver Parameters

| Parameter | Value | Assessment |
|-----------|-------|------------|
| `INITIAL_TEMP` | 500 | Reasonable for the cost scale |
| `COOLING_RATE` | 0.997 | Good — slow cooling, final temp ≈ 0.56 after 3000 iterations |
| `ITERATIONS` | 3000 | **Moderate** — sufficient for easy cases, likely too few for hard ones |
| `FAST_BEAM_WIDTH` | 12 | Reasonable for fast evaluation during SA |
| `FINAL_BEAM_WIDTH` | 50 | Good for final quality |
| Restart count | **0** (none) | **Critical gap** — no SA restarts, single trajectory only |
| Candidate diversity | **none** | Only the single best layout is tracked; no population |

### 1.3 Mutation Operators

Four mutation types in `mutationService.ts`:

| Operator | Probability | Scope |
|----------|-------------|-------|
| Single swap | 35% | Two occupied pads exchange voices |
| Single move | 35% | One voice moves to empty pad |
| Cluster swap | 15% | Two 2-pad clusters exchange |
| Row/col shift | 15% | All voices in a row/col shift ±1 |

**Assessment**: The operator set is reasonable but missing some high-leverage moves:
- **Zone transfer**: Move a voice from left zone to right zone (or vice versa) — important for hand balance optimization
- **Mirror**: Reflect a subset of the layout across the center column — preserves spatial structure while changing hand assignments
- **Region rotation**: Rotate a 2×2 or 3×3 block of assignments — enables structured local rearrangement

### 1.4 Where Runtime Is Spent

Each SA iteration calls `evaluateLayoutCost()` which:
1. Checks mapping coverage (`computeMappingCoverage`) — O(voices)
2. Creates a new BeamSolver instance
3. Runs full beam search over all events

**The beam search is the dominant cost.** With FAST_BEAM_WIDTH=12 and N events, each iteration costs O(N × 12 × grips_per_event). For a 200-event performance, a single SA iteration takes ~1-3ms, so 3000 iterations take 3-9 seconds.

### 1.5 Likely Under-Searching

1. **No restarts**: The solver runs a single SA trajectory. If it reaches a local minimum, it's stuck. SA theory strongly recommends multiple restarts, especially for combinatorial problems.

2. **No population diversity**: Only the best-ever layout is tracked. There's no mechanism to maintain a diverse set of promising candidates and refine the top N.

3. **Layout optimization is disabled in UI**: `useAnnealing: false` means the current product doesn't do any layout optimization at all — it only evaluates pre-seeded layouts.

4. **No passage-aware scoring during SA**: The beam solver scores the entire performance uniformly. Dense passages don't receive extra weight during optimization, so the solver may produce layouts that are locally good for easy passages but fail hard passages.

5. **Single-thread, sequential**: All 3 candidate strategies run sequentially. Even within the annealing solver, there's no parallelism.

### 1.6 Failure Modes

| Failure Mode | Likelihood | Impact |
|--------------|------------|--------|
| **Local minima** (no restarts) | High | Solver converges to mediocre layout, can't escape |
| **Premature convergence** (temp drops too fast for hard cases) | Medium | Good moves rejected late in the run |
| **Weak mutation coverage** (no zone transfer) | Medium | Can't fix hand balance issues without many steps |
| **Noise in fast evaluation** (beam width 12 during SA) | Low-Medium | May accept/reject mutations based on evaluation noise rather than true quality difference |
| **Dense passage blindness** | High | Layouts optimized for average case, not worst case |
| **No layout optimization in product** (`useAnnealing: false`) | Certain | Users never get optimized layouts currently |

---

## 2. Fast Solver vs Deep Solver Product Design

### 2.1 Mode Definitions

#### Fast Mode (current capability, with annealing enabled)

| Property | Value |
|----------|-------|
| **Purpose** | Quick feedback; good-enough for easy performances |
| **Runtime target** | 2–5 seconds |
| **SA iterations** | 3,000 |
| **SA restarts** | 0 (single trajectory) |
| **Fast beam width** | 12 |
| **Final beam width** | 50 |
| **Candidate count** | 3 strategies, best-of-1 per strategy |
| **Mutation set** | Standard 4 operators |
| **When to use** | Easy/Moderate performances; rapid iteration during editing |
| **Expected quality** | Good for simple layouts; acceptable for moderate complexity |
| **Telemetry** | Basic: iterations, best cost, final cost, generation time |

#### Deep Mode (new capability)

| Property | Value |
|----------|-------|
| **Purpose** | Best possible layout for hard performances |
| **Runtime target** | 5–15 seconds |
| **SA iterations** | 8,000 |
| **SA restarts** | 3 (best restart wins) |
| **Fast beam width** | 16 |
| **Final beam width** | 50 |
| **Candidate count** | 3 strategies, top-2 refined per strategy → 6 refined candidates, best overall returned |
| **Mutation set** | Standard 4 + zone transfer + mirror (6 operators) |
| **When to use** | Hard/Extreme performances; final optimization pass |
| **Expected quality** | Materially better than Fast on hard cases; negligible difference on easy cases |
| **Telemetry** | Full: per-restart traces, acceptance rates, diversity metrics, passage-level cost evolution |

### 2.2 Mode Selection

**Recommendation: Both manual and automatic, with manual override.**

```
┌──────────────────────────────────────────────┐
│ Mode Selection Logic                         │
│                                              │
│ 1. User selects "Auto" (default), "Quick",   │
│    or "Thorough"                             │
│                                              │
│ 2. If "Auto":                                │
│    - Classify performance difficulty          │
│    - Easy/Moderate → use Fast                │
│    - Hard/Extreme → use Deep                 │
│                                              │
│ 3. If "Quick" → always Fast                  │
│ 4. If "Thorough" → always Deep               │
└──────────────────────────────────────────────┘
```

### 2.3 Difficulty Classification Heuristics (for Auto mode)

Pre-solve classification using performance structure analysis (already available in `densityAnalysis.ts` and `performanceAnalyzer.ts`):

| Signal | Easy | Moderate | Hard |
|--------|------|----------|------|
| Voice count | ≤ 4 | 5–8 | > 8 |
| Peak density (events/sec) | < 4 | 4–8 | > 8 |
| Max polyphony | ≤ 2 | 3–4 | > 4 |
| Duration (seconds) | < 10 | 10–30 | > 30 |
| Simultaneous group count | < 3 | 3–6 | > 6 |

Score: sum weighted signals. If score ≥ threshold → Deep.

This is a **pre-solve heuristic** — it uses performance structure, not solver results. It's fast (< 10ms) and deterministic.

---

## 3. Proposed Deep Optimization Strategy

### 3.1 Changes Ordered by Leverage

#### Change 1: Enable annealing in the product (HIGH leverage, LOW risk)

**What**: Set `useAnnealing: true` in `generateFull()` when Deep mode is selected.
**Why**: The AnnealingSolver exists and works. Enabling it is the single highest-leverage change — it adds layout optimization to a pipeline that currently has none.
**Runtime impact**: +3-9 seconds per candidate.
**Risk**: Low — the code already exists and has been tested.

#### Change 2: Add SA restarts (HIGH leverage, LOW risk)

**What**: Run the SA loop `restartCount` times, reheating to `INITIAL_TEMP` each time but starting from the best layout found so far. Keep the global best across restarts.
**Why**: SA without restarts is brittle — a single trajectory easily gets stuck in local minima. Restarts are the cheapest way to dramatically improve search quality.
**Runtime impact**: Linear in restart count. 3 restarts ≈ 3× single-run time.
**Risk**: Very low — restarts are independent runs with the same logic.

```
Pseudocode:
  globalBest = initialLayout
  globalBestCost = initialCost

  for restart in 0..restartCount:
    current = globalBest  // start from best known
    currentCost = globalBestCost
    temp = INITIAL_TEMP

    for step in 0..iterationsPerRestart:
      candidate = mutate(current)
      candidateCost = evaluate(candidate)
      if accept(candidateCost, currentCost, temp):
        current = candidate
        currentCost = candidateCost
        if candidateCost < globalBestCost:
          globalBest = candidate
          globalBestCost = candidateCost
      temp *= coolingRate

  finalResult = evaluate(globalBest, finalBeamWidth)
```

#### Change 3: Increase iteration budget for Deep mode (MEDIUM leverage, LOW risk)

**What**: Deep mode uses 8,000 iterations per restart (vs 3,000 for Fast).
**Why**: More iterations allow the solver to explore further from the starting point and discover non-obvious improvements.
**Runtime impact**: ~2.5× per restart. Combined with 3 restarts: ~7.5× total vs current. Stays within 15-second target.
**Risk**: Very low — same algorithm, more steps.

#### Change 4: Add zone transfer mutation (MEDIUM leverage, LOW risk)

**What**: New mutation operator that moves a random voice from one hand zone (cols 0-3) to an empty pad in the other zone (cols 4-7), or vice versa.
**Why**: Current mutations can only gradually shift voices across zones via many single-move steps. Zone transfer enables the solver to fix hand balance issues in one step.
**Runtime impact**: Negligible — mutation cost is constant.
**Risk**: Low — same mutation contract (returns new Layout), same validation.

```typescript
// Zone transfer mutation (new operator)
function applyZoneTransferMutation(layout: Layout, rng: Rng): Layout {
  const occupiedPads = getOccupiedPads(layout);
  const emptyPads = getEmptyPads(layout);

  // Pick a random occupied pad
  const source = getRandomElement(occupiedPads, rng);
  const sourceZone = source.col < 4 ? 'left' : 'right';
  const targetZone = sourceZone === 'left' ? 'right' : 'left';

  // Find empty pads in the opposite zone
  const targetCandidates = emptyPads.filter(p =>
    targetZone === 'left' ? p.col < 4 : p.col >= 4
  );

  if (targetCandidates.length === 0) return layout; // No room in target zone

  const target = getRandomElement(targetCandidates, rng);
  return applyMoveMutation(layout, source, target);
}
```

#### Change 5: Increase fast beam width for Deep mode (LOW leverage, LOW risk)

**What**: Use FAST_BEAM_WIDTH=16 during SA in Deep mode (vs 12 for Fast).
**Why**: Wider beam during SA reduces evaluation noise, leading to more reliable accept/reject decisions. However, the current width of 12 is already reasonable.
**Runtime impact**: ~33% increase per iteration.
**Risk**: Very low — same beam search, wider width.

#### Change 6: Multi-candidate refinement (MEDIUM leverage, MEDIUM risk)

**What**: After SA completes all restarts, keep the top 2 distinct layouts (not just the best) and do a final high-quality evaluation on each. Return all to the candidate comparison system.
**Why**: The best-scoring layout during fast evaluation may not be the best when evaluated at full beam width. Keeping the top 2 provides insurance against evaluation noise.
**Runtime impact**: +1 final evaluation (~0.5s per extra candidate).
**Risk**: Medium — need to define "distinct" properly (layout similarity metric) and ensure downstream code handles multiple refined candidates.

### 3.2 Changes NOT Recommended

| Idea | Why Not |
|------|---------|
| Genetic algorithm / crossover | Adds significant complexity; SA restarts get most of the benefit with less risk |
| Passage-weighted scoring during SA | Would require modifying the beam solver's scoring, which is shared infrastructure. Better to assess passage difficulty after solving and use it for difficulty classification only. |
| Parallel SA threads (Web Workers) | High implementation complexity, platform-dependent. Save for a future iteration. |
| Adaptive temperature schedules | Marginal benefit over simple restarts; harder to debug |

---

## 4. Safe Implementation Plan

### Step 1: Add OptimizationMode type and solver configuration

**Goal**: Define the mode type and parameterize the AnnealingSolver.

**Files affected**:
- `src/types/engineConfig.ts` — add `OptimizationMode` type and `DeepSolverConfig`
- `src/engine/optimization/annealingSolver.ts` — accept config overrides

**Changes**:
```typescript
// In engineConfig.ts:
export type OptimizationMode = 'fast' | 'deep';

export interface AnnealingConfig {
  iterations: number;
  initialTemp: number;
  coolingRate: number;
  restartCount: number;
  fastBeamWidth: number;
  finalBeamWidth: number;
}

export const FAST_ANNEALING_CONFIG: AnnealingConfig = {
  iterations: 3000,
  initialTemp: 500,
  coolingRate: 0.997,
  restartCount: 0,
  fastBeamWidth: 12,
  finalBeamWidth: 50,
};

export const DEEP_ANNEALING_CONFIG: AnnealingConfig = {
  iterations: 8000,
  initialTemp: 500,
  coolingRate: 0.9985,  // Slower cooling for more iterations
  restartCount: 3,
  fastBeamWidth: 16,
  finalBeamWidth: 50,
};
```

**Risks**:
- None — additive type definitions, no existing behavior changes
- Must ensure FAST config matches current hardcoded values exactly

**Validation**:
- Verify `FAST_ANNEALING_CONFIG` produces identical behavior to current hardcoded constants
- Unit test: `FAST_ANNEALING_CONFIG.iterations === 3000` etc.

### Step 2: Parameterize AnnealingSolver to accept AnnealingConfig

**Goal**: Replace hardcoded constants with config-driven values while preserving default behavior.

**Files affected**:
- `src/engine/optimization/annealingSolver.ts`
- `src/types/engineConfig.ts` (SolverConfig)

**Changes**:
- Add `annealingConfig?: AnnealingConfig` to `SolverConfig`
- In `AnnealingSolver.solve()`, read from `this.annealingConfig ?? FAST_ANNEALING_CONFIG`
- Replace all references to `ITERATIONS`, `INITIAL_TEMP`, `COOLING_RATE`, `FAST_BEAM_WIDTH`, `FINAL_BEAM_WIDTH` with config properties
- Add restart loop wrapping the existing SA loop

**Expected behavior change**: None when no `annealingConfig` is provided (defaults to FAST).

**Risks**:
- Must not change behavior when config is not provided (regression risk)
- Restart loop must properly reset temperature and preserve global best
- Must yield to UI between restarts to prevent freezing

**Validation**:
- Run existing tests — output should be identical with no config override
- Run with `FAST_ANNEALING_CONFIG` explicitly — output should match no-config case
- Run with `restartCount: 0` — should behave identically to current code
- Seed determinism test: same seed → same result with and without explicit FAST config

### Step 3: Implement restart logic in AnnealingSolver

**Goal**: Add SA restart capability.

**Files affected**:
- `src/engine/optimization/annealingSolver.ts`

**Changes**:
```typescript
// In solve():
const config = this.annealingConfig ?? FAST_ANNEALING_CONFIG;
let globalBestLayout = /* initial */;
let globalBestCost = /* initial cost */;
const allTraces: AnnealingIterationSnapshot[] = [];

for (let restart = 0; restart <= config.restartCount; restart++) {
  let currentLayout = restart === 0
    ? /* deep copy of initial */
    : /* deep copy of globalBest */;
  let currentCost = restart === 0 ? initialCost : globalBestCost;
  let currentTemp = config.initialTemp;

  for (let step = 0; step < config.iterations; step++) {
    // ... existing SA loop body (unchanged) ...
    // Track in allTraces with restart index
  }

  // Yield between restarts
  await new Promise(resolve => setTimeout(resolve, 0));
}

this.bestLayout = globalBestLayout;
// ... final evaluation unchanged ...
```

**Risks**:
- Infinite loop if config has negative or zero iterations — guard with `Math.max(1, config.iterations)`
- Must deep-copy layout at restart boundaries to prevent mutation of globalBest
- annealingTrace must be extended to include restart index for debugging

**Validation**:
- `restartCount: 0` produces identical output to current code
- `restartCount: 1` with same seed produces at least as good a result as `restartCount: 0`
- Trace includes restart boundaries
- No shared state between restarts (verify via deep-copy assertions)

### Step 4: Add zone transfer mutation operator

**Goal**: Enable cross-zone voice movement in a single mutation step.

**Files affected**:
- `src/engine/optimization/mutationService.ts`

**Changes**:
- Add `applyZoneTransferMutation()` function
- Adjust probability distribution: swap 30%, move 30%, cluster 12%, shift 12%, zone transfer 16%
- Make probability distribution configurable (future-proofing, but default matches current behavior for Fast mode)

**Risks**:
- Zone transfer might move a voice to a pad that creates unmapped notes → already handled by coverage check in `evaluateLayoutCost` (returns Infinity, mutation rejected)
- Must preserve the contract: returns new Layout object, never mutates input

**Validation**:
- Unit test: zone transfer produces valid Layout with same voice count
- Unit test: zone transfer moves voice to opposite zone
- Unit test: zone transfer returns unchanged layout when no empty pads in target zone
- Integration: SA with zone transfer enabled produces valid candidates

### Step 5: Wire Deep mode through MultiCandidateGenerator

**Goal**: Allow `generateCandidates()` to accept an optimization mode.

**Files affected**:
- `src/engine/optimization/multiCandidateGenerator.ts`

**Changes**:
- Add `optimizationMode?: OptimizationMode` to `CandidateGenerationConfig`
- When `optimizationMode === 'deep'`:
  - Set `useAnnealing: true`
  - Pass `DEEP_ANNEALING_CONFIG` to AnnealingSolver
- When `optimizationMode === 'fast'` or undefined:
  - Set `useAnnealing: true` (enable annealing for Fast too — it currently has none)
  - Pass `FAST_ANNEALING_CONFIG`

**Important decision**: Even Fast mode should use annealing (just with conservative parameters). The current `useAnnealing: false` means zero layout optimization. Fast mode with 3000 iterations and no restarts is already fast enough (~3-5s) and materially better than no optimization.

**Risks**:
- This changes Fast mode behavior (adds annealing where none existed). This is intentional — the current behavior is a product gap, not a feature.
- Must ensure backward compatibility: callers that don't pass `optimizationMode` get `'fast'` behavior
- Generation time increases for Fast mode (from ~1s beam-only to ~3-5s with annealing)

**Validation**:
- `optimizationMode: undefined` produces valid candidates
- `optimizationMode: 'fast'` produces valid candidates
- `optimizationMode: 'deep'` produces valid candidates
- Deep mode candidates score equal or better than Fast mode on benchmark cases
- No crashes on empty performances, single-event performances, or performances with many voices

### Step 6: Add difficulty pre-classification for Auto mode

**Goal**: Automatically determine whether to use Fast or Deep mode.

**Files affected**:
- New function in `src/engine/evaluation/difficultyScoring.ts`

**Changes**:
```typescript
export function classifyOptimizationDifficulty(
  performance: Performance
): OptimizationMode {
  const events = performance.events;
  if (events.length === 0) return 'fast';

  // Voice count
  const uniqueNotes = new Set(events.map(e => e.noteNumber));
  const voiceCount = uniqueNotes.size;

  // Peak density (events per second, 1s window)
  const densityProfile = computeDensityProfile(events);
  const peakDensity = densityProfile.peakDensity;

  // Max polyphony
  const maxPoly = getMaxPolyphony(events);

  // Weighted score
  let score = 0;
  if (voiceCount > 8) score += 2;
  else if (voiceCount > 4) score += 1;

  if (peakDensity > 8) score += 2;
  else if (peakDensity > 4) score += 1;

  if (maxPoly > 4) score += 2;
  else if (maxPoly > 2) score += 1;

  return score >= 3 ? 'deep' : 'fast';
}
```

**Risks**:
- Classification might be wrong (easy performance routed to Deep → wastes time; hard performance routed to Fast → suboptimal result). This is acceptable because the user can always override.
- Must not import heavy dependencies or run expensive analysis

**Validation**:
- Unit test: empty performance → 'fast'
- Unit test: simple scale (4 notes, low density) → 'fast'
- Unit test: dense polyrhythm (10 notes, high density, polyphony) → 'deep'

### Step 7: Wire mode selection into UI

**Goal**: Add mode selection to the generation UI.

**Files affected**:
- `src/ui/hooks/useAutoAnalysis.ts` — accept and pass mode
- UI component that calls `generateFull()` — add mode selector

**Changes**:
- `generateFull()` accepts optional `mode: OptimizationMode | 'auto'`
- If `'auto'`, call `classifyOptimizationDifficulty()` to determine mode
- Pass mode through to `generateCandidates()`
- Update progress messages to reflect mode

**Risks**:
- UI must show estimated runtime ("This may take 10-15 seconds")
- Must handle case where user navigates away during deep optimization (abort mechanism already exists via `abortRef`)
- Do not break auto-analysis (the fast debounced re-analysis should remain Fast always)

**Validation**:
- Manual test: select "Quick" → fast generation
- Manual test: select "Thorough" → deep generation with longer runtime
- Manual test: select "Auto" → correct mode chosen based on performance
- Abort test: navigate away during deep optimization → clean abort, no crash

### Step 8: Add telemetry and instrumentation

**Goal**: Make solver behavior inspectable.

**Files affected**:
- `src/engine/optimization/annealingSolver.ts` — emit richer traces
- `src/types/executionPlan.ts` — extend `AnnealingIterationSnapshot`

**Changes**:
- Add `restartIndex` to `AnnealingIterationSnapshot`
- Add summary fields to ExecutionPlanResult metadata:
  - `optimizationMode: OptimizationMode`
  - `totalIterations: number`
  - `totalRestarts: number`
  - `restartBestCosts: number[]` (best cost at end of each restart)
  - `acceptanceRate: number` (fraction of iterations that accepted)
  - `improvementRate: number` (fraction of iterations that found new global best)
  - `wallClockMs: number`
- All telemetry goes through the existing `metadata` field on `ExecutionPlanResult`

**Risks**:
- Must not break existing consumers of `annealingTrace` or `metadata`
- New fields must be optional to maintain backward compatibility

**Validation**:
- Fast mode metadata includes `optimizationMode: 'fast'`
- Deep mode metadata includes restart-level data
- All new fields are present and have reasonable values

---

## 5. Verification and Testing Plan

### 5A. Correctness Tests

```
test("FAST_ANNEALING_CONFIG matches current hardcoded values", () => {
  expect(FAST_ANNEALING_CONFIG.iterations).toBe(3000);
  expect(FAST_ANNEALING_CONFIG.initialTemp).toBe(500);
  expect(FAST_ANNEALING_CONFIG.coolingRate).toBe(0.997);
  expect(FAST_ANNEALING_CONFIG.restartCount).toBe(0);
  expect(FAST_ANNEALING_CONFIG.fastBeamWidth).toBe(12);
  expect(FAST_ANNEALING_CONFIG.finalBeamWidth).toBe(50);
});

test("AnnealingSolver with no config override produces identical result to current code", () => {
  // Run current hardcoded solver and new configurable solver with same seed
  // Results must be identical
});

test("constraints enforced identically in fast and deep modes", () => {
  // Same performance, same initial layout, different modes
  // Both should reject identical infeasible candidates
  // Both should produce valid coverage (no unmapped notes)
});

test("infeasible candidates receive Infinity cost", () => {
  // Layout with missing voice mapping → cost must be Infinity
  // SA must reject this candidate
});

test("score breakdowns sum correctly", () => {
  // averageMetrics.total === sum of component averages
  // For every FingerAssignment: cost === sum of costBreakdown components
});

test("deep mode respects restart count", () => {
  // Run with restartCount=3, verify annealingTrace has 4 segments
  // (initial run + 3 restarts)
});

test("solver returns valid candidate for empty performance", () => {
  // No crash, returns a valid (trivial) result
});

test("solver returns valid candidate for single-event performance", () => {
  // Degenerate case — must not crash
});

test("zone transfer mutation preserves voice count", () => {
  // Before and after mutation: same number of voices, same set of voice IDs
});

test("zone transfer mutation actually changes zone", () => {
  // Verify source pad zone !== target pad zone
});
```

### 5B. Regression Tests

```
test("existing simple scale performance produces same result with Fast mode", () => {
  // Seed = 42, same performance, same initial layout
  // Score should match historical baseline ± epsilon
});

test("same seed produces deterministic result in Fast mode", () => {
  // Run twice with same seed → identical annealingTrace
});

test("same seed produces deterministic result in Deep mode", () => {
  // Run twice with same seed → identical annealingTrace
});

test("output structure compatible with CandidateSolution type", () => {
  // Result has all required fields
  // Can be passed to analyzeDifficulty() and computeTradeoffProfile()
  // Can be passed to extractEvaluationRecords()
  // Can be rendered by CandidateCard and CandidateCompare
});

test("deep mode never produces worse score than fast mode on benchmarks", () => {
  // For each benchmark: deepScore <= fastScore (lower is better)
  // Allow small epsilon for evaluation noise
  // If deep is worse, flag as test failure for investigation
});
```

### 5C. Quality Benchmark Tests

#### Benchmark Suite Structure

```typescript
interface BenchmarkCase {
  name: string;
  description: string;
  performance: Performance;        // Synthetic or from fixture
  initialLayout: Layout;           // Starting layout
  expectedDifficultyClass: DifficultyClass;
  fastBaselineScore?: number;      // Historical fast mode score
  deepShouldImprove: boolean;      // Whether deep mode should beat fast
  minimumImprovementPct?: number;  // e.g., 10% means deep must be ≥10% better
}
```

#### Benchmark Cases

| Case | Voices | Density | Polyphony | Expected Class | Deep Should Improve |
|------|--------|---------|-----------|----------------|---------------------|
| Simple scale | 4 | Low | 1 | Easy | No (minimal) |
| Chord progression | 6 | Moderate | 3 | Moderate | Yes (5-15%) |
| Dense polyrhythm | 10 | High | 4 | Hard | Yes (15-30%) |
| Cross-hand melody | 8 | Moderate | 2 | Hard | Yes (10-25%) |
| Full song excerpt | 12 | Variable | 5 | Extreme | Yes (20-40%) |

#### Quality Metrics

For each benchmark, measure:

| Metric | Definition | Good Direction |
|--------|-----------|---------------|
| `totalScore` | `averageMetrics.total` from ExecutionPlanResult | Lower |
| `feasibilityViolations` | Count of Unplayable assignments | Lower |
| `hardEventCount` | Count of Hard-difficulty assignments | Lower |
| `fingerDominanceMisuse` | Count of pinky/thumb assignments when index/middle available | Lower |
| `travelBurden` | Sum of movement distances | Lower |
| `worstPassageDifficulty` | Max passage difficulty score | Lower |
| `handBalanceDeviation` | `|leftFraction - 0.5|` | Lower |
| `scoreVarianceAcrossSeeds` | Variance of totalScore across 5 different seeds | Lower |

### Acceptance Criteria

1. **No crash on any benchmark case** — both modes
2. **Fast mode baseline scores match historical values** (regression gate)
3. **Deep mode scores ≤ Fast mode scores on all Hard/Extreme cases** (quality gate)
4. **Deep mode improves by ≥10% on at least one Hard case** (value gate)
5. **Wall-clock time: Fast < 5s, Deep < 15s** on benchmark hardware
6. **Deterministic: same seed → same score** within each mode

---

## 6. Instrumentation and Debugging Improvements

### 6.1 Solver Telemetry Record

Add to `ExecutionPlanResult.metadata`:

```typescript
interface SolverTelemetry {
  // Mode
  optimizationMode: OptimizationMode;

  // Timing
  wallClockMs: number;
  iterationsCompleted: number;

  // Restarts
  restartCount: number;
  restartBestCosts: number[];        // Best cost at end of each restart

  // Acceptance
  totalAccepted: number;
  totalRejected: number;
  totalInvalid: number;              // Mutations that produced invalid layouts
  acceptanceRate: number;            // accepted / (accepted + rejected)

  // Improvement
  improvementCount: number;          // How many times global best was updated
  improvementRate: number;           // improvementCount / iterationsCompleted
  finalCostImprovement: number;      // (initialCost - finalCost) / initialCost

  // Cost trajectory
  costAtMilestones: {                // Cost at 25%, 50%, 75%, 100% of iterations
    pct25: number;
    pct50: number;
    pct75: number;
    pct100: number;
  };
}
```

### 6.2 Debugging Tools (Use Existing Framework)

All debugging must use the existing framework in `src/engine/debug/`:

| Tool | Where | What It Shows |
|------|-------|---------------|
| **Evaluation Records** | `evaluationRecorder.ts` | Per-event cost breakdown — already works, no changes needed |
| **Candidate Report** | `candidateReport.ts` | Full candidate analysis — already works |
| **Sanity Checks** | `sanityChecks.ts` | Post-hoc validation — already works |
| **Irrational Detector** | `irrationalDetector.ts` | Flags suspicious finger choices — already works |
| **Constraint Validator** | `constraintValidator.ts` | Validates biomechanical constraints — already works |
| **Visualization Data** | `visualizationData.ts` | Timeline data for UI — already works |

**New instrumentation to add** (goes into existing debug framework):

1. **Cost vs iteration curve**: Already captured in `annealingTrace`. Extend with `restartIndex` field.

2. **Acceptance rate per restart**: Compute from trace data. Add to `SolverTelemetry`.

3. **Per-restart best-cost comparison**: Shows whether restarts are finding different optima. Goes in `SolverTelemetry.restartBestCosts`.

4. **Fast vs Deep comparison table**: When both modes have been run, compare per-factor scores side by side. This is a UI feature using existing `compareCandidates()` from `candidateComparator.ts`.

### 6.3 Key Principle

**Both Fast and Deep modes must run through the identical evaluation pipeline.**
- Same `evaluateLayoutCost()` function
- Same BeamSolver
- Same cost functions
- Same `extractEvaluationRecords()` for post-hoc debugging
- Same `constraintValidator` for validation
- Same `irrationalDetector` for quality checking

The only differences between modes are SA parameters (iterations, restarts, beam width during SA) and mutation operator set. The evaluation, constraint, and debugging infrastructure is shared and identical.

---

## 7. API / UX Recommendation

### 7.1 Mode Naming

| Internal Name | User-Facing Name | Description |
|---------------|------------------|-------------|
| `'fast'` | **Quick** | "Fast optimization — good for simple performances" |
| `'deep'` | **Thorough** | "Deep optimization — best results for complex performances" |
| `'auto'` | **Auto** (default) | "Automatically chooses based on performance complexity" |

Rationale: "Quick" and "Thorough" are intuitive and non-technical. Avoid "Fast/Deep" as user-facing terms — they imply implementation details.

### 7.2 UI Design

```
┌─────────────────────────────────────────┐
│ Generate Candidates                     │
│                                         │
│ Optimization: [Auto ▾] [Quick] [Thorough]│
│                                         │
│ Auto selected: Will use Quick            │
│ (Performance classified as Easy)         │
│                                         │
│        [ Generate ]                     │
│                                         │
│ ⏱ Estimated: ~3 seconds                 │
└─────────────────────────────────────────┘
```

When "Thorough" is active or auto-selected:
```
│ Auto selected: Will use Thorough         │
│ (Performance classified as Hard —        │
│  10 voices, peak density 9.2/sec)        │
│                                         │
│ ⏱ Estimated: ~10-15 seconds              │
```

### 7.3 Result Metadata

Each `CandidateSolution` should include in its `metadata`:

```typescript
interface CandidateMetadata {
  strategy: string;
  seed: number;
  generationTimeMs?: number;
  // New:
  optimizationMode: OptimizationMode;
  optimizationSummary?: string;  // Human-readable, e.g., "Thorough: 8000 iterations × 4 restarts, 12.3s"
}
```

### 7.4 Optimization Summary Panel

After generation, show a summary:

```
Optimization Complete (Thorough mode, 12.3s)
├─ 3 layout strategies evaluated
├─ 24,000 iterations across 3 restarts per strategy
├─ Best score: 4.23 (was 7.81 before optimization)
├─ 46% improvement over starting layout
└─ Performance classified as Hard
```

This uses existing data — no new plumbing needed beyond the `SolverTelemetry` struct.

---

## 8. Final Recommendation

### 8.1 Best Practical Design

The plan as described above: parameterize the existing AnnealingSolver, add restarts, add one new mutation operator, wire through the existing candidate generation pipeline, and add mode selection to the UI. No new solver algorithms, no architectural changes, no parallel execution.

### 8.2 Minimum Safe Version to Ship First

**Phase 1 (minimum viable):**
1. Enable annealing in the product (`useAnnealing: true` for all modes)
2. Parameterize SA constants via `AnnealingConfig`
3. Add restart loop
4. Add `OptimizationMode` to `CandidateGenerationConfig`
5. Wire "Quick" vs "Thorough" toggle in UI

This delivers the core value (layout optimization + deep search) with minimal code changes.

**Phase 2 (follow-up):**
6. Add zone transfer mutation
7. Add auto difficulty classification
8. Add solver telemetry
9. Add multi-candidate refinement (top-2)

### 8.3 Highest-Priority Tests Before Merging

1. **Regression**: Fast mode with explicit FAST config produces identical output to current hardcoded code (same seed)
2. **Correctness**: Deep mode produces valid candidates (no crashes, no Infinity scores, coverage complete)
3. **Quality**: Deep mode scores ≤ Fast mode on Hard benchmark case
4. **Determinism**: Same seed → same result in both modes
5. **Runtime**: Fast < 5s, Deep < 15s on benchmark case
6. **Abort safety**: Navigating away during deep optimization doesn't crash or leak

### 8.4 Biggest Risk Areas

| Risk | Mitigation |
|------|------------|
| **Enabling annealing changes Fast mode behavior** | This is intentional — current "no annealing" is a product gap, not a feature. Validate that annealing-enabled Fast mode is strictly better than beam-only. |
| **Restart logic has shared-state bugs** | Deep-copy layout at restart boundaries. Unit test that restart 0 with restartCount=0 matches current behavior exactly. |
| **Deep mode takes too long on slow machines** | Add wall-clock timeout (15s default). If timeout hit, return best-so-far. |
| **Zone transfer mutation creates invalid layouts** | Already handled: `evaluateLayoutCost` returns Infinity for incomplete coverage, SA rejects. Add unit test. |
| **UI freezes during deep optimization** | Existing `setTimeout(resolve, 0)` yield every 50 iterations. Add yield between restarts. Consider progress callback for UI updates. |
| **Auto mode classifies incorrectly** | Low impact — user can override. Log classification reasoning for debugging. |

---

## Implementation File Summary

| File | Change Type | Risk |
|------|-------------|------|
| `src/types/engineConfig.ts` | Add types | None |
| `src/engine/optimization/annealingSolver.ts` | Parameterize + add restarts | Low |
| `src/engine/optimization/mutationService.ts` | Add zone transfer operator | Low |
| `src/engine/optimization/multiCandidateGenerator.ts` | Accept mode, wire config | Low |
| `src/engine/evaluation/difficultyScoring.ts` | Add pre-classification function | None |
| `src/types/executionPlan.ts` | Extend snapshot and metadata types | None |
| `src/ui/hooks/useAutoAnalysis.ts` | Accept mode, pass through | Low |
| UI component (mode selector) | Add toggle | None |
| Test files | New tests | None |
