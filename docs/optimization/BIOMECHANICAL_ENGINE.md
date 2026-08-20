# PushFlow Biomechanical Engine

## Purpose and scope

PushFlow's biomechanical engine answers a specific question: **given a Layout,
the time-ordered Performance Events, and a proposed pad-to-finger ownership map,
can a player execute the performance, and what makes that execution easier or
harder?** It does not judge a grid arrangement in isolation. It couples the
static geometry of each simultaneous grip to the movement required between
successive moments.

This document describes the active TypeScript implementation. It distinguishes
hard constraints from soft costs, explains the search and evaluation paths,
records the current constants and equations, and calls out important limitations
and compatibility seams. The workflow-facing authority remains the
[PushFlow Engine Contract](../canonical/PUSHFLOW_ENGINE_CONTRACT.md); this is the
implementation reference beneath that contract.

## Mental model

The engine uses five layers:

1. **Surface and identity resolution** maps each event's stable Sound identity
   to a Pad in the selected Layout.
2. **Moment construction** groups notes that start together. A moment can be a
   single hit or a chord.
3. **Grip feasibility** enumerates hand/finger assignments and rejects grips
   that violate strict anatomy rules.
4. **Temporal scoring** charges for grip quality, finger choice, hand movement,
   rapid repetition, and hand distribution.
5. **Search and reporting** chooses an Execution Plan and exposes totals,
   factor breakdowns, per-moment detail, per-transition detail, feasibility,
   and assignment metadata.

Lower finite cost is better. `Infinity` means a transition exceeds the physical
speed limit; an empty grip set means no strict grip exists for that hand and
moment. A low score is **not** evidence of feasibility by itself: callers must
also inspect the feasibility verdict, unmapped events, and unplayable events.

## Coordinate, hand, and finger conventions

- The Push surface is an 8×8 grid. `row` increases bottom-to-top and `col`
  increases left-to-right. Distances are Euclidean grid units:
  `sqrt((Δrow)^2 + (Δcol)^2)`.
- A hand is `left` or `right`; a finger is `thumb`, `index`, `middle`, `ring`,
  or `pinky`.
- Engine labels `L1…L5` and `R1…R5` number thumb through pinky. UI/domain IDs
  such as `L_THUMB` convert to these labels.
- A `HandPose` contains active finger coordinates plus their centroid. It is a
  momentary grip, not a persistent anatomical state.
- A `PadFingerAssignment` owns each occupied pad with one hand and finger. A
  finger may own several pads over the performance, but cannot press two
  different simultaneous pads.
- Sound identity is primary when resolving events. MIDI note is a provenance
  fallback, not a biomechanical placement rule.

## Hard constraints: pass or reject

Normal grip generation is **strict-only**. Historical `relaxed` and `fallback`
members remain in some public types for compatibility, but the solver does not
generate those grips. Hard rules are not supposed to be traded against a lower
soft cost.

### Constraint inventory

| Rule | Active behavior | Failure meaning |
| --- | --- | --- |
| Moment capacity | A hand grip must contain 1–5 active pads. | More than five simultaneous pads for one hand cannot be assigned. |
| Collision / uniqueness | Each active pad receives a distinct finger in generated permutations. | One finger cannot cover two pads in the same grip; two fingers cannot occupy one pad. |
| Pair span | Every active finger pair must be within its strict Euclidean limit. | The proposed spread is anatomically out of range. |
| Hand topology | Fingers must retain their expected left-to-right order for the selected hand; the thumb receives only the configured delta allowance. | A finger crossover or incompatible thumb placement is rejected. |
| Outward rotation | For adjacent non-thumb fingers in the **same column**, the outer finger may not be below the inner finger. | The grip would require outward forearm/hand rotation (supination). |
| Transition speed | Hand-centroid speed may not exceed 12 grid units/second. | Transition cost becomes `Infinity`. |
| Mapping and ownership | Every performed Sound must resolve to a pad and that pad must have a finger owner. | The event is unassigned/unplayable and the performance cannot be considered fully feasible. |
| Explicit assignments | Solver hard assignments must be satisfied exactly. | A conflicting candidate is invalid, rather than merely expensive. |

### Strict pair-span limits

Pair lookup is symmetric. Unlisted pairs use the 5.5-unit fallback limit.

| Finger pair | Maximum distance (grid units) |
| --- | ---: |
| pinky–ring | 1.5 |
| index–middle | 2.0 |
| middle–ring | 2.0 |
| index–ring | 2.0 |
| middle–pinky | 2.5 |
| index–thumb | 3.5 |
| index–pinky | 4.0 |
| middle–thumb | 4.5 |
| ring–thumb | 5.5 |
| pinky–thumb | 5.5 |

The model also publishes a 5.5-unit overall hand envelope, a 5.0-unit nominal
single-finger reach, and a 1.0-unit thumb delta. Not every public helper applies
all three values: CLP grip generation primarily applies the pair table,
topology, and outward-rotation rule, while reach helpers and legacy chord APIs
accept `EngineConstants`. See [Known seams and limitations](#known-seams-and-limitations).

### Hand topology

The canonical ordering array is:

```text
pinky → ring → middle → index → thumb
```

For a left hand this order progresses left-to-right. For a right hand it is
mirrored. The thumb gets a one-unit ordering allowance. The separate
outward-rotation check only applies to vertically aligned adjacent non-thumb
fingers; horizontal displacement is assumed to let the hand absorb the vertical
difference.

### Diagnostic rejection records

Grip generation can run with diagnostics enabled. A rejection records
`fingerA`, `fingerB`, the named rule, the measured value, and the allowed limit.
Named rules include `span`, `ordering`, `collision`, `thumbDelta`, `topology`,
`reachability`, `speed`, `zone`, and `outwardRotation`. The generator currently
emits detailed records primarily for span, topology/thumb, and outward rotation.

## Soft cost model

Soft costs rank candidates that have survived hard feasibility checks. All costs
are non-negative and lower is better.

### 1. Grip shape deviation (beam solver)

The beam solver compares each pairwise distance in the current grip with the
same pair's distance in the user's natural pose:

```text
handShapeDeviation = Σ_pairs (currentPairDistance - naturalPairDistance)²
```

This is translation-invariant: moving an unchanged hand shape across the grid
does not itself worsen shape deviation. If a natural reference pair is absent,
the current pair distance is squared as the penalty.

### 2. Finger preference

The active fingers contribute a simple anatomical preference cost:

| Finger | Cost per use |
| --- | ---: |
| index | 0 |
| middle | 0 |
| ring | 1 |
| pinky | 3 |
| thumb | 5 |

These are preferences, not prohibitions. A thumb or pinky can be selected when
the grip remains feasible and the overall plan warrants it.

### 3. Transition cost

For each hand present in consecutive moments, the engine calculates:

```text
centroidDistance = distance(previousCentroid, currentCentroid)
speed            = centroidDistance / Δt
centroidCost     = centroidDistance + 0.5 × speed

perFingerCost = average(shared-finger distances)
              + 0.8 × maximum(shared-finger distance)

transitionCost = centroidCost + perFingerCost
```

Only fingers active in both poses contribute to per-finger movement. If
`Δt <= 0.001s`, transition cost is zero to avoid division instability. If
centroid speed exceeds 12 grid units/second, the result is `Infinity`.

Despite comments describing this as “Fitts's Law,” the implementation is a
linear distance-plus-speed proxy with per-finger travel; it does not use the
classical logarithmic Fitts equation.

### 4. Rapid same-finger repetition

For a hand/finger repeated in the next moment while `Δt < 0.25s`:

```text
penaltyPerRepeatedFinger = 1.5 × (1 - Δt / 0.25)
```

The canonical post-hoc evaluator includes this dimension when enabled. The beam
solver's V1 ranking path deliberately reports canonical alternation as zero and
does not use alternation to order its beam. This distinction matters when
comparing solver-internal trace costs with post-hoc diagnostics.

### 5. Hand balance

Once at least two notes have been assigned, the engine gently nudges total usage
toward 45% left hand / 55% right hand:

```text
leftShare      = leftCount / (leftCount + rightCount)
handBalanceCost = 0.5 × (leftShare - 0.45)²
```

This is intentionally weak. It should not scatter a naturally one-hand groove
merely to approach a 50/50 distribution.

### 6. Constraint penalty

In the strict V1 model, feasible grips have a constraint penalty of zero and
infeasible grips are rejected. Compatibility types and toggles still expose a
`constraintPenalty` dimension, but the active tier-to-penalty conversion returns
zero. Therefore disabling this toggle does **not** make the strict grip generator
ignore anatomical rules.

## Two active cost representations

Understanding this boundary prevents misleading comparisons.

### Solver-internal V1 objective

Beam search ranks partial Execution Plans using:

```text
poseNaturalness     = handShapeDeviation + fingerPreference
stepTotal           = poseNaturalness + transitionDifficulty
                    + constraintPenalty + handBalance
constraintPenalty   = 0 for generated strict grips
```

The V1 breakdown retains separate fields for finger preference, hand-shape
deviation, transition, hand balance, and constraint penalty. Legacy diagnostic
adapters map these into older display shapes; alternation is mapped to zero.

### Canonical post-hoc evaluator

The solver-independent evaluator accepts a Layout, `PadFingerAssignment`, and
moments, and exposes five togglable dimensions:

1. `poseNaturalness`
2. `transitionCost`
3. `constraintPenalty`
4. `alternation`
5. `handBalance`

Its pose formula is currently different from beam ranking:

```text
poseNaturalness = 0.3 × attractor
                + 0.3 × perFingerHome
                + 0.4 × fingerDominance
```

where:

- `attractor = distance(gripCentroid, restingCentroid) × stiffness`;
- `perFingerHome = 0.8 × Σ distance(finger, neutralPad)` when neutral pad data
  exists; and
- `fingerDominance` is the finger-preference table above.

This evaluator adds event costs and transition costs across the performance and
returns aggregate totals, averages, the peak event, hard/infeasible counts,
per-event assignments, transition movement metrics, and a feasibility verdict.
Cost toggles zero disabled dimensions in the total while preserving the common
output shape.

**Practical consequence:** solver trace cost and canonical diagnostic total are
related but are not numerically interchangeable. The final canonical evaluation
is the preferred cross-optimizer comparison payload; solver-internal cost
explains search decisions within that solver.

## Natural pose and calibration

The default Pose 0 is a ten-finger resting shape whose left cluster occupies
columns 0–3 and right cluster columns 4–7, mostly rows 2–4:

| Finger | Default pad | Finger | Default pad |
| --- | --- | --- | --- |
| L thumb | (2,3) | R thumb | (2,4) |
| L index | (3,3) | R index | (3,4) |
| L middle | (4,2) | R middle | (4,5) |
| L ring | (4,1) | R ring | (4,6) |
| L pinky | (4,0) | R pinky | (4,7) |

Pose utilities can normalize the minimum row to zero and vertically offset the
shape while keeping assigned fingers on-grid. The supported safe offset is
clamped to ±4 rows. The natural pose supplies pairwise shape references for beam
search and home/centroid references for post-hoc evaluation. Per-user
calibration is conceptually supported through configuration and neutral-position
overrides, although the global hard constraint values are fixed constants today.

## End-to-end execution pipeline

### Beam execution-plan search

1. Resolve the moment's Sounds to active Pads.
2. Split possible ownership by hand and respect manual/hard assignment inputs.
3. Generate all distinct finger permutations for each hand.
4. Incrementally prune pair-span violations, then reject topology and
   outward-rotation violations.
5. Calculate transition speed/cost from the previous beam node. Discard
   non-finite transitions.
6. Calculate grip shape, finger preference, and running hand balance.
7. Add step cost to the node's cumulative cost.
8. Keep only the best `beamWidth` nodes and continue through time.
9. Convert the winning path into the layout-bound `ExecutionPlanResult`,
   diagnostics, feasibility data, and assignment map.

Beam width changes search thoroughness, not anatomy. A wider beam retains more
partial plans and can avoid local pruning errors at increased CPU and memory
cost.

### Coupled optimizers

Beam, annealing, and greedy adapters ultimately need both a Layout and an
Execution Plan. Annealing mutates layout candidates and uses beam evaluation;
greedy uses the canonical evaluator during layout/finger improvement. All
optimizer outputs are expected to retain the final Layout, pad-finger ownership,
Execution Plan, canonical diagnostics, cost toggles, stop reason, telemetry, and
method-appropriate trace. Biomechanical feasibility is therefore shared engine
infrastructure, not a UI-only score.

### Independent evaluation and comparison

`evaluatePerformance` can score an existing Layout and assignment without
rerunning beam search. `compareLayouts` evaluates two pairs on the same moments
and reports total/factor deltas, per-moment winners, changed placements, and
changed finger ownership. `validateAssignment` separately reports unmapped notes
and span-infeasible moments.

## Feasibility, difficulty, and diagnostics are different

- **Feasibility** asks whether all required events have mappings/owners and
  whether strict grips and finite-speed transitions exist.
- **Difficulty/cost** ranks feasible choices. A difficult plan may still be
  feasible; an impossible plan should not be rescued by a favorable average.
- **Diagnostics** explain the result with named factors and local contributors.
  They should never silently transform an impossible event into a playable one.

For full-performance decisions, inspect at least:

1. `feasibility.level` and reasons;
2. unplayable/unassigned event counts;
3. whether total or transition costs are non-finite;
4. the five factor totals;
5. peak moments and transition records; and
6. baseline-relative differences when selecting a Candidate Solution.

## Configuration and tuning

| Parameter | Default/current value | Effect |
| --- | ---: | --- |
| `beamWidth` | caller supplied | Search breadth; no change to hard rules. |
| `stiffness` | caller supplied, documented range 0–1 | Strength of canonical evaluator's centroid attractor. |
| `max hand speed` | 12 units/s | Hard `Infinity` threshold for centroid movement. |
| speed weight | 0.5 | Strength of speed within transition cost. |
| mean finger movement weight | 1.0 | Strength of average shared-finger travel. |
| maximum finger jump weight | 0.8 | Extra pressure against one large finger jump. |
| alternation window | 0.25 s | Interval in which repeated fingers are charged. |
| alternation base penalty | 1.5 | Maximum penalty at near-zero interval. |
| target left share | 0.45 | Soft balance target. |
| hand-balance weight | 0.5 | Weak quadratic balance nudge. |
| neutral/home finger distance weight | 0.8 | Used inside canonical `perFingerHome`. |
| natural pose offset | safe range, capped ±4 rows | Moves the reference pose vertically. |

The compatibility `DEFAULT_ENGINE_CONSTANTS` contains `maxSpan: 4`,
`maxReach: 4`, `idealReach: 2`, activation cost 5, and crossover weight 20.
Those values are used by selected legacy/helper APIs and must not be confused
with the canonical strict table (overall span 5.5 and reach 5.0).

### Cost toggles

All five canonical dimensions default to enabled. Turning one off makes its
contribution zero for evaluation/optimization consumers that honor toggles.
Toggles are experimental controls, not model deletion, and do not rewrite stored
events or Layouts. In particular, the “Hard Constraints” toggle cannot relax the
strict CLP generator because feasibility rejection occurs before scalar cost.

## Complexity and performance

Grip enumeration is combinatorial. For `n` pads assigned to one hand, it tries
`P(5,n) = 5!/(5-n)!` finger permutations before pruning: 5, 20, 60, 120, and
120 possibilities for one through five pads. Two-hand chord candidates combine
left and right grip sets, which can multiply the branching factor. Incremental
span pruning reduces actual work; beam width then caps surviving temporal paths.

Canonical evaluation is approximately linear in moment and transition count for
a fixed assignment. Each pose contains at most five fingers, so pairwise shape
work is bounded by ten pairs per hand. Layout optimization is substantially more
expensive because it evaluates many layouts and may invoke beam search repeatedly.

## Known seams and limitations

These are current implementation facts, not desired future behavior:

1. **The solver and canonical evaluator use different pose-naturalness
   formulas.** Beam uses translation-invariant shape deviation plus raw finger
   preference; post-hoc evaluation uses weighted centroid/home/finger terms.
2. **Post-hoc grip classification checks span only.** `buildMomentPoses` does not
   re-run topology, thumb, outward-rotation, collision, reach, or zone checks.
   The beam generator applies more geometry than independent validation.
3. **Transition speed is centroid-based.** A shared finger can move very far and
   incur a large soft cost without independently triggering `Infinity` when the
   centroid remains under 12 units/s.
4. **Newly activated fingers have no transition travel.** Per-finger movement
   only considers fingers shared by both poses; a published activation constant
   exists but is not used in the active transition equation.
5. **`Δt <= 1ms` returns zero transition cost.** Simultaneous notes are expected
   to be grouped into one moment; malformed near-duplicate moments can otherwise
   avoid movement cost.
6. **Strict-only types retain historical tiers.** `ConstraintTier` still permits
   `relaxed` and `fallback`; in current generation, `fallback` is a diagnostic
   marker for invalid/unmapped post-hoc data, not a permitted solver grip.
7. **Constraint penalty is structurally present but numerically zero.** The hard
   behavior comes from rejection and validation, not the scalar dimension.
8. **Zone and reach rules are not uniformly enforced.** They exist in named
   diagnostics/helpers and some solver ownership logic, but are not part of the
   core CLP grip predicate described above.
9. **Biomechanical constants are population defaults, not medical claims.** The
   grid-unit thresholds are product heuristics and have no individual hand-size,
   injury, mobility, handedness, or technique calibration.
10. **Infinite values require careful serialization/display.** Consumers must
    not coerce `Infinity` into a plausible finite score or let aggregate averages
    hide the failing transition.

## Developer guide: changing the model safely

1. Treat `src/engine/prior/biomechanicalModel.ts` as the source of truth for
   physical constants and named constraints. Do not duplicate constants.
2. Decide whether a change is a **hard feasibility rule**, a **soft ranking
   cost**, or a **diagnostic-only metric**. Do not implement the same concern in
   conflicting categories.
3. Update both beam scoring and the canonical evaluator when semantics should be
   shared. If their formulas intentionally differ, document the reason and avoid
   comparing their raw totals.
4. Update cost types, toggles, optimizer traces, UI consumers, and the Learn More
   constraints content whenever public factors or constraints change.
5. Preserve deterministic ordering and seeds. Feasibility generation must give
   repeatable results for the same input.
6. Add atomic boundary tests (exactly at and just beyond each limit), regression
   tests for known grips, and full temporal tests for speed and repetition.
7. Verify every optimizer on TEST MIDI 1 whenever optimizer or solver behavior
   changes; all methods must retain zero unplayable events.

## Verification map

The most relevant automated coverage is:

- `test/engine/prior/feasibility.atomic.test.ts` — individual feasibility rules;
- `test/engine/prior/feasibility.regression.test.ts` — known grip regressions;
- `test/engine/solvers/beamSolver.smoke.test.ts` — plan generation;
- `test/engine/evaluation/canonicalEvaluator.test.ts` — structured independent
  evaluation;
- `test/engine/evaluation/performabilityObjective.test.ts` — objective behavior;
- `test/engine/evaluation/executionPlanValidation.test.ts` — plan integrity;
- `test/engine/evaluation/diagnostics.test.ts` — diagnostic mapping;
- `test/golden/goldenScenarios.test.ts` — end-to-end scenarios; and
- `test/engine/optimization/testMidi1Integration.test.ts` — all optimizer paths
  against the required MIDI regression fixture.

## Source map

| Concern | Active source |
| --- | --- |
| Constants, pair spans, named rules | `src/engine/prior/biomechanicalModel.ts` |
| Strict grip generation and rejection diagnostics | `src/engine/prior/feasibility.ts` |
| Natural/Pose 0 configuration | `src/engine/prior/handPose.ts`, `naturalHandPose.ts` |
| Atomic cost equations | `src/engine/evaluation/costFunction.ts` |
| Beam objective and compatibility mappings | `src/engine/evaluation/objective.ts` |
| Solver-independent evaluation and comparison | `src/engine/evaluation/canonicalEvaluator.ts` |
| Post-hoc pose construction/classification | `src/engine/evaluation/poseBuilder.ts` |
| Cost payloads and toggles | `src/types/costBreakdown.ts`, `costToggles.ts` |
| Evaluation and solver configuration | `src/types/evaluationConfig.ts`, `engineConfig.ts` |
| Temporal execution-plan search | `src/engine/solvers/beamSolver.ts` |
| Optimizer contracts/adapters | `src/engine/optimization/optimizerInterface.ts` and adapters |

## Glossary

- **Layout:** the mapping of Sound identities to Pads.
- **Performance moment:** notes starting together and evaluated as one grip.
- **Grip / HandPose:** the fingers and coordinates active for one hand in one
  moment, plus their centroid.
- **Execution Plan:** the time-ordered, layout-bound performance solution,
  including Finger Assignments and diagnostics.
- **Hard constraint:** a rule whose violation rejects a candidate.
- **Soft cost:** a non-negative value used to rank otherwise eligible choices.
- **Natural pose / Pose 0:** the user's or default resting finger geometry.
- **Canonical evaluator:** solver-independent post-hoc evaluation used to give
  optimizer outputs a common diagnostic shape.
- **Beam search:** temporal search retaining the best bounded set of partial
  Execution Plans at each moment.
