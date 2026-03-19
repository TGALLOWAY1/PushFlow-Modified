# Phase 1 Engine Refactor Report

## Executive Summary

Phase 1 is fixing the engine layer that sits underneath the V3 merge plan. The goal is not to finish UI implementation. The goal is to make the core engine behave consistently across beam search, annealing, candidate generation, and analysis.

The current engine already has useful pieces:

- a strong V2 feasibility model
- a real beam-search and annealing stack
- first-class candidate objects
- practical debug tooling

The current engine also still has structural problems that will break the V3 product model if they are not corrected now:

- hard feasibility is not enforced consistently across all solver paths
- the scoring model still drifts between canonical objective terms and legacy display terms
- candidate generation does not enforce baseline-relative diversity strongly enough
- diagnostics are useful but are not yet a single canonical payload
- solver truth is still keyed too heavily to imported pitch instead of stable sound identity

The most important architectural changes in Phase 1 are:

1. make strict feasibility the shared default contract for normal generation
2. unify all solver paths around one canonical `objectiveCost`
3. add an explicit diversity filter relative to the `Active Layout`
4. define one canonical diagnostics payload for compare mode and Event Analysis
5. begin re-keying solver truth from imported pitch to stable sound identity

## Resolved Direction Incorporated

### Strict feasibility in normal generation

**Decision**  
Normal generation should use strict hard feasibility only.

**Why**  
The resolved feedback explicitly rejects relaxed or degraded candidates in the standard candidate pool. If a candidate violates true feasibility, it should not survive normal generation with just a heavy penalty.

**Implementation consequence**  
Beam search, annealing, candidate generation, and prechecks need one shared strict-feasibility contract. Relaxed or degraded behavior must move behind an explicit non-default preview/debug/fallback mode.

### Soft vs hard hand-zone interpretation

**Decision**  
Hand-zone preference stays soft by default. Hard hand or finger region rules remain true feasibility constraints.

**Why**  
The resolved direction separates “preferred zone” from “capability region.” Those are not the same thing.

**Implementation consequence**  
The engine needs two separate concepts:

- hard capability-region feasibility
- soft zone-preference scoring

Those should never be collapsed into one ambiguous “zone rule.”

### Per-sound preference stays soft for now

**Decision**  
Per-sound preferred hand and preferred finger remain soft biases in Phase 1.

**Why**  
The product allows future extensibility toward explicit hard modes, but that is not the default behavior now.

**Implementation consequence**  
The state and solver contract should be designed so these preferences can later become explicit hard constraints, but the current implementation should score them as soft only.

### Fatigue remains cost-based

**Decision**  
Fatigue remains a soft sequence-level cost until a real fatigue model exists.

**Why**  
The resolved direction explicitly rejects inventing a fake hard fatigue rule without a strong underlying model.

**Implementation consequence**  
Phase 1 should treat fatigue as a sequence-level ranking factor and explanation term only. It should not affect binary feasibility.

### Meaningful diversity requirements

**Decision**  
Execution-plan difference counts as real diversity only when it changes how the passage is meaningfully played.

**Why**  
The resolved direction rejects trivial score jitter, metadata differences, and cosmetic assignment noise as valid diversity.

**Implementation consequence**  
The diversity filter needs a baseline-relative test that looks for real differences in layout strategy, hand allocation, finger-assignment strategy across meaningful sections, transition strategy in difficult passages, or major cost-driver profile.

### Degraded fallback only in debug, preview, or explicit fallback workflows

**Decision**  
Degraded fallback should not appear in normal candidate generation.

**Why**  
Normal generation must either return feasible candidates or explain why feasible diversity was constrained or unavailable.

**Implementation consequence**  
Fallback or degraded results need a separate mode flag and separate labeling path. They should not be mixed into the ordinary candidate pool.

### Stable sound identity over imported pitch

**Decision**  
Stable sound identity should become canonical engine truth. Imported pitch may remain metadata only.

**Why**  
The merge plan and engine audit both point to the same problem: the current V2 code introduces sound-stream concepts but still resolves the solver through `originalMidiNote`.

**Implementation consequence**  
Phase 1 needs to start re-keying mapping, structural analysis, solver input, and execution diagnostics to `soundId` and `performanceEventId`.

## Current Engine Mismatches

### Inconsistent hard-rule enforcement across beam, annealing, and generation

**What the code/audit currently suggests**  
Beam analysis can consume hard `manualAssignments`, but annealing still evaluates layouts through a different path and uses looser plumbing. `multiCandidateGenerator.ts` passes `manualAssignments` to beam-only solves, but not through the annealing solve path. `annealingSolver.ts` evaluates cost with `result.averageMetrics.total` and only passes `manualAssignments` in the final solve.

**Why it is wrong or incomplete**  
This means different optimization paths are not using the same hard-rule contract. That directly conflicts with the resolved Phase 1 direction.

**Correct V3-aligned interpretation**  
Every normal solve path must share one strict feasibility contract. A rule is either part of strict feasibility or it is not. No subsystem should silently relax or drop it.

**Affected systems**  
`src/engine/solvers/beamSolver.ts`, `src/engine/optimization/annealingSolver.ts`, `src/engine/optimization/multiCandidateGenerator.ts`, `src/ui/hooks/useAutoAnalysis.ts`

### Scoring naming drift

**What the code/audit currently suggests**  
The engine internally uses a simplified performability objective, but downstream types and display mappings still expose legacy names such as `bounce`, `fatigue`, and `crossover`. `beamSolver.ts` still builds `averageMetrics` with zeroed `bounce`, and `objective.ts` still maps canonical concepts into legacy names.

**Why it is wrong or incomplete**  
This makes it difficult to tell what the solver actually optimized, what the totals actually mean, and which costs were dominant.

**Correct V3-aligned interpretation**  
The engine should optimize and emit one canonical `objectiveCost` plus a canonical factor-level breakdown with V3 names. Any legacy compatibility mapping should be transitional only.

**Affected systems**  
`src/engine/evaluation/objective.ts`, `src/engine/evaluation/costFunction.ts`, `src/engine/solvers/beamSolver.ts`, `src/engine/optimization/annealingSolver.ts`, `src/types/executionPlan.ts`

### Lack of baseline-relative diversity enforcement

**What the code/audit currently suggests**  
V2 has candidate seed strategies and a dormant candidate ranker, but `generateCandidates()` returns candidates in generation order and does not enforce diversity relative to the `Active Layout`.

**Why it is wrong or incomplete**  
The product needs real alternatives, not just multiple generated outputs. Without a baseline-relative diversity check, trivial or cosmetic alternatives can leak into production.

**Correct V3-aligned interpretation**  
The engine must compare each candidate against the active baseline, reject trivial duplicates, and explain when hard constraints collapse diversity.

**Affected systems**  
`src/engine/optimization/multiCandidateGenerator.ts`, `src/engine/optimization/candidateRanker.ts`, `src/ui/hooks/useAutoAnalysis.ts`, `src/types/candidateSolution.ts`

### Missing canonical diagnostics payload

**What the code/audit currently suggests**  
The current debug stack is useful, but its data is split across `ExecutionPlanResult`, `constraintValidator.ts`, `evaluationRecorder.ts`, and `candidateReport.ts`. Some of it is reconstructed after the solve rather than emitted directly.

**Why it is wrong or incomplete**  
Compare mode, Event Analysis, candidate explanation, and rejection explanation all need one shared diagnostic vocabulary. Right now they do not have that.

**Correct V3-aligned interpretation**  
The solver should emit one canonical diagnostics payload that separates:

- hard feasibility status
- soft ergonomic contributors
- performance difficulty signals
- baseline-relative differences

**Affected systems**  
`src/types/executionPlan.ts`, `src/engine/debug/types.ts`, `src/engine/debug/evaluationRecorder.ts`, `src/engine/debug/candidateReport.ts`, `src/engine/debug/constraintValidator.ts`, `src/engine/solvers/beamSolver.ts`

### Pitch-keyed logic where stable sound identity should be used

**What the code/audit currently suggests**  
`mappingResolver.ts` builds note-to-pad indexes keyed by note number. `performanceAnalyzer.ts` and `performanceStructure.ts` treat voices as note numbers. `PerformanceEvent` still uses `noteNumber` as the durable identity field. `projectState.ts` flattens `SoundStream` back into solver events keyed by `originalMidiNote`.

**Why it is wrong or incomplete**  
This preserves a split between the source model and the engine model. It makes imported pitch behave like canonical sound identity even though V3 explicitly wants sound identity to survive beyond pitch provenance.

**Correct V3-aligned interpretation**  
Solver truth, layout resolution, structural analysis, and candidate diagnostics should key off stable sound identity. Imported pitch should survive only as input metadata.

**Affected systems**  
`src/ui/state/projectState.ts`, `src/types/performanceEvent.ts`, `src/types/performanceStructure.ts`, `src/types/voice.ts`, `src/engine/mapping/mappingResolver.ts`, `src/engine/structure/performanceAnalyzer.ts`

## Phase 1 Design

### Feasibility Layer

Hard feasibility in Phase 1 should include:

- mapping validity between `soundId` and `Pad`
- explicit sound placement locks
- finger and hand capability-region constraints
- unique pad ownership in the relevant representation
- simultaneous same-finger conflict prevention
- strict anatomical span and topology rules
- hard speed and transition infeasibility limits

All normal search and generation paths should share one contract:

- feasibility precheck validates mapping and preserved placement constraints
- beam expansion only considers strict-feasible grips
- annealing evaluates layouts only through strict-feasible execution plans
- candidate generation only admits strict-feasible candidates

Required rejection reasons should include:

- unmapped sound
- locked placement violated
- illegal capability-region assignment
- simultaneous conflict
- span exceeded
- topology invalid
- speed exceeded
- no strict-feasible plan

When no feasible candidates exist:

- normal generation should not fall back silently
- the engine should return a clear “no strict-feasible candidate” explanation
- degraded or relaxed exploration should only happen through an explicit non-default mode

### Scoring Layer

The canonical `objectiveCost` should be one lower-is-better scalar used by:

- beam search
- annealing evaluation
- production candidate ranking
- compare-mode summaries

That scalar should remain explainable through factor-level components.

Required factor-level breakdown:

- pose naturalness
- per-finger home pressure
- finger dominance or weak-finger pressure
- transition difficulty
- alternation or repetition pressure
- hand balance pressure
- zone-preference pressure
- relaxed-grip penalty, if relaxed mode is enabled explicitly
- fatigue or repetition-comfort pressure as a soft sequence term

Expected scopes:

- layout scope: locality or compactness
- event scope: pose, per-finger home, finger dominance
- transition scope: movement difficulty, alternation, speed pressure
- sequence scope: hand balance, fatigue, robustness

All of these remain soft in Phase 1 unless already part of strict feasibility.

The scoring layer should emit explanations such as:

- “higher transition pressure in dense passages”
- “more left-hand overload”
- “greater deviation from Natural Hand Pose”
- “weaker-finger usage increased in backbone passages”

### Diversity Filter

Candidate-vs-baseline comparison should ask:

- did any unlocked sound move?
- did hand allocation strategy change in meaningful sections?
- did finger-assignment strategy change in meaningful sections?
- did transition strategy change across difficult passages?
- did the major cost-driver profile materially change?

Candidate-vs-candidate comparison should ask the same questions pairwise after baseline-relative filtering.

Meaningful difference should include:

- different layout placement strategy
- different hand allocation strategy for meaningful sections
- different finger-assignment strategy for meaningful sections
- different transition strategy in difficult passages
- materially different dominant cost drivers

Trivial duplication should include:

- score jitter without interpretive difference
- metadata-only differences
- internal reorderings or equivalent assignments
- tiny local changes with no meaningful execution consequence

If diversity collapses under hard constraints, the engine should explain it directly:

- too many sounds locked
- only one strict-feasible mapping remains
- layout freedom collapsed so only execution-level differences were available

### Diagnostics Contract

The canonical diagnostics payload should support:

- compare mode
- Event Analysis
- candidate explanation
- rejection explanation
- top cost-driver explanation
- baseline-relative difference explanation

It should clearly separate:

- feasibility: legal vs illegal
- ergonomics: comfortable vs awkward
- performance difficulty: how hard the passage is to execute over time

A useful Phase 1 schema could look like this:

```ts
type DiagnosticsPayload = {
  analyzedSubject: 'active' | 'working' | 'candidate';
  baselineLayoutId?: string;
  objectiveCost: number;
  feasibility: {
    isStrictFeasible: boolean;
    rejectionReasons: string[];
    degradedModeUsed: boolean;
  };
  scoring: {
    topFactors: Array<{ name: string; scope: 'layout' | 'event' | 'transition' | 'sequence'; value: number }>;
    eventFactors: Record<string, Array<{ name: string; value: number }>>;
  };
  diversity?: {
    differsFromBaseline: boolean;
    changedUnlockedPlacements: string[];
    changedSections: string[];
    collapseReason?: string;
  };
  compare?: {
    summary: string;
    improvedFactors: string[];
    worsenedFactors: string[];
  };
};
```

## Stable Sound Identity Refactor

Stable sound identity should be used by:

- `PerformanceEvent`
- mapping resolution
- layout indexing
- structural analysis graphs
- solver input
- candidate explanations
- event-analysis explanations

Imported pitch can remain as metadata for:

- import provenance
- export or notation context
- debug display where useful

Current architecture impact:

- `PerformanceEvent` needs a stable `soundId`
- `performanceStructure.ts` needs sound-keyed graphs and profiles
- `mappingResolver.ts` needs a sound-to-pad index
- `projectState.ts` needs to stop flattening `SoundStream` into note-number-only solver truth
- `Voice` and layout types need to stay compatible while the engine migrates

Migration risks:

- partial migration could leave half the engine keyed by `soundId` and half by `noteNumber`
- structural-analysis outputs may become incompatible with downstream consumers if types change in only one place
- debug and fixture data may rely on note-number identity assumptions

Recommended migration direction:

- add `soundId` and stable `performanceEventId` first
- dual-carry imported pitch as metadata during migration
- update mapping and analysis consumers next
- remove note-number-as-identity assumptions after downstream consumers are migrated

## Compare / Event Analysis Impact

Working layout analysis should use the same feasibility, scoring, diversity, and diagnostics semantics as candidate generation. The only difference is the source state: the analyzed subject is `Working`, not `Candidate`.

Active vs working comparison should show:

- which unlocked placements moved
- whether feasibility changed
- which major cost drivers improved or worsened
- whether the passage is being played strategically differently

Candidate vs active comparison should show:

- why this candidate counts as a real alternative
- which hard constraints shaped it
- which scoring factors made it outrank or underperform the baseline

Event Analysis should show:

- assigned `Pad`
- assigned hand and finger
- strict-feasibility status
- top event and transition cost contributors
- whether the current event belongs to active, working, or candidate analysis

This means Compare mode and Event Analysis should not invent their own parallel logic. They should consume the same canonical diagnostics payload.

## Implementation Plan

### Phase 1A — Feasibility contract

Likely code areas and modules:

- `src/engine/prior/feasibility.ts`
- `src/engine/solvers/beamSolver.ts`
- `src/engine/optimization/annealingSolver.ts`
- `src/engine/optimization/multiCandidateGenerator.ts`
- `src/engine/debug/constraintValidator.ts`

What to change:

- define one strict-feasibility contract shared by beam, annealing, and generation
- remove normal relaxed or degraded candidates from standard generation
- make rejection reasons explicit and reusable

Invariants to preserve:

- exact simultaneous-note handling improvements from V2
- one canonical feasibility interpretation across all normal solve paths

QA checks:

- infeasible layouts never appear in normal candidate pools
- beam and annealing agree on what is feasible
- no silent fallback appears in normal generation

### Phase 1B — Canonical objective cost

Likely code areas and modules:

- `src/engine/evaluation/costFunction.ts`
- `src/engine/evaluation/objective.ts`
- `src/engine/solvers/beamSolver.ts`
- `src/engine/optimization/annealingSolver.ts`
- `src/types/executionPlan.ts`

What to change:

- define one canonical `objectiveCost`
- rename legacy factor labels in canonical output
- make annealing optimize the same scalar that beam search optimizes
- keep factor-level breakdowns for explanation

Invariants to preserve:

- lower `objectiveCost` means better
- factor-level explanation remains available
- public presentation score, if retained, stays separate from objective

QA checks:

- beam, annealing, and candidate ordering all agree on objective direction
- totals include the same factors that ranking uses
- no misleading legacy label survives as canonical truth

### Phase 1C — Diversity enforcement

Likely code areas and modules:

- `src/engine/optimization/multiCandidateGenerator.ts`
- `src/engine/optimization/candidateRanker.ts`
- `src/types/candidateSolution.ts`
- `src/ui/hooks/useAutoAnalysis.ts`

What to change:

- add baseline-relative diversity checks
- reject trivial duplicates
- rank candidates with diversity-aware logic
- attach low-diversity explanations when hard constraints collapse the space

Invariants to preserve:

- multiple candidates remain supported
- explicit locks still constrain the search space
- execution-only diversity counts only when strategically meaningful

QA checks:

- trivial baseline lookalikes are filtered out
- low-diversity cases are explained explicitly
- different strategies still survive when they are genuinely meaningful

### Phase 1D — Diagnostics payload

Likely code areas and modules:

- `src/types/executionPlan.ts`
- `src/engine/debug/types.ts`
- `src/engine/debug/evaluationRecorder.ts`
- `src/engine/debug/candidateReport.ts`
- `src/engine/solvers/beamSolver.ts`

What to change:

- define one canonical diagnostics payload
- capture top cost drivers with consistent names
- emit feasibility status, rejection reasons, baseline-relative differences, and compare summaries

Invariants to preserve:

- existing debug usefulness from V2
- clear separation between feasibility, ergonomics, and performance difficulty

QA checks:

- compare mode and Event Analysis can consume the same payload
- rejected candidates have a readable reason
- cost-driver explanations match actual solver behavior

### Phase 1E — Stable sound identity alignment

Likely code areas and modules:

- `src/types/performanceEvent.ts`
- `src/types/performanceStructure.ts`
- `src/types/voice.ts`
- `src/ui/state/projectState.ts`
- `src/engine/mapping/mappingResolver.ts`
- `src/engine/structure/performanceAnalyzer.ts`

What to change:

- add stable `soundId` and stable event identity to solver-facing types
- re-key mapping resolution and structural analysis
- preserve imported pitch as metadata only

Invariants to preserve:

- existing imported material still loads
- layout and execution remain coupled
- source identity stays stable across analysis and generation

QA checks:

- sound identity survives beyond import pitch
- layout resolution works through `soundId`
- structural-analysis outputs stay coherent after re-keying

## Open Questions

1. During the stable-sound-identity migration, should Phase 1 use a short dual-key period with both `soundId` and legacy `noteNumber`, or is a one-pass breaking refactor safer for this repo?
2. Should the initial diversity filter use explicit threshold constants in code, or should Phase 1 ship with named materiality heuristics first and tune thresholds after golden-fixture review?
3. Should the first canonical diagnostics payload be emitted directly from beam search only, with annealing wrapping it, or should both beam and annealing expose their own trace envelopes in Phase 1?

## Recommended Coding Order

1. Define the strict-feasibility contract and wire it through beam, annealing, and candidate generation.
2. Replace `averageMetrics.total` usage with one canonical `objectiveCost`.
3. Define canonical diagnostics types and emit them from the solver path.
4. Add baseline-relative candidate filtering and production ranking integration.
5. Start the stable-sound-identity migration in solver-facing types and mapping resolution.

## What I would implement first

1. Add a strict-feasibility result type and make `beamSolver`, `annealingSolver`, and `multiCandidateGenerator` all use it.
2. Introduce canonical `objectiveCost` and stop using `averageMetrics.total` as annealing fitness.
3. Replace legacy diagnostic names in canonical output with V3 terms while preserving temporary compatibility adapters only where necessary.
4. Add a baseline-relative candidate-diff function and wire it into generation and ranking.
5. Add `soundId` to solver-facing event types and start replacing note-number-based mapping resolution with sound-based resolution.
