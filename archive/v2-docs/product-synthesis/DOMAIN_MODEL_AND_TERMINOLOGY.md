# Domain Model and Terminology

## Scope

This document creates a first-pass glossary and domain model from the repo as it exists today. It distinguishes:

- canonical meaning the docs are trying to enforce
- actual meaning implied by current code
- places where usage is inconsistent or overloaded

Primary evidence:

- `docs/canonical_product_spec.md`
- `PROJECT_CANONICAL_SOURCE_OF_TRUTH.MD`
- `docs/terminology.md`
- `PROJECT_TERMINOLOGY_TABLE.MD`
- `src/types/*`
- `src/ui/state/projectState.ts`
- `src/types/performanceLane.ts`
- `src/types/loopEditor.ts`
- `src/types/patternRecipe.ts`
- `src/ui/components/*`

## Terminology Glossary

| Term | Repo-Implied Definition | Where It Is Used | Consistency | Related / Confused Terms |
|---|---|---|---|---|
| Project | The saved container for all timeline, layout, analysis, and editor state | `ProjectState`, library/editor pages | Mostly consistent | song, workspace session |
| Performance | The time-ordered event sequence analyzed by the solver | canonical docs, `Performance` type, `getActivePerformance()` | Mostly consistent in engine; blurrier in UI | timeline, arrangement |
| Performance Event | A time-stamped trigger with note identity and timing data | `PerformanceEvent`, canonical docs | Consistent | note, hit, event slice |
| Event | Usually a single timed trigger; sometimes colloquially a simultaneity group in docs/audit material | UI panels, engine, docs | Mildly inconsistent | note, time slice, chord |
| Transition | Movement from one event/group to the next | transition detail panel, analyzer code, docs | Consistent | next-event pressure, movement |
| Section | Detected temporal segment of a performance | structure analyzer, difficulty passages | Consistent | phrase, passage |
| Passage | Section-scoped difficulty chunk | `DifficultyAnalysis.passages`, diagnostics | Mostly consistent | section |
| Note | MIDI pitch identity | MIDI import, canonical docs | Consistent in types; often blurred in UI language | sound, voice |
| Sound | User-facing timbral identity such as Kick or Snare | library naming flow, voice palette, canonical docs | Mostly consistent | note, voice, lane |
| Voice | Distinct mapped entity tracked across layout/execution | `Voice` type, canonical docs, layout model | Partially consistent | sound stream, lane, sound |
| Sound Stream | Current project-level per-pitch stream derived from MIDI import or lanes | `ProjectState.soundStreams`, voice palette, timeline | Internally consistent, but conceptually overlaps other terms | voice, lane |
| Performance Lane | Authoring/organizational track derived from imported files or loop conversion | `PerformanceLane` type, `UnifiedTimeline`, lane components | Internally consistent | sound stream, track, voice |
| Lane Group | Collection of related performance lanes, usually by imported file/source | `LaneGroup` type, lane import | Consistent | source group |
| Source File | Record of an imported MIDI source represented in lane structures | `SourceFile` type | Consistent | project import |
| Layout | Full static pad-assignment artifact | canonical docs, `Layout` type, toolbar/UI | Strongly consistent in docs and types | mapping |
| Mapping | Relationship/data structure connecting identities to pads | terminology docs, mapping engine files | Consistent in docs; mixed in historical code/docs | layout |
| Pad | Physical Push button on the 8x8 grid | canonical docs, grid UI | Consistent | cell |
| Grid Position | Physical `(row, col)` coordinate | canonical docs, mapping code | Consistent | pad, note number |
| Cell | Abstract slot/index term; still appears in older docs/components | terminology docs, some legacy V1 material | Intentionally discouraged for current product language | pad |
| Layout Mode | Metadata describing how a layout was created (`manual`, `optimized`, `random`, `auto`, `none`) | `Layout` type, reducers | Consistent | strategy, variant |
| Finger Assignment | Per-event hand/finger decision | canonical docs, `FingerAssignment`, event panels | Consistent | execution plan |
| Execution Plan | Full time-based assignment of events to hands/fingers | canonical docs, `ExecutionPlanResult` | Consistent | fingering, analysis result |
| Candidate Solution | Complete proposal combining layout, execution plan, difficulty analysis, and tradeoff profile | `CandidateSolution` type, analysis UI | Consistent | candidate, result |
| Difficulty Analysis | Section/passage-oriented interpretation of execution difficulty | `DifficultyAnalysis`, diagnostics | Mostly consistent | complexity, score |
| Complexity | Pattern/rudiment-specific burden model used by composer results | `RudimentComplexity`, event stepper | Inconsistent with main `difficulty` language | difficulty |
| Score | Numeric aggregate quality or burden value | `ExecutionPlanResult.score`, difficulty analysis, candidate buttons, diagnostics | Inconsistent | overallScore, total cost, percent |
| Constraint | User- or model-imposed restriction on pad use, fingers, or feasibility | pad/voice constraints, debug/analysis, docs | Broad but understandable | invariant, feasibility rule |
| Feasibility | Whether a move or grip is physically possible | feasibility engine, canonical docs | Consistent in engine/docs | ergonomics, difficulty |
| Ergonomics | Comfort/naturalness/strain tendency | canonical docs, prior model | Consistent conceptually, not always visible in UI labels | feasibility, difficulty |
| Cost | Numeric burden component inside solver and diagnostics | `costFunction`, event detail, diagnostics | Consistent in engine; user meaning is partly opaque | score, metric |
| Metric | Named diagnostic dimension such as movement, stretch, drift, fatigue | diagnostics, tests, debug tools | Mostly consistent | cost component |
| Analysis | Umbrella label for result interpretation | analysis panel, diagnostics, debug route, structural analyzer | Overloaded | diagnostics, compare, structure |
| Diagnostics | More detailed metrics and suggestions panel | `DiagnosticsPanel` | Locally consistent | analysis |
| Pattern | Declarative or generated rhythmic structure in composer | `PatternRecipe`, composer UI | Consistent in composer subsystem | rudiment, loop |
| Rudiment | Older pattern-generation terminology still retained in types/presets/components | `rudiment` engine/types, pattern presets | Historically layered; not fully replaced | pattern |
| Loop | Step-sequencer state model for composer | `LoopState`, `LoopEditorView`, composer | Consistent in composer subsystem | pattern, timeline |
| Workbench | Older V1 user-facing editor term | V1 docs, some history docs | Deprecated in current terminology guidance | grid editor, workspace |
| Workspace | Current top-level editor framing | `PerformanceWorkspace`, UI copy | Current preferred shell term | workbench |
| Arrangement / Arrange | Older lane-oriented organization concept | restructure docs, retained lanes view | Legacy/informal | timeline authoring |
| Timeline | Time-based performance view; currently at least three concrete UIs fit this term | `UnifiedTimeline`, `ExecutionTimeline`, lane views | Overloaded | performance, arrangement, event list |

## Domain Objects

### Canonical or Near-Canonical Objects

| Object | What It Represents | Key Fields | Canonical / Derived / Transient | Evidence |
|---|---|---|---|---|
| `ProjectState` | Whole project container across UI, domain, and persistence | `soundStreams`, `layouts`, `analysisResult`, `performanceLanes`, `voiceConstraints`, transport state | canonical app-state container | `src/ui/state/projectState.ts` |
| `Performance` | Solver-facing event sequence plus tempo/name | `events`, `tempo`, `name` | derived from active project streams | `src/types/performance.ts`, `getActivePerformance()` |
| `PerformanceEvent` | Atomic timed musical event | `noteNumber`, `startTime`, `duration`, `velocity`, `channel`, `eventKey` | canonical event primitive | `src/types/performanceEvent.ts` |
| `Layout` | Static pad assignment artifact | `padToVoice`, `fingerConstraints`, `layoutMode`, `scoreCache` | canonical output artifact | `src/types/layout.ts` |
| `Voice` | Mapped identity placed on the grid | `id`, `name`, `originalMidiNote`, `color`, `sourceType` | canonical mapping identity | `src/types/voice.ts` |
| `FingerAssignment` | One event-level hand/finger decision | `noteNumber`, `startTime`, `assignedHand`, `finger`, `cost`, `row`, `col`, `eventIndex` | canonical micro-level execution object | `src/types/executionPlan.ts` |
| `ExecutionPlanResult` | Full execution artifact from solver | `fingerAssignments`, `score`, `hardCount`, `unplayableCount`, `averageMetrics`, `fatigueMap` | canonical output artifact | `src/types/executionPlan.ts` |
| `CandidateSolution` | Layout + execution + difficulty + tradeoff package | `layout`, `executionPlan`, `difficultyAnalysis`, `tradeoffProfile`, `metadata` | canonical comparison unit | `src/types/candidateSolution.ts` |
| `Section` / `VoiceProfile` / `PerformanceStructure` | Structural reading of a performance | sections, density, roles, graphs | canonical analysis adjunct | `src/types/performanceStructure.ts` |

### Current User-Workflow Objects

| Object | What It Represents | Key Fields | Canonical / Derived / Transient | Evidence |
|---|---|---|---|---|
| `SoundStream` | Per-note project stream shown in palette and timeline | `id`, `name`, `originalMidiNote`, `events`, `muted` | canonical for current solver-facing project workflow | `src/ui/state/projectState.ts` |
| `SoundEvent` | Simplified event inside a `SoundStream` | `startTime`, `duration`, `velocity`, `eventKey` | canonical inside stream model | `src/ui/state/projectState.ts` |
| `PerformanceLane` | Authoring lane derived from imported files or composer conversion | `sourceFileId`, `groupId`, `events`, `isMuted`, `isSolo`, `isHidden` | authoring model, not pure canonical domain | `src/types/performanceLane.ts` |
| `LaneGroup` | Visual organization layer for lanes | `groupId`, `name`, `color`, `orderIndex` | authoring organization | `src/types/performanceLane.ts` |
| `SourceFile` | Imported-file provenance for lanes | `id`, `fileName`, `importedAt`, `laneCount` | authoring/provenance | `src/types/performanceLane.ts` |

### Composer-Specific Objects

| Object | What It Represents | Key Fields | Canonical / Derived / Transient | Evidence |
|---|---|---|---|---|
| `LoopState` | Local step-sequencer state inside composer | `config`, `lanes`, `events`, `isPlaying`, `playheadStep`, `patternResult`, `rudimentResult` | local subsystem state | `src/types/loopEditor.ts` |
| `LoopLane` | One composer lane | `name`, `midiNote`, `orderIndex`, mute/solo flags | local composer object | `src/types/loopEditor.ts` |
| `LoopEvent` | One lane-step activation | `laneId`, `stepIndex`, `velocity` | local composer object | `src/types/loopEditor.ts` |
| `PatternRecipe` | Declarative recipe for generated rhythmic content | `layers`, `variation`, `tags`, `isPreset` | composer/generative object | `src/types/patternRecipe.ts` |
| `PatternResult` | Generated pattern output | `recipe`, `padAssignments`, `fingerAssignments`, `complexity` | derived generative result | `src/types/patternRecipe.ts` |
| `RudimentResult` | Older rudiment-generation result retained in composer subsystem | pad/finger assignments, complexity | derived generative result | `src/types/rudiment.ts` |

## Relationship Map

```text
ProjectState
├── soundStreams[] --------------------┐
│   └── derive active Performance -----┼--> BeamSolver --> ExecutionPlanResult
├── layouts[] -------------------------┘            │
│                                                  ├--> DifficultyAnalysis
├── analysisResult / candidates[] -----------------┘
├── performanceLanes[] <---- sync ----> soundStreams[]
├── laneGroups[] / sourceFiles[]
└── voiceConstraints

WorkspacePatternStudio
└── LoopState
    ├── PatternRecipe / PatternResult / RudimentResult
    └── convertLoopToPerformanceLanes()
         └--> UPSERT_LANE_SOURCE into ProjectState.performanceLanes
              └--> sync back into soundStreams
                   └--> can update layout via BULK_ASSIGN_PADS
```

## Canonical vs Derived vs Transient State Reading

### Most Canonical by Product Intent

- `Layout`
- `ExecutionPlanResult`
- `CandidateSolution`
- `PerformanceEvent`
- `Section`
- `VoiceProfile`

This matches the canonical docs and engine framing.

### Most Canonical by Current App Behavior

- `ProjectState`
- `SoundStream`
- `Layout`
- `analysisResult`

These are the main current UI "truths" the user actually works through.

### Important Derived Objects

- `Performance` from active unmuted `soundStreams`
- `streamAssignments` in `UnifiedTimeline`
- compare candidate selection state
- structural analysis (`sections`, `voiceProfiles`) generated from imported performance

### Important Transient UI Objects

- `selectedEventIndex`
- `compareCandidateId`
- drawer tab, sidebar collapse, grid expand, onion skin
- transport playback position
- temporary pattern recipe editor state

## Terminology Problems

## 1. Voice / Sound / Stream / Lane Are Too Close

Current repo meanings:

- `SoundStream` is the current project-level sequence object.
- `Voice` is the mapped identity stored in layouts.
- `PerformanceLane` is the authoring/organizational object.
- UI labels often say "Sounds."

Result:

- Users may not know whether they are editing a sound identity, a stream, a lane, or a mapped voice.

Evidence:

- `src/ui/state/projectState.ts`
- `src/types/voice.ts`
- `src/types/performanceLane.ts`
- `src/ui/components/VoicePalette.tsx`
- `src/ui/components/UnifiedTimeline.tsx`

## 2. Analysis Means Too Many Different Things

Current uses include:

- structural performance analysis
- candidate switching/comparison
- diagnostic metrics
- event/transition inspection
- optimizer debug dashboards

Result:

- The label `Analysis` in the UI understates how fragmented the analysis surface actually is.

Evidence:

- `src/engine/structure/performanceAnalyzer.ts`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/pages/OptimizerDebugPage.tsx`

## 3. Score Semantics Are Not Stable

Conflicting signals:

- `ExecutionPlanResult.score` comment says lower is better.
- Candidate buttons show `overallScore` as a percentage-like number.
- Diagnostics tooltips describe score as cost where lower is better.
- `BeamSolver.buildResult()` produces a 0-100 style aggregate that reads more like higher-is-better.

Result:

- `score` is currently overloaded and semantically unstable.

Evidence:

- `src/types/executionPlan.ts`
- `src/types/candidateSolution.ts`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/engine/solvers/beamSolver.ts`

## 4. Difficulty vs Complexity

- Main solver/UI uses `difficulty`.
- Composer/rudiment subsystem uses `complexity`.

These are reasonable as distinct concepts, but the product does not clearly explain their relationship.

Evidence:

- `src/types/candidateSolution.ts`
- `src/types/rudiment.ts`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`

## 5. Workbench vs Workspace vs Grid Editor

- Current terminology docs prefer `grid editor` in user-facing contexts.
- Current shell uses `Performance Workspace`.
- Older V1 docs use `Workbench`.

Result:

- Historical materials still leak old naming into product memory.

Evidence:

- `docs/terminology.md`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `Version1/docs/WORKBENCH_DOCUMENTATION.md`

## 6. Event Can Mean Note or Simultaneity Group

- Some docs treat an event as a single trigger.
- Other analysis language treats grouped simultaneous notes as a meaningful event unit.

Result:

- Transition and difficulty reasoning may operate on grouped moments even when UI labels suggest single-note events.

Evidence:

- `docs/canonical_product_spec.md`
- `src/engine/solvers/beamSolver.ts`
- `src/engine/structure/eventGrouping.ts`
- `src/ui/components/EventDetailPanel.tsx`

## First-Pass Canonical Language Recommendation

Based on current evidence, the cleanest first-pass terminology canon for future product artifacts would be:

- `Project`
- `Performance Timeline`
- `Sound` for user-facing identities
- `Sound Stream` only if the implementation distinction matters
- `Layout`
- `Pad`
- `Execution Plan`
- `Candidate Solution`
- `Difficulty Analysis`
- `Constraint`
- `Transition`

And for internal authoring architecture:

- `Performance Lane` may remain, but should be explicitly framed as an authoring structure rather than the canonical product term the user must learn.

## First-Draft Domain Conclusion

The engine-level domain model is comparatively disciplined. The UI-level terminology is not. The largest terminology risk is not a single wrong word; it is that the product currently asks one user to think in several adjacent models at once: stream model, lane model, layout model, execution model, and composer model. Until one of those is explicitly declared primary at the product level, terminology drift will keep reappearing.
