# Product Overview First Draft

## Scope and Method

This document synthesizes the product definition implied by the current repository, not the product definition the app ideally should have. Conclusions are based on the current React app in `src/`, the canonical intent documents in `docs/` and project-root markdown files, the older `Version1/` UX documentation, the engine and state models, and the current test suite.

Evidence anchors used throughout this package include:

- `docs/canonical_product_spec.md`
- `PROJECT_CANONICAL_SOURCE_OF_TRUTH.MD`
- `docs/terminology.md`
- `docs/ux-v1-restructure-plan.md`
- `tasks/ux-audit.md`
- `src/ui/App.tsx`
- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/state/projectState.ts`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/engine/solvers/beamSolver.ts`
- `test/golden/goldenScenarios.test.ts`
- `Version1/docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md`
- `Version1/docs/WORKBENCH_DOCUMENTATION.md`

## One-Paragraph Product Summary

PushFlow currently appears to be a project-based tool for turning MIDI-derived material into a physically playable Ableton Push 3 performance by combining three tightly related concerns: organizing a performance timeline, assigning sounds or voices to the Push 8x8 pad grid, and evaluating or generating hand/finger execution plans for that layout over time. The engine-level product vision is comparatively clear and well documented: optimize a static `Layout` and a dynamic `Execution Plan` together. The UX-level product definition is less clear: the live app now centers on a unified `Performance Workspace`, but that workspace still carries traces of multiple older workflows and overlapping state models.

## Likely Primary Users

### Explicitly Supported by Docs

- Push 3 performers adapting MIDI material for real physical playability.
- Producers using Push as a live performance surface rather than only a programming surface.
- Advanced users comparing alternate layouts and execution strategies.

Evidence:

- `docs/canonical_product_spec.md`
- `PROJECT_CANONICAL_SOURCE_OF_TRUTH.MD`
- `tasks/ux-audit.md`

### Inferred from the Current App

- Users comfortable importing MIDI and reasoning in note-, lane-, and grid-level abstractions.
- Users willing to iterate on playability using diagnostics rather than only listening output.
- Internal or power users who may inspect solver/debug surfaces.

Evidence:

- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/pages/OptimizerDebugPage.tsx`

## Likely Core Job To Be Done

When a musician has MIDI or pattern material that is musically valid but not yet physically mapped to Push, they want to place sounds on the grid, inspect how the performance would actually be executed by human hands over time, and iteratively improve the result so it becomes playable, learnable, and comparable across alternatives.

This JTBD is explicit in the canonical docs and reinforced by the engine architecture. It is also consistent with the current unified workspace copy: timeline editing, grid response, and composer output are framed as parts of the same performance problem.

Evidence:

- `docs/canonical_product_spec.md`
- `docs/ux-v1-restructure-plan.md`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`

## Major Workflows the App Appears to Support

### Clear, Current Workflows

1. Import a MIDI file into a new project, optionally rename detected sounds, and enter a project workspace.
2. Open a saved or demo project from the library.
3. Manually assign sounds to pads on the Push grid.
4. Generate candidate layouts and execution analyses from the current project state.
5. Inspect candidate results, per-event details, and transition details.
6. Organize or filter timeline material in the unified performance timeline.
7. Create or generate loop/pattern material in the pattern composer and sync it into the shared project timeline.
8. Save or export project state as JSON.

Evidence:

- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/EditorToolbar.tsx`
- `src/ui/components/InteractiveGrid.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`

### Hidden or Secondary Workflows

1. Use a separate optimizer debug dashboard at `/optimizer-debug`.
2. Use older lane-management and loop-editor surfaces that still exist in code but are not part of the active route shell.

Evidence:

- `src/ui/pages/OptimizerDebugPage.tsx`
- `src/ui/components/lanes/PerformanceLanesView.tsx`
- `src/ui/components/loop-editor/LoopEditorView.tsx`
- `src/ui/components/TimelinePanel.tsx`

## Major Subsystems / Modules

| Subsystem | What It Appears To Own | Evidence |
|---|---|---|
| Project library and persistence | Project list, demo entry points, MIDI import, JSON import/export, localStorage persistence | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` |
| Unified workspace shell | Current primary editor frame and panel orchestration | `src/ui/components/workspace/PerformanceWorkspace.tsx` |
| Grid/layout editing | Sound placement, swaps, removals, onion-skin overlays, per-pad constraints | `src/ui/components/InteractiveGrid.tsx`, `src/types/layout.ts` |
| Timeline authoring and playback | Lane-derived timeline display, transport, lane import, event selection | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/hooks/useLaneImport.ts` |
| Pattern composer | Local loop state, pattern generation, preset save/load, sync into project lanes and layout | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/state/loopEditorReducer.ts` |
| State and hydration | Canonical project state, reducer, undo/redo, lane synchronization | `src/ui/state/projectState.ts`, `src/ui/state/ProjectContext.tsx`, `src/ui/state/lanesReducer.ts` |
| Solver and optimization engine | Beam search execution planning, multi-candidate optimization, difficulty analysis | `src/engine/solvers/beamSolver.ts`, `src/engine/optimization/multiCandidateGenerator.ts`, `src/engine/evaluation/difficultyScoring.ts` |
| Structural analysis | Sections, density, voice roles, transition graph, co-occurrence graph | `src/engine/structure/performanceAnalyzer.ts` |
| Diagnostics and explainability | Difficulty heatmaps, suggestions, candidate comparison, debug dashboard | `src/ui/components/DiagnosticsPanel.tsx`, `src/ui/components/CandidateCompare.tsx`, `src/ui/pages/OptimizerDebugPage.tsx` |

## Current State of the Product

### Overall Assessment

The product is best described as:

- coherent at the engine and domain-model level
- partially coherent at the workspace level
- fragmented at the workflow and state-model level
- still carrying visible legacy duplication
- somewhat experimental in UX architecture

### Why It Feels Partially Coherent

What is strong:

- The repository repeatedly states the same core problem: jointly optimize Push pad layout and temporal execution.
- The biomechanical model, feasibility rules, and test fixtures reinforce a concrete notion of playability.
- The current `Performance Workspace` is an intentional attempt to unify what had previously been split across separate tabs.

What is weak:

- The current workspace merges multiple task families into one page without fully resolving which task is primary.
- Older parallel surfaces still exist in code, implying unresolved product boundaries.
- The authoritative performance model is not singular from a user-workflow perspective; `soundStreams`, `performanceLanes`, and local composer `LoopState` all compete to represent "the timeline."

## Key Product Tensions or Contradictions

### 1. Clear Core Problem, Blurry Primary Workflow

The repo is clear that the product is about Push playability. It is much less clear whether the user should primarily start from:

- imported MIDI lanes
- manual sound-to-pad layout
- candidate generation
- event-level analysis
- or pattern composition

Evidence:

- `docs/canonical_product_spec.md`
- `docs/ux-v1-restructure-plan.md`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`

### 2. "Unified Workspace" vs Multiple Underlying Editors

The current shell presents a unified workspace, but underneath it still combines:

- a lane/timeline authoring system
- a grid editing system
- a candidate analysis system
- a pattern composer with its own reducer and result model

This is a product integration move, but not yet a fully unified product model.

Evidence:

- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/state/projectState.ts`
- `src/ui/state/loopEditorReducer.ts`

### 3. Canonical Terminology vs Real UI Language Drift

The docs try hard to canonize terms such as `layout`, `execution plan`, and `grid editor`, but the live code still mixes:

- sound, voice, lane, stream
- analysis vs diagnostics
- difficulty vs score vs complexity
- workbench vs workspace vs grid editor

Evidence:

- `docs/terminology.md`
- `PROJECT_TERMINOLOGY_TABLE.MD`
- `src/ui/components/VoicePalette.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`

### 4. Rich Engine/Debug Logic vs Thin User-Facing Explanation

The engine, tests, and debug tools contain deep reasoning about feasibility, alternation, balance, and irrational assignments. The main user-facing analysis layer is much thinner than that depth suggests.

Evidence:

- `src/engine/debug/*`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/pages/OptimizerDebugPage.tsx`

### 5. V1 Had a Clearer UX Spine for Analysis, V2 Has a Clearer Unified Intent

The older codebase and docs show a more explicitly tasked flow around dashboard/workbench/event analysis. The current app has a better statement of unified intent, but the legibility of the analysis experience appears weaker than in V1.

Evidence:

- `Version1/docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md`
- `Version1/docs/WORKBENCH_DOCUMENTATION.md`
- `docs/ux-v1-restructure-plan.md`
- `tasks/ux-audit.md`

## Where the Product Vision Appears Clear vs Blurry

### Relatively Clear

- The target surface: Ableton Push 3 8x8 grid.
- The central artifacts: `Layout`, `Execution Plan`, candidate alternatives, difficulty analysis.
- The importance of biomechanical realism and real physical feasibility.
- The need to analyze simultaneity, transitions, and full-sequence burden rather than isolated hits.
- The importance of comparing alternatives rather than implying one universal best layout.

Evidence:

- `docs/canonical_product_spec.md`
- `PROJECT_CANONICAL_SOURCE_OF_TRUTH.MD`
- `src/engine/solvers/beamSolver.ts`
- `test/golden/goldenScenarios.test.ts`

### Blurry

- The single primary user mission inside the editor.
- Whether pattern generation is core product scope or a secondary adjunct tool.
- Whether `performanceLanes` or `soundStreams` is the practical source-of-truth timeline model.
- Whether analysis is meant to be candidate comparison, event inspection, or full ergonomic explanation.
- Whether export beyond JSON is part of the real present product or still aspirational.
- Whether old hidden surfaces should be considered legacy, backup, or still intended product directions.

Evidence:

- `src/ui/state/projectState.ts`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `tasks/ux-audit.md`
- `Version1/adg_remapper.py`

## Highest-Value Human Decisions Needed

1. Decide the one primary mission of the product editor: verify imported performances, author performances, generate new performances, or compare candidate layouts. The current workspace tries to do all four.
2. Decide the canonical user-facing performance model: `sound streams`, `performance lanes`, or a new consolidated timeline concept. The current product behavior depends on all three, plus composer-local `LoopState`.
3. Decide whether the pattern composer is a core product pillar or a secondary creation aid. Right now it materially changes the shared timeline and layout, so it is not a harmless side feature.
4. Decide the primary analysis experience. The codebase contains candidate comparison, event detail, transition detail, diagnostics, and a separate debug dashboard, but no clearly dominant analysis path.
5. Decide whether the older V1 event-analysis spine should define the future UX baseline. The current repo itself suggests that V1 had stronger task clarity for event-by-event ergonomic understanding.
6. Decide the real scope of export and downstream use. JSON export exists; Ableton-oriented export is described in docs and older utilities but is not part of the current live product shell.
7. Decide how much product surface should stay visible. Hidden legacy components and debug pages currently enlarge the conceptual product even when they are not routed for normal users.
