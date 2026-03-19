# ENGINE_ARCHITECTURE_COMPARISON

Method: code-first comparison of `../PushFlow/Version1` and `../PushFlow`. Statements below are facts unless explicitly marked as inference.

## Executive Verdict

V2 is not a clean-sheet engine rewrite. It is a partial architecture improvement layered on top of the V1 solver core. The real V2 wins are:

- better separation between persisted project truth and cached analysis (`../PushFlow/src/ui/persistence/projectStorage.ts:176-230`)
- a better authoring/source model (`../PushFlow/src/ui/state/projectState.ts:21-43`, `../PushFlow/src/types/performanceLane.ts`)
- materially better beam-search chord handling and feasibility modeling (`../PushFlow/src/engine/solvers/beamSolver.ts:247-304`, `../PushFlow/src/engine/prior/biomechanicalModel.ts:72-195`)
- materially better debug and constraint-surfacing tools (`../PushFlow/src/engine/debug/*.ts`, `../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:1-257`)
- deeper optimization infrastructure around annealing and mutations (`../PushFlow/src/types/engineConfig.ts:91-134`, `../PushFlow/src/engine/optimization/mutationService.ts:52-99`, `:376-435`)

The real V2 losses or unresolved carryovers are:

- solver truth is still keyed by imported MIDI note number, so the advertised "sound identity decoupled from pitch identity" shift is only partial (`../PushFlow/src/ui/state/projectState.ts:103-116`)
- manual override semantics are still wrong for simultaneous groups (`../PushFlow/src/engine/solvers/beamSolver.ts:895-1004`; V1 same bug at `../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:903-1003`)
- score semantics and display semantics are still conceptually inconsistent
- annealing still optimizes a legacy aggregate metric instead of the real primary objective, and V2 accidentally drops manual constraints during annealing inner-loop evaluation (`../PushFlow/src/engine/optimization/annealingSolver.ts:77-135`, `:168-396`; `../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:314-334`)

V3 should keep V2's improved structure and diagnostics, but it should not preserve V2's mixed domain truth or legacy metric taxonomy.

## Import Pipeline Architecture

### V1 approach

- `parseMidiProject()` directly produces solver-facing `Performance`, `Voice[]`, `InstrumentConfig`, and an empty `GridMapping` (`../PushFlow/Version1/src/utils/midiImport.ts:53-238`).
- Imported events remain flat `Performance.events`, with `noteNumber` as the long-term identity (`../PushFlow/Version1/src/types/performance.ts:79-114`).
- Import intentionally leaves the grid empty and all sounds effectively unassigned (`../PushFlow/Version1/src/utils/midiImport.ts:196-218`).

### V2 approach

- `parseMidiProject()` is mostly a terminology port: same extraction, same unique-note derivation, same empty-layout return (`../PushFlow/src/import/midiImport.ts:77-188`).
- The actual authoring import path now runs through lanes: `useLaneImport()` groups events by unique pitch into `PerformanceLane[]` (`../PushFlow/src/ui/hooks/useLaneImport.ts:46-98`).
- Lanes are converted to `SoundStream[]` via `buildSoundStreamsFromLanes()` (`../PushFlow/src/ui/state/lanesToStreams.ts:21-48`).

### Strengths

- V1 import is simple and honest. There is no false abstraction layer.
- V2 adds a useful authoring stage between raw MIDI and solver execution. That is a real improvement for V3 because it gives editing freedom before solving.

### Weaknesses

- V1 has no canonical source model beyond flat note events.
- V2 still groups by unique MIDI pitch at import time. It does not actually model imported sounds independently from imported pitches.

### Recommendation for V3

- Preserve V2's staged import architecture: MIDI -> source lanes/time-series -> canonical sound streams -> solver performance view.
- Remove the assumption that one unique MIDI pitch always becomes one long-lived sound identity.
- Canonical source truth should preserve imported pitch as provenance metadata, not as the primary solver identity.

## Canonical Musical / Performance Representation

### V1 approach

- Canonical truth is `Performance.events: NoteEvent[]` (`../PushFlow/Version1/src/types/performance.ts:100-114`).
- Every event carries `noteNumber`, and that same number drives mapping lookup, solver behavior, and long-term sound identity.

### V2 approach

- Persisted project truth claims `soundStreams` are canonical (`../PushFlow/src/ui/state/projectState.ts:57-63`).
- Each `SoundStream` stores timing events separately from stream metadata (`../PushFlow/src/ui/state/projectState.ts:21-43`).
- But `getActivePerformance()` flattens streams back into solver events whose `noteNumber` equals `stream.originalMidiNote` (`../PushFlow/src/ui/state/projectState.ts:103-116`).

### Strengths

- V1 is consistent, even if conceptually crude.
- V2 is directionally better because it introduces a time-series container separate from transient UI objects.

### Weaknesses

- V1 over-couples import pitch, sound identity, and pad mapping.
- V2 is architecturally split-brain: persisted truth says "stream", solver truth still says "imported pitch".

### Recommendation for V3

- V3 needs one canonical event identity model:
  - `SoundId` / `StreamId` for persistent sound identity
  - `PerformanceEventId` for timeline event identity
  - optional import provenance such as `rawPitch`, `rawChannel`, `sourceFileId`
- Solver input should reference `soundId`, not imported MIDI note number.

## Sound / Voice Identity Model

### V1 approach

- `Voice.originalMidiNote` is the core identity used by mapping and solving (`../PushFlow/Version1/src/types/layout.ts:17-30`, `../PushFlow/Version1/src/engine/mappingResolver.ts:37-50`).

### V2 approach

- `SoundStream` is introduced as a supposedly pitch-independent sound track, but still stores `originalMidiNote` and feeds it back into solver events (`../PushFlow/src/ui/state/projectState.ts:30-43`, `:103-116`).
- `Voice` remains pitch-based at layout level (`../PushFlow/src/types/voice.ts:8-20`).

### Strengths

- V1 is operationally straightforward.
- V2 surfaces the correct product idea: sound identity should outlive raw note import details.

### Weaknesses

- Neither version actually decouples sound identity from imported pitch in solver truth.

### Recommendation for V3

- Keep V2's "stream" direction.
- Rewrite the actual engine-facing identity model so layout and solver operate on sound IDs, not `originalMidiNote`.

## Layout / Mapping Model

### V1 approach

- `GridMapping.cells` maps pad -> `Voice` (`../PushFlow/Version1/src/types/layout.ts:50-75`).
- `mappingResolver` builds reverse note->pad index from `voice.originalMidiNote` (`../PushFlow/Version1/src/engine/mappingResolver.ts:30-51`).

### V2 approach

- Same structure with renamed fields: `Layout.padToVoice` and `hashLayout()` (`../PushFlow/src/types/layout.ts:24-44`, `../PushFlow/src/engine/mapping/mappingResolver.ts:39-53`, `:123-127`).
- Resolver remains pitch keyed (`../PushFlow/src/engine/mapping/mappingResolver.ts:39-53`, `:94-113`).

### Strengths

- Both versions have a clear O(1) resolution path once the reverse index is built.
- V2 naming is cleaner.

### Weaknesses

- Both versions treat layout as a mapping from pad to pitch-derived voice rather than pad to canonical sound.

### Recommendation for V3

- Preserve the reverse-index resolver architecture.
- Replace note-number indexing with sound-id indexing.
- Keep layout immutable and hashable for optimization/debug identity.

## Hand / Finger Assignment Model

### V1 approach

- Beam nodes track left/right hand pose plus per-group note assignments (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts`).
- One-hand chord assignment incorrectly uses finger array order instead of exact pad-to-finger match (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:301-344`).

### V2 approach

- Same high-level model, but one-hand and split-hand chord paths now map notes to exact finger coordinates (`../PushFlow/src/engine/solvers/beamSolver.ts:290-304`, `:472-490`).
- V2 also deduplicates pads before grip generation (`../PushFlow/src/engine/solvers/beamSolver.ts:247-259`, `:404-415`).

### Strengths

- V2 corrects a real beam-search correctness defect from V1.

### Weaknesses

- Manual overrides are still applied at group scope instead of per event in both versions.

### Recommendation for V3

- Preserve V2's exact note-to-finger mapping logic.
- Rewrite manual override handling so a single constrained event does not coerce the entire simultaneous group.

## Analysis Pipeline

### V1 approach

- Very little explicit structural analysis. Most "analysis" is solver output plus UI-derived metrics (`../PushFlow/Version1/src/engine/eventMetrics.ts`, `../PushFlow/Version1/src/pages/CostDebugPage.tsx:1-145`).

### V2 approach

- Adds explicit `PerformanceStructure` analysis: simultaneity, density, sections, co-occurrence, transitions, motifs, and voice roles (`../PushFlow/src/engine/structure/performanceAnalyzer.ts:24-60`, `../PushFlow/src/types/performanceStructure.ts:1-144`).

### Strengths

- V2 is much stronger structurally. This is a real engine-level improvement, not just UI scaffolding.

### Weaknesses

- The structure layer still uses `noteNumber` as the "voice" key (`../PushFlow/src/types/performanceStructure.ts:43-55`, `:97-108`).

### Recommendation for V3

- Preserve V2's structure-analysis layer.
- Re-key the graphs and profiles on canonical sound IDs.

## Optimization Pipeline

### V1 approach

- Beam search is the main execution planner.
- Annealing wraps beam search and evaluates layouts with `result.averageMetrics.total` (`../PushFlow/Version1/src/engine/solvers/AnnealingSolver.ts:116-183`).

### V2 approach

- Beam search remains the core execution planner.
- Annealing becomes configurable (`FAST_ANNEALING_CONFIG`, `DEEP_ANNEALING_CONFIG`) and deeper (`../PushFlow/src/types/engineConfig.ts:91-134`).
- Mutations are richer: swap, move, cluster swap, row/col shift, zone transfer (`../PushFlow/src/engine/optimization/mutationService.ts:52-99`, `:190-327`, `:376-435`).

### Strengths

- V2 meaningfully improves exploration depth and operational flexibility.

### Weaknesses

- Both versions optimize a legacy aggregate metric rather than the solver's real primary beam score.
- V2 SA inner loop ignores manual assignments (`../PushFlow/src/engine/optimization/annealingSolver.ts:77-135`, `:168-396`).

### Recommendation for V3

- Preserve V2's optimization staging and richer neighborhood.
- Rewrite the objective plumbing so beam, annealing, and candidate comparison optimize the same canonical cost.

## Candidate Generation Pipeline

### V1 approach

- No first-class candidate artifact. A solver run returns one mapping/result pair.

### V2 approach

- First-class `CandidateSolution` artifact combines layout, execution plan, difficulty analysis, and tradeoff profile (`../PushFlow/src/types/candidateSolution.ts:81-92`).
- Multi-candidate generation supports baseline, compact-right, compact-left, pose0-offset strategies (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:82-93`, `:178-235`).

### Strengths

- V2 is clearly superior here. Candidate objects are the right abstraction for V3.

### Weaknesses

- "Ranking results..." in UI does not actually call `candidateRanker`; candidates are dispatched in generation order (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:243-247`).
- Repo-wide search found no call sites for `rankCandidates()` / `filterPareto()` outside their own module and the barrel export, so ranking infrastructure exists but is not integrated.

### Recommendation for V3

- Preserve `CandidateSolution`.
- Wire candidate ranking into production, not just into a utility module.

## Debug / Validation Architecture

### V1 approach

- Strong test suite and a basic cost-debug page (`../PushFlow/Version1/src/engine/__tests__/README.md:65-94`, `../PushFlow/Version1/src/pages/CostDebugPage.tsx:1-145`).
- Debug is mostly cost totals and event tables, not explicit rule-violation surfacing.

### V2 approach

- Explicit validator, sanity checks, irrational detector, evaluation recorder, candidate report, and dedicated debug dashboard (`../PushFlow/src/engine/debug/*.ts`, `../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:1-257`).

### Strengths

- V2 is much better for practical debugging.

### Weaknesses

- Some V2 debug signals are reconstructed after the fact rather than emitted from the solver trace (`../PushFlow/src/engine/debug/evaluationRecorder.ts:76-137`).
- `constraintValidator.ts` claims to detect "span exceeded" but does not actually implement span detection (`../PushFlow/src/engine/debug/constraintValidator.ts:4-10`, `:31-47`).

### Recommendation for V3

- Keep V2's explicit debug architecture.
- Add true solver-trace instrumentation and close the gap between advertised and implemented checks.

## Persistence Or Cache Assumptions That Affect Engine Truth

### V1 approach

- Persists `solverResults`, `manualAssignments`, and full engine state as part of project truth (`../PushFlow/Version1/src/types/projectState.ts:54-64`, `../PushFlow/Version1/src/utils/projectPersistence.ts:118-135`).
- Strict validation is strong, but cached solver outputs are mixed into persisted truth.

### V2 approach

- Persisted `ProjectState` treats analysis as ephemeral and resets `analysisResult` plus `analysisStale` on load (`../PushFlow/src/ui/persistence/projectStorage.ts:195-230`).

### Strengths

- V1 strict validation is stronger.
- V2 cache invalidation model is architecturally more correct.

### Weaknesses

- V1 risks stale solver truth masquerading as canonical truth.
- V2 introduces `voiceConstraints` in state but solver wiring only consumes `layout.fingerConstraints`; repo-wide search did not find engine use of `voiceConstraints`.

### Recommendation for V3

- Merge V1 strict validation with V2's cache-invalidating persistence model.
- Persist domain truth, layout truth, and explicit user constraints.
- Do not persist derived execution plans as canonical truth.

