# PushFlow Cost Model — V1 Surgical Refactor Implementation Plan

## 1. Purpose

The PushFlow evaluation system has accrued three layers of cost logic, two competing objective models, misleading legacy terminology, and a tiered feasibility system that blurs the line between hard constraints and soft costs. This refactor simplifies the cost model to a single coherent system grounded in three clear concepts: **feasibility** (can it physically be played?), **ergonomics** (how natural is the grip and movement?), and **event-to-event difficulty** (how hard is it to transition between consecutive moments?).

The goal is not a rewrite. It is a surgical cleanup: remove what is redundant, rename what is misleading, harden what should be hard, and defer what is speculative. The result is a V1 cost model that is small, correct, and directly auditable against the Push 3 surface.

---

## 2. What Is Wrong in the Current Implementation

### 2.1 Tiered Feasibility Penalties Blur Constraints and Costs

**Files:** `src/engine/prior/feasibility.ts`, `src/engine/prior/biomechanicalModel.ts`

The system defines three tiers for grip generation:

- **Tier 1 (Strict):** All finger pairs within `FINGER_PAIR_MAX_SPAN_STRICT`. Penalty = 0.
- **Tier 2 (Relaxed):** Pairs within `FINGER_PAIR_MAX_SPAN_RELAXED` (strict × 1.15). Penalty = `RELAXED_GRIP_PENALTY` (200).
- **Tier 3 (Fallback):** Ignores all span and topology constraints. Penalty = `FALLBACK_GRIP_PENALTY` (1000).

**Problem:** Tier 3 (fallback) produces grips that violate what should be hard biomechanical constraints — finger ordering, span limits, topology — and then compensates with a large numeric penalty. This means the solver can and does return solutions that are physically impossible, masked by a high cost. The `generateValidGrips()` function is guaranteed to return at least one grip (`NEVER empty unless no pads given` — line 653 of feasibility.ts), even when that grip is anatomically nonsensical.

**Problem:** Tier 2 is itself questionable. The 1.15× multiplier on strict spans creates a narrow band where grips are allowed but penalized. This is neither clearly a hard constraint (you can still exceed strict limits) nor a well-calibrated cost (200 is an arbitrary number in cost-space). For V1, the user wants constraints to be either **hard** or **costs** — not both.

### 2.2 Fallback Solutions Can Be Invalid

**File:** `src/engine/solvers/beamSolver.ts` (line 306)

The beam solver contains this logic:

```typescript
if (transitionCost === Infinity && !isFirstGroup && !isFallback) continue;
```

This means: if a transition is biomechanically impossible (speed > `MAX_HAND_SPEED`), the solver skips it **unless** the grip is already a fallback. Fallback grips with impossible transitions are allowed through with `effectiveTransitionCost = 0`. This creates a path where the solver can produce a result with both a constraint-violating grip and an impossible transition, and the user sees a "solution" with a high total cost but no clear signal that it is physically unachievable.

Additionally, lines 1237–1310 contain an "emergency fallback" path that constructs ad-hoc finger assignments when no valid beam candidates are found, bypassing all feasibility checks.

### 2.3 Two Competing Objective Models

**File:** `src/engine/evaluation/objective.ts`

Two objective interfaces coexist:

| Model | Components | Used By |
|-------|-----------|---------|
| `PerformabilityObjective` (3-term) | poseNaturalness, transitionDifficulty, constraintPenalty | Beam search scoring |
| `ObjectiveComponents` (7-term) | transition, stretch, poseAttractor, perFingerHome, alternation, handBalance, constraints | Diagnostic display |

The 3-component model is the primary beam score, but the 7-component model is still computed alongside and used for UI diagnostics. These are then mapped to a third schema — the 5-factor `DiagnosticFactors` — for canonical display. The result is three overlapping schemas:

- `PerformabilityObjective` (3 fields)
- `ObjectiveComponents` (7 fields)
- `DiagnosticFactors` (5 fields)

The conversion functions between them (`performabilityToDifficultyBreakdown`, `objectiveToCanonicalFactors`, `performabilityToCanonicalFactors`) contain approximation logic that invents fake sub-breakdowns when actual data is unavailable (lines 196–207 of objective.ts):

```typescript
stretch: pose * 0.2,   // finger dominance portion
drift: pose * 0.4,     // centroid attractor portion
bounce: 0,             // alternation (diagnostic only)
fatigue: pose * 0.4,   // per-finger home portion
```

### 2.4 Terminology Drift

The codebase uses two naming layers:

| Legacy Name (still in code) | Actual Computation |
|------|------|
| `movement` | Transition cost (Fitts's Law) |
| `stretch` | Finger dominance cost (not actual stretch) |
| `drift` | Pose attractor distance from resting centroid |
| `bounce` | Same-finger alternation penalty |
| `fatigue` | Per-finger home distance (not cumulative fatigue) |
| `crossover` | Constraint penalty value (not actual crossover detection) |

The `DifficultyBreakdown` type used in `ExecutionPlanResult` still carries these legacy names (`movement`, `stretch`, `drift`, `bounce`, `fatigue`, `crossover`), while `DiagnosticFactors` uses corrected names. Both exist simultaneously.

### 2.5 Pose / Home Pose Confusion

**Files:** `src/engine/prior/handPose.ts`, `src/engine/evaluation/costFunction.ts`

The system maintains three pose concepts:

1. **`DEFAULT_HAND_POSE`** (`handPose.ts:94`): Fixed MIDI-note-based finger positions (e.g., L1 = D#-2, R3 = F0). These are note-space positions, not grid positions. Resolution to grid depends on `instrumentConfig.bottomLeftNote`.

2. **`RestingPose`**: A pair of `HandPose` objects (left/right) built from neutral pad positions. Used as the attractor target in `calculateAttractorCost`. The attractor cost is `distance(current.centroid, resting.centroid) × stiffness`.

3. **`NeutralHandCenters`**: Per-finger neutral pad positions used for `calculatePerFingerHomeCost`. Each finger has a fixed "home" pad.

**Problem:** The attractor cost pulls the hand centroid toward a fixed resting position. The per-finger home cost pulls each finger toward a fixed neutral pad. Together they create a strong bias toward a specific location on the grid. The user's intent is that the natural hand pose defines the **relationship between fingers** and can **translate vertically**, not that each finger has a fixed pad assignment. The current centroid attractor treats the resting position as an absolute location.

### 2.6 Transition Costs May Compound Misleadingly

**File:** `src/engine/solvers/beamSolver.ts`

The beam solver accumulates `totalCost` as a running sum across all events:

```typescript
const newTotalCost = node.totalCost + stepCostForBeam;
```

This means transition costs, pose costs, and penalties are all summed across the full performance. A performance with 200 events will have a much higher total cost than one with 20 events, making cross-performance comparison meaningless. The `averageMetrics` in `ExecutionPlanResult` partially address this, but the beam search itself ranks by cumulative total, which biases toward shorter sequences.

### 2.7 Lookahead Bonus

**File:** `src/engine/solvers/beamSolver.ts` (lines 202–216)

The `computeLookaheadBonus` function rewards grips that leave the hand close to the next group's pads:

```typescript
const proximityBonus = Math.max(0, 4.0 - distToNext) * 0.6;
return Math.min(stepCost * 0.2, proximityBonus);
```

This is subtracted from the step cost (line 379: `stepCostForBeam -= bonus`). The user wants this removed: it adds a speculative look-ahead heuristic that optimizes for proximity when the user believes more movement can sometimes be more natural.

### 2.8 Passage Difficulty Scoring in Active Model

**Files:** `src/engine/evaluation/passageDifficulty.ts`, `src/engine/evaluation/difficultyScoring.ts`

The passage difficulty scorer computes per-passage scores with weighted factors:

```
0.3 × hardRatio + 0.2 × speedScore + 0.15 × transitionScore + ...
```

It also introduces `DifficultyFactor` types (`transition`, `stretch`, `alternation`, `crossover`, `polyphony`, `speed`, `mixed`), `DifficultyClass` thresholds, role-weighted scoring (`ROLE_WEIGHTS`), a `TradeoffProfile` with 6 axes (playability, compactness, handBalance, transitionEfficiency, learnability, robustness), and binding constraint identification.

**Problem:** This adds a second scoring layer on top of the event-level costs. The `learnability` and `robustness` axes are abstract proxies not grounded in direct ergonomic measurement. The role-weighted scoring multiplies difficulty by voice importance, which is a musical judgment disconnected from physical difficulty. For V1, this entire system should be removed from the active evaluation path and deferred as a post-hoc analysis tool.

### 2.9 Zones Are Soft Constraints

**File:** `src/engine/surface/handZone.ts`

Zones are currently implemented as soft penalties via `zoneViolationScore()`. Left hand: columns 0–3, right hand: columns 4–7, with columns 3–4 as a shared overlap zone. The penalty is proportional to distance from the zone boundary. The user wants zones to be **hard constraints** in V1.

### 2.10 Finger Ordering May Be Applied Globally

**File:** `src/engine/prior/feasibility.ts` (lines 170–228)

`isValidFingerOrder()` checks finger ordering against the full `HandState`, which carries all finger positions from prior events. The function reads `tempFingers` including historical positions:

```typescript
const tempFingers: Record<FingerType, FingerState> = {
  ...handState.fingers,
  [newFinger]: { currentGridPos: newPos, ... },
};
```

If a finger was assigned to a pad in a previous event and hasn't been reassigned, its position persists in `handState.fingers`. The ordering check then validates against those stale positions. This means event-local decisions are constrained by historical finger positions — a finger assigned to pad (2,1) three events ago still influences the ordering check for the current event.

However, in the beam solver's `expandNodeForGroup`, grip generation via `generateValidGripsWithTier` does **not** use `isValidFingerOrder` — it uses the internal `satisfiesLeftHandTopology`/`satisfiesRightHandTopology` functions which only consider the fingers in the current grip. The `isValidFingerOrder` function is used in `checkChordFeasibility`, which is a separate code path. This is confusing but means the beam solver likely applies ordering per-event. The concern is still valid for any code path using `isValidFingerOrder` with accumulated `HandState`.

### 2.11 Crossover Is a Cost Label, Not a Hard Constraint

The legacy `DifficultyBreakdown.crossover` field maps to `constraintPenalty` — a numeric cost. Actual finger crossover (e.g., index crossing over middle) should be a hard constraint rejection, not a scored penalty. The topology checks in `feasibility.ts` do reject crossovers for Tier 1 and Tier 2 grips, but Tier 3 fallback grips bypass topology entirely.

### 2.12 Alternation Mischaracterizes Same-Finger Use

**File:** `src/engine/evaluation/costFunction.ts` (lines 114–129)

The alternation cost penalizes same-finger repetition when `dt < ALTERNATION_DT_THRESHOLD` (0.25s). The penalty scales linearly with time proximity. However, the user observes that same-finger repetition is often natural and desirable — rapid eighth-note hi-hat patterns can be comfortably played all-index or all-middle with one hand. The original intent was to reward natural left-right alternation in a drumming motion, not to penalize same-finger use generically.

---

## 3. V1 Target Model

### 3.1 Hard Constraints

These produce a binary feasible/infeasible verdict per event. A solution that violates any hard constraint for any event is **not returned as valid**.

| Constraint | Description | Current Status |
|-----------|-------------|----------------|
| **Span limit** | Per-finger-pair distance within `FINGER_PAIR_MAX_SPAN_STRICT` | Currently Tier 1; Tier 2/3 allow violations |
| **Finger topology** | Fingers maintain anatomical ordering per-hand (no crossover) | Currently Tier 1/2; Tier 3 bypasses |
| **Thumb delta** | Thumb within `THUMB_DELTA` vertical rows of other fingers | Currently Tier 1; relaxed in Tier 2 |
| **Speed limit** | Hand movement speed ≤ `MAX_HAND_SPEED` | Already hard (returns Infinity) |
| **Collision** | No two fingers on the same pad simultaneously | Already enforced |
| **Zone ownership** | Left hand on columns 0–3, right hand on columns 4–7, columns 3–4 shared | Currently soft penalty |
| **Pad mapping** | Every note in the event must resolve to a pad in the layout | Already checked |

### 3.2 Active Costs (V1 Objective)

These are scored and summed to rank alternative finger assignments. Lower is better.

| Cost | Description | Replaces |
|------|-------------|----------|
| **Finger preference** | Per-finger dominance cost (index/middle preferred over ring/pinky/thumb) | `stretch` (legacy) / `fingerDominanceCost` |
| **Hand shape deviation** | Distance of current finger spread from natural hand shape, evaluated per-event, translation-invariant | `poseNaturalness` / `attractorCost` + `perFingerHomeCost` |
| **Transition cost** | Simplified event-to-event movement cost (Fitts's Law: distance + speed) | `transitionDifficulty` |
| **Hand balance** | Quadratic penalty for deviation from target left/right split. Retained if empirically justified. | `handBalance` |

### 3.3 Removed Systems (V1)

| System | Why Removed |
|--------|-------------|
| Tier 2 (relaxed) penalty band | Constraints should be binary. Relaxed band adds a narrow zone of ambiguity with an arbitrary penalty value. |
| Tier 3 (fallback) grip generation | Solutions that violate hard constraints should not be returned. If no valid grip exists, the event is infeasible. |
| Lookahead bonus | Speculative heuristic that assumes proximity is always good. |
| Passage difficulty scoring | Post-hoc multi-factor scoring layer not needed for V1 solver. |
| Role-weighted scoring | Musical judgment disconnected from physical difficulty. |
| TradeoffProfile (learnability, robustness, compactness, transitionEfficiency) | Abstract proxy scores not grounded in direct measurement. |
| `ObjectiveComponents` (7-term legacy) | Replaced by unified cost schema. |
| `DifficultyBreakdown` (legacy names) | Replaced by `DiagnosticFactors` with corrected terminology. |
| Centroid attractor as absolute position | Replaced by translation-invariant hand shape deviation. |
| `alternation` cost (current form) | Current "same-finger bad" logic is often wrong. See section 3.5. |

### 3.4 Deferred Systems (Post-V1)

| System | Why Deferred |
|--------|-------------|
| Passage-level optimization | Requires empirical calibration. |
| Soft zones / context-sensitive zones | V1 uses hard zones; later versions may allow exceptions. |
| Richer transition modeling | V1 uses simplified Fitts's Law; empirical Push testing may refine it. |
| Fatigue modeling | Cumulative fatigue requires sustained-play validation. |
| Role-aware difficulty weighting | Needs musical evidence before reintroduction. |
| Cross-hand intentional use | V1 enforces zones; later may allow deliberate cross-hand. |
| Alternation as LR drumming pattern reward | Needs careful design; deferred from V1. |

### 3.5 Alternation — Corrected Understanding

The current `alternation` cost penalizes same-finger rapid repetition. The user's actual intent:

- Same-finger rapid repetition is often natural (e.g., all-index hi-hat).
- The real concern is rewarding natural **left-right hand alternation** in drumming patterns.
- Repeated large hand reconfiguration (many fingers moving far) between events is the actual problem.

For V1, the alternation cost should be **removed** from the active objective. It will be placed in the backlog as a candidate for redesign once real Push performance data is available to validate the correct formulation.

---

## 4. Proposed Unified Cost Schema

### 4.1 Hard Constraint Check (per-event)

```typescript
interface FeasibilityCheck {
  feasible: boolean;
  violations: ConstraintViolation[];
}

interface ConstraintViolation {
  rule: 'span' | 'topology' | 'thumbDelta' | 'speed' | 'collision' | 'zone' | 'unmapped';
  message: string;
  fingerA?: FingerType;
  fingerB?: FingerType;
  actual?: number;
  limit?: number;
}
```

If `feasible === false`, the grip is rejected outright. No penalty number is applied.

### 4.2 Event Cost (per-event, per-assignment)

```typescript
interface EventCost {
  /** Per-finger preference cost (index/middle = 0, ring/pinky/thumb > 0). */
  fingerPreference: number;
  /** Distance of current grip shape from natural hand shape (translation-invariant). */
  handShapeDeviation: number;
  /** Total event cost. */
  total: number;
}
```

### 4.3 Transition Cost (between consecutive events)

```typescript
interface TransitionCost {
  /** Fitts's Law: distance + speed penalty. */
  movementCost: number;
  /** Total transition cost. */
  total: number;
}
```

### 4.4 Performance Cost (aggregate)

```typescript
interface PerformanceCost {
  /** Mean event cost across all events. */
  meanEventCost: number;
  /** Mean transition cost across all transitions. */
  meanTransitionCost: number;
  /** Hand balance deviation from target. */
  handBalance: number;
  /** Count of infeasible events. */
  infeasibleEventCount: number;
  /** Total objective (for ranking). */
  total: number;
}
```

### 4.5 Diagnostic Output (per-solution)

```typescript
interface V1DiagnosticFactors {
  /** Average finger preference cost. */
  fingerPreference: number;
  /** Average hand shape deviation. */
  handShapeDeviation: number;
  /** Average transition / movement cost. */
  transitionCost: number;
  /** Hand balance deviation. */
  handBalance: number;
  /** Total. */
  total: number;
}
```

This replaces `DiagnosticFactors` (5-field), `ObjectiveComponents` (7-field), and `DifficultyBreakdown` (6-field) with a single unified schema.

### 4.6 Terminology Mapping

| Old Term | New V1 Term | Reason |
|----------|-------------|--------|
| `stretch` | `fingerPreference` | Was actually finger dominance cost, not anatomical stretch |
| `poseNaturalness` / `gripNaturalness` | `handShapeDeviation` | Measures deviation from natural hand shape, not overall "naturalness" |
| `poseAttractor` / `drift` | Removed (absorbed into `handShapeDeviation`) | Centroid attractor replaced by translation-invariant shape metric |
| `perFingerHome` / `fatigue` | Removed (absorbed into `handShapeDeviation`) | Per-finger home positions replaced by relative finger distance |
| `transition` / `transitionDifficulty` / `movement` | `transitionCost` | Consistent naming |
| `constraintPenalty` / `crossover` | Removed | Hard constraints produce rejections, not penalties |
| `alternation` / `bounce` | Removed from V1 | Current formulation is incorrect; needs redesign |

---

## 5. Required Code Changes

### 5.1 Remove Tier System from Feasibility

**Files:** `src/engine/prior/feasibility.ts`

**What changes:**
- Remove `generateValidGripsWithTier()` or simplify it to only generate Tier 1 (strict) grips.
- Remove `createFallbackGrip()` entirely.
- `generateValidGrips()` should return valid strict grips or an empty array. An empty array means the event is infeasible.
- Remove `ConstraintTier` type (or reduce to a boolean feasible/infeasible).
- Remove `GripResult.isFallback` and `GripResult.tier` fields.

**Why:** Constraints should be binary. If no valid grip exists, the layout is infeasible for that event.

**Expected impact:** The solver can no longer produce solutions with physically impossible grips. Layouts that require extreme stretches will be flagged as infeasible rather than silently degraded.

**Risk:** Some layouts that currently "work" (with fallback grips) will now be reported as infeasible. This is correct behavior — the user should be told to simplify the layout.

**Migration:** `GripResult` consumers need updating. Beam solver expansion must handle empty grip results by marking the event infeasible.

### 5.2 Enforce Zones as Hard Constraints

**Files:** `src/engine/surface/handZone.ts`, `src/engine/solvers/beamSolver.ts`

**What changes:**
- `zoneViolationScore()` becomes `isZoneValid()` returning boolean.
- Zone check: left hand cannot play columns 5–7, right hand cannot play columns 0–2. Columns 3–4 are valid for either hand.
- Add zone check to grip generation or beam expansion — reject grips where hand is in the wrong zone.

**Why:** User wants zones as hard constraints in V1. Soft penalties add complexity without clear benefit.

**Expected impact:** Solver will never assign left hand to right-only columns or vice versa.

**Risk:** Layouts where a sound is placed in a zone reachable only by the "wrong" hand will be flagged as infeasible. This is intended — the user should move the sound.

### 5.3 Remove Lookahead Bonus

**Files:** `src/engine/solvers/beamSolver.ts`

**What changes:**
- Remove `computeLookaheadBonus()` function.
- Remove `averagePadCentroid()` helper.
- Remove the lookahead subtraction from beam step cost (line 379).
- Remove the `nextGroup` parameter from `expandNodeForGroup`.

**Why:** Speculative heuristic. More movement is not always worse, and proximity to the next group is not always better.

**Expected impact:** Beam search will rank purely on immediate event cost. May produce slightly different (not necessarily worse) solutions.

**Risk:** Low. The lookahead bonus was capped at 20% of step cost.

### 5.4 Remove Passage Difficulty Scoring from Active Path

**Files:** `src/engine/evaluation/passageDifficulty.ts`, `src/engine/evaluation/difficultyScoring.ts`

**What changes:**
- These files remain in the codebase but are not called from the solver or primary evaluation pipeline.
- Remove any imports of passage difficulty from the canonical evaluator or beam solver.
- Mark these modules as `@deprecated` or move to an `analysis/` namespace for optional post-hoc use.

**Why:** Passage-level scoring adds a second evaluation layer that is not needed for V1 solver ranking.

**Expected impact:** Solver objective is purely event-level. Post-hoc passage analysis can still be used by UI for display.

**Risk:** UI components that display passage difficulty will need to explicitly opt-in.

### 5.5 Unify Objective Types

**Files:** `src/engine/evaluation/objective.ts`, `src/types/diagnostics.ts`

**What changes:**
- Remove `ObjectiveComponents` interface (7-term legacy).
- Remove `LegacyObjectiveComponents` type alias.
- Remove `ObjectiveResult` interface.
- Remove `createZeroComponents()` and `combineComponents()`.
- Remove all `objectiveTo*` and `performabilityTo*` conversion functions.
- Replace `PerformabilityObjective` with the V1 unified schema (section 4).
- Update `DiagnosticFactors` to match the V1 schema.

**Why:** Three overlapping objective schemas create confusion and require fragile conversion logic.

**Expected impact:** One objective type used everywhere.

**Risk:** Extensive refactor touching many consumers. Should be done incrementally — first add new types, then migrate consumers, then remove old types.

### 5.6 Simplify Pose Cost (Translation-Invariant Hand Shape)

**Files:** `src/engine/evaluation/costFunction.ts`, `src/engine/prior/handPose.ts`

**What changes:**
- Replace `calculatePoseNaturalness()` with a new `calculateHandShapeDeviation()` function.
- The new function computes the deviation of the current finger spread from the natural hand shape, **independent of absolute position on the grid**.
- Specifically: compute pairwise distances between fingers in the current grip and compare to the natural hand shape's pairwise distances. The cost is the sum of squared differences.
- Remove `calculateAttractorCost()` (centroid attractor toward fixed position).
- Remove `calculatePerFingerHomeCost()` (per-finger fixed home positions).
- Keep `calculateFingerDominanceCost()` as a separate cost term (`fingerPreference`).

**Why:** The user's intent is that the natural hand pose defines the relationship between fingers, not a fixed grid location. A hand shape that matches the natural pose should score equally well whether it's at row 2 or row 5.

**Expected impact:** Removes the bias toward the default resting position. Hands will be scored on shape quality, not proximity to a fixed location.

**Risk:** The current attractor provides a useful "return to center" bias that prevents hands from drifting to grid edges. Without it, the solver may produce solutions where hands wander unnecessarily. The hand shape deviation partially addresses this (natural hand shapes don't work well at extreme positions), and zone constraints provide additional boundary enforcement. Monitor in testing.

### 5.7 Simplify Transition Cost

**Files:** `src/engine/evaluation/costFunction.ts`

**What changes:**
- Keep the existing Fitts's Law formulation: `distance + speed × SPEED_COST_WEIGHT`.
- Keep the `speed > MAX_HAND_SPEED → Infinity` hard constraint.
- Verify that transition costs are not compounded in a misleading way. The beam solver sums step costs; for V1 this is acceptable but should be normalized when computing diagnostic averages.
- Remove the `effectiveTransitionCost = 0` fallback for Infinity transitions (this becomes a hard constraint rejection instead).

**Why:** The transition cost formula is reasonable. The problem was the fallback path allowing impossible transitions, not the formula itself.

**Expected impact:** Transitions that exceed `MAX_HAND_SPEED` are now hard rejections.

**Risk:** Low. The formula is unchanged; only the handling of impossible transitions changes.

### 5.8 Remove Alternation Cost from V1 Objective

**Files:** `src/engine/evaluation/costFunction.ts`, `src/engine/solvers/beamSolver.ts`

**What changes:**
- Remove `calculateAlternationCost()` from the beam score computation.
- Remove `ALTERNATION_BEAM_WEIGHT` from the beam step cost.
- Keep the function in the codebase for potential future use.

**Why:** Current formulation ("same finger bad") is often wrong. Natural drumming often uses same-finger repetition. The intended behavior (rewarding LR hand alternation) requires a different formulation.

**Expected impact:** Solver will no longer penalize same-finger repetition. May produce solutions with more same-finger use, which is often correct.

**Risk:** Some rapid patterns where finger alternation was genuinely needed may become slightly less optimal. This is acceptable for V1 — the current penalty was causing more harm than good.

### 5.9 Evaluate Hand Balance Retention

**Files:** `src/engine/evaluation/costFunction.ts`

**What changes:**
- Keep `calculateHandBalanceCost()` in V1 but evaluate whether it's still needed given hard zone constraints.
- With zones enforced as hard constraints, hand balance partially emerges from the layout itself — sounds in left columns go to left hand, sounds in right columns go to right hand.
- If the layout has roughly equal sounds in each zone, hand balance is automatic.
- Retain the quadratic penalty with the current parameters (`HAND_BALANCE_TARGET_LEFT = 0.45`, `HAND_BALANCE_WEIGHT = 2.0`) but flag it as a candidate for removal if zone enforcement proves sufficient.

**Why:** The user wants near 50/50 hand usage but believes it should emerge from finger reasoning, not a separate abstract term. Hard zones make it more likely to emerge naturally.

**Expected impact:** Minimal change. The cost remains but may become redundant.

**Risk:** Low. Keeping it is conservative.

### 5.10 Treat Crossover as Hard Constraint

**Files:** `src/engine/prior/feasibility.ts`

**What changes:**
- Finger ordering violations (crossover) are already hard constraints in Tier 1 and Tier 2 via `satisfiesLeftHandTopology` / `satisfiesRightHandTopology`.
- With Tier 3 removal, crossover is universally a hard constraint.
- Remove the legacy `crossover` cost label from `DifficultyBreakdown`.
- Crossover violations should produce `ConstraintViolation` with `rule: 'topology'`.

**Why:** Crossover is a physical impossibility for natural drumming, not a soft preference.

**Expected impact:** Already the case for Tier 1/2. Tier 3 removal makes it universal.

### 5.11 Rename Misleading Fields

**What changes (terminology cleanup):**

| Location | Old | New |
|----------|-----|-----|
| `costFunction.ts` | `calculateFingerDominanceCost` | `calculateFingerPreferenceCost` |
| `costFunction.ts` | `FINGER_DOMINANCE_COST` | `FINGER_PREFERENCE_COST` |
| `biomechanicalModel.ts` | `fingerDominanceCost` (in `HandModel`) | `fingerPreferenceCost` |
| `objective.ts` | `stretch` (in `ObjectiveComponents`) | Removed (was actually finger dominance) |
| `diagnostics.ts` | `gripNaturalness` (in `DiagnosticFactors`) | `handShapeDeviation` |
| `diagnostics.ts` | `GripNaturalnessDetail` | Removed (replaced by unified shape metric) |
| All DifficultyBreakdown consumers | `movement`, `stretch`, `drift`, `bounce`, `fatigue`, `crossover` | Removed entirely |

**Why:** Names should describe what the code actually computes.

### 5.12 Infeasible Layout Diagnostics

**Files:** `src/types/diagnostics.ts`, `src/engine/evaluation/canonicalEvaluator.ts`

**What changes:**
- When the solver finds no valid grip for an event, report which sounds/notes caused the infeasibility.
- Aggregate infeasible events by sound/voice ID to help the user identify which sounds to simplify, mute, or relocate.
- The `FeasibilityVerdict` type already supports reasons; extend it with per-sound violation counts:

```typescript
interface InfeasibilityDiagnostic {
  soundId: string;
  violationCount: number;
  mostCommonViolation: ConstraintViolation;
}
```

**Why:** When no valid solution exists, the user needs actionable guidance about what to change.

**Expected impact:** Users can identify problematic sounds instead of seeing a generic "infeasible" message.

### 5.13 Remove Emergency Fallback from Beam Solver

**File:** `src/engine/solvers/beamSolver.ts` (lines 1237–1310)

**What changes:**
- Remove the "emergency fallback" code path that constructs ad-hoc finger assignments when no valid candidates are found.
- When the beam search produces no valid candidates for an event, mark the event as infeasible in the output rather than inventing a fake assignment.

**Why:** Fake assignments mask real infeasibility problems. The user should know when a layout can't be played.

**Risk:** Some solver runs that currently produce (bad) results will now report infeasibility. This is correct.

---

## 6. Validation Plan

### 6.1 Event-Level Feasibility Validation

| Scenario | Expected Result |
|----------|-----------------|
| Single note, comfortable position | Feasible, low cost |
| Single note, extreme grid corner | Feasible (within zone), moderate cost from finger preference |
| Two-note chord, adjacent pads | Feasible, low hand shape deviation |
| Two-note chord, span = 6 grid units | Infeasible (exceeds strict span limits for most finger pairs) |
| Three-note chord, natural spread | Feasible if within strict limits |
| Five-note chord, full hand spread | Feasible only if within all pairwise strict limits |
| Note on pad with no layout mapping | Infeasible (`unmapped` violation) |

### 6.2 Zone Enforcement

| Scenario | Expected Result |
|----------|-----------------|
| Left hand, pad at column 2 | Valid |
| Left hand, pad at column 3 | Valid (shared zone) |
| Left hand, pad at column 5 | Rejected (`zone` violation) |
| Right hand, pad at column 4 | Valid (shared zone) |
| Right hand, pad at column 1 | Rejected (`zone` violation) |

### 6.3 Crossover Rejection

| Scenario | Expected Result |
|----------|-----------------|
| Right hand, index at col 3, middle at col 4 | Valid (index left of middle) |
| Right hand, index at col 5, middle at col 3 | Rejected (`topology` violation) |
| Left hand, index at col 4, middle at col 3 | Valid (index right of middle for left hand) |

### 6.4 Collision Detection

| Scenario | Expected Result |
|----------|-----------------|
| Two fingers assigned to same pad | Rejected (`collision` violation) |
| Two fingers assigned to adjacent pads | Valid |

### 6.5 Transition Validation

| Scenario | Expected Result |
|----------|-----------------|
| Hand moves 2 grid units in 0.5s | Valid, moderate transition cost |
| Hand moves 1 grid unit in 0.5s | Valid, low transition cost |
| Hand moves 10 grid units in 0.1s | Rejected (speed > MAX_HAND_SPEED) |
| Hand stays in same position | Zero transition cost |
| Sequential events, same pad | Zero transition, valid |

### 6.6 Hand Shape Deviation

| Scenario | Expected Result |
|----------|-----------------|
| Grip matches natural hand shape exactly (any position) | Zero hand shape deviation |
| Same grip shape at row 2 vs row 5 | Same hand shape deviation (translation-invariant) |
| Grip with index-middle spread wider than natural | Positive deviation proportional to stretch difference |
| Grip with pinky tucked in relative to natural pose | Positive deviation |

### 6.7 Repeated-Note Patterns

| Scenario | Expected Result |
|----------|-----------------|
| All-index rapid eighth notes on one pad | Valid, low cost (same-finger repetition is not penalized) |
| Alternating index/middle on one pad | Valid, comparable cost to all-index |
| Rapid hi-hat pattern, one hand | Valid, finger preference cost reflects finger choice |

### 6.8 No Invalid Solutions

| Scenario | Expected Result |
|----------|-----------------|
| Layout with physically impossible chord | No solution returned; infeasible diagnostic with per-sound violation info |
| Layout with one reachable but extreme event | Solution returned only if all events pass hard constraints |
| All events feasible | Solution returned with cost breakdown |

### 6.9 Cost Normalization

| Scenario | Expected Result |
|----------|-----------------|
| 20-event performance | `meanEventCost` and `meanTransitionCost` are averages, not sums |
| 200-event performance, same pattern repeated | Similar `meanEventCost` as the 20-event case |

---

## 7. Open Implementation Questions

### 7.1 Hand Shape Deviation Formula

The proposed translation-invariant hand shape deviation compares pairwise finger distances. The specific formula needs validation:

- Should it compare only distances between adjacent fingers, or all pairs?
- Should it weight certain finger pairs more (e.g., index-middle spread matters more than thumb-pinky)?
- Should it use absolute distance difference or squared difference?

**Recommendation:** Start with sum of squared differences for all finger pairs present in the grip. Calibrate by testing with known comfortable and uncomfortable hand shapes on the Push 3.

### 7.2 Hand Balance Necessity

With hard zone constraints, does the explicit hand balance term still provide value? Test by:

1. Running the solver on a balanced layout (equal sounds in each zone) with and without hand balance cost.
2. If the results are similar, remove the cost.
3. If removing it causes extreme imbalance on shared-zone sounds (columns 3–4), keep it.

### 7.3 Beam Solver Infeasibility Propagation

When a single event in a sequence is infeasible, should the solver:

(a) Abort the entire solve and return an infeasible verdict?
(b) Skip the infeasible event, continue solving remaining events, and report the infeasible event in diagnostics?

**Recommendation:** Option (b) — continue solving. The user needs to know which specific events are problematic. Aborting early loses information.

### 7.4 Shared Zone Assignment Strategy

For sounds in columns 3–4, how should the solver decide hand assignment?

- Currently: beam search explores both hands.
- With hard zones: both hands are valid for columns 3–4, so beam search should continue exploring both.
- The hand balance cost (if retained) would bias toward the underutilized hand.

No change needed — current behavior is correct for shared zone pads.
