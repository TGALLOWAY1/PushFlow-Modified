# V3_ENGINE_DECISIONS

## Canonical Engine Mission

V3 should optimize how a canonical set of sound-trigger events is executed on a pad surface by human hands, not how imported MIDI pitches happen to be replayed. The engine's job is to produce explainable, biomechanically plausible candidate layouts and execution plans, with constraints and diagnostics treated as first-class.

## Canonical Domain Truth

Canonical truth should be:

- sound identities with stable IDs
- event time series keyed by sound ID
- pad layout keyed by sound ID
- explicit user constraints keyed by sound, pad, or event

Derived truth should be:

- execution plans
- candidate rankings
- difficulty analysis
- debug reports

## Canonical Performance / Sound Model

Use V2's `SoundStream` direction, but finish the migration:

- keep stream/time-series authoring objects
- stop flattening back to `noteNumber = originalMidiNote` as solver truth
- keep imported pitch as provenance only

## Canonical Optimization Pipeline

Recommended pipeline:

1. Import sources into canonical sound timelines.
2. Build structural analysis summaries.
3. Generate a small set of diverse seed layouts.
4. Run beam search with one canonical objective.
5. Run annealing on selected seeds using the exact same objective and full hard-constraint enforcement in every evaluation.
6. Produce first-class candidates.
7. Rank candidates in production with a transparent policy.

## Canonical Cost Model Direction

- Keep V2's simplified internal objective direction:
  - pose naturalness
  - transition difficulty
  - constraint penalty
  - plus explicit alternation and hand-balance terms
- Remove legacy field names from canonical engine types.
- Stop treating `score`, `difficulty`, and `cost` as interchangeable.

## Canonical Constraints Hierarchy

Hard recommendation:

1. mapping validity
2. explicit user hard constraints
3. biomechanical hard feasibility
4. degraded fallback mode, explicitly annotated
5. soft optimization terms
6. diagnostic post-checks

## Canonical Verification Strategy

Merge V1 and V2:

- V1-style policy contracts, fixture bands, project-state integration, and runtime budget checks
- V2-style atomic feasibility tests, violation-category regressions, sanity checks, irrational detectors, and debug dashboard
- add solver-trace logging for true explainability

## Engine Features To Preserve From V1

- strict persistence validation (`../PushFlow/Version1/src/utils/projectPersistence.ts:34-136`)
- explicit behavioral-contract testing culture (`../PushFlow/Version1/src/engine/__tests__/README.md:65-94`, `../PushFlow/Version1/src/engine/__tests__/helpers/semantics.ts:1-123`)
- performance regression tests (`../PushFlow/Version1/src/engine/__tests__/solver.performance.test.ts:1-245`)

## Engine Features To Preserve From V2

- `SoundStream` / lane-based source model direction (`../PushFlow/src/ui/state/projectState.ts:21-43`, `../PushFlow/src/ui/hooks/useLaneImport.ts:46-98`)
- per-finger-pair biomechanical model (`../PushFlow/src/engine/prior/biomechanicalModel.ts:96-195`)
- corrected chord pad-to-finger mapping (`../PushFlow/src/engine/solvers/beamSolver.ts:290-304`, `:472-490`)
- relaxed-vs-fallback penalty separation
- Pose0 without stiffness doubling
- richer annealing presets, restarts, and mutation operators
- explicit debug/violation/sanity tooling
- stale-analysis invalidation on persistence load

## Engine Features To Remove Or Rewrite

- pitch-coupled solver truth
- manual-override group-scope behavior
- legacy `movement/stretch/drift/bounce/fatigue/crossover` canonical breakdown naming
- public score as if it were the optimized objective
- annealing fitness based on legacy average metrics
- dormant candidate-ranking utilities that are not integrated

## Highest-Risk Ambiguities

- whether V3 should allow degraded fallback plans in optimization mode or only in preview/debug mode
- whether hand-zone preference remains soft by default or can be promoted to hard
- whether sound-level constraints are real product requirements or dead state
- whether user-facing "score" should survive at all

## Recommended V3 Engine Direction in One Paragraph

V3 should be a sound-centric performability engine: canonical truth is a set of sound timelines and explicit constraints, layout maps pads to sound IDs, execution planning assigns hands and fingers over time, and optimization jointly evaluates layout and execution with one coherent objective built from pose naturalness, transition difficulty, constraint penalties, alternation, and hand balance. Preserve V2's structural analysis, biomechanical model, corrected chord assignment logic, candidate packaging, and debug tooling; preserve V1's strict validation and regression discipline; remove the surviving pitch-coupling, legacy metric taxonomy, broken manual-override behavior, and annealing/objective mismatches.

