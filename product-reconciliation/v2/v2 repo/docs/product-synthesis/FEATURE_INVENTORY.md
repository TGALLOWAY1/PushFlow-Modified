# Feature Inventory

## Method and Status Legend

This inventory is based on current code paths, visible UI, hidden routed pages, retained legacy components, and supporting docs/tests. Status meanings used below:

- `implemented`: clearly active in the current app
- `partial`: real and reachable, but thin or incomplete
- `broken-looking`: reachable or coded, but appears misleading or under-supported
- `duplicated`: overlaps another active or retained workflow
- `legacy`: still present in code but not part of the current primary shell
- `unclear`: intent exists, but product role is not settled
- `planned`: implied by docs/comments/utilities more than by current UI

## Entry, Creation, and Import

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Project library | creation / shell | Lists saved projects from localStorage and acts as the current home screen | Yes | `/` | `ProjectLibraryPage` | `ProjectLibraryEntry`, `ProjectState` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Replaces older V1 dashboard concept |
| MIDI import to new project | creation / import | Imports a `.mid` file and creates a project from it | Yes | `/` | `ProjectLibraryPage`, `parseMidiFileToProject` | `Performance`, `SoundStream`, `InstrumentConfig` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/import/midiImport.ts` | Current import is single-file at library entry |
| Post-import sound naming step | creation / authoring | After MIDI import, each unique pitch becomes a named sound stream | Yes | `/` | `ProjectLibraryPage` | `SoundStream`, `voiceProfiles`, `sections` | implemented | `src/ui/pages/ProjectLibraryPage.tsx` | Strongly user-facing and task-relevant |
| GM drum name autofill | creation / authoring | Applies default drum names based on MIDI note numbers | Yes | `/` | `ProjectLibraryPage` | `SoundStream.originalMidiNote` | implemented | `src/ui/pages/ProjectLibraryPage.tsx` | Useful for drums, weak for non-drum imports |
| Blank project creation | creation | Creates an empty project with a default empty layout | Yes | `/` | `ProjectLibraryPage` | `ProjectState`, `Layout` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/state/projectState.ts` | Starts with no sounds, no analysis |
| Demo project loading | onboarding / analysis | Opens bundled demo projects, including atomic and temporal feasibility scenarios | Yes | `/` | `ProjectLibraryPage`, `demoProjects` | `ProjectState` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/fixtures/demoProjects.ts`, `test/golden/feasibilityFixtures.ts` | Important because tests and demos share fixtures |
| Project JSON import | persistence / import-export | Loads a previously exported project JSON file | Yes | `/` | `ProjectLibraryPage`, `projectStorage` | `ProjectState` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | JSON only, not Ableton/drum-rack output |
| Saved project reopening | persistence | Reopens an existing project from the library history | Yes | `/` | `ProjectLibraryPage`, `ProjectEditorPage` | `ProjectState` | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/pages/ProjectEditorPage.tsx` | Current primary re-entry path |
| Remove project from history | persistence / shell | Removes project index entry without necessarily deleting underlying stored data | Yes | `/` | `ProjectLibraryPage`, `removeFromIndex` | project index | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Semantically different from full delete |
| Clear project history | persistence / shell | Clears the project index listing | Yes | `/` | `ProjectLibraryPage`, `clearProjectIndex` | project index | implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Can orphan stored projects from visible library |
| Delete project permanently | persistence | Full deletion of stored project data | No | none wired | `handleDeleteProject`, `deleteProject` | localStorage project blobs | partial | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Handler exists but is explicitly not wired to UI |

## Workspace Shell and Navigation

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Performance Workspace shell | shell / theming | Current unified editor container for project work | Yes | `/project/:id` | `PerformanceWorkspace` | `ProjectState` | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Main product hub |
| Save-and-return library button | shell / persistence | Saves the project and navigates back to library | Yes | `/project/:id` | `PerformanceWorkspace` | `ProjectState` | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Reinforces project-oriented workflow |
| Workspace flow guidance card | onboarding / shell | Explains the intended relationship between timeline, grid, and composer | Yes | `/project/:id` | `PerformanceWorkspace` | none | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Small but important evidence of intended mental model |
| Drawer tab switching | shell / workflow | Toggles between timeline view and pattern composer in the bottom drawer | Yes | `/project/:id` | `PerformanceWorkspace` | drawer UI state | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Makes composer a first-class sibling of timeline |
| Analysis slide-out | shell / analysis | Opens a side panel labeled Analysis | Yes | `/project/:id` | `PerformanceWorkspace`, `AnalysisSidePanel` | `analysisResult`, `candidates` | partial | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/components/AnalysisSidePanel.tsx` | Much thinner than the label suggests |
| Diagnostics slide-out | shell / analysis | Opens a side panel labeled Diagnostics | Yes | `/project/:id` | `PerformanceWorkspace`, `DiagnosticsPanel` | `analysisResult` | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/components/DiagnosticsPanel.tsx` | Carries more concrete analysis than Analysis panel |
| Keyboard shortcut support | shell / editing | Registers editor keyboard shortcuts | Implicit | `/project/:id` | `useKeyboardShortcuts` | undo/redo and editor actions | partial | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/hooks/useKeyboardShortcuts.ts` | Feature exists but user affordance is light |

## Layout Editing and Grid Interaction

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Push 8x8 grid view | editing / visualization | Renders the Push surface as the spatial editing surface | Yes | `/project/:id` | `InteractiveGrid` | `Layout`, `Voice`, `FingerAssignment` | implemented | `src/ui/components/InteractiveGrid.tsx`, `src/types/padGrid.ts` | Core spatial artifact |
| Drag sound from palette to pad | editing | Assigns a sound stream to a grid pad | Yes | `/project/:id` | `VoicePalette`, `InteractiveGrid` | `Layout.padToVoice`, `SoundStream` | implemented | `src/ui/components/VoicePalette.tsx`, `src/ui/state/projectState.ts` | Assignment acts as move, not copy |
| Move sound between pads | editing | Reassigns a sound to a different pad | Yes | `/project/:id` | `InteractiveGrid` | `Layout.padToVoice` | implemented | `src/ui/components/InteractiveGrid.tsx`, `src/ui/state/projectState.ts` | Existing assignment is stripped first |
| Swap pad assignments | editing | Swaps two occupied pads | Yes | `/project/:id` | `InteractiveGrid`, reducer | `Layout.padToVoice` | implemented | `src/ui/components/InteractiveGrid.tsx`, `src/ui/state/projectState.ts` | Also affects analysis staleness |
| Remove sound from pad | editing | Clears a pad assignment | Yes | `/project/:id` | `InteractiveGrid`, reducer | `Layout.padToVoice` | implemented | `src/ui/components/InteractiveGrid.tsx`, `src/ui/state/projectState.ts` | Core manual correction tool |
| Right-click pad context menu | editing / constraints | Opens pad actions including removal or constraints | Yes | `/project/:id` | `PadContextMenu`, `InteractiveGrid` | `Layout`, `fingerConstraints` | implemented | `src/ui/components/PadContextMenu.tsx`, `src/ui/components/InteractiveGrid.tsx` | Important micro-workflow |
| Multi-layout support | editing | Multiple layout variants per project with tab-like selector | Yes | `/project/:id` | `EditorToolbar` | `layouts`, `activeLayoutId` | implemented | `src/ui/components/EditorToolbar.tsx`, `src/ui/state/projectState.ts` | Variation exists, but lifecycle semantics are thin |
| Add empty layout | editing | Adds a new blank layout variant | Yes | `/project/:id` | `EditorToolbar` | `Layout` | implemented | `src/ui/components/EditorToolbar.tsx` | Helps comparison, but not explained in product terms |
| Clone layout | editing | Clones current layout variant | Yes | `/project/:id` | `EditorToolbar` | `Layout` | implemented | `src/ui/components/EditorToolbar.tsx` | Similar to versioning, but not labeled that way |
| Grid expand/collapse mode | visualization | Enlarges the spatial work area | Yes | `/project/:id` | `PerformanceWorkspace` | local UI state | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Focus mode exists informally, not as a named product concept |
| Compare grid side-by-side | visualization / comparison | Shows two candidate layouts at once | Yes | `/project/:id` | `CompareGridView` | `CandidateSolution.layout` | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/components/CompareGridView.tsx` | Only available when compare candidate is set |
| Pad-level finger constraints | editing / constraints | Locks a pad to a specific hand/finger combination | Yes | `/project/:id` | `EventDetailPanel`, grid context menu, reducer | `Layout.fingerConstraints` | implemented | `src/ui/components/EventDetailPanel.tsx`, `src/ui/state/projectState.ts`, `src/ui/hooks/useAutoAnalysis.ts` | Constraints become hard manual assignments in the solver |
| Voice-level hand/finger constraints | editing / constraints | Associates a preferred hand/finger with a whole sound stream | Yes | `/project/:id` | `VoicePalette`, reducer | `voiceConstraints` | partial | `src/ui/components/VoicePalette.tsx`, `src/ui/state/projectState.ts` | Current solver integration is unclear compared with pad constraints |

## Timeline, Arrangement, and Playback

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Unified timeline view | visualization / authoring | Shows voices as horizontal lanes with event blocks and assignment pills | Yes | `/project/:id` | `UnifiedTimeline` | `soundStreams`, `performanceLanes`, `analysisResult`, transport state | implemented | `src/ui/components/UnifiedTimeline.tsx` | Current primary timeline surface |
| Timeline MIDI import | import / authoring | Imports one or more MIDI files directly into lanes from the timeline toolbar | Yes | `/project/:id` | `UnifiedTimeline`, `useLaneImport` | `performanceLanes`, `laneGroups`, `sourceFiles` | implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/hooks/useLaneImport.ts` | Separate from library import, and more lane-oriented |
| Voice filtering | visualization | Filters visible voices by name in the timeline | Yes | `/project/:id` | `UnifiedTimeline` | `soundStreams` | implemented | `src/ui/components/UnifiedTimeline.tsx` | UI-level filter only |
| Timeline zoom | visualization | Adjusts pixels-per-second scale | Yes | `/project/:id` | `UnifiedTimeline` | local UI state | implemented | `src/ui/components/UnifiedTimeline.tsx` | Separate zoom model from older ExecutionTimeline |
| Playback transport | visualization / playback | Play, stop, reset, and current time display | Yes | `/project/:id` | `UnifiedTimeline`, reducer | `currentTime`, `isPlaying` | implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/state/projectState.ts` | No actual audio output; visual transport only |
| Event selection from timeline pills | analysis / visualization | Clicking a timeline assignment selects an event globally | Yes | `/project/:id` | `UnifiedTimeline`, reducer | `selectedEventIndex` | implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/state/projectState.ts` | Selection model connects multiple panels |
| Automatic lane-from-stream population | system behavior | Builds lanes from streams when no lanes exist | Hidden system behavior | `/project/:id` | `UnifiedTimeline`, converters | `soundStreams`, `performanceLanes` | implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/state/streamsToLanes.ts` | Important invisible sync rule |
| Automatic stream-from-lane synchronization | system behavior | When lanes exist, sound streams are regenerated from them | Hidden system behavior | `/project/:id` | `UnifiedTimeline`, converters | `performanceLanes`, `soundStreams` | implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/state/lanesToStreams.ts` | Major source-of-truth ambiguity |
| Lane mute from timeline sidebar | editing / authoring | Mutes individual streams from the timeline | Yes | `/project/:id` | `UnifiedTimeline` | `SoundStream.muted` | implemented | `src/ui/components/UnifiedTimeline.tsx` | Affects analysis and visibility |
| Older collapsible timeline panel | visualization | Older bottom panel around `ExecutionTimeline` | No in current shell | none | `TimelinePanel`, `ExecutionTimeline` | `soundStreams`, `analysisResult`, transport | legacy / duplicated | `src/ui/components/TimelinePanel.tsx`, `src/ui/components/ExecutionTimeline.tsx` | Overlaps with UnifiedTimeline |
| Separate performance lanes workspace | arrangement | Full lane management view with sidebar, timeline, and inspector | No in current shell | none | `PerformanceLanesView`, `LaneToolbar`, `LaneSidebar`, `LaneTimeline`, `LaneInspector` | `performanceLanes`, `laneGroups`, `sourceFiles` | legacy / duplicated | `src/ui/components/lanes/PerformanceLanesView.tsx` | Strong evidence of earlier separate Arrange workflow |

## Optimization, Analysis, and Comparison

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Auto-analysis after edits | analysis / system behavior | Debounced single-candidate re-analysis when current layout becomes stale | Mostly implicit | `/project/:id` | `useAutoAnalysis` | `analysisStale`, `analysisResult` | implemented | `src/ui/hooks/useAutoAnalysis.ts` | User sees result updates, not the mechanism |
| Full candidate generation | optimization | Generates three layout candidates via quick, thorough, or auto mode | Yes | `/project/:id` | `EditorToolbar`, `useAutoAnalysis`, candidate generator | `candidates`, `selectedCandidateId` | implemented | `src/ui/components/EditorToolbar.tsx`, `src/ui/hooks/useAutoAnalysis.ts`, `src/engine/optimization/multiCandidateGenerator.ts` | Current main solver-facing action |
| Auto-layout from empty state | optimization / convenience | If layout is empty, Generate first assigns notes chromatically to grid positions | Yes, but implicit | `/project/:id` | `useAutoAnalysis` | `Layout.padToVoice` | implemented | `src/ui/hooks/useAutoAnalysis.ts` | Helpful, but not clearly explained as a temporary heuristic |
| Candidate switching | analysis | Switches active candidate result | Yes | `/project/:id` | `AnalysisSidePanel` | `selectedCandidateId`, `analysisResult` | implemented | `src/ui/components/AnalysisSidePanel.tsx` | Main visible content of Analysis panel |
| Candidate comparison | analysis / comparison | Lets user pick a second candidate and view deltas | Yes | `/project/:id` | `AnalysisSidePanel`, `CandidateCompare`, `CompareGridView` | `compareCandidateId`, `candidates` | implemented | `src/ui/components/AnalysisSidePanel.tsx`, `src/ui/components/CandidateCompare.tsx` | More substantial than general analysis panel |
| Difficulty heatmap | visualization / analysis | Shows section-level difficulty bars | Yes | `/project/:id` | `DifficultyHeatmap`, `DiagnosticsPanel` | `DifficultyAnalysis` | implemented | `src/ui/components/DifficultyHeatmap.tsx`, `src/ui/components/DiagnosticsPanel.tsx` | Analysis signal is section-based, not event-first |
| Diagnostics metrics panel | analysis / explainability | Shows score, drift, hard count, finger usage, fatigue, suggestions | Yes | `/project/:id` | `DiagnosticsPanel` | `ExecutionPlanResult` | implemented | `src/ui/components/DiagnosticsPanel.tsx` | More concrete than `AnalysisSidePanel` |
| Event detail panel | analysis / editing | Shows selected event details and pad-level constraint controls | Yes | `/project/:id` | `EventDetailPanel` | `FingerAssignment`, `Layout.fingerConstraints` | implemented | `src/ui/components/EventDetailPanel.tsx` | Strong local explainability feature |
| Transition detail panel | analysis / visualization | Shows current-to-next event movement summary and pressure metrics | Yes | `/project/:id` | `TransitionDetailPanel`, `selectionModel` | selected transition model | implemented | `src/ui/components/workspace/TransitionDetailPanel.tsx`, `src/ui/analysis/selectionModel.ts` | Important bridge toward event analysis |
| Onion skin overlay | visualization | Shows previous/next event layers on the grid | Yes | `/project/:id` | `PerformanceWorkspace`, `InteractiveGrid` | selection state, assignments | implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/components/InteractiveGrid.tsx` | Current lightweight restoration of V1 idea |
| Transition arcs / impossible move highlights | visualization / analysis | Shows movement arcs, shared pads, and impossible move cues | Yes | `/project/:id` | `InteractiveGrid` | transition model, assignments | implemented | `src/ui/components/InteractiveGrid.tsx` | Useful, but not wrapped in a richer event-analysis frame |
| Analysis stale indicator | feedback | Warns user when displayed analysis is outdated | Yes | `/project/:id` | `EditorToolbar` | `analysisStale`, `analysisResult` | implemented | `src/ui/components/EditorToolbar.tsx` | Important, because stale state is common |
| Separate optimizer debug dashboard | debug / inspection | Developer-facing dashboard with tabs for timeline, fingers, costs, violations, movement, irrational, sanity | Yes, but hidden route | `/optimizer-debug` | `OptimizerDebugPage`, `src/engine/debug/*` | `window.__PUSHFLOW_DEBUG__`, `ExecutionPlanResult`, `CandidateSolution` | implemented / hidden | `src/ui/pages/OptimizerDebugPage.tsx` | Powerful but outside normal workflow |

## Pattern, Loop, and Generative Authoring

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Pattern composer drawer | creation / authoring | Built-in composer for loops/patterns inside the main workspace | Yes | `/project/:id` | `WorkspacePatternStudio` | local `LoopState`, project lanes | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx` | Major creation workflow inside analysis workspace |
| Lane-based loop editing | creation / authoring | Adds/removes lanes and toggles steps in a loop grid | Yes | `/project/:id` | `LoopLaneSidebar`, `LoopGridCanvas` | `LoopState.lanes`, `LoopState.events` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, loop-editor components | Separate from imported timeline model |
| Pattern preset selection | creation / authoring | Selects predefined rhythmic/pattern recipes | Yes | `/project/:id` | `PatternSelector`, pattern engine | `PatternRecipe`, `PatternResult` | implemented | `src/ui/components/loop-editor/PatternSelector.tsx`, `src/engine/pattern/presets.ts` | Includes converted legacy rudiments and newer recipes |
| Random pattern generation | creation / authoring | Generates a random pattern recipe from a seed | Yes | `/project/:id` | `PatternSelector`, random generator | `PatternRecipe`, `PatternResult` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/engine/pattern/randomRecipeGenerator.ts` | Seeded and reproducible |
| Custom recipe editor | creation / authoring | Modal editor for custom pattern recipes | Yes | `/project/:id` | `RecipeEditorModal` | `PatternRecipe` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/components/loop-editor/RecipeEditorModal.tsx` | More sophisticated than current top-level product framing suggests |
| Pattern analysis stepper | analysis / visualization | Steps through generated pattern finger assignments and complexity | Yes | `/project/:id` | `RudimentEventStepper` | `PatternResult`, `RudimentResult` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/components/loop-editor/RudimentEventStepper.tsx` | Uses separate complexity model from main difficulty analysis |
| Live sync from composer into project timeline | system behavior / authoring | Composer changes become project lanes automatically | Hidden system behavior | `/project/:id` | `WorkspacePatternStudio`, `convertLoopToPerformanceLanes` | `LoopState`, `performanceLanes` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/state/loopToLanes.ts` | High-product-impact behavior, not fully surfaced |
| Live sync from composer into main grid | system behavior / editing | Generated pattern pad assignments replace project layout assignments in bulk | Hidden system behavior | `/project/:id` | `WorkspacePatternStudio`, reducer | `Layout.padToVoice` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/state/projectState.ts` | Very important cross-workflow coupling |
| Composer preset save/load/delete | persistence / authoring | Saves user-created patterns to localStorage | Yes | `/project/:id` | `presetStorage`, `PatternSelector` | `PerformancePreset`, `LoopState` | implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/persistence/presetStorage.ts` | Real feature, but buried inside drawer workflow |
| Old loop editor page/workflow | creation / authoring | Standalone loop editor with local persistence and explicit commit-to-project action | No in current shell | none | `LoopEditorView`, `loopStorage` | `LoopState`, `performanceLanes` | legacy / duplicated | `src/ui/components/loop-editor/LoopEditorView.tsx`, `src/ui/persistence/loopStorage.ts` | Earlier model was commit-based; current one is live-sync |

## Persistence, Export, and Data Lifecycle

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Local project persistence | persistence | Saves projects to localStorage with project index | Yes | `/` and `/project/:id` | `projectStorage` | `ProjectState` | implemented | `src/ui/persistence/projectStorage.ts` | Current primary storage model |
| Save button in editor | persistence | Explicit save action inside editor toolbar | Yes | `/project/:id` | `EditorToolbar` | `ProjectState` | implemented | `src/ui/components/EditorToolbar.tsx` | Complements implicit save-and-return |
| JSON export | import/export | Exports project state to file | Yes | `/project/:id` | `EditorToolbar`, `projectStorage` | `ProjectState` | implemented | `src/ui/components/EditorToolbar.tsx`, `src/ui/persistence/projectStorage.ts` | Only current export in live shell |
| Validation and hydration fallback | system behavior | Fills defaults and repairs legacy data when loading projects | Hidden | storage layer | `validateProjectState` | `ProjectState` | implemented | `src/ui/persistence/projectStorage.ts` | Important for long-lived local data |
| Persisted candidates | persistence / analysis | Candidate solutions are stored with project data | Hidden | storage layer | `projectStorage` | `candidates` | implemented / risky | `src/ui/persistence/projectStorage.ts`, `docs/repo_map.md` | Can go stale across engine changes |
| Persisted loop-editor local state | persistence / legacy | Saves standalone loop-editor state per project | No in current shell | none | `loopStorage` | `LoopState` | legacy | `src/ui/persistence/loopStorage.ts`, `src/ui/components/loop-editor/LoopEditorView.tsx` | Legacy persistence path remains |
| Ableton/drum-rack export | import/export | Export finalized layout for Ableton Push use | No in current shell | none | older utility/docs | remapped notes, layout | planned | `tasks/ux-audit.md`, `Version1/adg_remapper.py`, `Version1/docs/MIDI_IMPORT_AND_EXPORT_DOCUMENTATION.md` | Clearly desired, not productized in current app |

## Debug, Inspection, and Engine Quality Features

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Constraint explanation helpers | debug / analysis | Identifies bottlenecks and explains constraints | Not surfaced directly | none | analysis helpers | `CandidateSolution`, `ExecutionPlanResult` | hidden | `src/engine/analysis/constraintExplainer.ts` | Logic exists without a dedicated user surface |
| Candidate comparison engine | debug / analysis | Computes structured diffs between candidates | Partly surfaced | `/project/:id` | comparator logic | `CandidateComparison` | partial | `src/engine/analysis/candidateComparator.ts`, `src/ui/components/CandidateCompare.tsx` | UI presents summary, not full structured explanation |
| Sanity checks | debug | Applies heuristic checks to execution plans | Hidden except debug route | `/optimizer-debug` | `sanityChecks` | `ExecutionPlanResult` | implemented / hidden | `src/engine/debug/sanityChecks.ts`, `src/ui/pages/OptimizerDebugPage.tsx` | Debug-only quality gate |
| Irrational assignment detector | debug | Flags suspicious solver decisions like pinky or thumb misuse | Hidden except debug route | `/optimizer-debug` | `irrationalDetector` | debug evaluation records | implemented / hidden | `src/engine/debug/irrationalDetector.ts`, `src/ui/pages/OptimizerDebugPage.tsx` | Strong internal quality heuristic |
| Candidate report generation | debug | Generates debug reports per candidate | Hidden | `/optimizer-debug` | `candidateReport` | `CandidateSolution` | implemented / hidden | `src/engine/debug/candidateReport.ts`, `src/ui/pages/OptimizerDebugPage.tsx` | Supports internal evaluation rather than performer workflow |

## Duplicate Features Across Pages / Systems

| Duplicated Concept | Where It Appears | Type of Duplication | Evidence | Why It Matters |
|---|---|---|---|---|
| Timeline visualization | `UnifiedTimeline` and older `TimelinePanel` / `ExecutionTimeline` | UI duplication | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/components/TimelinePanel.tsx` | Competing notions of what the "timeline" is |
| Lane arrangement workflow | `UnifiedTimeline` and retained `PerformanceLanesView` | Workflow duplication | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/components/lanes/PerformanceLanesView.tsx` | Suggests unresolved Arrange workflow |
| Pattern authoring | `WorkspacePatternStudio` and retained `LoopEditorView` | Workflow and state duplication | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/components/loop-editor/LoopEditorView.tsx` | Old commit-to-project model vs new live-sync model |
| Analysis surface | `AnalysisSidePanel`, `DiagnosticsPanel`, event/transition panels, debug route | Feature split and role duplication | `src/ui/components/AnalysisSidePanel.tsx`, `src/ui/components/DiagnosticsPanel.tsx`, `src/ui/pages/OptimizerDebugPage.tsx` | User-facing "analysis" is not one coherent thing |
| Constraint controls | `VoicePalette`, `EventDetailPanel`, grid context menu | Similar intent at different abstraction levels | `src/ui/components/VoicePalette.tsx`, `src/ui/components/EventDetailPanel.tsx`, `src/ui/components/PadContextMenu.tsx` | Hard to tell whether user constrains sounds, pads, or events |

## Hidden Features That Exist in Code but Are Not Clearly Surfaced

| Hidden Feature | Evidence | Why It Counts |
|---|---|---|
| Optimizer debug route | `src/ui/App.tsx`, `src/ui/pages/OptimizerDebugPage.tsx` | Real route with rich UI, but not linked from the main app |
| Permanent project deletion | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Handler and storage API exist, but no UI exposure |
| Standalone lane-management workspace | `src/ui/components/lanes/PerformanceLanesView.tsx` | Large retained workflow, not routed |
| Standalone loop editor | `src/ui/components/loop-editor/LoopEditorView.tsx` | Large retained workflow, not routed |
| Constraint explanation and candidate comparison engines beyond current UI | `src/engine/analysis/constraintExplainer.ts`, `src/engine/analysis/candidateComparator.ts` | More analysis depth exists than the current main UI exposes |

## Planned or Incomplete Features

| Feature | Evidence | Current Best Reading |
|---|---|---|
| Ableton / drum-rack export | `tasks/ux-audit.md`, `Version1/adg_remapper.py` | Desired product capability, not implemented in current live shell |
| Stronger event-by-event analysis spine | `tasks/ux-audit.md`, `docs/ux-v1-restructure-plan.md`, V1 event-analysis docs/components | Actively recognized gap |
| Full project deletion from library UI | `src/ui/pages/ProjectLibraryPage.tsx` comment | Straightforward unfinished UI wiring |
| Clear focus modes and workflow framing | `docs/ux-v1-restructure-plan.md` vs current workspace implementation | Product intent documented more clearly than final UI articulation |

## Inventory Summary

The repo supports a substantial number of real features, but many of them cluster around overlapping representations of the same product job. The app is not short on capabilities; it is short on clarified workflow boundaries. The most notable pattern is not missing engineering depth, but product surface drift: multiple valid feature systems exist at once, and the current UI only partially resolves which one is canonical.
