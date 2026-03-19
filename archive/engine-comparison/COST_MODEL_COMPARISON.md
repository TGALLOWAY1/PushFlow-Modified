# COST_MODEL_COMPARISON

## Executive Verdict

Both versions suffer from cost-model semantic drift. V2 improved the internal beam-search objective, but both versions still present users and downstream tools with a legacy breakdown taxonomy that no longer matches what the solver actually optimizes. V3 must not inherit that confusion.

## Top-Level Score Composition

| Metric | V1 | V2 | Where computed | User-facing meaning matches implementation? | V3 recommendation |
| --- | --- | --- | --- | --- | --- |
| Internal beam objective | 7-term objective sum (`transition + stretch + poseAttractor + perFingerHome + alternation + handBalance + constraints`) (`../PushFlow/Version1/src/engine/objective.ts:12-63`) | 3-term primary performability objective (`poseNaturalness + transitionDifficulty + constraintPenalty`) plus weighted alternation/hand-balance in beam score (`../PushFlow/src/engine/evaluation/objective.ts:22-40`, `../PushFlow/src/engine/solvers/beamSolver.ts:310-345`) | Beam solver | V1: mostly yes internally. V2: yes internally. | Keep V2's simplified primary objective, but wire every downstream stage to the same scalar |
| Public `score` | `100 - 5*hardCount - 20*unplayableCount` (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:745-747`) | Same formula (`../PushFlow/src/engine/solvers/beamSolver.ts:768-769`) | Beam result builder | No. This is not the optimized cost. | Rename or remove. If retained, make it explicitly a quality grade separate from objective |
| `averageMetrics.total` | average of mapped legacy breakdown total | same | Beam result builder | No, because it is treated as if it were canonical optimization cost in annealing | Replace with `objectiveAverage` and keep diagnostics separate |

## Event Cost vs Note Cost vs Transition Cost

### V1

- Group-level cost is computed, then divided equally across notes in the group (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:311-343`, `:471-523`).
- Result artifacts therefore present per-note costs that are really equal shares of group decisions.

### V2

- Same sharing model (`../PushFlow/src/engine/solvers/beamSolver.ts:349-376`, `:548-559`).

### Assessment

- This is acceptable as a diagnostic approximation.
- It is not a true per-note objective decomposition.
- V3 should record both:
  - event-group decision cost
  - projected per-event share for UI/debug

## Movement Cost / Transition Cost

| Item | V1 definition | V2 definition | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| Movement / transition | `distance + speed * 0.5`, `Infinity` if speed > 12 (`../PushFlow/Version1/src/engine/costFunction.ts:25-37` and transition helpers later in file) | same core formula (`../PushFlow/src/engine/evaluation/costFunction.ts:229-240`) | cost function | Yes | Keep |
| Speed max | 12 units/s | 12 units/s (`../PushFlow/src/engine/prior/biomechanicalModel.ts:147-150`) | biomechanical constants | Yes | Keep as tunable |

## Stretch / Span / Static Cost

| Item | V1 | V2 | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| Stretch in displayed breakdown | `calculateGripStretchCost()` / stretch term in legacy objective | replaced internally by finger dominance and richer pose model, but still displayed as `stretch` through legacy mapping | V1 beam solver uses stretch directly; V2 maps diagnostic terms into legacy fields | No in V2: displayed "stretch" is not the actual primary solver term | Replace with explicit `fingerDominance` and `spanStrain` diagnostics |
| Strict/relaxed span model | single global max span 5.5 / 7.5 (`../PushFlow/Version1/src/engine/feasibility.ts:32-43`) | per-finger-pair strict spans + relaxed multiplier 1.15 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:96-125`) | feasibility | V2 is much better | Keep V2 |

## Drift Cost / Pose Attractor

| Item | V1 | V2 | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| Pose attractor | centroid distance from resting pose, weighted by stiffness | same sub-component inside `poseNaturalness` (`../PushFlow/src/engine/evaluation/costFunction.ts:181-187`) | cost function | Yes internally | Keep as explicit sub-component |
| Displayed `drift` | mapped from `poseAttractor` (`../PushFlow/Version1/src/engine/objective.ts:69-93`) | same legacy mapping (`../PushFlow/src/engine/evaluation/objective.ts:130-154`) | objective mapping | Sort of, but naming is legacy | Rename to `poseAttractor` in debug output |

## Bounce / Repetition / Alternation Cost

| Item | V1 | V2 | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| Alternation penalty | same-finger reuse on short dt, threshold 0.25s, penalty 1.5 (`../PushFlow/Version1/src/engine/costFunction.ts:49-63`, `:73-94`) | same (`../PushFlow/src/engine/evaluation/costFunction.ts:109-129`) | cost function | Yes | Keep |
| Displayed as `bounce` | yes | yes | objective mapping | No. "bounce" is a legacy label for alternation cost | Rename |
| Aggregated into totals? | No. `totalMetrics.bounce` never increments (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:696-701`, `:726-735`) | Still no (`../PushFlow/src/engine/solvers/beamSolver.ts:722-760`) | result builders | No | Fix immediately in V3 |

## Fatigue Cost

| Item | V1 | V2 | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| Fatigue field in breakdown | mapped from `perFingerHome`, not actual cumulative fatigue (`../PushFlow/Version1/src/engine/objective.ts:69-93`) | same (`../PushFlow/src/engine/evaluation/objective.ts:130-154`, `:176-199`) | objective mapping | No | Rename to `perFingerHome` or implement real fatigue |
| `fatigueMap` | zero-filled placeholder in beam result (`../PushFlow/Version1/src/engine/solvers/types.ts:151-158`, builder zeroes map in beam solver) | same (`../PushFlow/src/engine/solvers/beamSolver.ts:762-766`) | result builders | No | Either track true fatigue or remove placeholder |

## Crossover Cost / Constraint Penalty

| Item | V1 | V2 | Where | Match? | V3 |
| --- | --- | --- | --- | --- | --- |
| `constraints` objective term | fallback penalty only | relaxed/fallback penalties | beam solver and objective | Internally yes | Keep penalty concept |
| Displayed as `crossover` | yes (`../PushFlow/Version1/src/engine/objective.ts:69-93`) | yes (`../PushFlow/src/engine/evaluation/objective.ts:130-154`) | legacy mapping | No. This field is not actual crossover | Replace with `constraintPenalty` |

## Constraint Penalties

### V1

- fallback penalty only: 1000 (`../PushFlow/Version1/src/engine/costFunction.ts:39-44`)
- relaxed tier has no distinct penalty even though relaxed grips are materially different from strict grips

### V2

- relaxed penalty 200, fallback penalty 1000 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:187-195`)

### Assessment

- V2 is strictly better.

## Impossible / Unplayable Detection

### V1

- Unmapped notes become `assignedHand: 'Unplayable'` and increment `unplayableCount`; this is well-documented in tests (`../PushFlow/Version1/src/engine/__tests__/solver.policy.test.ts:10-27`).
- Fast transitions produce `Infinity` transition cost but may still be coerced through fallback/manual paths in some cases.

### V2

- Same broad pattern.
- Debug validator can explicitly surface impossible reach and speed issues after the fact (`../PushFlow/src/engine/debug/constraintValidator.ts:31-47`, `:57-99`, `:164-209`).

### Assessment

- V2 is easier to debug, but the core semantics remain partly legacy.

## Weighting Schemes

### V1

- All 7 objective terms are directly summed (`../PushFlow/Version1/src/engine/objective.ts:49-63`).

### V2

- Primary beam score uses:
  - `poseNaturalness`
  - `transitionDifficulty`
  - `constraintPenalty`
  - plus alternation and hand-balance beam weights in solver (`../PushFlow/src/engine/solvers/beamSolver.ts:321-325`, `:519-523`)
- `poseNaturalness = 0.4*attractor + 0.4*perFingerHome + 0.2*dominance` (`../PushFlow/src/engine/evaluation/costFunction.ts:79-103`)

### Assessment

- V2 weighting is conceptually cleaner.
- But downstream diagnostics still pretend the canonical model is the old 7-component model (`../PushFlow/src/types/executionPlan.ts:18-35`), which is false.

## Normalization / Scaling

### V1

- Very little explicit normalization.
- Public score is capped 0-100 but detached from internal cost.

### V2

- Adds normalized passage difficulty and candidate tradeoff metrics (`../PushFlow/src/engine/evaluation/passageDifficulty.ts`, `../PushFlow/src/engine/evaluation/difficultyScoring.ts:181-277`).

### Assessment

- V2 is better at surfacing normalized downstream summaries.
- V3 must ensure those summaries derive from a semantically coherent core objective.

## Aggregation Across Time

### V1

- Aggregates note-shared costs into totals and averages, but silently drops bounce and handBalance from totals (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:696-775`).

### V2

- Same aggregation bug persists (`../PushFlow/src/engine/solvers/beamSolver.ts:722-795`).

### Assessment

- This is a hard V3 fix requirement.

## Differences in Semantics Between "score", "difficulty", "complexity", and "cost"

### V1

- `score` means 100-based grade where higher is better
- internal objective means lower is better
- `difficulty` is an event label
- `CostBreakdown.total` is a legacy sum of internal terms

### V2

- same confusion, plus type comments now contradict runtime:
  - `ExecutionPlanResult.score` comment says "lower = better" (`../PushFlow/src/types/executionPlan.ts:137-139`)
  - implementation still returns the same 100-based higher-is-better score (`../PushFlow/src/engine/solvers/beamSolver.ts:768-769`)

### V3 recommendation

- Define four distinct concepts:
  - `objectiveCost`: lower is better, used by beam and annealing
  - `difficultyGrade`: user-facing categorical label
  - `qualityScore`: optional normalized 0-100 presentation layer, if needed
  - `diagnosticBreakdown`: explainable component vector

## Cost Model Risks

### Risk 1: annealing optimizes the wrong scalar

- V1 and V2 annealing both use `averageMetrics.total` as layout fitness.
- In V2 that scalar is no longer the true primary beam score.

### Risk 2: legacy field names actively mislead

- `bounce` is alternation
- `fatigue` is per-finger-home bias
- `crossover` is constraint penalty

### Risk 3: displayed totals omit real terms

- both versions drop bounce from totals
- both versions hardcode handBalance summary to zero

### Risk 4: backward-compat mapping invents fake sub-breakdowns

- `performabilityToDifficultyBreakdown()` proportionally redistributes `poseNaturalness` when diagnostic data is absent (`../PushFlow/src/engine/evaluation/objective.ts:189-199`)
- That is acceptable for temporary UI fallback, not as canonical engine truth

### Risk 5: public score can improve while objective worsens

- Since public score depends only on `hardCount` and `unplayableCount`, it can mask material cost regressions in movement, pose, or repetition.

## V3 Cost Direction

- Preserve V2's primary objective simplification.
- Preserve V2's explicit relaxed-vs-fallback penalties.
- Preserve V2's alternation and hand-balance contributions.
- Remove legacy names from canonical types.
- Make solver, annealing, candidate ranking, debug totals, and tests all agree on one scalar objective.

