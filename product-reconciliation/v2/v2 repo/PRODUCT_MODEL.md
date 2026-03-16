# Product Model

## Scope Note

- Active runtime: top-level `src/ui`, `src/engine`, `src/types`, and `docs/`.
- Retained product evidence: `Version1/src/pages`, `Version1/src/workbench`, `Version1/src/types`, and `Version1/docs/`.
- The current app is a three-route project-based editor. `Version1/` is not the live shell, but it still defines important screen concepts, terminology, and workflow intent.

## 1. Product Purpose

PushFlow is a Push 3 performance ergonomics system. It converts MIDI-derived or pattern-generated material into a physically playable Push 3 performance by jointly solving:

1. Static pad placement on the 8x8 surface.
2. Dynamic hand and finger execution across time.
3. Analysis and comparison of the resulting tradeoffs.

At the product level, the repository consistently frames the problem as closing the gap between:

- music that is valid in software
- music that is realistically performable by human hands on Ableton Push 3

## 2. Primary User

Primary user:

- A Push 3 performer or producer adapting MIDI material into something physically playable and learnable on the hardware.

Secondary user shapes present in the repo:

- A producer using the composer/pattern tools to sketch playable material.
- A technical or internal user inspecting solver quality through diagnostics and debug pages.

## 3. Core Job-To-Be-Done

When I have musical material that is musically correct but not yet mapped to Push, I want to place it on the Push grid, inspect how human hands would actually play it over time, and iterate until the result is playable, understandable, and worth exporting or practicing.

Supporting JTBDs that are clearly implemented:

- Import MIDI and turn it into a project.
- Compare multiple candidate layouts instead of trusting one answer.
- Inspect difficult passages and transitions event by event.
- Constrain pads or sounds and re-run analysis.
- Generate new rhythmic material inside the same project.

## 4. Major Workflows

### Current runtime workflows

1. Project entry and library management.
2. MIDI import into a new project, plus sound naming.
3. Open saved or demo project.
4. Manually assign sounds to pads.
5. Import or organize timeline material in the unified timeline.
6. Generate candidate layouts and execution plans.
7. Inspect diagnostics, selected events, and transitions.
8. Compose patterns in the drawer and sync them into the shared project.
9. Save and export project JSON.

### Retained legacy workflows from `Version1/`

1. Dashboard-led song portfolio workflow.
2. Dedicated Workbench for layout editing and solver control.
3. Dedicated Event Analysis page.
4. Dedicated Timeline page.
5. Dedicated dev-only cost debug page.

## 5. Core Domain Objects

| Object | Product meaning | Where it appears now |
|---|---|---|
| `Project` | Saved container for timeline, layout, analysis, constraints, and editor state | `src/ui/state/projectState.ts` |
| `Performance` | Solver-facing ordered event sequence | `src/types/performance.ts` |
| `PerformanceEvent` | Atomic timed trigger with note identity and timing | `src/types/performanceEvent.ts` |
| `SoundStream` | Current runtime sound-centric performance representation, usually one stream per unique MIDI pitch | `src/ui/state/projectState.ts` |
| `PerformanceLane` | Authoring-oriented timeline representation grouped by source file/lane metadata | `src/types/performanceLane.ts` |
| `Layout` | Static pad-to-voice assignment artifact | `src/types/layout.ts` |
| `Voice` | Distinct mapped musical identity, usually tied to a MIDI note | `src/types/voice.ts` |
| `ExecutionPlanResult` | Full time-based hand/finger realization of a performance for a layout | `src/types/executionPlan.ts` |
| `FingerAssignment` | Per-event execution decision | `src/types/executionPlan.ts` |
| `CandidateSolution` | Layout + execution plan + difficulty analysis + tradeoff profile | `src/types/candidateSolution.ts` |
| `Section` / `VoiceProfile` | Structural metadata inferred from the imported performance | `src/types/performanceStructure.ts` |
| `NaturalHandPose` | Canonical comfortable hand placement prior | `src/types/ergonomicPrior.ts` |
| `LoopState` | Composer-local step-grid model | `src/types/loopEditor.ts` |
| `PatternRecipe` / `PatternResult` | Declarative pattern-generation model and compiled result | `src/types/patternRecipe.ts` |

## 6. Constraints and Invariants

### Physical and spatial constraints

- Push surface is fixed at 8 rows by 8 columns.
- Pad identity is physical `(row,col)`, not MIDI identity.
- Row indexing is bottom to top; column indexing is left to right.
- Layout quality depends on adjacency, hand zones, reach, and repeated transitions.

### Solver and analysis invariants

- Layout and execution are coupled artifacts; layout alone is not the product answer.
- Events are evaluated temporally, not as isolated hits.
- Simultaneous events are grouped and solved together.
- No two simultaneous notes should share the same finger.
- Feasibility is tiered: strict, relaxed, then fallback.
- Fallback exists to avoid hard solver failure, but it is heavily penalized.

### State and workflow invariants

- `ProjectState` is the active editor source of truth.
- The solver consumes `Performance`, which is derived from unmuted `soundStreams`.
- Any layout mutation marks analysis stale.
- Transport, selection, compare mode, and processing are ephemeral state, not durable product truth.
- Composer edits can upsert project lanes and bulk replace layout assignments.
- Current structural metadata (`sections`, `voiceProfiles`) is mostly import-time derived and can drift after later timeline edits.

## 7. Terminology Glossary

| Canonical term | Meaning | Current repo aliases / nearby terms |
|---|---|---|
| Layout | Full static pad assignment artifact | mapping, grid layout |
| Mapping | Assignment relationship or lookup structure | layout internals |
| Pad | Physical Push button | cell in `Version1/` |
| Grid position | `(row,col)` coordinate | pad key |
| Performance event | Timed musical trigger | note event in `Version1/` |
| Sound | User-facing timbral identity | stream name, lane name |
| Voice | Distinct mapped musical identity | sound asset in `Version1/` |
| Sound stream | Current runtime sound-centric performance representation | active streams |
| Performance lane | Authoring-centric timeline representation | lanes |
| Execution plan | Full hand/finger timeline | solver result, fingering plan |
| Finger assignment | One event-level execution decision | debug event in `Version1/` |
| Difficulty analysis | Aggregate burden summary | score, diagnostics |
| Complexity | Composer-local burden metric for generated patterns | not the same as main difficulty model |
| Candidate solution | Layout + execution + analysis bundle | candidate |
| Natural hand pose | Comfortable prior hand geometry | pose0 in older code/docs |
| Hand zone | Preferred left/right region on grid | left zone, right zone |

## 8. Product Reading

The strongest normalized reading of the repository is:

- Core product: Push performance verification and optimization.
- Active shell: project library plus a unified performance workspace.
- Secondary pillar: generative pattern authoring inside the same project.
- Ongoing ambiguity: the repo still contains multiple timeline models, multiple analysis surfaces, and a retained `Version1/` screen architecture that is clearer in some areas than the current runtime.
