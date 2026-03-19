# PushFlow Cost Model Reference

> **Deep Technical Audit of the PushFlow Optimization Engine**
>
> This document catalogs every cost metric, constraint, feasibility rule, weighting factor,
> and derived scoring function used by the PushFlow V2 engine when evaluating candidate solutions.
> All findings are grounded in the codebase at `product-reconciliation/v2/v2 repo/src/`.

---

## 1. Executive Summary

PushFlow jointly optimizes a **static layout** (sound → pad assignments on an 8×8 grid) and a
**dynamic execution plan** (hand + finger assignments over time). The cost model has three layers:

| Layer | Purpose | Entry Points |
|-------|---------|-------------|
| **Solver-Internal** | Pure cost functions called thousands of times during beam search | `costFunction.ts` |
| **Objective Combination** | Combines individual costs into a scalar score | `objective.ts` |
| **Post-Hoc Analysis** | Passage-level difficulty, tradeoff profiles, event explanations | `difficultyScoring.ts`, `passageDifficulty.ts`, `canonicalEvaluator.ts` |

The system distinguishes **hard constraints** (reject or Infinity cost) from **soft penalties** (scored, not rejected).

### Key Numbers

- **5 canonical diagnostic factors**: transition, gripNaturalness, alternation, handBalance, constraintPenalty
- **3-component primary objective**: poseNaturalness + transitionDifficulty + constraintPenalty
- **6-dimension tradeoff profile**: playability, compactness, handBalance, transitionEfficiency, learnability, robustness
- **3-tier feasibility system**: Strict → Relaxed (1.15×) → Fallback

---

## 2. Evaluation Pipeline Overview

```
Candidate Layout + Performance Events
        │
        ▼
┌─────────────────────────────────────┐
│  MAPPING RESOLUTION                 │
│  noteNumber → padKey via Layout     │
│  Unmapped notes → reject (∞ cost)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  EVENT GROUPING                     │
│  Group simultaneous events into     │
│  PerformanceGroups (MOMENT_EPSILON) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  FEASIBILITY CHECK (per group)      │
│  generateValidGripsWithTier()       │
│  Tier 1 (Strict) → penalty 0       │
│  Tier 2 (Relaxed) → penalty 200    │
│  Tier 3 (Fallback) → penalty 1000  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  COST COMPUTATION (per group)       │
│  ┌───────────────────────────────┐  │
│  │ Pose Naturalness (static)     │  │
│  │  = 0.4 × attractor           │  │
│  │  + 0.4 × perFingerHome       │  │
│  │  + 0.2 × fingerDominance     │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Transition Difficulty         │  │
│  │  = distance + speed × 0.5    │  │
│  │  (Fitts's Law model)         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Constraint Penalty            │  │
│  │  0 / 200 / 1000 by tier      │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Alternation Cost × 0.8       │  │
│  │ Hand Balance Cost × 0.3      │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Lookahead Bonus (subtracted)  │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  BEAM SEARCH ACCUMULATION           │
│  totalCost += stepCost per group    │
│  Keep K best nodes per depth level  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  POST-HOC ANALYSIS                  │
│  - Difficulty classification        │
│  - TradeoffProfile computation      │
│  - Passage difficulty scoring       │
│  - Event-level explanations         │
│  - Feasibility verdict              │
│  - Canonical diagnostic factors     │
└─────────────────────────────────────┘
```

### Function Call Chain (Beam Solver)

```
createBeamSolver(config)
  └─ solve(performance, config, manualAssignments?, constraints?)
       ├─ groupEventsByTimestamp(events)
       ├─ for each group:
       │    ├─ generateValidGripsWithTier(pads, ...)     → GripResult[]
       │    ├─ calculatePoseNaturalness(grip, rest, ...)  → number
       │    ├─ calculateTransitionCost(prev, curr, dt)    → number | ∞
       │    ├─ calculateAlternationCost(prev, curr, dt)   → number
       │    ├─ calculateHandBalanceCost(L, R)             → number
       │    ├─ combinePerformabilityComponents(...)        → stepCost
       │    ├─ stepCost += alternation × 0.8
       │    ├─ stepCost += handBalance × 0.3
       │    └─ stepCost -= computeLookaheadBonus(...)
       └─ best node → ExecutionPlanResult
```

### Function Call Chain (Canonical Evaluator)

```
evaluatePerformance(input)
  ├─ for each moment:
  │    └─ evaluateEvent(input)
  │         ├─ buildMomentPoses(pads, assignment)    → MomentPoseResult
  │         ├─ computePoseDetail(poseResult, config)  → PoseNaturalnessDetail
  │         ├─ tierToPenalty(tier)                     → 0 | 200 | 1000
  │         ├─ calculateAlternationCost(...)           → number
  │         └─ calculateHandBalanceCost(...)           → number
  ├─ for each consecutive pair:
  │    └─ evaluateTransition(input)
  │         ├─ buildMomentPoses(from, to)
  │         └─ calculateTransitionCost(from, to, dt)
  └─ aggregate: PerformanceCostBreakdown
```

---

## 3. Static Cost Metrics

These costs depend only on the layout and a single event (no transition between events).

### 3.1 Pose Naturalness (Unified)

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/costFunction.ts` |
| **Function** | `calculatePoseNaturalness(grip, restingPose, stiffness, handSide, neutralHandCenters)` |
| **Output** | number ≥ 0 (lower = better) |
| **Normalized** | No |
| **Additive** | Yes — summed across hands |

**Formula:**
```
poseNaturalness = 0.4 × attractorCost
                + 0.4 × perFingerHomeCost
                + 0.2 × fingerDominanceCost
```

#### 3.1.1 Attractor Cost (Spring Model)

| Property | Value |
|----------|-------|
| **Function** | `calculateAttractorCost(current, resting, stiffness)` |
| **Inputs** | HandPose (current), HandPose (resting), stiffness multiplier |

**Formula:**
```
attractorCost = euclideanDistance(current.centroid, resting.centroid) × stiffness
```

Pulls each hand's centroid toward the resting pose. The `stiffness` parameter (typically 1.0) controls spring strength.

#### 3.1.2 Per-Finger Home Cost

| Property | Value |
|----------|-------|
| **Function** | `calculatePerFingerHomeCost(pose, handSide, neutralHandCenters, weight)` |
| **Weight Parameter** | 0.8 (hardcoded at call site) |

**Formula:**
```
perFingerHomeCost = Σ euclideanDistance(finger_coord, neutral_pad_coord) × 0.8
                   for each finger in pose
```

Each finger is penalized proportionally to its distance from its neutral home pad position. Neutral pad positions are defined in `handPose.ts` (see §8.2).

#### 3.1.3 Finger Dominance Cost

| Property | Value |
|----------|-------|
| **Function** | `calculateFingerDominanceCost(grip)` |

**Formula:**
```
fingerDominanceCost = Σ FINGER_DOMINANCE_COST[finger]
                      for each finger in grip
```

**Constants** (from `biomechanicalModel.ts`):

| Finger | Cost | Rationale |
|--------|------|-----------|
| index | 0.0 | Preferred — no penalty |
| middle | 0.0 | Preferred — no penalty |
| ring | 1.0 | Slightly suboptimal |
| pinky | 3.0 | Discouraged |
| thumb | 5.0 | Very discouraged for percussion |

### 3.2 Constraint Penalty (Feasibility Tier)

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/costFunction.ts`, `engine/prior/biomechanicalModel.ts` |
| **Additive** | Yes — added once per group |

**Mapping:**

| Feasibility Tier | Penalty | Condition |
|------------------|---------|-----------|
| Strict (Tier 1) | **0** | All finger-pair spans within strict limits |
| Relaxed (Tier 2) | **200** | Spans within 1.15× strict limits |
| Fallback (Tier 3) | **1000** | Constraints ignored; fingers assigned by proximity |

### 3.3 Activation Cost

| Property | Value |
|----------|-------|
| **File** | `engine/prior/biomechanicalModel.ts` |
| **Constant** | `ACTIVATION_COST = 5.0` |
| **Used in** | Legacy code path (`legacyCosts.ts`) |
| **Status** | **Not used in primary beam search** — diagnostic/legacy only |

Applied when a finger is placed for the first time with no prior position.

### 3.4 Zone Violation Score

| Property | Value |
|----------|-------|
| **File** | `engine/surface/handZone.ts` |
| **Function** | `zoneViolationScore(pad, hand)` |
| **Used in** | Debug tools only (`constraintValidator.ts`, `irrationalDetector.ts`, `evaluationRecorder.ts`) |
| **Status** | **Not used in beam search scoring** |

**Formula:**
```
if pad.col within hand's zone (L: 0-3, R: 4-7): return 0
else: return distance from nearest zone boundary
```

Zone preferences: cols 0-2 → left, cols 3-4 → shared, cols 5-7 → right.

---

## 4. Transition Cost Metrics

These costs depend on event-to-event motion over time.

### 4.1 Transition Cost (Fitts's Law)

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/costFunction.ts` |
| **Function** | `calculateTransitionCost(prev, curr, timeDelta)` |
| **Inputs** | HandPose (prev), HandPose (curr), timeDelta (seconds) |
| **Output** | number ≥ 0 or **Infinity** |

**Formula:**
```
if timeDelta ≤ 0.001: return 0                    // No meaningful transition
distance = euclideanDistance(prev.centroid, curr.centroid)
if distance === 0: return 0                         // No movement needed
speed = distance / timeDelta
if speed > MAX_HAND_SPEED (12.0): return Infinity   // HARD RULE: physically impossible
cost = distance + speed × SPEED_COST_WEIGHT (0.5)
```

**Constants:**

| Name | Value | Source |
|------|-------|--------|
| `MIN_TIME_DELTA` | 0.001 s | `costFunction.ts` |
| `MAX_HAND_SPEED` | 12.0 grid units/s | `biomechanicalModel.ts` |
| `SPEED_COST_WEIGHT` | 0.5 | `biomechanicalModel.ts` |

**Key behavior:**
- Returns **Infinity** when speed exceeds `MAX_HAND_SPEED` — this is a **hard constraint**
- In the beam solver, Infinity transitions cause the grip to be skipped (unless it's a fallback or the first group)
- The beam solver converts Infinity to 0 for first groups and to 100 for manual constraint overrides

### 4.2 Alternation Cost (Same-Finger Repetition)

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/costFunction.ts` |
| **Function** | `calculateAlternationCost(prevAssignments, currentAssignments, dt)` |
| **Beam Weight** | `ALTERNATION_BEAM_WEIGHT = 0.8` |

**Formula:**
```
if no previous assignments OR dt ≥ ALTERNATION_DT_THRESHOLD (0.25s): return 0
penalty = 0
for each current assignment:
  if same (hand, finger) appears in previous assignments:
    recencyFactor = 1 - (dt / 0.25)                // Linear decay: 1.0 at dt=0 → 0.0 at dt=0.25
    penalty += ALTERNATION_PENALTY (1.5) × recencyFactor
return penalty
```

**Constants:**

| Name | Value | Source |
|------|-------|--------|
| `ALTERNATION_DT_THRESHOLD` | 0.25 s | `biomechanicalModel.ts` |
| `ALTERNATION_PENALTY` | 1.5 | `biomechanicalModel.ts` |
| `ALTERNATION_BEAM_WEIGHT` | 0.8 | `beamSolver.ts` |

### 4.3 Lookahead Bonus

| Property | Value |
|----------|-------|
| **File** | `engine/solvers/beamSolver.ts` |
| **Function** | `computeLookaheadBonus(gripCentroid, nextGroup, stepCost)` |
| **Effect** | **Subtracted** from stepCost |

**Formula:**
```
if stepCost ≤ 0: return 0
distToNext = euclideanDistance(gripCentroid, nextGroupCentroid)
proximityBonus = max(0, 4.0 - distToNext) × 0.6
return min(stepCost × 0.2, proximityBonus)         // Capped at 20% of step cost
```

Rewards grips that position the hand closer to the next group, implementing 1-step lookahead.

---

## 5. Feasibility Constraints

### 5.1 Three-Tier Feasibility System

**File:** `engine/prior/feasibility.ts`
**Function:** `generateValidGripsWithTier(pads, ...)`

```
Input: set of pads to play simultaneously
│
├─ Try Tier 1 (Strict)
│    Spans: FINGER_PAIR_MAX_SPAN_STRICT
│    Topology: strict ordering, no overlap
│    Thumb delta: ≤ 1.0
│    → Penalty: 0
│    → If valid grips found: return
│
├─ Try Tier 2 (Relaxed)
│    Spans: FINGER_PAIR_MAX_SPAN_STRICT × 1.15
│    Topology: relaxed (0.5 unit overlap allowed)
│    Thumb delta: ≤ 2.0
│    → Penalty: 200
│    → If valid grips found: return
│
└─ Tier 3 (Fallback)
     Ignore all biomechanical constraints
     Assign fingers by left-to-right proximity
     → Penalty: 1000
     → ALWAYS returns at least one grip
```

### 5.2 Hard Constraints (Reject or Infinity)

These are true hard rules — violated candidates are rejected or assigned infinite cost:

#### 5.2.1 Speed Limit

| Rule | Threshold | Effect |
|------|-----------|--------|
| Hand movement speed | > 12.0 grid units/s | `calculateTransitionCost()` returns **Infinity** |

#### 5.2.2 Finger-Pair Span Limits (Strict)

**File:** `engine/prior/biomechanicalModel.ts`

| Finger Pair | Max Span (grid units) |
|-------------|----------------------|
| index ↔ middle | 2.0 |
| middle ↔ ring | 2.0 |
| pinky ↔ ring | 1.5 |
| index ↔ ring | 2.0 |
| middle ↔ pinky | 2.5 |
| index ↔ pinky | 4.0 |
| index ↔ thumb | 3.5 |
| middle ↔ thumb | 4.5 |
| ring ↔ thumb | 5.5 |
| pinky ↔ thumb | 5.5 |
| (unlisted pairs) | 5.5 |

When Strict fails, Relaxed uses these × **1.15** multiplier.

#### 5.2.3 Finger Ordering (Topology)

| Hand | Rule |
|------|------|
| Left (L→R on grid) | pinky ≤ ring ≤ middle ≤ index ≤ thumb + delta |
| Right (L→R on grid) | thumb − delta ≤ index ≤ middle ≤ ring ≤ pinky |

Violation → grip rejected at that tier.

#### 5.2.4 Collision Detection

Two fingers **cannot** occupy the same grid cell (row, col). Violation → grip rejected.

#### 5.2.5 Thumb Delta

| Tier | Max Vertical Offset |
|------|-------------------|
| Strict | 1.0 grid units |
| Relaxed | 2.0 grid units |

Thumb must sit below (higher row index = lower on grid) other fingers.

#### 5.2.6 Layout Coverage

**File:** `engine/mapping/mappingCoverage.ts`

If any performance note has no pad assignment in the layout → **Infinity cost** (annealing solver rejects the layout entirely).

### 5.3 Soft Penalties (Scored, Not Rejected)

| Penalty | Value | Condition |
|---------|-------|-----------|
| Relaxed tier grip | 200 | Grip spans between 1.0× and 1.15× strict limits |
| Fallback tier grip | 1000 | No valid grip at Strict or Relaxed tier |
| Finger dominance | 0–5 per finger | Using anatomically suboptimal fingers |
| Alternation | up to 1.5 per occurrence | Same finger reused within 0.25s |
| Hand balance | quadratic | Left/right distribution deviates from 45/55 target |
| Chord spread | (threshold only) | Spread > 3.0 units (threshold defined, penalty applied via tier system) |

### 5.4 Named Constraint Rules

**File:** `engine/prior/biomechanicalModel.ts`

| Rule Name | Description | Hard/Soft |
|-----------|-------------|-----------|
| `span` | Per-pair span exceeds limit | Hard (at tier level) |
| `ordering` | Finger ordering violation (crossover) | Hard |
| `collision` | Two fingers on same pad | Hard |
| `thumbDelta` | Thumb too far above other fingers | Hard |
| `topology` | Left/right hand topology violation | Hard |
| `reachability` | Finger outside reach given hand anchor | Hard |
| `speed` | Transition too fast (> MAX_HAND_SPEED) | Hard |
| `zone` | Hand in wrong zone | Soft (diagnostic only) |

---

## 6. Sequence-Level Metrics

### 6.1 Hand Balance Cost

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/costFunction.ts` |
| **Function** | `calculateHandBalanceCost(leftCount, rightCount)` |
| **Beam Weight** | `HAND_BALANCE_BEAM_WEIGHT = 0.3` |

**Formula:**
```
total = leftCount + rightCount
if total < HAND_BALANCE_MIN_NOTES (2): return 0
leftShare = leftCount / total
deviation = leftShare - HAND_BALANCE_TARGET_LEFT (0.45)
cost = HAND_BALANCE_WEIGHT (2.0) × deviation²
```

**Constants:**

| Name | Value | Source |
|------|-------|--------|
| `HAND_BALANCE_TARGET_LEFT` | 0.45 (45% left, 55% right) | `biomechanicalModel.ts` |
| `HAND_BALANCE_WEIGHT` | 2.0 | `biomechanicalModel.ts` |
| `HAND_BALANCE_MIN_NOTES` | 2 | `biomechanicalModel.ts` |
| `HAND_BALANCE_BEAM_WEIGHT` | 0.3 | `beamSolver.ts` |

### 6.2 Fatigue Model (Diagnostic Only)

| Property | Value |
|----------|-------|
| **File** | `engine/diagnostics/fatigueModel.ts` |
| **Status** | **NOT used in beam search** — diagnostic display only |

**Constants:**

| Name | Value |
|------|-------|
| `FATIGUE_ACCUMULATION_RATE` | 0.1 per finger use |
| `FATIGUE_DECAY_RATE` | 0.05 per second of rest |
| `MAX_FATIGUE` | 5.0 |

**Formulas:**
```
decayFatigue(current, timeDelta) = max(0, current - 0.05 × timeDelta)
accumulateFatigue(current) = min(5.0, current + 0.1)
```

### 6.3 Passage Difficulty Scoring

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/passageDifficulty.ts` |
| **Function** | `scorePassage(assignments, sectionIndex, startTime, endTime)` |

**Passage difficulty formula:**
```
difficultyScore = min(
  0.30 × hardRatio +              // Hard/unplayable event ratio
  0.20 × speedScore +             // Event density normalized
  0.15 × transitionScore +        // Movement cost normalized
  0.10 × stretchScore +           // Finger stretch normalized
  0.10 × polyphonyScore +         // Max simultaneous notes normalized
  0.10 × min(avgCost/15, 1) +     // Average raw cost normalized
  0.05 × crossoverScore,          // Crossover/constraint cost
  1.0
)
```

**Factor normalization scales:**

| Factor | Normalization | Scale |
|--------|--------------|-------|
| transitionScore | `min(avgMovement / 10, 1)` | 10.0 |
| stretchScore | `min(avgStretch / 5, 1)` | 5.0 |
| alternationScore | `min(avgBounce / 3, 1)` | 3.0 |
| crossoverScore | `min(avgCrossover / 20, 1)` | 20.0 |
| polyphonyScore | `min(maxPoly / 5, 1)` | 5 notes |
| speedScore | `min(density / 10, 1)` | 10 events/s |

### 6.4 Tradeoff Profile

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/difficultyScoring.ts` |
| **Function** | `computeTradeoffProfile(result, analysis)` |

Six dimensions, all 0–1 (higher = better):

| Dimension | Formula |
|-----------|---------|
| **playability** | `max(0, 1 - overallDifficultyScore)` |
| **compactness** | `max(0, 1 - min(averageDrift / 4, 1))` |
| **handBalance** | `max(0, 1 - abs(leftFraction - 0.5) × 2)` |
| **transitionEfficiency** | `max(0, 1 - min(avgMovement / 10, 1))` |
| **learnability** | `max(0, 1 - min(uniquePadCount / 20, 1))` |
| **robustness** | `max(0, 1 - variance(passageScores) × 4)` or 0.8 default for single passage |

### 6.5 Difficulty Classification

| Property | Value |
|----------|-------|
| **File** | `engine/evaluation/difficultyScoring.ts` |

| Score Range | Class |
|-------------|-------|
| ≤ 0.2 | Easy |
| 0.2 – 0.45 | Moderate |
| 0.45 – 0.7 | Hard |
| > 0.7 | Extreme |

### 6.6 Role-Weighted Scoring

Difficulty is weighted by voice role importance:

| Musical Role | Weight |
|-------------|--------|
| backbone | 1.5× |
| lead | 1.3× |
| fill | 0.8× |
| texture | 0.7× |
| accent | 0.6× |

**Formula:**
```
avgWeight = Σ(ROLE_WEIGHT[role] × eventCount) / Σ(eventCount)
roleWeightedScore = min(rawScore × avgWeight, 1.0)
```

---

## 7. Weighting System

### 7.1 Beam Solver Weights

The beam solver's per-step score is computed as:

```
stepCost = combinePerformabilityComponents({
  poseNaturalness,           // weight: 1.0 (implicit)
  transitionDifficulty,      // weight: 1.0 (implicit)
  constraintPenalty           // weight: 1.0 (implicit)
})
stepCost += alternationCost × 0.8
stepCost += handBalanceCost × 0.3
stepCost -= lookaheadBonus
```

| Component | Weight in Beam Score |
|-----------|---------------------|
| Pose naturalness | 1.0 (direct) |
| Transition difficulty | 1.0 (direct) |
| Constraint penalty | 1.0 (direct) |
| Alternation | 0.8 |
| Hand balance | 0.3 |
| Lookahead bonus | −(up to 20% of step cost) |

### 7.2 Pose Naturalness Sub-Weights

```
poseNaturalness = 0.4 × attractor + 0.4 × perFingerHome + 0.2 × fingerDominance
```

| Sub-Component | Weight |
|---------------|--------|
| Attractor (centroid spring) | 0.4 |
| Per-finger home distance | 0.4 |
| Finger dominance | 0.2 |

### 7.3 Candidate Ranking Weights

**File:** `engine/optimization/candidateRanker.ts`

```
compositeScore = 0.30 × playability
               + 0.20 × transitionEfficiency
               + 0.15 × compactness
               + 0.15 × learnability
               + 0.10 × handBalance
               + 0.10 × robustness
```

| Dimension | Weight |
|-----------|--------|
| playability | 0.30 |
| transitionEfficiency | 0.20 |
| compactness | 0.15 |
| learnability | 0.15 |
| handBalance | 0.10 |
| robustness | 0.10 |

---

## 8. Objective Function Definition

### 8.1 Primary Objective (PerformabilityObjective)

**File:** `engine/evaluation/objective.ts`

```typescript
interface PerformabilityObjective {
  poseNaturalness: number;      // Grip quality (attractor + home + dominance)
  transitionDifficulty: number; // Fitts's Law movement cost
  constraintPenalty: number;    // Tier penalty (0 / 200 / 1000)
}

totalScore = poseNaturalness + transitionDifficulty + constraintPenalty
```

Used by the beam solver for all scoring decisions.

### 8.2 Legacy Objective (ObjectiveComponents)

```typescript
interface ObjectiveComponents {
  transition: number;       // Fitts's Law cost
  stretch: number;          // Finger dominance penalty (misleading name)
  poseAttractor: number;    // Centroid spring cost
  perFingerHome: number;    // Per-finger home distance
  alternation: number;      // Same-finger repetition
  handBalance: number;      // Left/right distribution
  constraints: number;      // Tier penalty
}

totalScore = transition + stretch + poseAttractor + perFingerHome
           + alternation + handBalance + constraints
```

Used for display-level diagnostics and mapping to canonical factors.

### 8.3 Canonical Diagnostic Factors

**File:** `types/diagnostics.ts`

```typescript
interface DiagnosticFactors {
  transition: number;           // ← transition
  gripNaturalness: number;      // ← stretch + poseAttractor + perFingerHome
  alternation: number;          // ← alternation
  handBalance: number;          // ← handBalance
  constraintPenalty: number;    // ← constraints
  total: number;
}
```

### 8.4 DifficultyBreakdown (UI Display)

**File:** `types/executionPlan.ts`

```typescript
interface DifficultyBreakdown {
  movement: number;    // ← transition
  stretch: number;     // ← fingerDominance (0.2 of poseNaturalness)
  drift: number;       // ← attractor (0.4 of poseNaturalness)
  bounce: number;      // ← alternation
  fatigue: number;     // ← perFingerHome (0.4 of poseNaturalness)
  crossover: number;   // ← constraintPenalty
  total: number;
}
```

### 8.5 Annealing Solver Objective

The annealing solver uses the beam solver as its cost function:

```
evaluateLayoutCost(layout, performance, config, beamWidth)
  └─ createBeamSolver(config).solveSync(performance, config)
     └─ returns ExecutionPlanResult.metadata.objectiveTotal
```

The Metropolis acceptance criterion:
```
if delta < 0: accept (improvement)
if delta ≥ 0: accept with probability exp(-delta / temperature)
```

Invalid layouts (unmapped notes) → always rejected (Infinity cost).

**Annealing Configurations:**

| Parameter | Fast | Deep |
|-----------|------|------|
| iterations | 3,000 | 8,000 |
| initialTemp | 500 | 500 |
| coolingRate | 0.997 | 0.9985 |
| restartCount | 0 | 3 |
| fastBeamWidth | 12 | 16 |
| finalBeamWidth | 50 | 50 |
| useZoneTransfer | false | true |

---

## 9. Code Reference Index

### Core Cost Functions

| File | Key Functions |
|------|--------------|
| `engine/evaluation/costFunction.ts` | `calculatePoseNaturalness`, `calculateAttractorCost`, `calculatePerFingerHomeCost`, `calculateFingerDominanceCost`, `calculateTransitionCost`, `calculateAlternationCost`, `calculateHandBalanceCost` |
| `engine/evaluation/objective.ts` | `combinePerformabilityComponents`, `combineComponents`, `objectiveToCanonicalFactors`, `performabilityToDifficultyBreakdown` |
| `engine/evaluation/canonicalEvaluator.ts` | `evaluateEvent`, `evaluateTransition`, `evaluatePerformance`, `compareLayouts`, `validateAssignment` |

### Feasibility & Biomechanics

| File | Key Exports |
|------|------------|
| `engine/prior/biomechanicalModel.ts` | All constants (single source of truth), `calculateGridDistance`, `pairKey`, `DEFAULT_HAND_MODEL` |
| `engine/prior/feasibility.ts` | `generateValidGripsWithTier`, `isSpanValid`, `isFingerOrderingValid`, `isCollision`, `getReachabilityMap` |
| `engine/prior/handPose.ts` | `computeNeutralHandCenters`, `getNeutralHandCenters`, `restingPoseFromNeutralPadPositions`, `DEFAULT_HAND_POSE` |

### Solvers

| File | Key Exports |
|------|------------|
| `engine/solvers/beamSolver.ts` | `createBeamSolver` (K-best beam search) |
| `engine/optimization/annealingSolver.ts` | `AnnealingSolver` (simulated annealing wrapping beam search) |
| `engine/optimization/mutationService.ts` | `applyRandomMutation`, `applyZoneTransferMutation` |

### Analysis & Scoring

| File | Key Exports |
|------|------------|
| `engine/evaluation/difficultyScoring.ts` | `analyzeDifficulty`, `classifyDifficulty`, `computeTradeoffProfile`, `classifyOptimizationDifficulty` |
| `engine/evaluation/passageDifficulty.ts` | `scorePassage`, `scorePassagesFromSections`, `scorePassagesFixedWindow` |
| `engine/evaluation/eventMetrics.ts` | `computeEventAnatomicalStretchScore`, `computeCompositeDifficultyScore`, `analyzeAssignments` |
| `engine/evaluation/transitionAnalyzer.ts` | `analyzeTransition`, `analyzeAllTransitions` |
| `engine/evaluation/poseBuilder.ts` | `buildMomentPoses`, `getHandForPad` |
| `engine/analysis/baselineCompare.ts` | Canonical baseline-aware comparison (3 modes) |
| `engine/analysis/diversityMeasurement.ts` | Layout diversity metrics and trivial duplicate filtering |
| `engine/analysis/eventExplainer.ts` | Per-event cost explanations |
| `engine/analysis/constraintExplainer.ts` | Feasibility constraint explanations |
| `engine/optimization/candidateRanker.ts` | `compositeScore`, `rankCandidates`, `filterPareto` |

### Diagnostic / Legacy

| File | Key Exports |
|------|------------|
| `engine/diagnostics/fatigueModel.ts` | `decayFatigue`, `accumulateFatigue` (diagnostic only) |
| `engine/diagnostics/legacyCosts.ts` | `calculateMovementCost`, `calculateStretchPenalty`, `calculateDriftPenalty`, `calculateCrossoverCost` (all deprecated) |
| `engine/prior/ergonomicConstants.ts` | Re-export layer — no new constants |

### Types

| File | Key Types |
|------|----------|
| `types/diagnostics.ts` | `DiagnosticFactors`, `FeasibilityLevel`, `FeasibilityVerdict`, `DiagnosticsPayload` |
| `types/costBreakdown.ts` | `CostDimensions`, `EventCostBreakdown`, `TransitionCostBreakdown`, `PerformanceCostBreakdown`, `LayoutComparisonResult` |
| `types/executionPlan.ts` | `FingerAssignment`, `ExecutionPlanResult`, `DifficultyBreakdown`, `PadFingerAssignment` |
| `types/candidateSolution.ts` | `CandidateSolution`, `TradeoffProfile`, `DifficultyAnalysis` |
| `types/engineConfig.ts` | `EngineConfiguration`, `AnnealingConfig`, `FAST_ANNEALING_CONFIG`, `DEEP_ANNEALING_CONFIG` |

---

## 10. Inconsistencies / Potential Bugs

### 10.1 Zone Violation Score: Defined but Not Used in Scoring

`zoneViolationScore()` in `engine/surface/handZone.ts` computes a penalty for hand-zone violations. However, it is **never called from the beam solver or canonical evaluator**. It only appears in debug tools (`constraintValidator.ts`, `irrationalDetector.ts`, `evaluationRecorder.ts`, `candidateReport.ts`).

**Impact:** The solver has no zone awareness during optimization. Left-hand assignments to right-zone pads (and vice versa) receive no direct penalty. Zone preference is only enforced implicitly through the topology constraints and hand pose model.

**Recommendation:** Either integrate `zoneViolationScore` into the beam solver as a soft cost term, or document that zone awareness is intentionally deferred to the topology/pose model.

### 10.2 "stretch" in ObjectiveComponents Is Actually Finger Dominance

In `ObjectiveComponents`, the field named `stretch` actually receives the output of `calculateFingerDominanceCost()`, not a stretch/span metric:

```typescript
// beamSolver.ts, line ~385
const stepComponents: ObjectiveComponents = {
  transition: effectiveTransitionCost,
  stretch: staticCost,              // ← staticCost = calculateFingerDominanceCost(grip)
  poseAttractor: attractorCost,
  ...
};
```

This is misleading — the field name suggests physical stretch, but the value is finger preference weighting. When mapped to `DifficultyBreakdown`, `stretch` maps to the "stretch" UI label, further confusing the semantics.

**Impact:** UI diagnostics may display finger dominance costs under the "stretch" label.

**Recommendation:** Rename `stretch` to `fingerDominance` in `ObjectiveComponents` to match the actual computation.

### 10.3 Two Coexisting Objective Models

The codebase maintains two parallel objective models:

1. **PerformabilityObjective** (3-component) — used for beam scoring
2. **ObjectiveComponents** (7-component) — used for display/diagnostics

Both are computed per step in the beam solver. The 7-component model is marked as legacy but is still actively used for `DifficultyBreakdown` and `DiagnosticFactors` mapping.

**Impact:** Maintenance burden; two models must stay synchronized. The mapping functions (`objectiveToDifficultyBreakdown`, `performabilityToDifficultyBreakdown`) introduce potential for drift.

### 10.4 Alternation and Hand Balance Not in PerformabilityObjective

Alternation and hand balance costs are **not** included in the `PerformabilityObjective` 3-component model. They are added separately in the beam solver with their own weights (0.8 and 0.3). However, the canonical evaluator (`canonicalEvaluator.ts`) includes them in the `CostDimensions` as separate fields.

**Impact:** The beam solver's actual scoring is:

```
actual_score = poseNaturalness + transitionDifficulty + constraintPenalty
             + alternation × 0.8 + handBalance × 0.3
```

This is a **5-component** system in practice, but the `PerformabilityObjective` type only represents 3. The `CostDimensions` type in `costBreakdown.ts` correctly models all 5.

**Recommendation:** Either expand `PerformabilityObjective` to 5 components or rename it to clarify it represents only the "core 3."

### 10.5 Legacy Cost Functions Still Importable

`engine/diagnostics/legacyCosts.ts` exports deprecated functions that:
- Use the abandoned `HandState` interface (not `HandPose`)
- Maintain global mutable state (`noteHistory`)
- Duplicate logic from active modules

While all are marked `@deprecated`, they are still importable and could be accidentally used.

### 10.6 Legacy Finger Weights vs. Finger Dominance Cost

Two different per-finger cost tables exist:

| Source | Thumb | Index | Middle | Ring | Pinky |
|--------|-------|-------|--------|------|-------|
| `FINGER_DOMINANCE_COST` (active) | 5.0 | 0.0 | 0.0 | 1.0 | 3.0 |
| `FINGER_WEIGHTS` (deprecated) | 1.2 | 1.0 | 1.0 | 1.1 | 1.3 |

The deprecated `FINGER_WEIGHTS` in `ergonomicConstants.ts` uses a fundamentally different scale (multiplicative around 1.0) vs. the active `FINGER_DOMINANCE_COST` (additive penalties from 0).

### 10.7 Chord Penalty Threshold Defined but Not Directly Used

`CHORD_PENALTY_THRESHOLD = 3.0` is defined in `biomechanicalModel.ts` but is not directly referenced in any active cost function. The chord spread penalty is implicitly handled through the feasibility tier system (wide chords → Relaxed/Fallback tier → penalty 200/1000).

### 10.8 Pad-Finger Ownership Invariant

**Invariant B** in the beam solver states: "Once a pad is assigned a finger, all future groups must use the same finger for that pad."

This is correctly enforced via the `padOwnership` map in `BeamNode`. However, this invariant is **not enforced in the canonical evaluator** (`canonicalEvaluator.ts`), which takes a static `PadFingerAssignment` as input. If the input assignment violates this invariant, the evaluator will not detect it.

**Impact:** The canonical evaluator trusts its input. If called with an inconsistent `PadFingerAssignment`, results will be misleading.

**Recommendation:** Add a `validateAssignment()` check that verifies pad-finger consistency before evaluation.

### 10.9 Event Model Verification

**Finding:** The system correctly groups events into simultaneity groups. The beam solver uses `groupEventsByTimestamp()` which groups events within `MOMENT_EPSILON` time threshold. The canonical evaluator operates on pre-grouped `PerformanceMoment` objects. Costs are computed **per group**, not per individual note.

**Invariant E** is enforced: "All notes in a simultaneous group get the FULL moment cost (not divided per-note)." This is correct — the beam solver assigns the same cost to all notes in a group.

**No bug found here.**

### 10.10 Inconsistent Infinity Handling

When `calculateTransitionCost()` returns Infinity:
- **Beam solver (normal path):** skips the grip (`continue`)
- **Beam solver (first group):** uses `max(rawTimeDelta, 1.0)` to prevent zero-division
- **Beam solver (manual overrides):** converts Infinity to 100
- **Beam solver (fallback grips):** does not skip (fallback grips always allowed)

This inconsistency means fallback grips with physically impossible transitions can be accepted, while non-fallback grips with the same transitions are rejected.

---

## 11. Recommendations for Improving the Cost Model

### 11.1 Unify to a Single Objective Model

Replace the dual PerformabilityObjective (3) + ObjectiveComponents (7) with a single **5-component CostDimensions** model that includes all active cost terms:

```typescript
interface CostDimensions {
  poseNaturalness: number;
  transitionCost: number;
  constraintPenalty: number;
  alternation: number;
  handBalance: number;
}
```

This matches what the beam solver actually computes and eliminates the mapping layer.

### 11.2 Integrate Zone Violation into Scoring

Add `zoneViolationScore` as a soft cost in the beam solver. Currently, the solver has no direct zone preference — it relies entirely on implicit effects of the biomechanical model. A small zone penalty (e.g., weight 0.2–0.5) would improve left/right hand assignment quality.

### 11.3 Rename "stretch" to "fingerDominance"

The `stretch` field in `ObjectiveComponents` is misleading. Rename it to `fingerDominance` to match the actual `calculateFingerDominanceCost()` it receives.

### 11.4 Remove Dead Legacy Code

Delete `engine/diagnostics/legacyCosts.ts` and the deprecated `FINGER_WEIGHTS` constant. These create confusion and risk accidental usage. Any diagnostic display needs can be served by the active cost functions.

### 11.5 Add Canonical Evaluator Input Validation

The canonical evaluator should verify that `PadFingerAssignment` is internally consistent (no pad mapped to multiple fingers) before evaluation. The `validateAssignment()` function exists but must be called by consumers.

### 11.6 Normalize Constraint Penalty Scale

The current penalty jumps (0 → 200 → 1000) are very large relative to typical pose/transition costs (often 1–20). This creates a cliff effect where one Relaxed grip dominates the entire score. Consider:
- Reducing penalties (e.g., 0 → 10 → 100)
- Making penalties proportional to the number of violated constraints
- Using a graduated penalty based on how far past the limit the grip is

### 11.7 Consider Explicit Passage-Level Costs in Optimization

Currently, passage difficulty is computed post-hoc only. The beam solver optimizes greedily per-group with only 1-step lookahead. Consider:
- Wider lookahead windows for dense passages
- Section-level cost bonuses for maintaining hand position stability
- Fatigue integration (currently diagnostic-only)

---

## Appendix A: Complete Constants Table

All constants from `engine/prior/biomechanicalModel.ts` (the single source of truth):

| Constant | Value | Category | Used In |
|----------|-------|----------|---------|
| `MAX_FINGER_SPAN_STRICT` | 5.5 | Hard constraint | Feasibility |
| `RELAXED_SPAN_MULTIPLIER` | 1.15 | Hard constraint | Feasibility |
| `THUMB_DELTA` | 1.0 | Hard constraint | Feasibility |
| `THUMB_DELTA_RELAXED` | 2.0 | Hard constraint | Feasibility |
| `MAX_HAND_SPAN` | 5.5 | Hard constraint | Feasibility |
| `MAX_REACH_GRID_UNITS` | 5.0 | Hard constraint | Feasibility |
| `MAX_SPEED_UNITS_PER_SEC` | 12.0 | Hard constraint | Transition cost |
| `MAX_HAND_SPEED` | 12.0 | Hard constraint | Transition cost |
| `SPEED_COST_WEIGHT` | 0.5 | Soft cost | Transition cost |
| `RELAXED_GRIP_PENALTY` | 200 | Soft cost | Tier penalty |
| `FALLBACK_GRIP_PENALTY` | 1000 | Soft cost | Tier penalty |
| `CHORD_PENALTY_THRESHOLD` | 3.0 | Threshold | (Not directly used) |
| `ALTERNATION_DT_THRESHOLD` | 0.25 s | Threshold | Alternation cost |
| `ALTERNATION_PENALTY` | 1.5 | Soft cost | Alternation cost |
| `HAND_BALANCE_TARGET_LEFT` | 0.45 | Soft cost | Hand balance |
| `HAND_BALANCE_WEIGHT` | 2.0 | Soft cost | Hand balance |
| `HAND_BALANCE_MIN_NOTES` | 2 | Threshold | Hand balance |
| `ACTIVATION_COST` | 5.0 | Soft cost | Legacy only |
| `FINGER_DOMINANCE_COST.index` | 0.0 | Soft cost | Pose naturalness |
| `FINGER_DOMINANCE_COST.middle` | 0.0 | Soft cost | Pose naturalness |
| `FINGER_DOMINANCE_COST.ring` | 1.0 | Soft cost | Pose naturalness |
| `FINGER_DOMINANCE_COST.pinky` | 3.0 | Soft cost | Pose naturalness |
| `FINGER_DOMINANCE_COST.thumb` | 5.0 | Soft cost | Pose naturalness |

Additional constants from other files:

| Constant | Value | File |
|----------|-------|------|
| `ALTERNATION_BEAM_WEIGHT` | 0.8 | `beamSolver.ts` |
| `HAND_BALANCE_BEAM_WEIGHT` | 0.3 | `beamSolver.ts` |
| `TIE_THRESHOLD` | 0.01 | `canonicalEvaluator.ts` |
| `FATIGUE_ACCUMULATION_RATE` | 0.1 | `fatigueModel.ts` |
| `FATIGUE_DECAY_RATE` | 0.05 | `fatigueModel.ts` |
| `MAX_FATIGUE` | 5.0 | `fatigueModel.ts` |
| `DRIFT_PENALTY_MULTIPLIER` | 0.5 | `ergonomicConstants.ts` (deprecated) |

## Appendix B: Finger-Pair Span Limits

### Strict (Tier 1)

| Pair | Max Span |
|------|----------|
| index ↔ middle | 2.0 |
| middle ↔ ring | 2.0 |
| pinky ↔ ring | 1.5 |
| index ↔ ring | 2.0 |
| middle ↔ pinky | 2.5 |
| index ↔ pinky | 4.0 |
| index ↔ thumb | 3.5 |
| middle ↔ thumb | 4.5 |
| ring ↔ thumb | 5.5 |
| pinky ↔ thumb | 5.5 |

### Relaxed (Tier 2) = Strict × 1.15

| Pair | Max Span |
|------|----------|
| index ↔ middle | 2.30 |
| middle ↔ ring | 2.30 |
| pinky ↔ ring | 1.725 |
| index ↔ ring | 2.30 |
| middle ↔ pinky | 2.875 |
| index ↔ pinky | 4.60 |
| index ↔ thumb | 4.025 |
| middle ↔ thumb | 5.175 |
| ring ↔ thumb | 6.325 |
| pinky ↔ thumb | 6.325 |

## Appendix C: Default Neutral Pad Positions (Pose 0)

```
Row 0:  [ ][ ][ ][LT][RT][ ][ ][ ]
Row 1:  [ ][ ][ ][ ][ ][ ][ ][ ]
Row 2:  [ ][ ][ ][ ][ ][ ][ ][ ]
Row 3:  [ ][ ][ ][LI][RI][ ][ ][ ]
Row 4:  [LP][LR][LM][ ][ ][RM][RR][RP]
Row 5-7: (unused in default pose)

L = Left, R = Right
T = Thumb, I = Index, M = Middle, R = Ring, P = Pinky
```

| Finger | Grid Position (row, col) |
|--------|-------------------------|
| L_THUMB | (0, 3) |
| L_INDEX | (3, 3) |
| L_MIDDLE | (4, 2) |
| L_RING | (4, 1) |
| L_PINKY | (4, 0) |
| R_THUMB | (0, 4) |
| R_INDEX | (3, 4) |
| R_MIDDLE | (4, 5) |
| R_RING | (4, 6) |
| R_PINKY | (4, 7) |
