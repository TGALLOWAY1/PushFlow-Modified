# CONSTANTS_THRESHOLDS_AND_ASSUMPTIONS

Scope: engine-relevant constants, thresholds, and behavioral assumptions that materially affect solver behavior or analysis validity.

## Search / Optimization Constants

| Constant | V1 | V2 | Role | Likely behavioral impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Default beam width | 50 (`../PushFlow/Version1/src/types/projectState.ts:186-196`) | 30 in empty project state (`../PushFlow/src/ui/state/projectState.ts:445-452`) | beam breadth | Higher width improves search quality but increases runtime | Expose mode-specific presets, not one universal default |
| Default stiffness | 1.0 (`../PushFlow/Version1/src/types/projectState.ts:186-196`) | 0.3 (`../PushFlow/src/ui/state/projectState.ts:445-452`) | attractor force to resting pose | major behavior change; V2 allows freer motion by default | Preserve lower default unless human testing shows under-anchoring |
| Auto-analysis beam width | n/a explicit | 15 (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:163-167`) | fast interactive refresh | Speeds UI, may hide better alternatives | Keep as interactive mode only |
| V1 annealing fast beam width | 5 (`../PushFlow/Version1/src/engine/solvers/AnnealingSolver.ts:29-55`) | superseded | cheap inner-loop evaluation | Very coarse layout fitness | Replace with canonical fast preset |
| V2 fast annealing beam width | n/a | 12 (`../PushFlow/src/types/engineConfig.ts:112-120`) | fast inner-loop evaluation | better than V1, still approximate | Keep tunable |
| V2 deep annealing beam width | n/a | 16 (`../PushFlow/src/types/engineConfig.ts:126-134`) | deeper inner-loop evaluation | more accurate but slower | Keep |
| Final beam width after annealing | 50 in V1 | 50 in V2 | final quality pass | stabilizes final plan quality | Keep as high-quality preset |
| Candidate count | no first-class candidate layer | default 3 (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:44-46`, `:253-255`) | number of alternatives generated | higher count expands comparison space | Expose as advanced option if runtime allows |

## Annealing Parameters

| Constant | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Iterations | 1000 (`../PushFlow/Version1/src/engine/solvers/AnnealingSolver.ts:29-55`) | 3000 fast / 8000 deep (`../PushFlow/src/types/engineConfig.ts:112-134`) | SA budget | V2 allows materially deeper exploration | Keep V2 presets |
| Initial temperature | 500 | 500 fast / deep | exploration vs greediness | stable continuity across versions | Keep |
| Cooling rate | 0.99 | 0.997 fast / 0.9985 deep | cooling speed | V2 cools slower, explores longer | Keep V2 |
| Restart count | 0 | 0 fast / 3 deep | escape local minima | V2 deep can recover from poor basins | Keep deep restarts |
| Zone transfer mutation | absent | false fast / true deep | cross-zone exploration | major V2 exploration improvement | Keep |

## Feasibility / Reach / Span Constants

| Constant | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Strict max general finger span | 5.5 (`../PushFlow/Version1/src/engine/feasibility.ts:32-37`) | fallback unlisted pair span 5.5 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:74-76`) | one-hand chord feasibility | coarse in V1, fallback-only in V2 | Keep only as fallback in V2 model |
| Relaxed max general finger span | 7.5 (`../PushFlow/Version1/src/engine/feasibility.ts:39-43`) | replaced by per-pair strict * 1.15 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:109-125`) | relaxed chord feasibility | V1 too generous; V2 more plausible | Keep V2 |
| Thumb delta strict | 1.0 | 1.0 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:129-136`) | thumb vertical/topology tolerance | similar across versions | Keep |
| Thumb delta relaxed | 2.0 | 2.0 | relaxed topology | similar across versions | Keep |
| Max hand span | indirectly 5.5 in several places | 5.5 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:140-145`) | physical envelope | bounds grip generation and diagnostics | Keep |
| Max reach grid units | from engine constants / ergonomics defaults, effectively 4-5 depending path | 5.0 biomechanical constant, but `isReachPossible()` still defaults to `DEFAULT_ENGINE_CONSTANTS.maxReach = 4` in feasibility (`../PushFlow/src/engine/prior/feasibility.ts:158-165`) | reach checks | Important inconsistency in V2: two nearby but different reach notions | Unify to one canonical reach constant |
| Max speed units/sec | 12.0 (`../PushFlow/Version1/src/engine/costFunction.ts:25-31`) | 12.0 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:147-150`) | impossible transition threshold | strong hard feasibility gate | Keep |

## Per-Finger / Penalty Constants

| Constant | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Finger strength weights | index 1.0, middle 1.0, ring 1.1, pinky 2.5, thumb 2.0 (`../PushFlow/Version1/src/engine/models.ts:65-75`, `:93-99`) | removed from `DEFAULT_ENGINE_CONSTANTS`; replaced in primary scoring by explicit `FINGER_DOMINANCE_COST` (`../PushFlow/src/types/engineConfig.ts:30-49`, `../PushFlow/src/engine/prior/biomechanicalModel.ts:173-179`) | V1 movement weighting by finger | V2 simplifies model but loses some movement-specific nuance | Decide explicitly whether V3 wants movement weights, dominance costs, or both |
| Finger dominance cost | implicit through stretch/static functions and finger-strength weights | explicit: index 0, middle 0, ring 1, pinky 3, thumb 5 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:173-179`) | discourage weak/awkward fingers | V2 is much clearer | Keep V2 explicit table |
| Fallback grip penalty | 1000 (`../PushFlow/Version1/src/engine/costFunction.ts:39-44`) | 1000 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:194-195`) | severe degraded-solution penalty | same | Keep |
| Relaxed grip penalty | none explicit | 200 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:187-193`) | discourage strained but not impossible grips | major V2 improvement | Keep |
| Alternation dt threshold | 0.25s (`../PushFlow/Version1/src/engine/costFunction.ts:49-53`) | 0.25s (`../PushFlow/src/engine/prior/biomechanicalModel.ts:202-206`) | same-finger repetition window | stable across versions | Keep |
| Alternation penalty | 1.5 | 1.5 | repetition penalty size | stable | Keep |
| Hand balance target left share | 0.45 | 0.45 | slight right-hand bias | stable | Keep or make handedness-aware |
| Hand balance weight | 2.0 | 2.0 | imbalance penalty strength | stable | Keep, maybe expose in advanced config |
| Hand balance minimum notes | 2 | 2 | activation threshold | stable | Keep |
| Activation cost | 5.0 in legacy engine constants (`../PushFlow/Version1/src/engine/models.ts:76-81`, `:100-102`) | 5.0 in carried `DEFAULT_ENGINE_CONSTANTS` (`../PushFlow/src/types/engineConfig.ts:41-49`) | cost of bringing in a new finger in legacy calculations | still matters for any retained legacy movement model | Keep only if legacy movement model survives |
| Crossover penalty weight | 20.0 in legacy engine constants (`../PushFlow/Version1/src/engine/models.ts:78-81`, `:100-102`) | 20.0 in carried `DEFAULT_ENGINE_CONSTANTS` (`../PushFlow/src/types/engineConfig.ts:41-49`) | legacy crossover discouragement | currently semantically muddled with constraint penalty naming | Reassess after taxonomy cleanup |
| Chord penalty threshold | not centralized | 3.0 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:197-199`) | debug / soft interpretation of chord spread | minor unless surfaced | Revisit once cost taxonomy is unified |

## Beam Scoring Weights

| Constant | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Alternation beam weight | not separately weighted; part of 7-term objective | 0.8 in beam solver (`../PushFlow/src/engine/solvers/beamSolver.ts:321-325`, `:519-523`) | how strongly repetition influences beam ranking | meaningful ranking behavior change | Move into canonical config or centralized constants |
| Hand-balance beam weight | not separately weighted; part of 7-term objective | 0.3 in beam solver (`../PushFlow/src/engine/solvers/beamSolver.ts:321-325`, `:519-523`) | how strongly load distribution influences ranking | moderate | Centralize |
| Lookahead bonus | absent | one-step lookahead bonus enabled inline (`../PushFlow/src/engine/solvers/beamSolver.ts:327-331`, `:525-533`) | anticipatory scoring | can improve phrase flow, but is not configurable | Keep concept, centralize amount and tests |

## Grouping / Timing Windows

| Constant / assumption | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Simultaneity epsilon in beam grouping | 0.001s (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:133-154`) | 0.001s (`../PushFlow/src/engine/structure/eventGrouping.ts:14-58`) | group events into chords | affects solver path and debug grouping | Keep explicit and tested |
| Event-metrics grouping epsilon | 0.0001s (`../PushFlow/Version1/src/engine/eventMetrics.ts:91-97`) | n/a | debug/event-analysis grouping | mismatch with solver grouping | Remove split assumptions in V3 |
| Simultaneous collision grouping in validator | n/a explicit | millisecond rounding and `SIMULTANEOUS_EPSILON = 0.001` (`../PushFlow/src/engine/debug/constraintValidator.ts:22-27`, `:114-154`) | debug rule detection | aligned enough with solver | Keep, but derive from canonical constant |
| Same-finger streak fast threshold | docs/tests only | 0.2s in irrational detector (`../PushFlow/src/engine/debug/irrationalDetector.ts:164-166`) | heuristic irrational detection | affects debug flags, not solving | Keep debug-only |

## UI / Persistence / Staleness Assumptions That Affect Engine Validity

| Constant / assumption | V1 | V2 | Role | Impact | V3 guidance |
| --- | --- | --- | --- | --- | --- |
| Analysis cache persistence | persisted solver results in project state (`../PushFlow/Version1/src/types/projectState.ts:54-64`) | analysis reset on import/load (`../PushFlow/src/ui/persistence/projectStorage.ts:211-230`) | cache truth boundary | V2 avoids stale engine truth | Keep V2 approach |
| Auto-analysis debounce | no equivalent | 1000 ms (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:30`) | recompute throttling | affects freshness vs UI churn | Keep adjustable UI constant |
| Pose0 stiffness behavior | stiffness doubled when neutral override exists (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:834-845`) | no doubling; uses config stiffness as-is (`../PushFlow/src/engine/solvers/beamSolver.ts:833-846`) | how strongly Pose0 anchors the search | V1 can overconstrain solver away from musically necessary movement | Keep V2 behavior |
| Empty-layout auto-seeding | import leaves empty grid in both versions | V2 auto-builds layout from `originalMidiNote` when generating from scratch (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:81-122`, `:212-220`) | generation bootstrap | convenient, but reinforces pitch-coupled identity | Keep bootstrap, re-key on soundId in V3 |

## Hardcoded Geometry Assumptions

| Assumption | V1 | V2 | Impact | V3 guidance |
| --- | --- | --- | --- | --- |
| Grid size | 8x8 | 8x8 | pervasive in mapping, mutation, reachability | Keep if Push-only; otherwise isolate behind surface model |
| Bottom-left note default | 36 | 36 | chromatic layout origin | Keep as device preset, not universal engine truth |
| Hand zones | implicit | left zone cols 0-3, right zone cols 4-7 in optimization and debug logic (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:128-136`, `../PushFlow/src/engine/optimization/mutationService.ts:377-398`) | impacts candidate layout generation and diagnostics | Keep as preset, expose via surface model |
| Home centroids | richer preset set in V1 project state | simplified empty-project centroids left 1.5/3.5, right 5.5/3.5 (`../PushFlow/src/ui/state/projectState.ts:448-451`) | affects default attractor behavior | Keep presets, not one hardcoded default |

## Constants That Should Definitely Change in V3

- `ExecutionPlanResult` type comments and cost-field names should be rewritten; current names encode the wrong ontology.
- Reachability constants need unification. V2 currently has both `MAX_REACH_GRID_UNITS = 5.0` and `DEFAULT_ENGINE_CONSTANTS.maxReach = 4`, which means different subsystems can disagree.
- Alternation and hand-balance beam weights should move out of inline solver code.
- Lookahead bonus magnitude and activation should be centralized.

## Constants That Should Be Preserved

- per-finger-pair strict span table
- relaxed span multiplier near 1.15, not V1's effectively 1.36x from 5.5 -> 7.5
- relaxed and fallback penalties remaining clearly distinct
- 12 units/s max movement speed until better evidence exists
- 0.001s simultaneity epsilon unless human testing proves otherwise
