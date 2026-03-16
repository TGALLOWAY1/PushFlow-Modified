# PushFlow Cost Model — Decision Record

This document records the design decisions made for the V1 cost model refactor. Each decision is authoritative for implementation work unless explicitly superseded by a later decision.

---

## D-01: Remove Tiered Feasibility Penalties

**Decision:** Remove the Tier 1 / Tier 2 / Tier 3 feasibility system. Replace with binary hard constraint evaluation: a grip is either feasible (passes all strict constraints) or infeasible (rejected outright).

**Status:** Accepted

**Why:** The tiered system conflates hard constraints with soft costs. Tier 2 (relaxed) applies a `RELAXED_GRIP_PENALTY` of 200 to grips that exceed strict limits by up to 15%. Tier 3 (fallback) applies `FALLBACK_GRIP_PENALTY` of 1000 to grips that ignore all constraints. This means the solver can return solutions with physically impossible finger configurations, masked by a penalty number. The penalty values (200, 1000) are arbitrary and not grounded in any ergonomic measurement. A constraint is either physically possible or it isn't.

**Codebase impact:**
- `src/engine/prior/feasibility.ts`: Remove `createFallbackGrip()`. Simplify `generateValidGrips()` to only return strict-tier grips. Remove or reduce `ConstraintTier` type. Modify `generateValidGripsWithTier()` to return feasible grips only.
- `src/engine/prior/biomechanicalModel.ts`: `RELAXED_GRIP_PENALTY` and `FALLBACK_GRIP_PENALTY` constants become unused. `FINGER_PAIR_MAX_SPAN_RELAXED`, `RELAXED_SPAN_MULTIPLIER`, `THUMB_DELTA_RELAXED` become unused.
- `src/engine/solvers/beamSolver.ts`: Remove fallback grip handling, emergency fallback path (lines 1237–1310), and the `isFallback` special case for Infinity transitions (line 306).
- `src/engine/evaluation/objective.ts`: Remove `constraintPenalty` from `PerformabilityObjective` — it becomes a hard constraint check, not a cost.
- `src/engine/evaluation/canonicalEvaluator.ts`: Update `tierToPenalty()` and related logic.
- `src/types/diagnostics.ts`: Remove `constraintPenalty` from `DiagnosticFactors`. Update `FeasibilityReason` — `fallback_grip` type may no longer occur.

---

## D-02: Treat Zones as Hard Constraints in V1

**Decision:** Hand zones are hard constraints. Left hand may only play columns 0–4. Right hand may only play columns 3–7. Columns 3–4 are shared (either hand valid).

**Status:** Accepted

**Why:** Soft zone penalties add complexity without clear V1 benefit. The penalty function `zoneViolationScore()` returns a distance-proportional value, but this distance has no meaningful interpretation in cost-space (1 column of zone violation is not calibrated relative to, say, finger preference cost). Hard zones are simple, predictable, and correct for the vast majority of Push 3 performances.

**Codebase impact:**
- `src/engine/surface/handZone.ts`: Replace `zoneViolationScore()` with `isZoneValid(pad, hand) → boolean`. Remove penalty computation.
- `src/engine/solvers/beamSolver.ts`: Add zone check in `expandNodeForGroup()` before grip generation — skip hand if any pad in the group violates the hand's zone.
- `src/engine/debug/types.ts`: Remove `zoneViolation` cost fields from debug types.
- `src/engine/debug/irrationalDetector.ts`: Update cross-hand detection to reflect hard zone enforcement.

---

## D-03: Remove Fallback from Normal Optimization

**Decision:** When the solver cannot find a valid grip for an event, it reports the event as infeasible rather than generating a fallback grip. No fake assignments are produced.

**Status:** Accepted

**Why:** Fallback grips violate hard biomechanical constraints and produce misleading results. The user sees a "solution" with a high cost but no clear indication that the result is physically unachievable. When no valid solution exists, the correct behavior is to tell the user which events and sounds are problematic so they can simplify the layout.

**Codebase impact:**
- `src/engine/solvers/beamSolver.ts`: Remove emergency fallback (lines 1237–1310). When beam expansion produces no valid children for an event, mark it infeasible in the output.
- `src/engine/evaluation/canonicalEvaluator.ts`: Update `validateAssignment()` to reject assignments containing infeasible events.
- `src/types/diagnostics.ts`: Extend `FeasibilityReason` with per-sound violation diagnostics.

---

## D-04: Unify Objective and Diagnostics

**Decision:** Replace the three overlapping schemas (`PerformabilityObjective`, `ObjectiveComponents`, `DiagnosticFactors`) with a single V1 cost schema used by the solver, diagnostics, and UI.

**Status:** Accepted

**Why:** Three schemas with conversion functions between them create confusion, fragile mapping logic, and fake sub-breakdowns when actual data is unavailable. The `performabilityToDifficultyBreakdown()` function invents values like `stretch: pose * 0.2` when no real breakdown exists. A single schema eliminates all conversion logic.

**Codebase impact:**
- `src/engine/evaluation/objective.ts`: Remove `ObjectiveComponents`, `LegacyObjectiveComponents`, `ObjectiveResult`, all `objectiveTo*` and `performabilityTo*` conversion functions. Replace `PerformabilityObjective` with the V1 unified cost type.
- `src/types/diagnostics.ts`: Update `DiagnosticFactors` to match V1 schema fields: `fingerPreference`, `handShapeDeviation`, `transitionCost`, `handBalance`, `total`. Remove `gripNaturalness`, `constraintPenalty`, `GripNaturalnessDetail`.
- `src/types/executionPlan.ts`: Remove legacy `DifficultyBreakdown` type with `movement/stretch/drift/bounce/fatigue/crossover` fields.
- All UI components consuming diagnostics: update to use unified field names.

---

## D-05: Simplify Pose Modeling (Translation-Invariant Hand Shape)

**Decision:** Replace the centroid attractor + per-finger home cost with a single translation-invariant hand shape deviation metric. The cost measures how much the current finger spread deviates from the natural hand shape, regardless of absolute position on the grid.

**Status:** Accepted

**Why:** The user's intent is that the natural hand pose defines the relationship between fingers, not a fixed grid location. The current attractor cost (`calculateAttractorCost`) pulls the hand centroid toward a fixed resting position, penalizing valid hand positions far from the default. The per-finger home cost (`calculatePerFingerHomeCost`) assigns each finger a fixed "home pad," which contradicts the idea that the hand shape can translate vertically. The new metric compares pairwise finger distances in the current grip against the natural hand shape, independent of position.

**Codebase impact:**
- `src/engine/evaluation/costFunction.ts`: Remove `calculatePoseNaturalness()`, `calculateAttractorCost()`, `calculatePerFingerHomeCost()`. Add `calculateHandShapeDeviation(grip, naturalHandShape) → number`.
- `src/engine/prior/handPose.ts`: Simplify. `DEFAULT_HAND_POSE` and `NeutralPadPositions` remain as the definition of the natural hand shape, but are used only for pairwise distance references, not as absolute attractor positions. `RestingPose` and `restingPoseFromNeutralPadPositions()` may become unnecessary if the attractor concept is removed.
- `src/engine/solvers/beamSolver.ts`: Update pose cost computation to use `calculateHandShapeDeviation()`.
- `src/engine/evaluation/canonicalEvaluator.ts`: Update event evaluation to use new pose cost.

---

## D-06: Simplify Transition Cost

**Decision:** Keep the existing Fitts's Law formulation (`distance + speed × SPEED_COST_WEIGHT`). Remove the fallback path that allowed Infinity transitions for fallback grips. Speed exceeding `MAX_HAND_SPEED` is a hard constraint rejection, not a special case.

**Status:** Accepted

**Why:** The Fitts's Law formulation is reasonable and well-understood. The problem was not the formula but the fallback path that set `effectiveTransitionCost = 0` for impossible transitions on fallback grips. With fallback grips removed (D-01, D-03), this special case is eliminated.

**Codebase impact:**
- `src/engine/solvers/beamSolver.ts`: Remove `effectiveTransitionCost = transitionCost === Infinity ? 0 : transitionCost` (line 308). Infinity transitions cause event rejection.
- `src/engine/evaluation/costFunction.ts`: No change to `calculateTransitionCost()`.

---

## D-07: Remove Lookahead Bonus

**Decision:** Remove the 1-step lookahead bonus from beam search scoring.

**Status:** Accepted

**Why:** The lookahead bonus rewards grips that leave the hand close to the next event's pads. This encodes the assumption that less future movement is always better. The user observes that more movement can sometimes be more natural — a hand repositioning to a comfortable grip may be preferable to staying in a cramped position near the next pad. The bonus is speculative and its parameters (20% cap, 4.0 range) are not empirically calibrated.

**Codebase impact:**
- `src/engine/solvers/beamSolver.ts`: Remove `computeLookaheadBonus()`, `averagePadCentroid()`, the `nextGroup` parameter from `expandNodeForGroup()`, and the bonus subtraction from step cost (line 379).

---

## D-08: Remove Passage Scoring from Active Evaluation

**Decision:** Remove passage-level difficulty scoring from the active solver and evaluation path. Retain the modules for optional post-hoc analysis.

**Status:** Accepted

**Why:** Passage-level scoring adds a second evaluation layer with its own factor weights, difficulty classes, role-weighted scoring, and tradeoff profiles. This complexity is not needed for V1 solver ranking, which operates event-by-event. The passage scorer can remain available for UI display as a separate analysis step, but should not influence solver decisions.

**Codebase impact:**
- `src/engine/evaluation/passageDifficulty.ts`: No code change, but remove imports from solver/evaluator paths. Mark as optional analysis.
- `src/engine/evaluation/difficultyScoring.ts`: Same — decouple from primary evaluation. The `TradeoffProfile`, `DifficultyClass`, `ROLE_WEIGHTS` systems remain but are not used by the solver.
- `src/types/candidateSolution.ts`: `TradeoffProfile` remains but is not computed by default.

---

## D-09: Treat Crossover as Hard Constraint

**Decision:** Finger ordering violations (crossover) are universally hard constraint rejections. No grip with crossed fingers is ever returned as valid.

**Status:** Accepted

**Why:** Finger crossover (e.g., index crossing over middle in horizontal position) is anatomically unnatural for pad drumming. The current code already rejects crossover in Tier 1 and Tier 2 grips via topology checks. With Tier 3 removal (D-01), crossover is universally rejected. The legacy `crossover` cost label in `DifficultyBreakdown` was misleading — it mapped to `constraintPenalty`, which could be any constraint violation, not specifically crossover.

**Codebase impact:**
- Already addressed by D-01 (Tier 3 removal). No additional code changes needed.
- `src/types/executionPlan.ts`: Remove `crossover` field from `DifficultyBreakdown` (removed entirely by D-04).

---

## D-10: Fix Stretch Terminology

**Decision:** Rename `stretch` to `fingerPreference`. The current `stretch` field in `ObjectiveComponents` maps to `calculateFingerDominanceCost()`, which penalizes anatomically suboptimal fingers (thumb, pinky). This is a finger preference/dominance cost, not an anatomical stretch measurement.

**Status:** Accepted

**Why:** The name `stretch` implies inter-finger distance strain. The implementation measures which fingers are used, not how far apart they are. The mismatch is confusing and has been flagged in the cost model comparison as a critical naming issue. The new name `fingerPreference` accurately describes the computation: preferred fingers (index, middle) cost 0; suboptimal fingers (ring, pinky, thumb) cost more.

**Codebase impact:**
- `src/engine/evaluation/costFunction.ts`: Rename `calculateFingerDominanceCost` → `calculateFingerPreferenceCost`. Rename `FINGER_DOMINANCE_COST` → `FINGER_PREFERENCE_COST`.
- `src/engine/prior/biomechanicalModel.ts`: Rename `fingerDominanceCost` field in `HandModel` → `fingerPreferenceCost`. Rename exported constant.
- All consumers of these functions/constants.

---

## D-11: Revisit Passage-Level Optimization Later

**Decision:** Passage-level optimization (where the solver considers sequences of events jointly rather than greedily) is deferred to post-V1. See backlog item B-02.

**Status:** Deferred

**Why:** Event-local beam search is sufficient for V1. Passage-level optimization is a fundamentally different approach that requires benchmarking against the event-local baseline to justify its complexity. Without empirical evidence that event-local optimization produces poor solutions, adding passage-level optimization is speculative.

**Codebase impact:** None for V1.

---

## D-12: Reconsider Advanced Transition Modeling Later

**Decision:** Advanced transition modeling (direction-aware costs, momentum effects, grip-shape-aware transitions) is deferred to post-V1. See backlog item B-03.

**Status:** Deferred

**Why:** The simplified Fitts's Law model is a reasonable starting point. Advanced modeling requires empirical data from real Push 3 performances to calibrate. Adding complexity without calibration data risks making the model less accurate, not more.

**Codebase impact:** None for V1.

---

## D-13: Keep Only Costs + Hard Constraints for V1

**Decision:** The V1 evaluation model consists of exactly two categories: **hard constraints** (binary pass/fail per event) and **costs** (numeric scores for ranking assignments). There are no intermediate categories (penalties, degraded tiers, soft constraints in the solver path).

**Status:** Accepted

**Why:** The current system blurs constraints and costs through tiered penalties, soft zone violations, and fallback grips. This creates ambiguity about what the solver is allowed to produce. The binary model is simple: if it passes all hard constraints, it's a valid candidate. Among valid candidates, the one with the lowest cost wins.

**Codebase impact:** Addressed by D-01 (remove tiers), D-02 (hard zones), D-03 (remove fallback), D-09 (hard crossover). This decision is a meta-principle that governs all others.

---

## D-14: Determine Whether Explicit Hand Balance Remains Needed

**Decision:** Retain the hand balance cost in V1 but flag it for empirical evaluation. If hard zone enforcement (D-02) naturally produces balanced hand use, remove it.

**Status:** Accepted (conditional)

**Why:** The user wants near 50/50 hand usage but believes it should emerge from finger reasoning and zone constraints, not a separate abstract term. With hard zones, sounds in left columns go to left hand and sounds in right columns go to right hand. For balanced layouts, hand balance is automatic. The explicit term may only matter for layouts with many shared-zone sounds (columns 3–4) or unbalanced sound placement. The current formulation (`HAND_BALANCE_TARGET_LEFT = 0.45`, targeting 55% right) is reasonable. Keeping it is conservative and low-risk.

**Codebase impact:**
- No immediate change. The `calculateHandBalanceCost()` function and its beam weight remain.
- After V1 implementation: run solver on 10+ diverse layouts with and without hand balance cost. If results are similar, remove the cost in a follow-up.

---

## D-15: Reinterpret Alternation Based on Natural Drumming Motion

**Decision:** Remove the current alternation cost from the V1 objective. The current formulation ("same-finger repetition is bad") is incorrect for many common drumming patterns. A redesigned formulation based on natural left-right hand alternation is deferred to post-V1. See backlog item B-07.

**Status:** Accepted (remove now) / Deferred (redesign later)

**Why:** Same-finger rapid repetition is often the most natural way to play a pattern on Push 3. A hi-hat pattern on a single pad is commonly played all-index or all-middle with one hand. The current penalty discourages this and pushes the solver toward unnatural finger switching. The original intent — rewarding natural LR hand alternation in drumming — requires a fundamentally different formulation that operates at the hand level, not the finger level, and considers tempo and pattern context.

**Codebase impact:**
- `src/engine/solvers/beamSolver.ts`: Remove `alternationCost * ALTERNATION_BEAM_WEIGHT` from step cost.
- `src/engine/evaluation/costFunction.ts`: Keep `calculateAlternationCost()` in the codebase but do not call it from the solver. It may be useful for post-hoc analysis or future redesign.
- V1 cost schema: Remove `alternation` field.

---

## D-16: Remove Learnability and Robustness Scoring

**Decision:** Remove `learnability` and `robustness` from the `TradeoffProfile` and active evaluation.

**Status:** Accepted

**Why:** `learnability` is defined as `1 - min(uniquePads / 20, 1)` — a proxy based on pad count that doesn't reflect actual learning difficulty. `robustness` is `1 - variance(passageScores) × 4` — a variance metric that assumes uniformity is always better. Neither is grounded in empirical measurement. They add noise to candidate comparison without providing actionable insight.

**Codebase impact:**
- `src/engine/evaluation/difficultyScoring.ts`: Remove `learnability` and `robustness` computation from `TradeoffProfile` (deferred, since passage scoring is already removed from active path by D-08).
- `src/types/candidateSolution.ts`: Remove fields from `TradeoffProfile` interface if it is simplified for V1.

---

## D-17: Remove Role-Weighted Scoring

**Decision:** Remove role-weighted difficulty scoring from the active model. The behavior intended by role weighting (backbone sounds should be easy to play) should emerge from layout optimization — placing important sounds on ergonomically favorable pads — not from adjusting difficulty scores after the fact.

**Status:** Accepted

**Why:** Role-weighted scoring multiplies passage difficulty by a role importance factor (backbone × 1.5, accent × 0.6). This is a musical judgment applied to physical difficulty, which creates a confusing cost signal: the same physical difficulty gets different scores depending on what sound is being played. If a backbone sound is hard to play, the solution is to move it to an easier pad, not to inflate its difficulty score.

**Codebase impact:**
- `src/engine/evaluation/difficultyScoring.ts`: Remove `ROLE_WEIGHTS` and `roleWeightedScore()`. Already deferred from active path by D-08.

---

## D-18: Unify Grip Naturalness and Pose Naturalness

**Decision:** Replace both `gripNaturalness` and `poseNaturalness` with a single term: `handShapeDeviation`. This measures how much the current finger spread deviates from the natural hand shape, computed as pairwise finger distance comparison.

**Status:** Accepted

**Why:** The terms `gripNaturalness` (diagnostics) and `poseNaturalness` (objective) refer to the same concept but use different names. The underlying computation (attractor + per-finger home + finger dominance) is a weighted mix that is hard to interpret. The new `handShapeDeviation` is a single, clear concept: how different is this grip from your natural hand shape? It replaces three sub-components with one translation-invariant metric.

**Codebase impact:** Addressed by D-05.

---

## D-19: Finger Ordering Is Per-Event, Not Global

**Decision:** Finger ordering constraints (topology checks) are evaluated per-event using only the fingers active in that event. Historical finger positions from prior events do not influence the current event's feasibility check.

**Status:** Accepted

**Why:** The beam solver's grip generation already operates this way — `generateValidGripsWithTier()` considers only the pads in the current group. However, the `isValidFingerOrder()` function in feasibility.ts accepts a full `HandState` including historical positions, which could propagate stale position data. The decision clarifies that per-event constraints should use per-event state only.

**Codebase impact:**
- `src/engine/prior/feasibility.ts`: Audit `isValidFingerOrder()` call sites. Ensure it is only called with current-event finger positions, not accumulated `HandState` from prior events.
- No expected behavioral change in the beam solver (already per-event), but clarifies the invariant for other code paths.

---

## D-20: Natural Hand Pose Defines Finger Relationships, Not Fixed Positions

**Decision:** The natural hand pose defines the relative distances between fingers (the hand shape), not fixed pad assignments. The pose can translate vertically and horizontally on the grid without penalty. Only deviation from the natural finger spread is penalized.

**Status:** Accepted

**Why:** The user explicitly stated: "natural pose is the relationship between fingers; it can translate vertically; it is not a fixed pad assignment for each finger." The current `DEFAULT_HAND_POSE` assigns each finger to a specific MIDI note, which resolves to a specific grid position. This creates a fixed attractor that penalizes hands positioned far from the default, even if the hand shape is perfectly natural. The new model uses the default pose only to derive the natural pairwise finger distances.

**Codebase impact:** Addressed by D-05.
