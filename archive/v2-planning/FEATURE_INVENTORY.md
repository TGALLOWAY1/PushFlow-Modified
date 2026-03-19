# Feature Inventory

## Scope Note

- `Current` means active in the top-level runtime.
- `Hidden` means reachable or real in code but not linked from the main flow.
- `Legacy` means retained in `Version1/`.

## Core Features

| Feature | Scope | Status | Evidence | Notes |
|---|---|---|---|---|
| Project library | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx` | Home route for creation, import, demos, and re-entry |
| Blank project creation | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx` | Creates default empty layout |
| MIDI import to new project | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/import/midiImport.ts` | One stream per unique note number |
| Post-import sound naming | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx` | Includes GM drum naming helper |
| Demo project loading | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/fixtures/demoProjects.ts` | Includes atomic and temporal feasibility demos |
| Saved project reopen | Current | Implemented | `src/ui/pages/ProjectEditorPage.tsx`, `src/ui/persistence/projectStorage.ts` | Loads hydrated `ProjectState` |
| Unified performance workspace | Current | Implemented | `src/ui/components/workspace/PerformanceWorkspace.tsx` | Main editor shell |
| Manual pad assignment | Current | Implemented | `src/ui/components/InteractiveGrid.tsx`, `src/ui/components/VoicePalette.tsx` | Drag stream to pad |
| Pad swap and removal | Current | Implemented | `src/ui/components/InteractiveGrid.tsx`, `src/ui/state/projectState.ts` | Layout mutation invalidates analysis |
| Multi-layout project support | Current | Implemented | `src/ui/components/EditorToolbar.tsx` | Add and clone layout variants |
| Unified timeline | Current | Implemented | `src/ui/components/UnifiedTimeline.tsx` | Timeline display, import, filter, zoom, transport |
| Timeline MIDI import | Current | Implemented | `src/ui/hooks/useLaneImport.ts`, `src/ui/components/UnifiedTimeline.tsx` | Imports one or more files into lanes |
| Lane/source grouping | Current | Implemented | `src/types/performanceLane.ts`, `src/ui/state/lanesReducer.ts` | Tracks source files and groups |
| Playback transport | Current | Implemented | `src/ui/components/UnifiedTimeline.tsx`, `src/ui/state/projectState.ts` | Visual time playback only |
| Candidate generation | Current | Implemented | `src/ui/hooks/useAutoAnalysis.ts`, `src/engine/optimization/multiCandidateGenerator.ts` | Quick, thorough, and auto modes |
| Debounced auto-analysis | Current | Implemented | `src/ui/hooks/useAutoAnalysis.ts` | Runs single-candidate refresh after edits |
| Diagnostics panel | Current | Implemented | `src/ui/components/DiagnosticsPanel.tsx` | Score, drift, balance, fatigue, suggestions |
| Selected event inspection | Current | Implemented | `src/ui/components/EventDetailPanel.tsx` | Event facts plus pad-level constraints |
| Selected transition inspection | Current | Implemented | `src/ui/components/workspace/TransitionDetailPanel.tsx` | Current-to-next movement analysis |
| Onion-skin and transition overlays | Current | Implemented | `src/ui/components/InteractiveGrid.tsx` | Previous/next pads, shared pads, movement arcs |
| Candidate comparison | Current | Implemented | `src/ui/components/AnalysisSidePanel.tsx`, `src/ui/components/CandidateCompare.tsx` | Metric and layout comparison |
| Project save and JSON export | Current | Implemented | `src/ui/components/EditorToolbar.tsx`, `src/ui/persistence/projectStorage.ts` | Local persistence plus file export |

## Secondary Features

| Feature | Scope | Status | Evidence | Notes |
|---|---|---|---|---|
| Voice-level hand/finger constraints | Current | Partial | `src/ui/components/VoicePalette.tsx`, `src/ui/state/projectState.ts` | UI exists; solver effect is weaker than pad constraints |
| Pad-level finger constraints | Current | Implemented | `src/ui/components/EventDetailPanel.tsx`, `src/ui/hooks/useAutoAnalysis.ts` | Converted into hard manual assignments |
| Difficulty heatmap by passage | Current | Implemented | `src/ui/components/DifficultyHeatmap.tsx` | Section-level, not event-first |
| Pattern composer drawer | Current | Implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx` | Local loop editor inside project |
| Pattern preset selection | Current | Implemented | `src/ui/components/loop-editor/PatternSelector.tsx`, `src/engine/pattern/presets.ts` | Recipe-driven generation |
| Random recipe generation | Current | Implemented | `src/engine/pattern/randomRecipeGenerator.ts` | Seeded generation |
| Custom recipe editing | Current | Implemented | `src/ui/components/loop-editor/RecipeEditorModal.tsx` | Editable declarative recipe model |
| Composer preset save/load/delete | Current | Implemented | `src/ui/persistence/presetStorage.ts` | Stored in localStorage |
| Live composer-to-project sync | Current | Implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/ui/state/loopToLanes.ts` | Upserts lanes into shared project |
| Composer-driven bulk pad assignment | Current | Implemented | `src/ui/components/workspace/WorkspacePatternStudio.tsx` | Replaces layout assignments using generated pad assignments |
| Remove-from-history without delete | Current | Implemented | `src/ui/persistence/projectStorage.ts` | Hides entry but keeps blob |
| Project JSON import | Current | Implemented | `src/ui/pages/ProjectLibraryPage.tsx`, `src/ui/persistence/projectStorage.ts` | Hydrates `ProjectState` |

## Debug / Developer Tools

| Feature | Scope | Status | Evidence | Notes |
|---|---|---|---|---|
| Optimizer debug dashboard | Hidden | Implemented | `src/ui/pages/OptimizerDebugPage.tsx` | Route is `/optimizer-debug` |
| Event timeline debug table | Hidden | Implemented | `src/ui/pages/OptimizerDebugPage.tsx`, `src/engine/debug/evaluationRecorder.ts` | Sortable cost table |
| Constraint violation validation | Hidden | Implemented | `src/engine/debug/constraintValidator.ts` | Debug-only view |
| Irrational assignment detection | Hidden | Implemented | `src/engine/debug/irrationalDetector.ts` | Pinky/thumb/zone heuristics |
| Candidate report generation | Hidden | Implemented | `src/engine/debug/candidateReport.ts` | Candidate-level summary |
| Sanity checks | Hidden | Implemented | `src/engine/debug/sanityChecks.ts` | Quality gates for plans |
| Synthetic optimizer tests | Hidden | Implemented | `test/optimizer/syntheticStressTests.test.ts` | Stress scenarios |
| Golden feasibility scenarios | Hidden | Implemented | `test/golden/goldenScenarios.test.ts` | Engine regression coverage |

## Experimental Features

| Feature | Scope | Status | Evidence | Notes |
|---|---|---|---|---|
| Dedicated Event Analysis page | Legacy | Retained | `Version1/src/pages/EventAnalysisPage.tsx` | Strong analysis spine not in current runtime |
| Dedicated Timeline page | Legacy | Retained | `Version1/src/pages/TimelinePage.tsx` | Separate from current unified timeline |
| Dedicated Workbench page | Legacy | Retained | `Version1/src/workbench/Workbench.tsx` | Dashboard -> Workbench workflow |
| Song portfolio dashboard | Legacy | Retained | `Version1/src/pages/Dashboard.tsx` | Metadata-driven song library |
| Dev-only cost debug page | Legacy | Retained | `Version1/src/pages/CostDebugPage.tsx` | Earlier debug surface |
| Standalone performance lanes workspace | Hidden | Retained | `src/ui/components/lanes/PerformanceLanesView.tsx` | No current route |
| Standalone loop editor | Hidden | Retained | `src/ui/components/loop-editor/LoopEditorView.tsx` | Old commit-based authoring model |
| Older `TimelinePanel` plus `ExecutionTimeline` flow | Hidden | Retained | `src/ui/components/TimelinePanel.tsx` | Duplicates unified timeline intent |
| Permanent project deletion UI | Current | Partial | `src/ui/pages/ProjectLibraryPage.tsx` | Handler exists but is not wired |
| Ableton/drum-rack export | Legacy/Planned | Partial | `Version1/adg_remapper.py`, `Version1/docs/MIDI_IMPORT_AND_EXPORT_DOCUMENTATION.md`, `tasks/ux-audit.md` | Desired product capability, not in live shell |

## Inventory Reading

The repository has broad product capability. The main issue is not missing engine depth. The issue is that multiple adjacent feature systems still compete to define what the product is:

- verification and optimization
- timeline authoring
- pattern composition
- deep developer diagnostics
- retained `Version1/` dedicated analysis screens
