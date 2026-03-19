# Screen, Route, and Panel Map

## Current Live Route Map

The current route shell is small:

```text
/
└── Project Library Page

/project/:id
└── Performance Workspace

/optimizer-debug
└── Optimizer Debug Dashboard
```

Evidence:

- `src/ui/App.tsx`

## Likely Navigation Hierarchy

```text
Project Library
├── New Project
├── Import MIDI
├── Import Project JSON
├── Open Demo
└── Open Saved Project
      ↓
Performance Workspace
├── Toolbar actions
├── Left sound rail
├── Center grid / compare view
├── Event + transition detail
├── Bottom drawer
│   ├── Timeline
│   └── Pattern Composer
└── Right slide-out
    ├── Analysis
    └── Diagnostics

Hidden / direct access
└── Optimizer Debug Dashboard
```

## Route: `/`

### Purpose

Current home page for project creation, import, demos, and saved-project re-entry.

### Major Panels / Regions

1. Title/header
2. MIDI import dropzone
3. Quick action buttons
4. Error banner
5. Demo projects section
6. Saved projects section

### Key Controls / Components

- `Import MIDI File` dropzone
- `+ New Project`
- `Import Project JSON`
- Demo group expand/collapse buttons
- Demo project open buttons
- Saved project open buttons
- Remove-from-history button
- `Clear All`

### Inputs / Actions

- drag/drop or browse for MIDI
- browse for project JSON
- create blank project
- open demo
- open saved project

### Outputs / Visualizations

- lists project cards
- shows demo grouping
- shows saved project difficulty badge, sound count, event count, date

### Related Workflows

- project creation
- import
- demo-driven testing/onboarding
- saved project reopening

### Concerns

- The page presents import, demo evaluation, blank authoring, and project history side by side without strong prioritization.
- Permanent delete exists in storage but not in the visible UI.

Evidence:

- `src/ui/pages/ProjectLibraryPage.tsx`

## Route: `/` Naming Subflow

### Purpose

Intermediate screen after MIDI import that turns detected note groups into named sound streams.

### Major Panels / Regions

1. Project name input
2. Detected sound stream list
3. `Apply GM Drum Names`
4. Cancel / Create actions

### Key Controls / Components

- project name input
- one input per detected sound stream
- create project button

### Concern

This subflow is useful and clarifying, but it only exists for library import. Timeline-level MIDI import does not offer the same naming step, which creates two different import experiences.

Evidence:

- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/hooks/useLaneImport.ts`

## Route: `/project/:id`

### Purpose

Current all-in-one editor. Intended to be the unified performance workspace where timeline, grid, analysis, and composer remain coupled.

### High-Level Layout

```text
┌ Header: back to library + project title                               ┐
├ Toolbar: layouts | undo/redo | save/export | analysis toggles | gen  ┤
├ Main body                                                            │
│ ├ Left rail: workflow help + sound palette                           │
│ └ Center: grid or compare grid + event detail + transition detail    │
├ Bottom drawer                                                        │
│ ├ Timeline                                                           │
│ └ Pattern Composer                                                   │
└ Slide-out side panel                                                 │
  ├ Analysis                                                           │
  └ Diagnostics                                                        │
```

### Major Panels / Regions

#### Header

- back to library
- project title
- workspace label

Evidence:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`

#### Toolbar

- layout tabs
- add layout
- clone layout
- undo
- redo
- save
- export JSON
- analysis toggle
- diagnostics toggle
- generate mode dropdown
- generate button
- stale analysis badge

Evidence:

- `src/ui/components/EditorToolbar.tsx`

#### Left Rail

- Workspace Flow help card
- `Open Composer`
- `Timeline View`
- `VoicePalette`

Evidence:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/VoicePalette.tsx`

#### Center Grid Region

- `Push Grid` or `Layout Compare` heading
- onion-skin toggle
- expand/collapse toggle
- interactive grid or compare grid
- selected event panel
- selected transition panel

Evidence:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/InteractiveGrid.tsx`
- `src/ui/components/CompareGridView.tsx`
- `src/ui/components/EventDetailPanel.tsx`
- `src/ui/components/workspace/TransitionDetailPanel.tsx`

#### Bottom Drawer: Timeline Tab

- import MIDI
- voice count, event count
- voice filter
- zoom slider
- transport controls
- beat grid
- voice sidebar
- lane/event visualization
- event assignment pills

Evidence:

- `src/ui/components/UnifiedTimeline.tsx`

#### Bottom Drawer: Pattern Composer Tab

- bars selector
- grid subdivision selector
- play/stop
- BPM
- add lane
- pattern selector
- randomize
- custom recipe editor
- save preset
- clear
- step-sequencer canvas
- event stepper/complexity

Evidence:

- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- loop-editor components

#### Slide-Out Side Panel

- `Analysis` tab content: mostly candidate switching and compare mode
- `Diagnostics` content: metrics, fatigue, balance, suggestions

Evidence:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`

### Related Workflows

- manual layout editing
- timeline editing/import
- automatic optimization
- event and transition inspection
- composer-based creation
- candidate comparison

### Concerns

- Page is a workflow hub for too many different task types.
- Analysis and diagnostics are split into separate panels with uneven depth.
- The drawer makes the timeline and composer feel like sub-tools, even though both materially affect the core project state.
- Several major concepts appear in multiple places: sounds in the left rail, voices in the timeline, pad assignments in the grid, candidate selection in a slide-out.

## Route: `/optimizer-debug`

### Purpose

Developer-facing inspection dashboard for optimization output.

### Major Panels / Regions

1. header and candidate selector
2. sanity banner
3. tab bar
4. content tabs

### Tabs

- Event Timeline
- Finger Usage
- Cost Breakdown
- Violations
- Movement
- Irrational
- Sanity

### Inputs / Actions

- choose candidate
- switch tabs
- sort timeline columns
- navigate back

### Outputs / Visualizations

- detailed records table
- charts and summaries
- flagged irrational assignments
- sanity-check results

### Concerns

- Rich, meaningful analysis exists here but is not integrated into the main product flow.
- Route depends on `window.__PUSHFLOW_DEBUG__`, reinforcing that this is not the normal user path.

Evidence:

- `src/ui/pages/OptimizerDebugPage.tsx`

## Retained but Unrouted / Legacy Screen-Level Surfaces

These are not part of the active app shell, but they still matter when mapping the product because they preserve older task boundaries and still shape the codebase.

### `PerformanceLanesView`

- Purpose: full lane-management workspace with left sidebar, center timeline, right inspector.
- Likely old role: `Arrange` tab or separate arrangement screen.
- Concern: duplicates much of what `UnifiedTimeline` now tries to absorb.

Evidence:

- `src/ui/components/lanes/PerformanceLanesView.tsx`
- `docs/ux-v1-restructure-plan.md`

### `LoopEditorView`

- Purpose: standalone loop/pattern editor with explicit local persistence and commit-to-project behavior.
- Likely old role: `Patterns` tab or separate creation screen.
- Concern: duplicates the newer `WorkspacePatternStudio` but uses a different lifecycle model.

Evidence:

- `src/ui/components/loop-editor/LoopEditorView.tsx`
- `docs/ux-v1-restructure-plan.md`

### `TimelinePanel` + `ExecutionTimeline`

- Purpose: older bottom timeline and event pill visualization.
- Likely old role: execution-analysis companion panel under the grid.
- Concern: partial predecessor to `UnifiedTimeline`, still retained.

Evidence:

- `src/ui/components/TimelinePanel.tsx`
- `src/ui/components/ExecutionTimeline.tsx`

## Page-Level Redundancies

| Concept | Where It Appears | Redundancy Concern |
|---|---|---|
| Timeline | `UnifiedTimeline`, `PerformanceLanesView`, `TimelinePanel` | Multiple competing "true" timeline surfaces |
| Pattern creation | `WorkspacePatternStudio`, `LoopEditorView` | Multiple creation workflows with different commit models |
| Analysis | slide-out Analysis, slide-out Diagnostics, event/transition panels, debug route | Multiple analysis destinations |
| Layout comparison | compare tab plus compare grid mode | Comparison spans both panel and center grid |

## Components That Act as Workflow Hubs

### `PerformanceWorkspace`

Acts as the product's main workflow orchestrator. Almost every major task reconnects here.

### `UnifiedTimeline`

Acts as both a user-facing timeline and a state synchronization bridge between lanes and streams.

### `WorkspacePatternStudio`

Acts as a self-contained authoring tool that also writes into the shared project timeline and layout.

### `EditorToolbar`

Acts as the global command bar for save/export/compare/generate/layout management.

## Overloaded, Underdefined, or Redundant Pages

### Most Overloaded

- `/project/:id`

Why:

- It currently hosts project control, layout editing, timeline authoring, candidate optimization, analysis inspection, transition inspection, and a pattern composer.

### Most Underdefined

- `AnalysisSidePanel`

Why:

- The name promises broad analysis, but its actual content is mostly candidate switching and compare selection.

### Most Redundant

- Retained lane and loop standalone views

Why:

- They represent older route-level answers to problems the new workspace now also tries to solve.

## First-Draft Screen Architecture Reading

The live product has a very small route map and a very large workspace. That is not inherently a problem, but in this repo the compression appears to have hidden unresolved workflow boundaries rather than fully eliminating them. The active navigation hierarchy is simple; the conceptual navigation hierarchy is still crowded.
