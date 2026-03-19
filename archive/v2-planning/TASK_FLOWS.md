# Task Flows

## Scope Note

- Flows marked `Current` are implemented in the active top-level app.
- Flows marked `Legacy` are reconstructed from `Version1/` and remain important because the repo still references those screen concepts.

## Flow 1: Import MIDI Into a New Project

Status: `Current`

- Entry point: `/` -> Project Library -> MIDI dropzone or file picker
- Steps:
  1. User selects a MIDI file.
  2. Import pipeline parses events and tempo.
  3. Structure analyzer derives sections and voice profiles.
  4. Import groups events by unique MIDI note into `SoundStream[]`.
  5. User optionally renames the project and streams.
  6. User creates the project and is routed to `/project/:id`.
- UI screens used:
  - `ProjectLibraryPage`
  - Import naming subflow inside `ProjectLibraryPage`
- Engine interactions:
  - `parseMidiFileToProject()`
  - `analyzePerformance()`
  - Initial empty `Layout` creation

## Flow 2: Open Saved or Demo Project

Status: `Current`

- Entry point: `/` -> saved project card or demo card
- Steps:
  1. User selects a saved project or demo.
  2. Project is hydrated from localStorage or duplicated from bundled fixtures.
  3. Editor route loads the project into `ProjectProvider`.
  4. Workspace renders current layout, timeline, and cached candidates.
- UI screens used:
  - `ProjectLibraryPage`
  - `ProjectEditorPage`
  - `PerformanceWorkspace`
- Engine interactions:
  - No immediate solver run on navigation
  - Cached candidates may be available, but `analysisResult` is reset/stale on load

## Flow 3: Import or Organize Timeline Material Inside the Project

Status: `Current`

- Entry point: `/project/:id` -> bottom drawer -> `Timeline`
- Steps:
  1. User opens `UnifiedTimeline`.
  2. User imports one or more MIDI files into timeline lanes, or works with existing streams.
  3. Timeline import creates `PerformanceLane[]`, `LaneGroup[]`, and `SourceFile[]`.
  4. Timeline sync regenerates `soundStreams` from lanes.
  5. User filters voices, mutes lanes, scrubs time, or selects events.
- UI screens used:
  - `PerformanceWorkspace`
  - `UnifiedTimeline`
- Engine interactions:
  - Lane import reuses MIDI parsing
  - No optimization required to display raw timeline data
  - Selected event state later feeds grid and analysis views

## Flow 4: Assign Sounds to Pads Manually

Status: `Current`

- Entry point: `/project/:id` -> left rail `VoicePalette` + center `InteractiveGrid`
- Steps:
  1. User drags a sound stream from the palette onto a pad.
  2. Existing assignment for that stream is removed first.
  3. User may move, swap, or clear assignments.
  4. Reducer updates the active layout and marks analysis stale.
- UI screens used:
  - `PerformanceWorkspace`
  - `VoicePalette`
  - `InteractiveGrid`
  - `PadContextMenu`
- Engine interactions:
  - No solver run at the moment of drop
  - `useAutoAnalysis()` later re-runs single-candidate analysis if layout is valid

## Flow 5: Generate Candidate Layouts and Execution Plans

Status: `Current`

- Entry point: `/project/:id` -> top toolbar -> `Generate`
- Steps:
  1. User chooses `Quick`, `Thorough`, or `Auto`.
  2. If the layout is empty, system seeds it using chromatic fallback placement.
  3. Candidate generator produces three strategies: baseline, compact-right, compact-left.
  4. Each candidate runs beam search and, in current modes, annealing-backed layout search.
  5. Candidates are ranked and stored; the first becomes active.
- UI screens used:
  - `EditorToolbar`
  - `PerformanceWorkspace`
  - `AnalysisSidePanel`
- Engine interactions:
  - `generateCandidates()`
  - `AnnealingSolver`
  - `BeamSolver`
  - `analyzeDifficulty()`
  - `computeTradeoffProfile()`

## Flow 6: Inspect Selected Event and Transition

Status: `Current`

- Entry point: `/project/:id` -> click event in `UnifiedTimeline` or grid
- Steps:
  1. User selects an event.
  2. Selection model groups assignments by moment.
  3. Grid highlights current pads, previous/next pads, shared pads, and movement arcs.
  4. Event detail panel shows current event facts and cost breakdown.
  5. Transition detail panel shows current-to-next movement and next-event pressure.
- UI screens used:
  - `UnifiedTimeline`
  - `InteractiveGrid`
  - `EventDetailPanel`
  - `TransitionDetailPanel`
- Engine interactions:
  - Uses existing `ExecutionPlanResult.fingerAssignments`
  - Selection logic uses `buildSelectedTransitionModel()`
  - No new solve is required

## Flow 7: Constrain Hand or Finger Behavior

Status: `Current`

- Entry point:
  - `/project/:id` -> `VoicePalette` for sound-level constraints
  - `/project/:id` -> `EventDetailPanel` or pad context menu for pad-level constraints
- Steps:
  1. User sets a hand or finger preference.
  2. For pad-level constraints, layout stores a concrete constraint string such as `L-Ix`.
  3. Re-analysis converts matching pad constraints into hard manual assignments keyed by event.
  4. Solver rebuilds the execution plan around those constraints.
- UI screens used:
  - `VoicePalette`
  - `EventDetailPanel`
  - `InteractiveGrid`
- Engine interactions:
  - `useAutoAnalysis()` builds `manualAssignments`
  - `BeamSolver.solve()` consumes those constraints

## Flow 8: Compose or Generate New Pattern Material

Status: `Current`

- Entry point: `/project/:id` -> bottom drawer -> `Pattern Composer`
- Steps:
  1. User edits step-grid lanes or selects a pattern recipe.
  2. Composer generates `PatternResult` or `RudimentResult`.
  3. Local loop state is converted into `PerformanceLane[]`.
  4. Upserted lanes are merged into the shared project timeline.
  5. Generated pad assignments also bulk-replace the active layout.
  6. New material is visible immediately in the main timeline and grid.
- UI screens used:
  - `WorkspacePatternStudio`
  - `LoopLaneSidebar`
  - `LoopGridCanvas`
  - `PatternSelector`
  - `RudimentEventStepper`
- Engine interactions:
  - `compilePattern()`
  - `generateRandomRecipe()`
  - `generateRudiment()`
  - `assignLanesToPads()`
  - `assignFingers()`
  - `scoreComplexity()`

## Flow 9: Save and Export Project

Status: `Current`

- Entry point: `/project/:id` -> `Save`, `Export`, or `Library` button
- Steps:
  1. User saves to localStorage or exports JSON.
  2. Persisted project strips ephemeral state such as selection and processing.
  3. JSON export serializes the current project snapshot.
- UI screens used:
  - `EditorToolbar`
  - `PerformanceWorkspace`
- Engine interactions:
  - None; persistence only

## Flow 10: Review Solver Diagnostics

Status: `Current hidden`

- Entry point: direct navigation to `/optimizer-debug`
- Steps:
  1. User reaches the debug route after populating `window.__PUSHFLOW_DEBUG__`.
  2. Page shows event timeline, finger usage, costs, violations, movement, irrational flags, and sanity checks.
  3. User switches candidate and reviews low-level optimization data.
- UI screens used:
  - `OptimizerDebugPage`
- Engine interactions:
  - Consumes debug helpers from `src/engine/debug/*`
  - Does not run optimization itself

## Flow 11: Song Portfolio -> Workbench

Status: `Legacy`

- Entry point: `Version1` `/` Dashboard
- Steps:
  1. User opens or creates a song in the portfolio.
  2. MIDI may be linked to the song.
  3. Workbench loads song state via URL query parameter.
  4. Workbench auto-saves back to the song.
- UI screens used:
  - `Version1/src/pages/Dashboard.tsx`
  - `Version1/src/workbench/Workbench.tsx`
- Engine interactions:
  - `BiomechanicalSolver`
  - `optimizeLayout()`
  - Project persistence per song

## Flow 12: Dedicated Event Analysis

Status: `Legacy`

- Entry point: `Version1` `/event-analysis?songId=...`
- Steps:
  1. User loads a song-backed project.
  2. Event analysis groups debug events into moments.
  3. Onion-skin model is built for selected event.
  4. Left panel shows event list or log, center shows onion-skin grid, right shows transition metrics and practice loop controls.
- UI screens used:
  - `Version1/src/pages/EventAnalysisPage.tsx`
  - `Version1/src/workbench/EventAnalysisPanel.tsx`
- Engine interactions:
  - `analyzeEvents()`
  - `analyzeAllTransitions()`
  - `buildOnionSkinModel()`

## Flow 13: Dedicated Timeline View

Status: `Legacy`

- Entry point: `Version1` `/timeline?songId=...`
- Steps:
  1. User opens dedicated timeline view for a song.
  2. Timeline renders one row per voice.
  3. Finger labels are derived from current solver result.
  4. User seeks through time.
- UI screens used:
  - `Version1/src/pages/TimelinePage.tsx`
  - `Version1/src/workbench/Timeline.tsx`
- Engine interactions:
  - Consumes solver output already stored in context
  - Does not solve on the page itself
