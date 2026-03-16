# Screen Architecture

## Route Map

### Current runtime

```text
/
└── Project Library

/project/:id
└── Performance Workspace

/optimizer-debug
└── Optimizer Debug Dashboard
```

### Retained legacy runtime in `Version1/`

```text
/
└── Dashboard

/workbench
└── Workbench

/event-analysis
└── Event Analysis

/timeline
└── Timeline

/cost-debug
└── Cost Debug
```

## Current Screens

### Project Library (`/`)

- Purpose:
  - Project creation, import, demo entry, and saved-project re-entry.
- Key panels/components:
  - Library header
  - MIDI import dropzone
  - Import naming subflow
  - Demo groups
  - Saved project list
- User actions:
  - Create blank project
  - Import MIDI
  - Import project JSON
  - Open demo
  - Open saved project
  - Remove from history / clear history
- Data dependencies:
  - `projectStorage` index
  - `demoProjects`
  - MIDI import pipeline
  - structure analysis output for sections and voice profiles

### Performance Workspace (`/project/:id`)

- Purpose:
  - Unified editing and analysis shell for a single project.
- Key panels/components:
  - Header with back-to-library
  - `EditorToolbar`
  - Left rail:
    - workflow helper card
    - `VoicePalette`
  - Center region:
    - `InteractiveGrid` or `CompareGridView`
    - `EventDetailPanel`
    - `TransitionDetailPanel`
  - Bottom drawer:
    - `UnifiedTimeline`
    - `WorkspacePatternStudio`
  - Slide-out:
    - `AnalysisSidePanel`
    - `DiagnosticsPanel`
- User actions:
  - Save, export, undo/redo
  - Add/clone/switch layouts
  - Assign, swap, or clear pads
  - Toggle analysis and diagnostics
  - Generate candidates
  - Select events from timeline or grid
  - Constrain pads or sounds
  - Import timeline MIDI
  - Compose patterns
- Data dependencies:
  - `ProjectState`
  - active `Layout`
  - `analysisResult`, `candidates`
  - `soundStreams`, `performanceLanes`, `laneGroups`, `sourceFiles`
  - local workspace UI state

### Optimizer Debug Dashboard (`/optimizer-debug`)

- Purpose:
  - Developer-facing inspection of optimization decisions and sanity heuristics.
- Key panels/components:
  - Candidate selector
  - Tabs for timeline, fingers, costs, violations, movement, irrational, sanity
- User actions:
  - Switch candidate
  - Sort event records
  - Inspect flags and violations
- Data dependencies:
  - `window.__PUSHFLOW_DEBUG__`
  - `CandidateSolution`
  - `ExecutionPlanResult`
  - `src/engine/debug/*`

## Current Embedded Screen Modules

### Unified Timeline

- Purpose:
  - Timeline-centric editing, import, filtering, playback, and event selection.
- Key panels/components:
  - Toolbar with import, filter, zoom, transport
  - voice sidebar
  - event canvas with beat grid and playhead
- User actions:
  - Import MIDI files
  - Filter streams
  - Zoom
  - Play, stop, reset
  - Select event pills
- Data dependencies:
  - `soundStreams`
  - `performanceLanes`
  - derived stream assignments from `analysisResult`
  - transport state

### Workspace Pattern Studio

- Purpose:
  - Pattern and loop authoring inside the project shell.
- Key panels/components:
  - composer toolbar
  - lane sidebar
  - step-grid canvas
  - pattern selector
  - recipe editor modal
  - event stepper / complexity summary
- User actions:
  - Add lanes
  - Toggle steps
  - Select recipe
  - Randomize
  - Save/load/delete preset
  - Clear composer
- Data dependencies:
  - local `LoopState`
  - `PatternRecipe`, `PatternResult`, `RudimentResult`
  - bridge into project lanes and layout

## Legacy Screens in `Version1/`

### Dashboard

- Purpose:
  - Song portfolio and MIDI-linking shell.
- Key panels/components:
  - song card grid
  - add song card
  - metadata-centric dashboard header
- User actions:
  - Create or delete song
  - Link MIDI to existing song
  - Open editor-style actions per card
- Data dependencies:
  - `SongService`
  - `SongMetadata`
  - song-scoped project state persistence

### Workbench

- Purpose:
  - Dedicated layout editor and solver control page.
- Key panels/components:
  - workbench header
  - `LayoutDesigner`
  - `AnalysisPanel`
  - solver controls
  - theme toggle and save/load controls
- User actions:
  - Load MIDI
  - Assign parked sounds to pads
  - Run solver
  - Optimize layout
  - Save/load project JSON
- Data dependencies:
  - `ProjectContext`
  - `ProjectState`
  - `EngineResult`
  - song hydration

### Event Analysis

- Purpose:
  - Dedicated event-by-event ergonomic inspection.
- Key panels/components:
  - `EventTimelinePanel`
  - `EventLogTable`
  - `OnionSkinGrid`
  - `TransitionMetricsPanel`
  - `PracticeLoopControls`
- User actions:
  - Step through events
  - change assignments
  - export metrics and loop settings
- Data dependencies:
  - `EngineResult.debugEvents`
  - `Performance`
  - onion-skin analysis model

### Timeline

- Purpose:
  - Dedicated timeline visualization for a song.
- Key panels/components:
  - zoom controls
  - `Timeline`
  - now-bar and seeking
- User actions:
  - Scrub time
  - inspect notes and finger labels
- Data dependencies:
  - active layout performance
  - current solver result
  - resolved voices from mapping

### Cost Debug

- Purpose:
  - Dev-only deep cost breakdown page.
- Key panels/components:
  - event list
  - aggregate metrics
  - annealing visualization
- User actions:
  - Sort and inspect event costs
  - switch debug mode
- Data dependencies:
  - `EngineResult.debugEvents`
  - annealing trace

## Architecture Reading

The current product collapsed several older routes into one `Performance Workspace`, but the repository still preserves the older screen responsibilities in `Version1/`. For redesign work, those legacy screens matter because:

- `Event Analysis` is still the clearest dedicated analysis responsibility map in the repo.
- `Timeline` is still the clearest dedicated temporal responsibility map.
- `Workbench` remains a strong model for a layout-centric page even though the live app now embeds that responsibility inside a larger workspace.
