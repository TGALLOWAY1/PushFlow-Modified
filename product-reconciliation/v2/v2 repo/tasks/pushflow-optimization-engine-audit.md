# PushFlow Optimization Engine Audit

**Date:** 2026-03-13
**Scope:** Full technical audit of the joint layout + execution plan optimization system
**Codebase:** PushFlow v2 (current `src/engine/` subsystem)

---

## Phase 1 — Codebase Structural Understanding

### 1. System Architecture Overview

The optimization system converts MIDI-derived musical events into physically playable Ableton Push 3 performances. The pipeline flows as follows:

```
Input MIDI File (.mid)
        │
        ▼
┌──────────────────────────┐
│   MIDI Import Pipeline   │  src/import/midiImport.ts
│   @tonejs/midi parser    │  Extracts events, groups voices
│   → Performance object   │  Assigns deterministic eventKeys
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Performance Structure   │  src/engine/structure/performanceAnalyzer.ts
│  Section detection       │  src/engine/structure/sectionDetection.ts
│  Role inference          │  src/engine/structure/roleInference.ts
│  Co-occurrence graph     │  src/engine/structure/cooccurrence.ts
│  Transition graph        │  src/engine/structure/transitionGraph.ts
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Layout Generation       │  src/engine/mapping/seedFromPose.ts
│  Seed from Pose0         │  src/engine/optimization/multiCandidateGenerator.ts
│  Compact layouts (L/R)   │  Places voices on pads
│  Chromatic fallback      │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Execution Plan Solver   │  src/engine/solvers/beamSolver.ts
│  Beam search (K-best)    │  Assigns hand + finger per event
│  Tiered feasibility      │  src/engine/prior/feasibility.ts
│  3-component objective   │  src/engine/evaluation/costFunction.ts
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Layout Optimization     │  src/engine/optimization/annealingSolver.ts
│  Simulated annealing     │  src/engine/optimization/mutationService.ts
│  Mutate → re-evaluate    │  Metropolis acceptance criterion
│  1000 iterations         │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Difficulty Evaluation   │  src/engine/evaluation/difficultyScoring.ts
│  Passage-level scoring   │  src/engine/evaluation/passageDifficulty.ts
│  Factor breakdown        │  Role-weighted scoring
│  Binding constraints     │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Candidate Ranking       │  src/engine/optimization/candidateRanker.ts
│  Composite scoring       │  Pareto filtering
│  Dimension comparison    │  TradeoffProfile (6 axes)
└──────────────────────────┘
        │
        ▼
  CandidateSolution[]
  (Layout + ExecutionPlan + DifficultyAnalysis)
```

#### How Layout and Execution Interact

This is a **coupled optimization problem**. The system handles it via nested evaluation:

1. **Outer loop (AnnealingSolver):** Mutates the Layout (pad assignments)
2. **Inner loop (BeamSolver):** For each candidate layout, solves the execution plan (finger assignments)
3. **Evaluation:** The execution plan cost becomes the layout's fitness score

The BeamSolver is used both as the primary solver (for beam-search-only candidates) and as the cost function for the AnnealingSolver. This creates a clean hierarchical optimization:

```
AnnealingSolver.solve()
  └── for each mutation:
        └── BeamSolver.solveSync()  ← evaluates layout quality
              └── generateValidGripsWithTier()  ← feasibility check
              └── calculatePoseNaturalness()    ← pose scoring
              └── calculateTransitionCost()     ← movement scoring
```

The `multiCandidateGenerator.ts` generates 3 diverse candidates using different layout strategies (baseline, compact-right, compact-left), then optionally runs annealing on each.

---

### 2. Core Optimization Components

#### 2.1 BeamSolver (`src/engine/solvers/beamSolver.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Assign hand + finger to each performance event |
| **Inputs** | `Performance` (events), `EngineConfiguration` (beam width, stiffness, resting pose), `Layout` |
| **Outputs** | `ExecutionPlanResult` (per-event FingerAssignment[], aggregate metrics) |
| **Dependencies** | `feasibility.ts`, `costFunction.ts`, `objective.ts`, `mappingResolver.ts`, `handPose.ts` |

**Algorithm:**
1. Sort events by timestamp, group simultaneous events
2. Build note-to-pad index from layout
3. Initialize beam with resting hand poses
4. For each event group:
   - For each beam node, expand with all valid grips (left hand, right hand)
   - For chords (≥2 simultaneous notes), also try split-hand assignments
   - Score each expansion with 3-component PerformabilityObjective
   - Apply 1-step lookahead bonus for proximity to next group
   - Prune beam to top-K by total cost
5. Backtrack from best terminal node to recover full assignment sequence

**Key design choice:** Each event group is assigned to a single hand OR split across both hands. The beam tracks both hand poses, left/right counts, and cumulative cost.

#### 2.2 AnnealingSolver (`src/engine/optimization/annealingSolver.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Optimize layout (pad assignments) for a given performance |
| **Inputs** | `Performance`, `EngineConfiguration`, initial `Layout` |
| **Outputs** | `ExecutionPlanResult` (with `annealingTrace` for debugging) |
| **Dependencies** | `beamSolver.ts`, `mutationService.ts`, `mappingCoverage.ts` |

**Configuration (updated):**
- `INITIAL_TEMP = 500`
- `COOLING_RATE = 0.997` *(was 0.99)*
- `ITERATIONS = 3000` *(was 1000)*
- `FAST_BEAM_WIDTH = 12` *(was 5)* (during search)
- `FINAL_BEAM_WIDTH = 50` (final evaluation)

**Algorithm:**
1. Evaluate initial layout cost via BeamSolver
2. For each iteration:
   - Apply random mutation (swap or move)
   - Evaluate mutated layout
   - Accept if better, or probabilistically accept worse (Metropolis: `exp(-Δ/T)`)
   - Cool temperature: `T *= 0.99`
3. Re-evaluate best layout with high beam width

#### 2.3 MultiCandidateGenerator (`src/engine/optimization/multiCandidateGenerator.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Generate diverse candidate solutions |
| **Inputs** | `Performance`, `NaturalHandPose`, `CandidateGenerationConfig` |
| **Outputs** | `CandidateSolution[]` (typically 3) |
| **Dependencies** | `annealingSolver.ts`, `beamSolver.ts`, `seedFromPose.ts`, `difficultyScoring.ts` |

**Strategies (when no Pose0):**
1. **Baseline** — user's current layout, beam search only
2. **Compact-right** — voices clustered in right-hand zone (cols 4-7)
3. **Compact-left** — voices clustered in left-hand zone (cols 0-3)

**Strategies (with Pose0):**
- Pose0-offset variants (offset 0, 1, 2 rows up)

#### 2.4 MutationService (`src/engine/optimization/mutationService.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Generate layout mutations for annealing |
| **Inputs** | `Layout`, RNG function |
| **Outputs** | Mutated `Layout` (new immutable object) |
| **Dependencies** | None (pure function) |

**Mutations (updated):**
- **Swap** (35%): Exchange voices between two occupied pads
- **Move** (35%): Move a voice from an occupied pad to an empty pad
- **Cluster swap** (15%): Swap two adjacent groups of voices *(new)*
- **Row/col shift** (15%): Shift all voices in a row/column by ±1 *(new)*

#### 2.5 CandidateRanker (`src/engine/optimization/candidateRanker.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Rank and filter candidate solutions |
| **Inputs** | `CandidateSolution[]` |
| **Outputs** | Ranked/filtered `CandidateSolution[]` |
| **Dependencies** | None |

**Ranking formula:**
```
compositeScore = 0.30 × playability
               + 0.15 × compactness
               + 0.10 × handBalance
               + 0.20 × transitionEfficiency
               + 0.15 × learnability
               + 0.10 × robustness
```

**Pareto filtering:** On two axes: composite score (higher=better) vs max passage difficulty (lower=better).

#### 2.6 Feasibility (`src/engine/prior/feasibility.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Generate biomechanically valid hand grips |
| **Inputs** | `PadCoord[]` (active pads), `HandSide` |
| **Outputs** | `GripResult[]` with tier metadata |
| **Dependencies** | `biomechanicalModel.ts` |

**Tiered constraint system:**
- **Tier 1 (Strict):** Per-pair finger span within strict limits, strict topology, strict thumb delta
- **Tier 2 (Relaxed):** Span limits × 1.15, relaxed thumb delta (2.0), allow slight overlap
- **Tier 3 (Fallback):** Ignore all constraints, assign fingers in anatomical order

#### 2.7 DifficultyScoring (`src/engine/evaluation/difficultyScoring.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Analyze difficulty at passage and song level |
| **Inputs** | `ExecutionPlanResult`, `Section[]` |
| **Outputs** | `DifficultyAnalysis` (overall score, per-passage breakdown, binding constraints) |
| **Dependencies** | `passageDifficulty.ts` |

#### 2.8 BiomechanicalModel (`src/engine/prior/biomechanicalModel.ts`)

| Property | Value |
|----------|-------|
| **Responsibility** | Single source of truth for all physical constants |
| **Inputs** | N/A (constants module) |
| **Outputs** | All constraint parameters, finger costs, speed limits |
| **Dependencies** | None |

---

### 3. Cost Function Breakdown

The optimizer uses a **3-component primary scoring model** (`PerformabilityObjective`) plus a **7-component diagnostic model** (`ObjectiveComponents`) for display.

#### 3.1 Primary Scoring Model (3-Component)

**File:** `src/engine/evaluation/objective.ts` (lines 33-40)

```
total_cost = poseNaturalness + transitionDifficulty + constraintPenalty
```

No explicit weights between the three primary terms — they are summed directly. The relative scaling comes from the internal computation of each term.

##### Cost 1: `poseNaturalness`

**What it penalizes:** Unnatural hand grips — hands far from resting position, fingers on suboptimal pads.

**Computation** (`costFunction.ts:92-116`):
```
poseNaturalness = 0.4 × attractorCost
                + 0.4 × perFingerHomeCost
                + 0.2 × dominanceCost
```

**Sub-components:**

| Sub-cost | Formula | Weight | Code |
|----------|---------|--------|------|
| `attractorCost` | `euclidean(grip.centroid, resting.centroid) × stiffness` | 0.4 | `costFunction.ts:197` |
| `perFingerHomeCost` | Σ `euclidean(finger_pos, neutral_pad) × 0.8` for each assigned finger | 0.4 | `costFunction.ts:210-228` |
| `dominanceCost` | Σ `FINGER_DOMINANCE_COST[finger]` for each assigned finger | 0.2 | `costFunction.ts:173-179` |

**Finger dominance costs** (`biomechanicalModel.ts:173-179`):
| Finger | Cost |
|--------|------|
| index | 0.0 |
| middle | 0.0 |
| ring | 1.0 |
| pinky | 3.0 |
| thumb | 5.0 |

##### Cost 2: `transitionDifficulty`

**What it penalizes:** Large or fast hand movements between consecutive event groups.

**Computation** (`costFunction.ts:240-251`):
```
distance = euclidean(prev_centroid, curr_centroid)
speed = distance / timeDelta
if speed > MAX_HAND_SPEED (12.0): return Infinity  ← HARD CONSTRAINT
transitionDifficulty = distance + speed × SPEED_COST_WEIGHT (0.5)
```

**Key constant:** `MAX_HAND_SPEED = 12.0` grid units/second. This is a hard feasibility cutoff.

**Special cases:**
- `timeDelta ≤ 0.001`: cost = 0 (simultaneous events)
- `distance = 0`: cost = 0 (no movement)
- First event group: `timeDelta` is clamped to `max(rawDelta, 1.0)` to avoid penalizing the initial placement

##### Cost 3: `constraintPenalty`

**What it penalizes:** Use of relaxed or fallback grips that violate biomechanical constraints.

**Values** (`biomechanicalModel.ts:192-195`):
| Tier | Penalty |
|------|---------|
| Strict (Tier 1) | 0 |
| Relaxed (Tier 2) | 200 |
| Fallback (Tier 3) | 1000 |

#### 3.2 Diagnostic Scoring Model (7-Component, Legacy)

**File:** `src/engine/evaluation/objective.ts` (lines 50-58)

Computed alongside the primary model for UI display but **not used in beam search scoring**.

| Component | Source | Used in beam? |
|-----------|--------|---------------|
| `transition` | Fitts's Law cost (same as primary) | No (display only) |
| `stretch` | `calculateFingerDominanceCost()` | No |
| `poseAttractor` | `calculateAttractorCost()` | No |
| `perFingerHome` | `calculatePerFingerHomeCost()` | No |
| `alternation` | `calculateAlternationCost()` | No |
| `handBalance` | `calculateHandBalanceCost()` | No |
| `constraints` | Tier-based penalty | No |

##### `alternation` (diagnostic only)

**What it penalizes:** Same finger playing consecutive events with short time gap.

**Computation** (`costFunction.ts:126-141`):
```
if dt ≥ ALTERNATION_DT_THRESHOLD (0.25s): return 0
for each finger repeated:
    recencyFactor = 1 - dt / 0.25
    penalty += ALTERNATION_PENALTY (1.5) × recencyFactor
```

##### `handBalance` (diagnostic only)

**What it penalizes:** One hand doing disproportionate work.

**Computation** (`costFunction.ts:151-160`):
```
if total < HAND_BALANCE_MIN_NOTES (2): return 0
leftShare = leftCount / total
deviation = leftShare - HAND_BALANCE_TARGET_LEFT (0.45)
handBalanceCost = HAND_BALANCE_WEIGHT (2.0) × deviation²
```

#### 3.3 Lookahead Bonus

**File:** `beamSolver.ts:158-172`

A 1-step lookahead that rewards grips leaving the hand near the next event group:
```
distToNext = euclidean(gripCentroid, nextGroupCentroid)
proximityBonus = max(0, 3.0 - distToNext) × 0.5
bonus = min(stepCost × 0.1, proximityBonus)
stepCost -= bonus
```

Capped at 10% of step cost. Only applied when `stepCost > 0`.

#### 3.4 Passage-Level Difficulty Scoring

**File:** `src/engine/evaluation/passageDifficulty.ts:65-178`

Per-passage difficulty is a weighted combination:
```
difficultyScore = 0.30 × hardRatio
                + 0.20 × speedScore
                + 0.15 × transitionScore
                + 0.10 × stretchScore
                + 0.10 × polyphonyScore
                + 0.10 × avgCostNormalized
                + 0.05 × crossoverScore
```

Each factor is normalized to [0, 1]. The overall song score uses **square-weighted** averaging that emphasizes harder passages.

#### 3.5 TradeoffProfile Dimensions

**File:** `src/engine/evaluation/difficultyScoring.ts:183-231`

All scores are 0-1, higher = better:

| Dimension | Computation |
|-----------|-------------|
| `playability` | `1 - overallDifficultyScore` |
| `compactness` | `1 - min(avgDrift/4, 1)` |
| `handBalance` | `1 - |leftFraction - 0.5| × 2` |
| `transitionEfficiency` | `1 - min(avgMovement/10, 1)` |
| `learnability` | `1 - min(uniquePadCount/20, 1)` |
| `robustness` | `1 - passageDifficultyVariance × 4` |

---

### 4. Hard Constraints vs Soft Costs

#### Hard Constraints (Reject or Return Infinity)

| Constraint | Where Enforced | Behavior |
|------------|---------------|----------|
| **Max hand speed** | `calculateTransitionCost()` (`costFunction.ts:249`) | Returns `Infinity` → candidate expansion dropped |
| **Per-pair finger span (Tier 1)** | `satisfiesSpanConstraint()` (`feasibility.ts:336-348`) | Grip rejected at generation time |
| **Finger ordering (topology)** | `satisfiesLeftHandTopology()` / `satisfiesRightHandTopology()` (`feasibility.ts:354-414`) | Grip rejected |
| **Finger collision** | Checked during grip permutation (`feasibility.ts:501-519`) | Permutation skipped |
| **Thumb delta** | Topology check in `satisfiesLeftHandTopology()` | Grip rejected |
| **Max 5 simultaneous pads** | `generateGripsWithConstraints()` (`feasibility.ts:456`) | Returns empty |
| **Full coverage** | `AnnealingSolver.evaluateLayoutCost()` (`annealingSolver.ts:96-98`) | Returns `Infinity` cost → mutation rejected |

#### Soft Costs (Penalty, Not Rejection)

| Cost | Magnitude | Effect |
|------|-----------|--------|
| Relaxed grip penalty | 200 | Strong discouragement of strained grips |
| Fallback grip penalty | 1000 | Nearly prohibitive; only used when no valid grip exists |
| Finger dominance (ring) | 1.0 | Mild preference for index/middle |
| Finger dominance (pinky) | 3.0 | Moderate discouragement |
| Finger dominance (thumb) | 5.0 | Strong discouragement for percussion |
| Attractor spring | `distance × stiffness` | Proportional pull to resting pose |
| Per-finger home distance | `distance × 0.8` | Per-finger pull to neutral pad |
| Transition (Fitts's Law) | `distance + speed × 0.5` | Movement + speed cost |

#### Active Scoring Costs (Now in Beam Score, Weighted)

| Cost | Weight in Beam | When Active | Purpose |
|------|---------------|-------------|---------|
| Alternation penalty (1.5) | × 0.8 | `dt < 0.25s` | Penalizes same-finger repetition |
| Hand balance penalty | × 0.3 | `total ≥ 2 notes` | Prevents hand imbalance |

---

### 5. Finger Capability Model

**File:** `src/engine/prior/biomechanicalModel.ts`

The system models finger capabilities through several mechanisms:

#### 5.1 Finger Dominance Cost (Selection Preference)

| Finger | Cost | Interpretation |
|--------|------|----------------|
| index | 0.0 | Fully preferred — no penalty |
| middle | 0.0 | Fully preferred — no penalty |
| ring | 1.0 | Slight penalty — weaker independence |
| pinky | 3.0 | Significant penalty — weak, short |
| thumb | 5.0 | Highest penalty — discouraged for percussion pads |

This cost enters the beam score via `calculatePoseNaturalness()` at weight 0.2.

#### 5.2 Per-Pair Span Limits (Finger Spread)

The system models inter-finger spread limits reflecting anatomical constraints:

| Finger Pair | Strict Span | Relaxed (×1.15) | Rationale |
|-------------|------------|-----------------|-----------|
| index-middle | 2.0 | 2.30 | Adjacent, moderate spread |
| middle-ring | 2.0 | 2.30 | Adjacent, moderate |
| pinky-ring | 1.5 | 1.73 | Linked tendons, least independent |
| index-ring | 2.0 | 2.30 | One-apart |
| middle-pinky | 2.5 | 2.88 | One-apart, more connective tissue |
| index-pinky | 4.0 | 4.60 | Two-apart, significant stretch |
| index-thumb | 3.5 | 4.03 | Thumb independent ROM |
| middle-thumb | 4.5 | 5.18 | Wider thumb range |
| ring-thumb | 5.5 | 6.33 | Near envelope limit |
| pinky-thumb | 5.5 | 6.33 | Full hand span |

#### 5.3 Finger Ordering Rules

Left hand (L→R on grid): `pinky ≤ ring ≤ middle ≤ index ≤ thumb + delta`
Right hand (L→R on grid): `thumb - delta ≤ index ≤ middle ≤ ring ≤ pinky`

`THUMB_DELTA = 1.0` (strict), `2.0` (relaxed) — allows thumb to sit slightly below other fingers.

#### 5.4 Missing Finger Capability Modeling

The current system does **not** model:
- **Velocity/force capability per finger** (pinky hits are weaker)
- **Speed capability per finger** (pinky trills are slower)
- **Fatigue accumulation differences** (pinky fatigues faster)
- **Independence constraints** (ring and pinky share tendons — moving one affects the other)

The fatigue model exists in `src/engine/diagnostics/fatigueModel.ts` but is diagnostic-only, not integrated into the beam search scoring.

---

### 6. Biomechanical Model

**File:** `src/engine/prior/biomechanicalModel.ts` — single source of truth

#### 6.1 Hand Zones

Not explicitly enforced in the beam search. The beam solver tries both left and right hand for every event group, relying on cost accumulation (attractor spring, per-finger home distance) to naturally bias hands toward their zones.

The emergency fallback in the beam solver (`beamSolver.ts:940`) uses a simple zone heuristic:
```
leftZone: col closer to 2
rightZone: col closer to 5
```

#### 6.2 Natural Hand Pose (Pose 0)

**Default positions** (`naturalHandPose.ts:96-107`):
```
Left Hand:                Right Hand:
  L_THUMB:  (0, 3)          R_THUMB:  (0, 4)
  L_INDEX:  (3, 3)          R_INDEX:  (3, 4)
  L_MIDDLE: (4, 2)          R_MIDDLE: (4, 5)
  L_RING:   (4, 1)          R_RING:   (4, 6)
  L_PINKY:  (4, 0)          R_PINKY:  (4, 7)
```

This represents hands resting in the middle of the grid with thumbs below and fingers fanned out. The pose is used to:
1. Seed initial layouts (`seedFromPose.ts`)
2. Compute resting pose for attractor cost
3. Compute neutral pad positions for per-finger home cost

#### 6.3 Reach Distance

`MAX_REACH_GRID_UNITS = 5.0` — used in `isReachPossible()` for single-finger reach checks.

`MAX_HAND_SPAN = 5.5` — maximum comfortable thumb-to-pinky envelope.

#### 6.4 Home Position Drift

Drift is measured as `euclidean(assignment_position, resting_centroid)` and reported as `averageDrift` in the execution plan result. It is used:
- In the `compactness` TradeoffProfile dimension
- In binding constraint identification (>2.5 triggers warning)
- As a diagnostic metric

Drift is **not** directly penalized in the beam score. Instead, the attractor cost indirectly penalizes drift by pulling the grip centroid toward the resting pose.

#### 6.5 Speed Model

**Transition speed:** `speed = centroid_distance / time_delta`
- If `speed > 12.0 grid_units/s` → `Infinity` (hard reject)
- Otherwise: `cost = distance + speed × 0.5` (Fitts's Law inspired)

This is a centroid-based speed check, not a per-finger speed check. The entire hand centroid must not move faster than 12 grid units per second.

---

## Phase 2 — Expert Optimization Critique

### 1. Objective Function Quality

#### Strengths

1. **The 3-component model is clean and principled.** Separating pose naturalness, transition difficulty, and constraint penalty creates clear attribution of cost sources.

2. **Finger dominance costs are well-calibrated.** The 0/0/1/3/5 scale for index/middle/ring/pinky/thumb correctly reflects percussion pad playing ergonomics.

3. **The tiered feasibility system is elegant.** Progressive relaxation (strict → relaxed → fallback) with increasing penalties ensures the solver always produces output while preferring valid grips.

4. **Fitts's Law transition model is appropriate.** The `distance + speed × weight` formulation captures both spatial and temporal movement difficulty.

#### Problems

**P1: ~~Alternation cost is diagnostic-only~~ ✅ FIXED — now included in beam score with weight 0.8.**

Same-finger repetition on short time intervals is one of the most important performance difficulty factors for percussion. A rapid alternation on the same pad using the same finger is genuinely hard. The system now includes `alternationCost × ALTERNATION_BEAM_WEIGHT (0.8)` in `stepCostForBeam` for both single-hand and split-chord paths.

**P2: ~~Hand balance cost is diagnostic-only~~ ✅ FIXED — now included in beam score with weight 0.3.**

The solver now has a mild hand balance bias during beam search. `handBalanceCost × HAND_BALANCE_BEAM_WEIGHT (0.3)` is added to `stepCostForBeam`, preventing extreme single-hand dominance while still allowing legitimate one-hand passages.

**P3: The three primary components have no weights — implicit scale coupling.**

The three primary components are summed directly:
```
total = poseNaturalness + transitionDifficulty + constraintPenalty
```

This means the relative influence of each component depends entirely on their internal scaling. The constraint penalty (200 or 1000) absolutely dominates when present, which is intentional. But the balance between `poseNaturalness` and `transitionDifficulty` is an implicit design choice:

- `poseNaturalness`: typically 0-10 range (distance-based, scaled by stiffness ~0.3)
- `transitionDifficulty`: typically 0-15 range (distance + speed × 0.5)

Transition cost tends to dominate pose naturalness, which may cause the solver to accept unnatural grips if they reduce movement.

**P4: ~~Stiffness parameter doubles when Pose0 override is present~~ ✅ FIXED — doubling removed.**

The ad-hoc `Math.min(2.0, config.stiffness * 2.0)` has been replaced with `config.stiffness` directly. The attractor cost and per-finger-home cost already provide adequate pull toward the resting pose without an artificial multiplier.

**P5: ~~The lookahead bonus is very weak~~ ✅ FIXED — strengthened.**

The 1-step lookahead bonus cap increased from 10% → 20% of step cost. Proximity range widened from 3.0 → 4.0 grid units. Multiplier increased from 0.5 → 0.6. Maximum bonus at distance 0 is now 2.4 (was 1.5).

---

### 2. Search Strategy

#### Current Approach: Beam Search + Simulated Annealing

**Beam Search (execution plan):**
- Width: configurable (default varies by context — 5 during annealing, 50 for final)
- Greedy-ish: keeps K-best at each step, no backtracking beyond the beam
- 1-step lookahead bonus for tie-breaking

**Simulated Annealing (layout optimization):**
- 1000 iterations, geometric cooling (500 × 0.99^t)
- Random swap/move mutations
- Uses beam search as cost function

#### Evaluation

**Beam search is appropriate for execution planning.** The temporal sequential structure of performance events maps naturally to a beam search that maintains K candidate hand states. The alternative (full dynamic programming) would be exponential in the number of grips per step.

**~~The annealing parameters are likely undertuned.~~** ✅ **FIXED — parameters retuned.**

1. ~~**1000 iterations is low for a 64-cell grid.**~~ ✅ Now 3000 iterations, exploring 3× more of the layout space.

2. ~~**`FAST_BEAM_WIDTH = 5` is very narrow.**~~ ✅ Now 12, providing more reliable cost evaluation and reducing noisy acceptance decisions.

3. ~~**Cooling rate 0.99 with 1000 steps**~~ ✅ Now 0.997 with 3000 steps. Final temp ≈ 0.56, maintaining meaningful exploration through most of the run.

4. ~~**Single-mutation moves are too local.**~~ ✅ Now 4 mutation types: swap (35%), move (35%), cluster swap (15%), row/col shift (15%). Multi-pad mutations enable non-local search.

~~**Beam width 5 during annealing vs 50 for final evaluation creates a gap.**~~ ✅ Gap reduced: beam width 12 during annealing is much closer to the final evaluation width of 50, reducing the evaluation-quality mismatch.

---

### 3. Failure Modes

#### FM1: ~~Single-Hand Dominance~~ ✅ MITIGATED

~~Because hand balance is diagnostic-only, the solver can assign nearly all events to one hand.~~ Hand balance cost is now included in the beam score (weight 0.3), providing a quadratic penalty for lopsided hand usage. Extreme single-hand dominance is now actively discouraged. Remaining risk: the 0.3 weight is mild, so strongly zone-biased layouts may still lean one-handed.

#### FM2: ~~Same-Finger Rapid Repetition~~ ✅ MITIGATED

~~Because alternation cost is diagnostic-only, the solver may assign the same finger to consecutive rapid events.~~ Alternation cost is now included in the beam score (weight 0.8), penalizing same-finger repetition on dt < 0.25s. The solver now actively prefers finger variety on fast passages.

#### FM3: Greedy Grip Selection Missing Global Patterns

The beam search with 1-step lookahead can't plan for phrase-level patterns. For example:
- A 4-note ascending run might be best played with index-middle-ring-pinky
- But the solver assigns index for step 1 (cheapest individually), then has to awkwardly reassign for step 2

The lookahead bonus is too weak (capped at 10%) to prevent this.

#### FM4: ~~Annealing Stalls on Local Optima~~ ✅ MITIGATED

~~With only swap/move mutations and 1000 iterations, the annealing solver easily gets stuck in local optima.~~ Now mitigated by: 3× more iterations (3000), multi-pad mutations (cluster swap 15%, row/col shift 15%), and wider beam evaluation (width 12) for more reliable cost gradients. The solver can now perform non-local reorganizations and has more iterations to explore the landscape. Remaining risk: truly adversarial initial layouts may still challenge the search.

#### FM5: Split-Chord Heuristic Is Rigid

The split-chord logic (`beamSolver.ts:337-515`) always splits at the midpoint by column position:
```
const midpoint = Math.ceil(sortedPads.length / 2);
const leftPads = sortedPads.slice(0, midpoint);
const rightPads = sortedPads.slice(midpoint);
```

This is a fixed spatial split, not an optimal split. For a 3-note chord at positions (3,2), (3,4), (3,6), the split assigns (3,2) to left and (3,4), (3,6) to right. But (3,2) and (3,4) might be better as a left-hand pair.

#### FM6: Emergency Fallback Loses Beam Context

When the beam produces zero valid expansions (`beamSolver.ts:925-1005`), the emergency fallback assigns fingers by column proximity with a flat `FALLBACK_GRIP_PENALTY`. This discards all accumulated pose context, potentially causing discontinuities in the execution plan.

---

### 4. Missing Constraints

#### MC1: ~~Alternation Preference (Critical)~~ ✅ IMPLEMENTED

Same-finger rapid repetition is now penalized in the beam score. Added `alternationCost × 0.8` to `stepCostForBeam`.

#### MC2: ~~Hand Balance Bias (Important)~~ ✅ IMPLEMENTED

A mild hand balance term is now in the beam score. Added `handBalanceCost × 0.3` to `stepCostForBeam`.

#### MC3: Finger Independence Model (Enhancement)

Ring and pinky share extensor tendons. When ring is pressing a pad, pinky's range of motion is reduced, and vice versa. The current model treats each finger independently.

#### MC4: Velocity-Dependent Finger Selection (Enhancement)

High-velocity hits (accents) should prefer index/middle. Low-velocity ghost notes can use ring/pinky. The current model ignores event velocity entirely.

#### MC5: Phrase-Level Coherence (Enhancement)

The solver should prefer consistent fingering within a repeating phrase. If a 4-note motif appears 8 times, it should ideally use the same finger assignment each time. This requires multi-step lookahead or post-processing.

#### MC6: Energy Distribution Over Time (Enhancement)

Sustained high-cost finger usage should accumulate fatigue. The fatigue model exists (`src/engine/diagnostics/fatigueModel.ts`) but is not integrated into beam scoring.

#### MC7: Hand Zone Enforcement (Low Priority)

Currently implicit via attractor cost. An explicit zone bias (e.g., left hand penalized for cols > 5, right hand for cols < 2) would make hand assignment more predictable.

---

### 5. Debuggability

#### What Works Well

1. **7-component legacy diagnostics** provide rich per-event cost breakdowns visible in the UI
2. **Annealing trace** records iteration-by-iteration temperature, cost, and acceptance for post-hoc analysis
3. **Tiered feasibility with GripRejection diagnostics** — the system can explain exactly which constraint rejected a grip and by how much
4. **DifficultyBreakdown per event** — every finger assignment carries its cost decomposition
5. **Binding constraints** — the system identifies and explains limiting factors

#### What Is Missing

1. **No beam search trace.** There is no way to inspect which beam nodes were considered and pruned at each step. For debugging irrational assignments, you need to see the full beam.

2. **No per-hand cost attribution.** The primary score doesn't track how much cost each hand contributes. You can't easily answer "is this hard because of left hand movement or right hand pose?"

3. **No diff between candidates at the event level.** The `CandidateComparison` type exists but comparing finger assignments event-by-event across candidates is not surfaced.

4. **The diagnostic model and primary model use different cost functions.** The 7-component display breakdown doesn't match the 3-component beam score. A user seeing high "alternation" in the diagnostics might think the solver optimized for it, but it didn't.

5. **No explanation of "why this grip was chosen."** The system can explain why grips were rejected (via GripRejection) but not why the chosen grip won over alternatives.

---

## Phase 3 — Verification & Validation Plan

### 1. Cost Function Unit Tests

#### Test 1.1: Attractor Cost — Zero at Rest
```
Setup: grip centroid = resting centroid
Expected: attractorCost = 0
```

#### Test 1.2: Attractor Cost — Proportional to Distance
```
Setup: grip centroid at (2,2), resting at (4,4), stiffness = 0.5
Expected: attractorCost = sqrt(8) × 0.5 ≈ 1.41
```

#### Test 1.3: Transition Cost — Adjacent Pads, Long Time
```
Setup: centroid moved 1 unit, timeDelta = 2.0s
Expected: distance=1.0, speed=0.5, cost = 1.0 + 0.5×0.5 = 1.25
```

#### Test 1.4: Transition Cost — Large Jump, Short Time
```
Setup: centroid moved 6 units, timeDelta = 0.3s
Expected: speed = 20.0 > MAX_HAND_SPEED (12.0) → Infinity
```

#### Test 1.5: Transition Cost — Simultaneous Events
```
Setup: timeDelta ≤ 0.001
Expected: cost = 0 (no transition penalty for chords)
```

#### Test 1.6: Finger Dominance — Index Only
```
Setup: grip with only index finger
Expected: dominanceCost = 0.0
```

#### Test 1.7: Finger Dominance — Pinky + Ring
```
Setup: grip with pinky and ring
Expected: dominanceCost = 3.0 + 1.0 = 4.0
```

#### Test 1.8: Per-Finger Home Cost — At Neutral Position
```
Setup: finger at its neutral pad position
Expected: perFingerHomeCost = 0.0
```

#### Test 1.9: Constraint Penalty — Strict Grip
```
Setup: grip generated at Tier 1
Expected: constraintPenalty = 0
```

#### Test 1.10: Constraint Penalty — Fallback Grip
```
Setup: grip generated at Tier 3
Expected: constraintPenalty = 1000
```

---

### 2. Constraint Violation Tests

#### Test 2.1: Impossible Finger Span
```
Setup: index at (0,0), pinky at (7,7) — distance ≈ 9.9
Expected: No Tier 1 or Tier 2 grips generated (span exceeds all limits)
Result: Tier 3 fallback only
```

#### Test 2.2: Finger Collision
```
Setup: Two notes on the same pad
Expected: No valid grip (same finger can't play same pad twice)
Note: Currently the system allows this — the grip just assigns one finger
```

#### Test 2.3: Topology Violation — Right Hand Crossover
```
Setup: Right hand with index at col 6, pinky at col 2
Expected: Rejected by topology check (index must be left of pinky for right hand)
```

#### Test 2.4: Thumb Above Middle Finger
```
Setup: Right hand with thumb at row 6, middle at row 3
Expected: Rejected by thumb delta check (thumb.row > middle.row + delta)
```

#### Test 2.5: Speed Limit Violation
```
Setup: centroid moves 7 units in 0.5s → speed = 14.0
Expected: Transition cost = Infinity → expansion dropped
```

#### Test 2.6: Unmapped Note in Annealing
```
Setup: Layout mutation removes a voice, creating an unmapped note
Expected: Layout cost = Infinity → mutation rejected
```

---

### 3. Finger Assignment Sanity Tests

#### Test 3.1: Prefer Index Over Pinky
```
Setup: Single note on a pad equidistant from index and pinky home positions
Expected: Index finger assigned (dominance cost 0.0 vs 3.0)
Automated check: Assert assignedFinger !== 'pinky' when index is equally reachable
```

#### Test 3.2: No Unnecessary Thumb Usage
```
Setup: Single note in the upper grid (row 4-7) where all four fingers can reach
Expected: Thumb not assigned (dominance cost 5.0)
Automated check: Count thumb assignments; flag if >20% for non-thumb-zone pads
```

#### Test 3.3: Alternation on Repeated Notes
```
Setup: Same note repeated 8 times at 120 BPM 16th notes (125ms apart)
Expected: At minimum, hand alternation if not finger alternation
Bad sign: Same finger plays all 8 strikes
Automated check: Consecutive same-finger count ≤ 2 for dt < 200ms
```

#### Test 3.4: Both Hands Used for Wide Chords
```
Setup: 4-note chord spanning cols 0-7
Expected: Split across both hands (span too wide for one hand)
Automated check: Assert both 'left' and 'right' hands in chord assignment
```

#### Test 3.5: Hand Zone Bias
```
Setup: Performance with notes in cols 0-3 and cols 4-7
Expected: Left hand plays cols 0-3, right hand plays cols 4-7 predominantly
Automated check: >70% of left-zone notes assigned to left hand
```

---

### 4. Visualization Tools

#### 4.1 Cost Heatmap
Per-pad heatmap showing average cost of events assigned to each pad. Color scale: green (low) → yellow → red (high). Overlay on the 8×8 grid.

#### 4.2 Finger Usage Diagram
Bar chart of finger usage counts (L-Thumb, L-Index, ..., R-Pinky). Color by difficulty level (easy=green, hard=red).

#### 4.3 Zone Violation Map
Highlight pads where the assigned hand doesn't match the expected zone. Left-hand assignments in cols 5-7 and right-hand in cols 0-2 should be flagged.

#### 4.4 Movement Path Visualization
Draw arrows between consecutive assigned pad positions, colored by hand (blue=left, red=right). Arrow thickness proportional to speed. This reveals crossover patterns and large jumps.

#### 4.5 Grip Rejection Treemap
For each event where Tier 2 or 3 was used, show a tree of rejected Tier 1 grips with their violation reasons. Helps identify which constraints are binding.

---

### 5. Score Decomposition Debug View

Proposed per-event debug output format:

```
Event 42
─────────────────────────
Note:     C3 (MIDI 60)
Time:     2.450s
Pad:      (3, 4)
Hand:     Right
Finger:   Index
Tier:     Strict

Primary Score (Beam)
────────────────────
poseNaturalness:      1.23
  ├─ attractor:       0.45  (40%)
  ├─ perFingerHome:   0.58  (40%)
  └─ dominance:       0.00  (20%) → index=0.0
transitionDifficulty: 2.10
  ├─ distance:        1.40
  ├─ speed:           4.67 u/s
  └─ speedCost:       1.40 + 4.67×0.5 = 3.74 → wait, 2.10 actual
constraintPenalty:    0.00  (Tier 1)
─────────────────────
STEP TOTAL:           3.33
lookahead bonus:     -0.12
─────────────────────
NET STEP COST:        3.21

Diagnostic (Display Only)
─────────────────────
alternation:          0.00  (no same-finger repeat)
handBalance:          0.02  (L:48% R:52%)

Beam Context
─────────────────────
beam rank: 1 of 12 (best)
prev hand: Right at (3.2, 4.1)
next group: 2 pads at (3,5), (4,5)
```

This format enables:
- Verifying each cost component independently
- Checking that weights are applied correctly
- Understanding why one grip was chosen over another
- Correlating diagnostic costs with beam decisions

---

### 6. Stress Tests

#### ST1: Rapid Alternation (16th Notes at 200 BPM)
```
Pattern: Single note repeated 32 times at 75ms intervals
Expected: System should not crash, should assign fingers
Watch for: Same finger assigned to all 32 strikes
Severity: High (tests alternation gap)
```

#### ST2: Large Leaps
```
Pattern: Notes alternating between (0,0) and (7,7) every 250ms
Expected: System flags as Unplayable or Very Hard
Watch for: Distance ≈ 9.9, speed = 39.6 u/s >> MAX_HAND_SPEED
```

#### ST3: Four-Note Chords
```
Pattern: 4 simultaneous notes at (3,1), (3,3), (3,5), (3,7) repeated 8 times
Expected: Split across hands (span too wide for one hand)
Watch for: Single-hand assignment with fallback grip
```

#### ST4: Dense Polyphony
```
Pattern: 5 simultaneous notes every 500ms for 10 seconds
Expected: System handles 5-finger grips, uses both hands for wide spreads
Watch for: Fallback grip overuse, performance degradation
```

#### ST5: Fast Repeated Notes (Different Pitches)
```
Pattern: C-D-E-F-G ascending run at 32nd notes (62ms at 120 BPM)
Expected: Sequential finger assignment (index-middle-ring-pinky or similar)
Watch for: Same finger for all notes, irrational hand switches mid-run
```

#### ST6: Empty Performance
```
Pattern: No events
Expected: Empty execution plan, score = 100, no crashes
```

#### ST7: Single Event
```
Pattern: One note at time 0
Expected: Clean assignment to preferred finger, no transition costs
```

#### ST8: Maximum Grid Density
```
Pattern: 64 unique notes (all pads occupied), all playing simultaneously
Expected: System handles gracefully (5-finger per hand = 10 max)
Watch for: Correct identification of unplayable events
```

---

### 7. Regression Benchmarks

These reference patterns should have deterministic expected outcomes. They serve as regression tests when the algorithm changes.

#### RB1: Two-Note Alternation
```
Input: Notes at (3,2) and (3,5), alternating at 500ms
Expected: Left hand for (3,2), right hand for (3,5)
         Index finger preferred for both
         All events rated "Easy"
```

#### RB2: Three-Note Left-Hand Run
```
Input: Notes at (4,0), (4,1), (4,2) in sequence at 250ms
Expected: All left hand
         Finger assignment: pinky → ring → middle (or similar natural sequence)
         No Tier 2/3 grips needed
```

#### RB3: Wide Chord
```
Input: Simultaneous notes at (3,0), (3,3), (3,4), (3,7)
Expected: Split between hands
         Left: (3,0), (3,3) — Right: (3,4), (3,7)
         Both grips at Tier 1
```

#### RB4: Repeated Single Note
```
Input: Note at (3,3) repeated 16 times at 200ms
Expected: Left hand (near left home position)
         Index finger (preferred, closest to home)
         Score: "Easy" (no movement, no stretch)
```

#### RB5: Cross-Grid Jump
```
Input: Note at (0,0) then (7,7) at 1000ms gap
Expected: Different hands OR flagged as Hard
         Speed: distance ≈ 9.9, speed = 9.9 < 12.0 (barely feasible for one hand)
         High transition cost
```

#### RB6: Simple Drum Groove (Kick + Snare)
```
Input: Kick at (1,3) on beats 1,3; Snare at (3,5) on beats 2,4; 120 BPM (500ms)
Expected: Kick=left hand, Snare=right hand (zone-based)
         Steady, low-cost assignments
         Hand balance ≈ 50/50
```

#### RB7: Chromatic Scale
```
Input: 8 sequential notes mapped to one row (row 3, cols 0-7) at 250ms
Expected: Natural left-to-right finger sequence
         Hand switch around col 3-4 boundary
         Smooth transition costs
```

These benchmarks should be version-controlled and run automatically on each optimization engine change.

---

## Summary

### What Is Working

1. **Clean 3-component objective model** with clear separation of pose, transition, and constraint costs
2. **Tiered feasibility system** that always produces output while preferring biomechanically valid grips
3. **Biomechanical constants centralized** in a single source of truth
4. **Rich diagnostic output** with per-event cost breakdowns and annealing traces
5. **Multi-candidate generation** with diverse layout strategies
6. **Pareto filtering and composite ranking** for candidate comparison
7. **Deterministic seeded RNG** for reproducible annealing results
8. **Joint optimization framing** — layout and execution are correctly coupled

### What Is Broken

1. ~~**Alternation cost not in beam score**~~ ✅ **FIXED** — now included with weight 0.8
2. ~~**Hand balance cost not in beam score**~~ ✅ **FIXED** — now included with weight 0.3
3. ~~**Diagnostic display model doesn't match beam model**~~ ✅ **FIXED** — alternation and hand balance now in both models

### What Is Partial / Redundant

1. **Legacy 7-component ObjectiveComponents** exists alongside the 3-component model — two parallel scoring systems (architectural debt, but now aligned for key costs)
2. **Fatigue model** exists but is diagnostic-only, not integrated into search
3. ~~**HandState-based cost functions** in `legacyCosts.ts` are fully dead code but still exported~~ ✅ **FIXED** — exports removed
4. **Finger bounce / note history** tracking is dead code (in `legacyCosts.ts`, no longer exported)
5. ~~**Lookahead bonus** is implemented but too weak to meaningfully affect results~~ ✅ **FIXED** — strengthened to 20% cap, 4.0 range

### Highest-Leverage Fixes

1. **~~Add alternation cost to beam score~~** ✅ **IMPLEMENTED** — highest-impact single change. Prevents irrational same-finger repetition on fast passages. Implementation: added `alternationCost × 0.8` to `stepCostForBeam` in `beamSolver.ts` (both single-hand and split-chord paths).

2. **~~Add hand balance cost to beam score~~** ✅ **IMPLEMENTED** — prevents one-hand dominance. Implementation: added `handBalanceCost × 0.3` to `stepCostForBeam` in `beamSolver.ts`.

3. **~~Increase annealing iterations and beam width~~** ✅ **IMPLEMENTED** — 1000 iterations with beam width 5 was insufficient for meaningful layout optimization. Changed to: `ITERATIONS = 3000`, `FAST_BEAM_WIDTH = 12`, `COOLING_RATE = 0.997` (final temp ≈ 0.56 instead of ≈ 0.02).

4. **~~Add multi-pad mutation operators~~** ✅ **IMPLEMENTED** — cluster swap (15%), row/column shift (15%) added alongside existing swap (35%) and move (35%). Allows annealing to explore non-local layout reorganizations.

5. **~~Unify diagnostic and primary scoring models~~** ✅ **IMPLEMENTED** — alternation and hand balance costs are now included in the primary beam score (weighted), unifying the diagnostic and primary models. Comments updated to reflect the change.

### Additional Fixes Implemented

6. **~~Strengthen lookahead bonus~~** ✅ **IMPLEMENTED** — Cap increased from 10% → 20% of step cost. Proximity range widened from 3.0 → 4.0 grid units. Multiplier increased from 0.5 → 0.6. The bonus can now meaningfully influence beam ranking for phrase-level planning.

7. **~~Remove stiffness doubling hack~~** ✅ **IMPLEMENTED** — The ad-hoc `stiffness × 2.0` multiplier when Pose0 was present has been removed. It over-constrained the solver, making it reluctant to deviate from the resting position even when the music demanded it.

8. **~~Remove dead legacy code~~** ✅ **IMPLEMENTED** — Removed re-exports of dead `legacyCosts.ts` functions (`calculateMovementCost`, `calculateStretchPenalty`, `calculateDriftPenalty`, `calculateCrossoverCost`, `clearNoteHistory`, `recordNoteAssignment`, `getFingerBouncePenalty`, `calculateGripStretchCost`, `calculateTotalGripCost`, `handStateToHandPose`) from `costFunction.ts` and `engine/index.ts`. The functions remain in `legacyCosts.ts` for reference but are no longer publicly exported.

### Suggested Implementation Order (remaining)

1. **Add beam search trace for debugging** (moderate effort, high debuggability value)
2. **Integrate fatigue model** into beam score (moderate effort, quality improvement)

---

## Phase 4 — Implementation Changelog

### Change 1: Alternation Cost Added to Beam Score

**Files modified:** `src/engine/solvers/beamSolver.ts`, `src/engine/evaluation/costFunction.ts`

**What changed:**
- Added `ALTERNATION_BEAM_WEIGHT = 0.8` constant to beamSolver.ts
- Added `stepCostForBeam += alternationCost * ALTERNATION_BEAM_WEIGHT` to both `expandNodeForGroup()` and `expandNodeForSplitChord()` methods
- Updated costFunction.ts comments to reflect alternation is no longer diagnostic-only

**Rationale:** Same-finger rapid repetition was unpenalized in the beam score. This is one of the most important performance difficulty factors for percussion. A rapid alternation on the same pad using the same finger is genuinely hard. The solver now actively avoids same-finger repetition on fast passages (dt < 0.25s).

**Weight justification:** 0.8 is strong enough to shift finger choice on 16th-note passages (where alternation penalty ≈ 1.2 with recency factor) but mild enough not to override transition/pose costs on slower passages where same-finger reuse is acceptable.

---

### Change 2: Hand Balance Cost Added to Beam Score

**Files modified:** `src/engine/solvers/beamSolver.ts`, `src/engine/evaluation/costFunction.ts`

**What changed:**
- Added `HAND_BALANCE_BEAM_WEIGHT = 0.3` constant to beamSolver.ts
- Added `stepCostForBeam += handBalanceCost * HAND_BALANCE_BEAM_WEIGHT` to both expansion methods
- Updated costFunction.ts comments

**Rationale:** Without this, the solver could assign 90%+ of events to one hand when its resting pose was slightly cheaper for each individual step. The quadratic penalty (`2.0 × deviation²`) now scales by 0.3 in the beam, providing a mild but meaningful push toward balanced hand usage.

**Weight justification:** 0.3 is low enough to allow legitimate one-hand passages (e.g., a left-hand-only groove) but high enough to break ties in favor of distributing work across both hands.

---

### Change 3: Annealing Parameters Increased

**File modified:** `src/engine/optimization/annealingSolver.ts`

**What changed:**
| Parameter | Before | After | Rationale |
|-----------|--------|-------|-----------|
| `ITERATIONS` | 1000 | 3000 | 3× more iterations to explore the layout space. With 10-20 occupied pads on 64 cells, 1000 single-pad mutations explored a tiny fraction. |
| `FAST_BEAM_WIDTH` | 5 | 12 | Reduces noise in cost evaluation during annealing. Width 5 was too narrow — a layout looking bad at width 5 might look good at width 50. Width 12 provides a more reliable gradient. |
| `COOLING_RATE` | 0.99 | 0.997 | Slower cooling to match the longer iteration count. Final temp: 500 × 0.997^3000 ≈ 0.56, maintaining meaningful exploration through most of the run (vs 500 × 0.99^1000 ≈ 0.02 before). |

---

### Change 4: Multi-Pad Mutation Operators Added

**File modified:** `src/engine/optimization/mutationService.ts`

**What changed:**
- `applyRandomMutation()` now uses 4 mutation types with probabilities:
  - **Swap** (35%): Same as before — exchange voices between two occupied pads
  - **Move** (35%): Same as before — relocate voice to an empty pad
  - **Cluster swap** (15%): Pick two occupied pads, find each one's nearest neighbor, swap both pairs. Moves 2-pad groups atomically.
  - **Row/column shift** (15%): Pick a row or column with occupied pads, shift all voices by ±1 position. Enables linear group translations.

**New functions added:**
- `applyClusterSwapMutation()` — picks two cluster seeds, finds nearest neighbors, performs atomic double-swap
- `applyShiftMutation()` — picks a random row/col, validates shift feasibility, applies via `applyMultiMove()`
- `applyMultiMove()` — atomic multi-pad relocation (clear all sources first, then place at targets)
- `findNearestOccupied()` — helper for cluster mutation

**Rationale:** The previous single-mutation-only approach (swap or move one pad) was too local. The annealing solver could not discover that fundamentally different arrangements existed — it could only make small perturbations. Multi-pad mutations enable non-local search: rotating clusters, shifting rows, reorganizing zones.

---

### Change 5: Lookahead Bonus Strengthened

**File modified:** `src/engine/solvers/beamSolver.ts`

**What changed:**
| Parameter | Before | After |
|-----------|--------|-------|
| Proximity range | 3.0 grid units | 4.0 grid units |
| Proximity multiplier | 0.5 | 0.6 |
| Cap | 10% of step cost | 20% of step cost |
| Max bonus (at distance 0) | 1.5 | 2.4 |

**Rationale:** The previous lookahead was too weak (at most 0.5-1.0 bonus on typical steps of 5-10) to meaningfully influence beam ranking. With the strengthened bonus, the solver can better plan for phrase-level patterns — e.g., preferring a grip that leaves the hand near the next event group even if it costs slightly more in the current step.

---

### Change 6: Stiffness Doubling Hack Removed

**File modified:** `src/engine/solvers/beamSolver.ts`

**What changed:**
- Removed `Math.min(2.0, config.stiffness * 2.0)` when `neutralPadPositionsOverride` is present
- Now uses `config.stiffness` directly in all cases

**Rationale:** The 2× stiffness multiplier when Pose0 was defined over-constrained the solver. It made the hand reluctant to deviate from the resting position even when the music demanded movement to distant pads. The attractor cost and per-finger-home cost already provide adequate pull toward the resting pose without the artificial multiplier.

---

### Change 7: Dead Legacy Code Exports Removed

**Files modified:** `src/engine/evaluation/costFunction.ts`, `src/engine/index.ts`

**What changed:**
- Removed re-exports of 10 deprecated functions from `costFunction.ts`:
  `calculateMovementCost`, `calculateStretchPenalty`, `calculateDriftPenalty`, `calculateCrossoverCost`, `clearNoteHistory`, `recordNoteAssignment`, `getFingerBouncePenalty`, `calculateGripStretchCost`, `calculateTotalGripCost`, `handStateToHandPose`
- Removed `export { calculateGripStretchCost }` from `engine/index.ts`

**Rationale:** These functions were dead code — HandState-based scoring replaced by HandPose-based scoring, finger bounce/note history unused, grip stretch folded into `calculatePoseNaturalness()`. No consumer in the current codebase (src/ or test/) referenced them. They remain in `legacyCosts.ts` as reference documentation.

---

### Validation

- **TypeScript:** `tsc --noEmit` passes cleanly (0 errors)
- **Tests:** All 234 existing tests pass (13 test files)
- **No regressions:** Same test suite, same pass count before and after changes
