# PushFlow Engineering Audit

Date: 2026-03-22

## Scope

This audit covers the current PushFlow workspace implementation with emphasis on:

- UI consistency
- behavioral correctness
- source-of-truth ownership
- layout library semantics
- solver output normalization
- terminology and product surface clarity

## Executive Summary

PushFlow's current instability is primarily caused by state-boundary drift, not isolated UI bugs.

The workspace has no single canonical "currently inspected solution" model. Different panels read different combinations of:

- `activeLayout`
- `workingLayout`
- `selectedCandidateId`
- `analysisResult`
- `voiceConstraints`
- raw solver output

As a result, the grid can show one layout while the summary, timeline, events panel, compare view, and cost calculations explain a different one.

The second major issue is that solver outputs are not normalized before entering UI state. Beam/annealing and greedy do not currently share the same score semantics or event-cost data shape. That breaks score displays, candidate ranking, and the event difficulty chart.

The third issue is ownership drift for user-authored technique data. Finger constraints, placement locks, and display labels are represented in multiple partially synchronized forms, which makes edits brittle and causes stale rendering.

## High-Confidence Bugs

### 1. Active layout selection does not switch analysis context

- Symptom: choosing the Active card can leave layout metrics, event selection, and timeline analysis on the previously selected candidate
- Evidence:
  - `LayoutOptionsPanel` only clears `selectedCandidateId`
  - `ActiveLayoutSummary`, `UnifiedTimeline`, and `EventsPanel` read `state.analysisResult`
  - `InteractiveGrid` renders a separate candidate/layout override path
- Impacted files:
  - `src/ui/components/panels/LayoutOptionsPanel.tsx`
  - `src/ui/components/panels/ActiveLayoutSummary.tsx`
  - `src/ui/components/UnifiedTimeline.tsx`
  - `src/ui/components/EventsPanel.tsx`
  - `src/ui/components/workspace/PerformanceWorkspace.tsx`

### 2. Finger constraints in current UI format are ignored by solver input building

- Symptom: constraints entered as `L2` / `R3` do not reliably affect solving
- Evidence:
  - current UI writes canonical compact strings like `L2`
  - `useAutoAnalysis` still parses legacy `L-Ix` style in one code path
- Impacted files:
  - `src/ui/hooks/useAutoAnalysis.ts`
  - `src/ui/state/projectState.ts`
  - multiple UI components with duplicated parsers

### 3. Greedy execution plan shape violates UI expectations

- Symptom:
  - score/quality can be misleading
  - event difficulty chart appears blank or zeroed
  - hard-count and cost interpretation drift by solver
- Evidence:
  - greedy writes raw accumulated cost into `executionPlan.score`
  - greedy emits zero per-event `cost` for playable assignments
  - greedy omits `layoutBinding`
  - UI treats score as a percentage and chart data as meaningful event costs
- Impacted files:
  - `src/engine/optimization/greedyOptimizer.ts`
  - `src/ui/components/panels/ActiveLayoutSummary.tsx`
  - `src/ui/components/panels/EventCostChart.tsx`

### 4. Placement lock UI is incorrect and effectively unusable

- Symptom:
  - lock indicators are wrong
  - current workspace has no live way to toggle a lock
- Evidence:
  - locks are modeled as `voiceId -> padKey`
  - grid and sounds panel read them like `padKey -> boolean`
  - reducer supports `TOGGLE_PLACEMENT_LOCK`, but no current UI dispatches it
- Impacted files:
  - `src/types/layout.ts`
  - `src/ui/components/InteractiveGrid.tsx`
  - `src/ui/components/VoicePalette.tsx`
  - `src/ui/components/PadContextMenu.tsx`
  - `src/ui/state/projectState.ts`

### 5. Candidate promotion carries forward stale lock positions

- Symptom: promoting a candidate can preserve the old Active layout's lock map even when the candidate moved those voices
- Evidence:
  - `PROMOTE_CANDIDATE` copies `state.activeLayout.placementLocks`
  - seed generators and mutation code treat locks as hard layout-generation constraints
- Impacted files:
  - `src/ui/state/projectState.ts`
  - `src/engine/optimization/seedGenerators.ts`
  - `src/engine/optimization/mutationService.ts`

### 6. Candidate fallback ranking is inconsistent across solver types

- Symptom: fallback candidate selection can prefer the wrong result
- Evidence:
  - legacy candidate generation sorts by lowest `executionPlan.score`
  - beam score is higher-is-better while greedy score is lower-is-better
- Impacted files:
  - `src/engine/optimization/multiCandidateGenerator.ts`
  - `src/engine/optimization/greedyCandidatePipeline.ts`

## Source-of-Truth Problems

### Finger assignments / technique preferences

Current overlapping stores:

- `ProjectState.voiceConstraints`
- `Layout.fingerConstraints`
- solver output `padFingerOwnership`
- solver output `fingerAssignments`

Recommended boundary:

- user-authored preference should be layout-scoped and voice-scoped
- solver-owned fingering should remain solution output
- UI should not synchronize two mutable user stores bidirectionally

### Inspected layout vs analyzed plan

Current overlapping stores:

- `activeLayout`
- `workingLayout`
- `selectedCandidateId`
- `analysisResult`

Recommended boundary:

- a single inspected artifact should determine both visible layout and visible analysis
- analysis freshness should be validated against the bound layout

### Sound labels

Current overlapping stores:

- canonical `soundStreams`
- embedded voice copies inside `layout.padToVoice`

Recommended boundary:

- names/colors should be canonical in `soundStreams`
- layouts should reference sound identity, not own mutable copies of display labels

### Position display

Current overlapping stores:

- local `R3C2` formatters
- raw `row,col`
- implied alternate conventions in settings/comments

Recommended boundary:

- one shared formatter utility in the pad-grid domain layer

## State-Flow Findings

1. Layout display and analysis display are decoupled in the live workspace
2. `analysisResult` is acting as both a cache and a selection model
3. bidirectional sync between `voiceConstraints` and `layout.fingerConstraints` is fragile
4. several panels overlay solver results and user constraints in different ways
5. stale helper utilities for layout binding/freshness exist but are not applied in runtime UI selection

## Solver Integration Findings

Beam-style plans currently provide:

- meaningful event costs
- `momentAssignments`
- `layoutBinding`
- percentage-like score semantics

Greedy plans currently provide:

- raw objective as `score`
- zero event cost payload for playable events
- no `layoutBinding`

Recommended direction:

- all solvers should produce raw optimization facts
- one normalization step should convert those into shared UI-facing semantics

## Information Architecture Findings

Current workspace mismatches:

- `Layout Summary` is rendered under the `Costs` tab
- Composer exists both in the center tab bar and as a header button
- saved variants are durable but not first-class in the main layouts surface
- legacy panels still exist and encode conflicting mental models

Recommended IA:

- Costs: analysis only
- Layouts: active/draft identity, candidates, variants, diffs, promote/save/load
- Sounds: sound registry and explicit technique preferences
- Timeline/Composer: temporal navigation and authoring only

## Recommended Fix Order

### Phase 1: correctness stabilization

- unify inspected-solution state
- fix finger constraint parsing drift
- fix placement-lock lookup/rendering
- fix candidate-promotion lock semantics
- normalize enough greedy output to restore event chart and score correctness

### Phase 2: source-of-truth cleanup

- collapse duplicate user constraint stores
- stop embedding mutable display labels in layout mappings
- route all panels through shared selectors

### Phase 3: UI structure cleanup

- move layout summary to Layouts
- make variants actionable
- remove redundant Composer entry point

### Phase 4: consistency sweep

- shared formatter/parser utilities
- terminology cleanup
- remove stale legacy components
- add regression tests for the above flows

## Immediate Validation Targets

- generating layouts must not affect `savedVariants`
- selecting Active must switch both grid and analysis to the same layout
- changing a finger preference must be reflected consistently across grid, sounds, timeline, and solver input
- promoting a candidate must preserve the candidate's own lock semantics
- greedy and beam/annealing outputs must render through the same score and chart contract
