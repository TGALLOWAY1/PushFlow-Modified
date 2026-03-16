# OPTIMIZATION_PIPELINE_COMPARISON

## Executive Verdict

V1 optimization was not "fundamentally broken" in the absolute sense. It had serious correctness defects and semantic confusion, but the core beam-search + annealing architecture was real and often serviceable. V2 fixed several of the most important beam-search correctness problems and added much better optimization infrastructure, but it did not finish the job. Several critical issues survived or were reintroduced.

## Beam Solver Architecture

### V1

- Beam search over chronological simultaneity groups (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:133-154`, `:892-1018`).
- Scores candidates by a 7-term objective (`../PushFlow/Version1/src/engine/objective.ts:12-63`).
- One-hand chord expansion assigns fingers by array order rather than pad match (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:301-344`).

### V2

- Same high-level beam structure.
- Beam step score changed to a 3-term performability model plus weighted alternation and hand-balance terms (`../PushFlow/src/engine/solvers/beamSolver.ts:310-345`, `:505-546`; `../PushFlow/src/engine/evaluation/objective.ts:22-40`).
- One-hand and split-hand chord assignment now resolve notes by exact coordinate match (`../PushFlow/src/engine/solvers/beamSolver.ts:290-304`, `:472-490`).
- Duplicate pads are removed before grip generation (`../PushFlow/src/engine/solvers/beamSolver.ts:247-259`, `:404-415`).

### Assessment

- V2 beam search is materially better than V1 for simultaneous notes.
- V2 did not fix result aggregation semantics, public score semantics, or manual override semantics.

## Beam Width Behavior and Assumptions

### V1

- Default beam width comes from project default config: 50 (`../PushFlow/Version1/src/types/projectState.ts:186-196`).
- Annealing fast evaluation uses beam width 5; final evaluation uses 50 (`../PushFlow/Version1/src/engine/solvers/AnnealingSolver.ts:29-55`).

### V2

- Default UI engine config is 30 (`../PushFlow/src/ui/state/projectState.ts:445-452`).
- Auto-analysis forces beam width 15 for fast refresh (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:161-167`).
- Annealing fast/deep presets use fast beam width 12 or 16 and final width 50 (`../PushFlow/src/types/engineConfig.ts:112-134`).

### Assessment

- V2 is more explicit and operationally tunable.
- Lower default beam width in V2 is a pragmatic UI improvement, not obviously an engine-theory improvement.
- V3 should keep mode-specific beam widths, not one global default.

## Fallback Logic

### V1

- Tiered grip generation exists: strict -> relaxed -> fallback (`../PushFlow/Version1/src/engine/feasibility.ts:844-942`).
- But only fallback gets a real penalty in beam scoring (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:275-298`).

### V2

- Tiering is much better modeled:
  - strict per-pair spans
  - relaxed per-pair spans with `RELAXED_GRIP_PENALTY = 200`
  - fallback `FALLBACK_GRIP_PENALTY = 1000`
  (`../PushFlow/src/engine/prior/biomechanicalModel.ts:96-125`, `:187-195`)

### Assessment

- V2 clearly improved fallback logic. This should be preserved.

## Simulated Annealing Stage

### V1

- SA exists and is real, not fake.
- Constants: `INITIAL_TEMP = 500`, `COOLING_RATE = 0.99`, `ITERATIONS = 1000`, `FAST_BEAM_WIDTH = 5`, `FINAL_BEAM_WIDTH = 50` (`../PushFlow/Version1/src/engine/solvers/AnnealingSolver.ts:29-55`).
- Mutation neighborhood is only move/swap (`../PushFlow/Version1/src/engine/solvers/mutationService.ts:65-97`).

### V2

- SA is meaningfully expanded:
  - fast/deep presets
  - restart support
  - zone-transfer mutation
  - telemetry and milestone tracking
  (`../PushFlow/src/types/engineConfig.ts:91-134`, `../PushFlow/src/engine/optimization/annealingSolver.ts:168-396`, `../PushFlow/src/engine/optimization/mutationService.ts:52-99`, `:376-435`)

### Assessment

- Claim "V2 enabled deeper analysis/search through simulated annealing": verified.
- Caveat 1: the annealing fitness is still `result.averageMetrics.total`, not the real beam objective (`../PushFlow/src/engine/optimization/annealingSolver.ts:129-134`).
- Caveat 2: annealing inner-loop evaluation ignores `manualAssignments`; only the final pass receives them (`../PushFlow/src/engine/optimization/annealingSolver.ts:77-135`, `:361-363`).

## Candidate Generation Strategy

### V1

- No first-class candidate generation layer.

### V2

- Baseline, compact-right, compact-left, and pose0-offset strategies (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:82-93`, `:178-235`).
- Compact layouts are sensible search seeds: voices sorted by MIDI note and packed into a hand zone (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:109-172`).

### Assessment

- This is a true V2 improvement and should be preserved.
- But the annealing branch drops `manualAssignments` entirely when calling `solver.solve()` (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:314-324`), while the beam-only path passes them correctly (`:326-334`).

## Optimization Staging / Order of Operations

### V1

- Layout mutation and execution planning are loosely coupled through beam-evaluated annealing.

### V2

- Same overall shape, but now explicitly:
  - build candidate layouts
  - run beam-only or annealing
  - compute difficulty analysis
  - compute tradeoff profile
  (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:248-360`)

### Assessment

- V2 reduced orchestration complexity and made candidate production cleaner.
- It did not unify objective semantics across stages.

## What the System Optimizes Jointly vs Separately

### V1

- Beam search optimizes execution planning given a mapping.
- Annealing optimizes mapping by repeatedly re-running beam search.

### V2

- Same, but with a clearer candidate object around the result.
- Difficulty analysis and tradeoff profiling happen after solve, not inside optimization.

### Assessment

- Both versions still optimize layout and execution only approximately jointly because layout quality is proxied through a derived execution-plan aggregate.
- V3 should make the scalar optimized by beam, annealing, candidate ranking, and displayed total explicitly identical or explicitly translated.

## How Results Are Selected / Scored

### V1

- Beam returns the lowest accumulated internal cost path.
- Public `score` is then recomputed as `100 - 5*hardCount - 20*unplayableCount` (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:745-747`).

### V2

- Same public score formula (`../PushFlow/src/engine/solvers/beamSolver.ts:768-769`).
- Candidate ranking utilities exist but are not wired into generation output ordering.

### Assessment

- Both versions are semantically inconsistent.
- V2 has better ranking infrastructure, but it is not integrated.

## How Optimized Results Are Persisted or Surfaced

### V1

- Solver results are part of persisted `ProjectState` (`../PushFlow/Version1/src/types/projectState.ts:54-64`).

### V2

- Analysis results are ephemeral and invalidated on load (`../PushFlow/src/ui/persistence/projectStorage.ts:195-230`).
- Candidate solutions are surfaced as first-class artifacts (`../PushFlow/src/types/candidateSolution.ts:81-92`).

### Assessment

- V2 is clearly better here and should be the V3 baseline.

## Simplifications Introduced in V2

- extracted event grouping into a reusable structure module (`../PushFlow/src/engine/structure/eventGrouping.ts:21-58`)
- extracted structural analysis pipeline (`../PushFlow/src/engine/structure/performanceAnalyzer.ts:24-60`)
- introduced first-class candidate objects (`../PushFlow/src/types/candidateSolution.ts:81-92`)
- moved constants into a single biomechanical model (`../PushFlow/src/engine/prior/biomechanicalModel.ts:1-240`)
- made optimization mode explicit (`../PushFlow/src/types/engineConfig.ts:82-134`)

These are beneficial simplifications.

## Regressions or Lost Useful Behavior From V1

- V1 had a much broader explicit regression suite around policy, fixtures, performance, and project-state integration (`../PushFlow/Version1/src/engine/__tests__/README.md:65-94`, `../PushFlow/Version1/src/engine/__tests__/solver.performance.test.ts:1-245`).
- V2 has better debug tooling, but weaker behavioral-contract coverage.
- V2 still lacks integrated candidate ranking despite having the module.

## Claim Assessment

### Claim: "V1 optimization was fundamentally broken"

Verdict: reject.

Why:

- V1 definitely had serious bugs:
  - wrong one-hand chord finger mapping (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:301-344`)
  - broken bounce/handBalance aggregation (`:696-775`)
  - manual-override group-scope bug (`:903-1003`)
- But the architecture itself was not fake:
  - beam search is real
  - annealing is real
  - there is extensive regression coverage

More accurate statement: V1 had a valid engine core with several severe correctness and metric-semantics defects.

### Claim: "V2 corrected core beam-solver failures"

Verdict: partially verify.

Corrected:

- duplicate-pad chord handling
- exact pad-to-finger resolution for simultaneous notes
- distinct relaxed vs fallback penalty
- removal of Pose0 stiffness doubling

Not corrected:

- manual override semantics for simultaneity groups
- result aggregation bugs
- public score semantics

### Claim: "V2 reduced complexity in producing optimized results"

Verdict: verify, with caveat.

Why:

- candidate generation is cleaner
- persistence/invalidation is cleaner
- difficulty/tradeoff packaging is cleaner

Caveat:

- the underlying solver/domain truth is still semantically mixed, so not all complexity was actually removed

### Claim: "V2 enabled deeper analysis/search through simulated annealing"

Verdict: verify, with caveat.

Why:

- restarts, presets, richer mutations, zone transfer, telemetry are real

Caveat:

- inner-loop objective and constraint plumbing are still wrong

## Canonical V3 Optimization Architecture

Recommended V3 pipeline:

1. canonical source model builds sound-keyed performance events
2. structural analysis builds simultaneity/section/transition/co-occurrence summaries
3. beam search solves execution planning against one canonical objective
4. annealing mutates layout using that same canonical objective and respects all hard constraints during every evaluation
5. candidate generation creates diverse seeds
6. candidate ranking is applied in production, not just implemented as a dormant utility
7. debug tooling consumes true solver trace plus post-hoc analysis

