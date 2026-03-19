# Workflow and Task Inventory

## Scope

This document describes the workflows the current repository actually supports. It focuses on user task flow, not just internal architecture. Each workflow distinguishes between explicit support, inferred behavior, and product confusion points.

Primary evidence:

- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/pages/ProjectEditorPage.tsx`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/VoicePalette.tsx`
- `src/ui/components/InteractiveGrid.tsx`
- `src/ui/components/EditorToolbar.tsx`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/components/EventDetailPanel.tsx`
- `src/ui/components/workspace/TransitionDetailPanel.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/hooks/useAutoAnalysis.ts`
- `src/ui/state/projectState.ts`
- `docs/ux-v1-restructure-plan.md`

## Workflow Summary Map

```text
Library
├── New blank project
├── Import MIDI -> name sounds -> create project
├── Import project JSON
├── Open saved project
└── Open demo project

Project Workspace
├── Organize/edit timeline material
├── Assign sounds to pads on grid
├── Generate candidates / re-analyze
├── Inspect event / transition / diagnostics
└── Open pattern composer -> generate/edit material -> sync back into shared timeline

Hidden / Secondary
└── Optimizer debug dashboard
```

## Workflow 1: Create a New Blank Project

| Field | Detail |
|---|---|
| Core task | Start an empty project without imported material |
| Entry points | `+ New Project` button on the library page |
| Prerequisite state/data | None |
| Inputs required | None |
| Main actions | Create empty project -> create default layout -> navigate to workspace |
| System computes | Default `ProjectState`, default empty `Layout`, default engine/instrument configuration |
| Outputs generated | New project record in localStorage, editor route navigation |
| Success condition | User lands in `/project/:id` with empty workspace |
| Failure/confusion points | Workspace opens with no sounds, so primary next step is unclear unless user already understands either timeline import or pattern composer |
| Files/routes/components involved | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/state/projectState.ts`, `src/ui/pages/ProjectEditorPage.tsx` |

## Workflow 2: Import MIDI as a New Project

| Field | Detail |
|---|---|
| Core task | Convert a MIDI file into a PushFlow project |
| Entry points | Library drag/drop zone or hidden file input |
| Prerequisite state/data | MIDI file |
| Inputs required | `.mid` or `.midi` file |
| Main actions | Choose file -> parse MIDI -> analyze structure -> split by pitch into streams -> optionally rename streams -> create project |
| System computes | `Performance`, `sections`, `voiceProfiles`, `SoundStream[]`, `InstrumentConfig`, empty default layout |
| Outputs generated | Project with sound streams and structural metadata |
| Decisions user makes | Whether to rename project, rename sounds, apply GM drum names |
| Success condition | User enters workspace with imported performance material available |
| Failure/confusion points | Import groups by unique note number, not track or channel; this is strong but may not match user mental model for some MIDI sources |
| Files/routes/components involved | `src/ui/pages/ProjectLibraryPage.tsx`, `src/import/midiImport.ts`, `src/engine/structure/performanceAnalyzer.ts` |

## Workflow 3: Open Demo or Saved Project

| Field | Detail |
|---|---|
| Core task | Re-enter an existing project context quickly |
| Entry points | Demo cards or saved project cards on `/` |
| Prerequisite state/data | Existing saved or bundled project |
| Inputs required | Project selection |
| Main actions | Click card -> load or duplicate project -> navigate to editor |
| System computes | For demos, a copied project instance; for saved projects, hydrated project state |
| Outputs generated | Active editor session |
| Success condition | User reaches project workspace with project loaded |
| Failure/confusion points | Saved projects may reopen with stale candidates/cleared analysis, because load resets `analysisResult` and marks analysis stale |
| Files/routes/components involved | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts`, `src/ui/pages/ProjectEditorPage.tsx` |

## Workflow 4: Import or Organize Timeline Material Inside the Project

| Field | Detail |
|---|---|
| Core task | Bring event material into the active project timeline and inspect it over time |
| Entry points | Timeline drawer tab, `Import MIDI` button inside `UnifiedTimeline` |
| Prerequisite state/data | Active project; optional MIDI files |
| Inputs required | One or more MIDI files, or already-present streams |
| Main actions | Open timeline tab -> import files or inspect existing voices -> filter voices -> zoom -> play/stop/reset transport -> click event pills |
| System computes | Lane/source grouping, stream synchronization, beat lines, dummy assignments before analysis |
| Outputs generated | Updated `performanceLanes`, synchronized `soundStreams`, selected event state |
| Decisions user makes | Which files to import, which voices to mute, which event to inspect |
| Branches | If `performanceLanes` exist, they become the driver of `soundStreams`; if not, lanes are populated from streams |
| Where workflows reconnect | Event selection feeds grid highlight, event detail, and transition detail |
| Success condition | User sees timeline material and can inspect or manipulate it in context |
| Failure/confusion points | The timeline is both an authoring view and a derived view; users are not told that lanes may silently overwrite or regenerate `soundStreams` |
| Files/routes/components involved | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/hooks/useLaneImport.ts`, `src/ui/state/lanesToStreams.ts`, `src/ui/state/streamsToLanes.ts` |

## Workflow 5: Assign Sounds to the Push Grid Manually

| Field | Detail |
|---|---|
| Core task | Place sound streams onto physical Push pads |
| Entry points | Voice palette and main grid in workspace |
| Prerequisite state/data | Active project with sound streams |
| Inputs required | At least one sound stream |
| Main actions | Drag stream from palette -> drop on pad -> optionally move, swap, or remove assignments |
| System computes | `Layout.padToVoice` mutations, layout mode updates, analysis staleness |
| Outputs generated | Updated static layout |
| Decisions user makes | What goes where, whether to cluster by hand zone, whether to use multiple layouts |
| Where workflows reconnect | Layout changes drive auto-analysis and candidate generation readiness |
| Success condition | Desired sounds appear on desired pads and grid reflects current layout |
| Failure/confusion points | Because assignment is "move not copy", multi-pad duplication of one sound stream is not the current model; that may or may not match user expectations |
| Files/routes/components involved | `src/ui/components/VoicePalette.tsx`, `src/ui/components/InteractiveGrid.tsx`, `src/ui/state/projectState.ts` |

## Workflow 6: Constrain Hand/Finger Behavior

| Field | Detail |
|---|---|
| Core task | Influence how the solver should play a sound or pad |
| Entry points | Voice palette dropdowns, grid context menu, selected event panel |
| Prerequisite state/data | Active layout; most useful once analysis exists |
| Inputs required | Hand and/or finger selection |
| Main actions | Select sound or selected event -> assign hand/finger constraint -> re-analyze |
| System computes | Updates either `voiceConstraints` or `layout.fingerConstraints`; pad constraints become solver manual assignments |
| Outputs generated | Constrained layout or sound preferences |
| Decisions user makes | Whether the constraint should apply at sound level or pad level |
| Success condition | Re-analysis respects intended constraints |
| Failure/confusion points | Pad constraints clearly feed the solver; voice-level constraints are visible but less clearly integrated, which creates model ambiguity |
| Files/routes/components involved | `src/ui/components/VoicePalette.tsx`, `src/ui/components/EventDetailPanel.tsx`, `src/ui/hooks/useAutoAnalysis.ts`, `src/ui/state/projectState.ts` |

## Workflow 7: Generate Candidate Layouts and Execution Analyses

| Field | Detail |
|---|---|
| Core task | Ask the system to produce optimized candidate solutions |
| Entry points | `Generate` control in top toolbar |
| Prerequisite state/data | At least one active sound stream and a layout context |
| Inputs required | Generation mode: `Quick`, `Thorough`, or `Auto` |
| Main actions | Choose mode -> click Generate -> wait for processing -> review candidates |
| System computes | Optional auto-layout from chromatic fallback, candidate generation, execution plans, difficulty analysis, tradeoff profiles |
| Outputs generated | `candidates[]`, selected candidate, updated `analysisResult` |
| Decisions user makes | Speed/depth tradeoff, which candidate to keep active |
| Where workflows branch | Empty layouts first get auto-filled; otherwise generation uses current layout as base |
| Success condition | Candidates appear and one becomes active |
| Failure/confusion points | Generate can mean both "analyze current layout" and "invent three alternatives"; current UI bundles those ideas into one button |
| Files/routes/components involved | `src/ui/components/EditorToolbar.tsx`, `src/ui/hooks/useAutoAnalysis.ts`, `src/engine/optimization/multiCandidateGenerator.ts`, `src/engine/solvers/beamSolver.ts` |

## Workflow 8: Inspect Analysis Results

| Field | Detail |
|---|---|
| Core task | Understand why a layout is easy, hard, or better than another |
| Entry points | Analysis toggle, Diagnostics toggle, clicking timeline events, compare mode |
| Prerequisite state/data | `analysisResult` or `candidates` |
| Inputs required | Candidate selection, event selection, compare selection |
| Main actions | Open analysis/diagnostics -> switch candidates -> optionally compare candidate B -> click timeline events -> read event/transition panels |
| System computes | Candidate deltas, current transition model, difficulty summaries, suggestions |
| Outputs generated | User understanding rather than new domain data |
| Decisions user makes | Which candidate to inspect, which event matters, whether to compare or keep iterating |
| Where workflows reconnect | Insights often lead back to layout edits, constraints, or generation reruns |
| Success condition | User can explain what is difficult and why |
| Failure/confusion points | "Analysis" panel is mostly a candidate switcher; actual diagnostic depth is split across other panels; no first-class event-analysis workflow frame exists |
| Files/routes/components involved | `src/ui/components/AnalysisSidePanel.tsx`, `src/ui/components/DiagnosticsPanel.tsx`, `src/ui/components/EventDetailPanel.tsx`, `src/ui/components/workspace/TransitionDetailPanel.tsx`, `src/ui/components/CandidateCompare.tsx` |

## Workflow 9: Compare Two Candidates

| Field | Detail |
|---|---|
| Core task | Evaluate two candidate solutions against one another |
| Entry points | Analysis side panel compare tab |
| Prerequisite state/data | At least two candidates |
| Inputs required | Select comparison candidate |
| Main actions | Switch to compare tab -> choose alternate candidate -> inspect metric deltas -> optionally see compare grid mode |
| System computes | Metric deltas, layout compare view |
| Outputs generated | Comparison insight |
| Success condition | User understands relative strengths and weaknesses between two candidates |
| Failure/confusion points | Compare is useful but sits under the same "Analysis" umbrella as non-comparison inspection, which blurs the panel's purpose |
| Files/routes/components involved | `src/ui/components/AnalysisSidePanel.tsx`, `src/ui/components/CandidateCompare.tsx`, `src/ui/components/CompareGridView.tsx` |

## Workflow 10: Compose or Generate New Pattern Material

| Field | Detail |
|---|---|
| Core task | Create new rhythmic/pattern content from inside the project |
| Entry points | Pattern Composer drawer tab |
| Prerequisite state/data | Active project |
| Inputs required | Pattern preset, random seed, custom recipe, or manual grid edits |
| Main actions | Open composer -> add lanes -> edit steps or generate a pattern -> play/stop -> save preset -> clear or revise |
| System computes | `PatternResult` or `RudimentResult`, per-event finger assignments, complexity, pad assignments |
| Outputs generated | Local composer state plus synchronized lane data in the project |
| Decisions user makes | Which recipe to use, which lanes to create, whether to save preset |
| Where workflows reconnect | Composer syncs generated content into shared project timeline and shared grid layout |
| Success condition | New material appears in project timeline and becomes available for broader workspace inspection |
| Failure/confusion points | Composer has its own state model and its own result language (`complexity`, `pad assignments`), yet it changes the same project artifacts as the main workspace |
| Files/routes/components involved | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/state/loopEditorReducer.ts`, `src/engine/pattern/*`, `src/ui/persistence/presetStorage.ts` |

## Workflow 11: Save, Export, and Reopen

| Field | Detail |
|---|---|
| Core task | Preserve project work or move it between sessions |
| Entry points | Save button, export button, save-and-return library button |
| Prerequisite state/data | Active project |
| Inputs required | Optional export destination/filename via browser |
| Main actions | Save to localStorage -> optionally export JSON -> later re-import or reopen |
| System computes | Persistence-safe project payload, hydration defaults on load |
| Outputs generated | Saved local project and/or project file |
| Success condition | User can recover the same project state later |
| Failure/confusion points | Analysis results are intentionally partially reset on load; reopened project may not visually match prior analyzed state until re-analysis occurs |
| Files/routes/components involved | `src/ui/components/EditorToolbar.tsx`, `src/ui/persistence/projectStorage.ts`, `src/ui/pages/ProjectLibraryPage.tsx` |

## Workflow 12: Use the Debug Dashboard

| Field | Detail |
|---|---|
| Core task | Inspect low-level optimizer behavior and sanity heuristics |
| Entry points | Direct route to `/optimizer-debug` |
| Prerequisite state/data | `window.__PUSHFLOW_DEBUG__` populated externally |
| Inputs required | Candidate selection, tab switching, sort fields |
| Main actions | Open route -> inspect timeline, finger, cost, movement, irrational, and sanity tabs |
| System computes | Evaluation records, debug reports, irrational flags, violations, sanity results, movement visual data |
| Outputs generated | Detailed developer-oriented diagnosis |
| Success condition | User or developer can inspect suspicious solver output |
| Failure/confusion points | No normal in-app entry point; not clearly part of the main product definition |
| Files/routes/components involved | `src/ui/pages/OptimizerDebugPage.tsx`, `src/engine/debug/*` |

## Where Workflows Branch or Reconnect

| Branch / Reconnection | Description | Evidence |
|---|---|---|
| Timeline import vs library import | Import can happen before project creation or inside the timeline after the project already exists | `ProjectLibraryPage`, `UnifiedTimeline`, `useLaneImport` |
| Layout editing vs generation | User can manually assign pads first or let Generate auto-seed an empty layout | `InteractiveGrid`, `useAutoAnalysis` |
| Imported material vs composed material | Both feed into the same project timeline, but through different models and vocabularies | `UnifiedTimeline`, `WorkspacePatternStudio`, `loopToLanes` |
| Event inspection vs aggregate diagnostics | Selected event and transition surfaces reconnect to the same `analysisResult` used by diagnostics and candidate compare | event/transition panels, `DiagnosticsPanel` |
| Legacy standalone flows vs current unified workspace | Retained lane and loop views imply older branch points that the current shell collapsed visually but not fully conceptually | `PerformanceLanesView`, `LoopEditorView`, `docs/ux-v1-restructure-plan.md` |

## Workflow Duplication and Confusion Hotspots

### Timeline Duplication

- `UnifiedTimeline` is the active timeline.
- `PerformanceLanesView` is a more explicit lane-management workflow retained in code.
- `TimelinePanel` and `ExecutionTimeline` are an older analysis timeline pairing.

Product implication: there is no singular settled answer to "what the timeline page should be."

### Composer Duplication

- `LoopEditorView` uses explicit local persistence and commit-to-project.
- `WorkspacePatternStudio` uses live synchronization into the shared workspace.

Product implication: the repo contains both "temporary sketchpad" and "always-shared composer" mental models.

### Analysis Duplication

- `AnalysisSidePanel` handles candidate switching/compare.
- `DiagnosticsPanel` handles metrics/suggestions.
- Event/transition panels handle local detail.
- `/optimizer-debug` exposes developer-grade inspection.

Product implication: analysis is a family of surfaces, not a single workflow.

## First-Draft Workflow Conclusion

The current repo supports a real end-to-end user task loop:

1. get performance material into a project
2. place or generate it onto the Push grid
3. analyze playability
4. iterate with edits or constraints
5. compare alternatives

What is missing is not workflow coverage. What is missing is a crisp product decision about which of those steps is the primary task spine and which are support workflows around it.
