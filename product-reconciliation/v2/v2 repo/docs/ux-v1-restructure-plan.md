# PushFlow V1 UX Restructure Plan

## Executive Summary
PushFlow had drifted into three loosely connected tools:

- `Arrange` for imported performance lanes
- `Patterns` for generated/manual pattern sketches
- `Grid` for layout assignment and analysis

That split made the product hard to understand because the user was really trying to do one job: shape a performance timeline and evaluate how that timeline maps onto the Push grid.

V1 fixes that by replacing the three-tab model with a single **Performance Workspace**. In that workspace, the timeline and the grid are always visible together. Pattern generation is no longer a disconnected page-level workflow. It becomes a way to add or edit material inside the same project timeline. Layout is no longer treated as a separate destination. It is the spatial view of the same performance.

## Why The Current UX Fails
The old structure fragmented the user flow at the route/view level rather than at the task level.

### The three-tab split hid the real workflow
The previous `ProjectEditorPage` separated the core flow into `Arrange`, `Patterns`, and `Grid`, even though those screens were all manipulating the same musical/performance intent.

Relevant code:

- `src/ui/pages/ProjectEditorPage.tsx`
- `src/ui/components/lanes/PerformanceLanesView.tsx`
- `src/ui/components/loop-editor/LoopEditorView.tsx`
- `src/ui/components/InteractiveGrid.tsx`

### Pattern generation used a different state model
The old pattern workflow lived in a local loop editor with its own reducer and its own persistence layer:

- `src/ui/state/loopEditorReducer.ts`
- `src/ui/persistence/loopStorage.ts`

That meant the user generated patterns in one state model and then later had to push them into project lanes. The workflow felt temporary and disconnected from the main project.

### Layout analysis was visually and conceptually detached
The grid editor contained the core value proposition, but the execution timeline sat in a separate bottom panel and the lane timeline lived on a separate tab. The user had to mentally stitch together:

- timeline material
- grid placement
- finger assignments
- cost analysis

instead of seeing them as one synchronized system.

### Event analysis capability existed but was not first-class
Version1 already explored stronger event-analysis ideas:

- `Version1/src/engine/onionSkinBuilder.ts`
- `Version1/src/components/vis/OnionSkinGrid.tsx`
- `Version1/src/workbench/EventAnalysisPanel.tsx`

Those concepts were not carried forward into the main V2 workspace, so the app lost some of its most legible ergonomic-analysis affordances.

## New Product Mental Model
The product should be understood through a small number of coupled concepts:

### Core objects
- `Project`: the container for everything
- `Performance Timeline`: the canonical event sequence
- `Layout`: the active sound-to-pad assignment on the Push grid
- `Execution Plan`: the hand/finger interpretation of the timeline for that layout
- `Candidate Solutions`: alternate layout+execution combinations

### Core job-to-be-done
Take musical/performance material, map it onto the Push surface, inspect physical difficulty, and iteratively improve the result.

### Key design rule
The timeline and grid are not separate workflows. They are two views of the same performance problem:

- timeline answers: "what happens over time?"
- grid answers: "where and how is it played?"

## New Information Architecture
### Current
```text
Library
└── Project
    ├── Arrange
    ├── Patterns
    ├── Grid
    └── Optimizer Debug
```

### Proposed
```text
Library
└── Performance Workspace
└── Diagnostics / Advanced
```

### Important clarification
**Layout is not a separate page.**

The user should not leave the workspace to understand or modify layout. The grid must stay coupled to the timeline at all times. When the user needs more room for spatial work, the workspace switches focus modes. It does not switch pages.

## Performance Workspace
The workspace merges the previously separated flows into one synchronized editing environment.

### Primary layout
```text
┌ Header: project | save/export | optimize | layout controls | focus mode                  ┐
├ Left rail: workflow help | sounds                                               │
├ Center: performance timeline lanes                                               │
├ Right: live Push grid + event/transition inspection + analysis                   │
└ Bottom drawer: execution timeline | pattern composer                             ┘
```

### Purpose of each region
#### Left rail
- reinforce the workflow
- expose sounds/voices in the active project
- keep the relationship between timeline material and mapped sounds visible

#### Center timeline
- show the canonical project performance
- allow event-time selection directly from the lane view
- preserve import/organization controls for MIDI-derived material

#### Right grid
- show the active layout for the same selected timeline context
- support manual sound-to-pad assignment
- support finger constraint editing
- display event selection and next-event transition preview

#### Bottom drawer
- `Execution`: event-level execution timeline, playback, scrub
- `Pattern Composer`: generation/manual pattern editing that syncs into the same project timeline

## Timeline + Grid Coupling
This restructure is centered on one principle: **time and space stay visible together**.

### Coupling rules
- clicking an event in the lane timeline selects that moment globally
- the grid highlights all pads active at that selected time
- the grid also previews the next event in time when analysis exists
- the execution timeline, event detail, and transition detail all follow the same selection

### Layout focus is a mode, not a destination
The workspace now supports focus modes:

- `Balanced`
- `Timeline Focus`
- `Layout Focus`

These only rebalance space. They do not break context or selection.

## Event Analysis Experience
V1 exposed a stronger event-analysis mental model than the old V2 shell. The new workspace starts restoring that model.

### What the user can now do in the shared workspace
- select a timeline event from the lane view
- see active pads illuminate on the grid
- inspect the selected event in the right rail
- preview the next event on the grid without changing pages
- see finger movement arcs between current and next pads
- inspect a transition summary panel derived from the same selection

### What is reused conceptually from Version1
- event grouping by timestamp
- current/next event comparison
- per-finger movement tracking
- onion-skin style transition thinking

Relevant inspiration files:

- `Version1/src/engine/onionSkinBuilder.ts`
- `Version1/src/components/vis/OnionSkinGrid.tsx`
- `Version1/src/workbench/EventAnalysisPanel.tsx`

### V1 implementation note
The current workspace introduces transition preview and finger-path rendering directly inside the existing grid component rather than porting the entire Version1 visualization stack in one step.

## Cost Visibility
The cost model still needs further refinement, but the workspace now makes it more inspectable.

### Visible levels of cost
- overall analysis and diagnostics in the right rail
- selected-event cost in the event detail panel
- next-event pressure in the transition detail panel
- event-linked execution view in the bottom drawer

### Why this is better than before
Previously, cost information was split across disconnected panels and a separate page structure. Now the user can:

1. select an event from the timeline
2. see the grid response immediately
3. inspect event cost and transition preview in the same visual context

## Implementation Impact
This change deliberately restructures both the UI shell and the workflow boundaries.

### New primary workspace
Added:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`

This replaces the old tab-switch model inside the project editor.

### New pattern composer in the shared workspace
Added:

- `src/ui/components/workspace/WorkspacePatternStudio.tsx`

This composer uses the existing loop/pattern generation primitives but synchronizes generated or manual pattern edits into the shared project timeline instead of requiring a separate commit-only page workflow.

### New transition detail panel
Added:

- `src/ui/components/workspace/TransitionDetailPanel.tsx`
- `src/ui/analysis/selectionModel.ts`

These files provide a shared selection model for current/next event reasoning and expose that in the workspace UI.

### Project editor simplification
Updated:

- `src/ui/pages/ProjectEditorPage.tsx`

The old `Arrange / Patterns / Grid` tabs were removed in favor of one workspace.

### Timeline interaction changes
Updated:

- `src/ui/components/lanes/LaneTimeline.tsx`

Lane blocks can now drive shared event-time selection, which keeps the main timeline synchronized with the grid and analysis panels.

### Grid behavior changes
Updated:

- `src/ui/components/InteractiveGrid.tsx`

The grid now:

- shows selected-event pads
- previews the next event
- highlights shared pads
- renders finger-movement arcs between current and next event

### Data flow support for live pattern sync
Updated:

- `src/ui/state/lanesReducer.ts`
- `src/ui/state/loopToLanes.ts`

These changes allow generated pattern lanes to be upserted into or removed from the project timeline without relying on the old page/tab workflow.

## Phased Rollout
### Phase 1
- replace the three-tab shell with one workspace
- keep timeline and grid visible together
- sync composer output into the project timeline
- centralize event selection

Expected outcome:
The product finally reads as one coherent system instead of three adjacent tools.

### Phase 2
- deepen transition selection
- improve cost deltas for manual layout edits
- push more Version1 onion-skin behavior into the live grid

Expected outcome:
The user can move fluidly between composition, inspection, and ergonomic reasoning.

### Phase 3
- add stronger candidate comparison on shared selections
- add richer practice-loop and advanced diagnostics affordances
- continue refining cost explanation UX

Expected outcome:
Advanced users gain analytical power without re-fragmenting the core workflow.

## V1 Recommendation
PushFlow should present itself as **one timeline-first performance workspace with a permanently linked Push grid**.

The strongest V1 direction is:

- one canonical timeline
- one always-visible grid
- one shared selection model
- in-page focus modes instead of separate pages
- generation/editing that feeds the same project timeline

That is the simplest structure that preserves PushFlow’s optimization purpose while making the product understandable to first-time users and still useful to advanced performers.
