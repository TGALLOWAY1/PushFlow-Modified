# Wireframe Spec

## Scope Note

- These wireframes are reconstruction artifacts, not visual design proposals.
- They are based on existing capabilities in the current runtime plus retained dedicated-screen concepts in `Version1/`.
- No new net-new product features are introduced here.

## 1. Dashboard

Current equivalent: top-level `Project Library`

### Purpose

- Start a new project.
- Import MIDI or project JSON.
- Re-enter saved work.
- Open demos.

### Layout zones

1. Top header
   - product title
   - one-line product framing
2. Primary action band
   - `New Project`
   - `Import MIDI`
   - `Import Project JSON`
3. Import panel
   - drag/drop zone
   - import status / error banner
4. Demo section
   - grouped demo categories
   - expand/collapse controls
5. Saved projects section
   - project cards or rows
   - quick metadata
   - history management controls
6. Conditional naming panel
   - appears only after MIDI import

### Panels and controls

- Import dropzone with browse affordance
- Naming form with project name plus one input per detected sound
- `Apply GM Drum Names`
- Demo cards
- Saved project cards with difficulty, sound count, event count, updated date

### Information hierarchy

1. Start or import work
2. Resume a known project
3. Evaluate demo fixtures

### Critical interactions

- Import should transition immediately into the naming step.
- Saved and demo project entry should be one-click.
- Naming step should clearly show that one stream is created per unique MIDI note.

## 2. Workbench

Current equivalent: `Performance Workspace`

### Purpose

- Keep time, space, and analysis visible inside one project editing shell.
- Support manual layout editing, candidate generation, and composer use without leaving the project.

### Layout zones

1. Global header
   - back to library
   - project title
2. Editor toolbar
   - layout selector
   - add / clone layout
   - undo / redo
   - save / export
   - analysis toggles
   - generation controls
3. Left rail
   - workflow guidance card
   - sound palette
4. Main stage
   - Push grid or compare grid
   - event detail panel
   - transition detail panel
5. Bottom drawer
   - timeline tab
   - pattern composer tab
6. Right slide-out
   - analysis
   - diagnostics

### Panels and controls

- `VoicePalette` rows with mute and voice constraints
- `InteractiveGrid` with context menu, onion-skin toggle, expand/collapse
- `CompareGridView` when comparison mode is active
- `UnifiedTimeline` with import, filter, zoom, transport
- `WorkspacePatternStudio` with bars, subdivision, BPM, pattern selector, presets, grid, stepper

### Information hierarchy

1. Active layout and project state
2. Spatial editing on the grid
3. Selected event / transition understanding
4. Timeline and composer as alternate lower work surfaces
5. Aggregate analysis and candidate comparison

### Critical interactions

- Event selection in the timeline should always update the grid and detail panels.
- Layout mutations should clearly mark analysis as stale.
- Candidate comparison should switch the main stage from edit mode to compare mode.
- Composer changes must visibly indicate they are affecting the shared project timeline.

## 3. Event Analysis

Repository source: dedicated `Version1` screen; current partial equivalent is the selected-event plus transition flow embedded in the workspace.

### Purpose

- Make event-by-event and transition-by-transition ergonomic inspection the primary activity.

### Layout zones

1. Header
   - back to workbench/workspace
   - project or performance title
   - high-level difficulty summary
2. Left analysis rail
   - event timeline list
   - event log toggle
3. Center analysis canvas
   - onion-skin Push grid
   - current event pads
   - previous/next event context
   - finger movement arrows
4. Right inspection rail
   - transition metrics
   - event metrics
   - practice loop controls
5. Export strip
   - export event metrics
   - export hard transitions
   - export practice loop settings

### Panels and controls

- Event list with per-transition difficulty emphasis
- Event log for direct assignment inspection
- Onion-skin grid canvas
- Transition metrics panel
- Practice loop controls

### Information hierarchy

1. Current event and next transition
2. Physical movement path on the grid
3. Quantified transition burden
4. Exportable analysis artifacts

### Critical interactions

- Up/down navigation should step event selection.
- Selecting an event should update the onion-skin grid and transition panel together.
- Event analysis should privilege transitions as the primary unit, not only aggregate song score.

## 4. Timeline

Repository source: dedicated `Version1` route, with current functional equivalent in `UnifiedTimeline`.

### Purpose

- Give the user a clean time-first read of the performance and the current execution plan.

### Layout zones

1. Header
   - back navigation
   - title
   - zoom control
2. Time ruler
   - seconds / beats / measures
3. Voice label column
   - one row per visible voice
4. Main timeline canvas
   - event blocks
   - finger labels or assignment pills
   - playhead
   - beat grid
5. Footer transport
   - play / stop / reset
   - current time

### Panels and controls

- voice filter
- zoom
- transport
- per-voice rows
- scrollable timeline
- click-to-seek or click-to-select behavior

### Information hierarchy

1. Sequence over time
2. Which voice is active when
3. Which finger/hand plays each event when analysis exists
4. Where the playhead is now

### Critical interactions

- Timeline must work before and after full analysis.
- It should remain obvious whether it is showing raw events, solved assignments, or both.
- Selection and playback should not require the grid to remain visible, even if they are linked elsewhere.

## Wireframe Reading

These four wireframes expose the most important screen responsibilities hidden inside the current repository:

- Dashboard = entry and project selection
- Workbench = unified editing shell
- Event Analysis = dedicated local ergonomic understanding
- Timeline = dedicated temporal understanding

The current runtime implements Dashboard and Workbench directly, and partially embeds Event Analysis and Timeline inside the workspace. The retained `Version1/` screens show that those responsibilities were already understood, even though they are no longer first-class routes in the current app.
