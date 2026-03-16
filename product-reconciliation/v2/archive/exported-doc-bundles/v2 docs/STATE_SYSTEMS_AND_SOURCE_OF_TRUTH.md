# State Systems and Source of Truth

## Goal

This document summarizes how the product currently works from a state-ownership perspective. It is product-facing rather than implementation-exhaustive: the goal is to clarify what the app treats as truth, what is derived, and where duplicated or mirrored state creates ambiguity.

Primary evidence:

- `src/ui/state/projectState.ts`
- `src/ui/state/ProjectContext.tsx`
- `src/ui/state/useUndoRedo.ts`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/state/lanesReducer.ts`
- `src/ui/state/lanesToStreams.ts`
- `src/ui/state/streamsToLanes.ts`
- `src/ui/state/loopEditorReducer.ts`
- `src/ui/state/loopToLanes.ts`
- `src/ui/hooks/useAutoAnalysis.ts`
- `src/ui/persistence/projectStorage.ts`
- `docs/repo_map.md`

## State System Overview

| State System | Scope | What It Owns | Source of Truth Status |
|---|---|---|---|
| `ProjectState` in `ProjectContext` | Whole active project editor session | sounds, layouts, analysis cache, constraints, lanes, transport, errors, UI selection | primary application truth |
| Local workspace UI state | `PerformanceWorkspace` component | drawer tab, panel visibility, sidebar collapse, onion skin, grid expansion | local presentation truth |
| Timeline-local UI state | `UnifiedTimeline` | zoom, search filter, file input refs | local presentation truth |
| Composer-local `LoopState` | `WorkspacePatternStudio` | loop config, composer lanes, composer events, pattern/rudiment results, playhead | local subsystem truth |
| Persisted project state | localStorage via `projectStorage` | serialized project snapshot | persistent stored truth, but partially rehydrated/reset |
| Persisted composer presets | localStorage via `presetStorage` | saved composer presets | persistent subsystem truth |
| Older loop-editor persistence | localStorage via `loopStorage` | standalone loop editor state | legacy persistent truth |
| Engine-computed result state | solver + optimization outputs | execution plan, candidate solutions, difficulty analysis | derived truth/cache |
| Debug global payload | `window.__PUSHFLOW_DEBUG__` | candidates and latest result for debug route | debug-only auxiliary truth |

## Primary Global State Store

## `ProjectState`

`ProjectState` is the main container the current app actually depends on. It owns both domain data and some editor-facing transient data.

Major fields:

- identity: `id`, `name`, timestamps, `isDemo`
- performance-ish data: `soundStreams`, `tempo`, `instrumentConfig`, `sections`, `voiceProfiles`
- spatial data: `layouts`, `activeLayoutId`
- analysis cache: `analysisResult`, `candidates`, `selectedCandidateId`
- authoring data: `performanceLanes`, `laneGroups`, `sourceFiles`
- constraint data: `voiceConstraints`
- ephemeral editor state: `selectedEventIndex`, `compareCandidateId`, `isProcessing`, `error`, `analysisStale`
- transport: `currentTime`, `isPlaying`

Evidence:

- `src/ui/state/projectState.ts`

## Undo/Redo Ownership

Undo/redo wraps the reducer but excludes ephemeral actions such as selection, processing, errors, transport, candidate switching, and analysis cache updates.

Meaning:

- the app treats layout and authoring edits as history-worthy
- it treats most inspection and playback state as disposable

Evidence:

- `src/ui/state/useUndoRedo.ts`
- `src/ui/state/projectState.ts`

## Likely Source-of-Truth Objects

### 1. Layout Truth

The active layout in `ProjectState.layouts` is the clear spatial source of truth.

Why:

- grid uses it directly
- generate/analyze uses it directly
- constraints are stored on it
- compare and candidates package alternate layouts alongside execution plans

Evidence:

- `getActiveLayout()` in `projectState.ts`
- `InteractiveGrid`
- `useAutoAnalysis`

### 2. Analysis Truth

`analysisResult` is the active displayed result; `candidates[]` are the retained alternatives.

Why:

- diagnostics read `analysisResult`
- event detail and transition detail read `analysisResult.executionPlan`
- analysis compare reads `candidates[]`

Important nuance:

- `analysisResult` is a cache, not immutable product truth
- it is regularly invalidated and can be stale or reset on reload

Evidence:

- `src/ui/state/projectState.ts`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/persistence/projectStorage.ts`

### 3. Performance Truth Is Ambiguous

This is the major state-model issue in the repo.

There are three strong contenders:

1. `soundStreams`
2. `performanceLanes`
3. composer-local `LoopState`

Only one of them should feel canonically primary to a user, but the current app uses all three.

## `soundStreams` as Solver-Facing Truth

`getActivePerformance()` derives the solver input from unmuted `soundStreams`.

Implication:

- the engine sees `soundStreams` as the actual performance material

Evidence:

- `src/ui/state/projectState.ts`

## `performanceLanes` as Authoring Truth

The timeline imports into `performanceLanes`, and `UnifiedTimeline` explicitly synchronizes lanes back into streams whenever lanes exist.

Implication:

- in real editing sessions, `performanceLanes` often become the hidden driver of `soundStreams`

Evidence:

- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/state/lanesToStreams.ts`
- `src/ui/state/lanesReducer.ts`

## `LoopState` as Composer Truth

The pattern composer owns a separate reducer with its own lanes/events/config and then converts that into performance lanes for insertion into the project.

Implication:

- composer authoring starts from a distinct timeline model before being merged into project truth

Evidence:

- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/state/loopEditorReducer.ts`
- `src/ui/state/loopToLanes.ts`

## Derived State

| Derived State | Derived From | Why It Exists | Risk |
|---|---|---|---|
| `Performance` | `soundStreams` | Solver-facing normalized sequence | If streams are stale relative to lanes, analysis uses wrong material |
| active layout | `layouts` + `activeLayoutId` | Current layout selection | Null risk if IDs drift |
| active streams | `soundStreams` filtered by mute | Current visible/analyzed material | Straightforward |
| candidate comparison mode | `selectedCandidateId` + `compareCandidateId` | Enables compare grid/panel | Compare view depends on multiple synchronized states |
| stream assignments map in timeline | `analysisResult` + `soundStreams` | Display finger assignment pills per stream | Falls back to dummy data pre-analysis |
| structural metadata | imported performance | Difficulty explanation context | Can lag behind later timeline edits |

## Persisted State

## Project Persistence

Persisted:

- core project identity
- `soundStreams`
- layouts
- candidates
- authoring data (`performanceLanes`, groups, source files)
- engine config
- constraints

Not persisted or reset on load:

- selected event
- compare candidate
- processing
- errors
- current playback state
- current time
- analysis is marked stale
- `analysisResult` is cleared on load

Evidence:

- `src/ui/persistence/projectStorage.ts`
- `LOAD_PROJECT` in `src/ui/state/projectState.ts`

## Presets and Legacy Loop Persistence

- composer presets are stored separately and intentionally
- standalone loop editor state still has its own persistence path, but the active workspace composer does not use that old path

Evidence:

- `src/ui/persistence/presetStorage.ts`
- `src/ui/persistence/loopStorage.ts`
- `src/ui/components/loop-editor/LoopEditorView.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`

## Imported / Exported State

### Import Paths

- MIDI import at library level -> builds `soundStreams` and structural metadata
- MIDI import inside timeline -> builds `performanceLanes`, groups, and sources
- project JSON import -> hydrates `ProjectState`

### Export Paths

- project JSON export only in current shell

Implication:

The import/export model already encodes multiple truths:

- library import favors streams
- timeline import favors lanes
- composer favors local loop state then lane conversion

## Duplicated or Mirrored State

| Duplication | Description | Why It Exists | Current Risk |
|---|---|---|---|
| `soundStreams` vs `performanceLanes` | Same musical material represented in two adjacent models | streams are solver-friendly, lanes are authoring-friendly | High |
| `LoopState` vs project timeline | Composer keeps its own lane/event graph before syncing | composer needs a step-grid model | High |
| `analysisResult` vs `candidates[]` | Active result mirrors one candidate but can also come from auto-analysis | UI needs a current display result | Medium |
| `voiceConstraints` vs `layout.fingerConstraints` | Sound-level vs pad-level constraint models | two different user-intent layers | Medium |
| current layout vs candidate layouts | Active layout and generated candidates can diverge | comparison and variant exploration | Medium |

## Stale or Potentially Conflicting State

### Structural Metadata vs Edited Timeline

`sections` and `voiceProfiles` are generated at import time, but later timeline edits or composer syncs may materially change the actual performance.

Risk:

- difficulty explanation may rely on structure inferred from an earlier version of the timeline

Evidence:

- import flow in `ProjectLibraryPage`
- later lane/composer sync behavior in `UnifiedTimeline` and `WorkspacePatternStudio`

### Persisted Candidates vs Changed Engine or Layout

Candidates persist, but their interpretation can drift if:

- engine logic changes between sessions
- the user edits layout or timeline after generation

Evidence:

- `projectStorage.ts`
- `docs/repo_map.md`

### Stale Visible Analysis After Rapid Edits

Layout edits immediately mark analysis stale, but re-analysis is debounced.

Evidence:

- `projectState.ts`
- `useAutoAnalysis.ts`

## State Ownership Confusion Points

## 1. What Is the Canonical Timeline?

Possible answers in current code:

- `soundStreams` for the solver
- `performanceLanes` for authoring
- `LoopState` for composition

This is the biggest unresolved ownership issue.

## 2. Who Owns Pattern-Generated Layout Assignments?

`WorkspacePatternStudio` uses `BULK_ASSIGN_PADS`, meaning the composer can effectively replace the active grid layout.

Open issue:

- is the composer supposed to be suggesting pad assignments, or directly owning them?

## 3. Are Constraints on Sounds or on Pads?

The repo has both:

- per-stream `voiceConstraints`
- per-pad `fingerConstraints`

Only one is clearly hard-enforced in solver integration today.

## 4. Is `analysisResult` the Truth or Just the Current View?

Practically it is the current view.

Product-wise it behaves like truth because so many panels depend on it.

That dual role is manageable, but it should be named and framed as a cache of the current selected candidate/result.

## Working First-Draft Source-of-Truth Reading

The cleanest current reading is:

- `ProjectState` is the top-level application truth
- `Layout` is the spatial truth
- `analysisResult` is the current interpreted result truth
- `soundStreams` are the solver-facing performance truth
- `performanceLanes` are the authoring truth that often regenerate that solver truth
- `LoopState` is a local composition truth that can overwrite shared authoring truth

That is workable for code, but not yet simple enough for a clear product definition. A later product artifact should explicitly decide which performance model the user is meant to think in most of the time.
