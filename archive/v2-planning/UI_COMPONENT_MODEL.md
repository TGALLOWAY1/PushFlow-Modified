# UI Component Model

## Scope Note

- The first hierarchy is the active top-level runtime.
- The second hierarchy captures retained `Version1/` screen models because they still influence product language and redesign targets.

## Current Runtime Hierarchy

### `App`

```text
App
├── ProjectLibraryPage
├── ProjectEditorPage
│   └── ProjectProvider
│       └── PerformanceWorkspace
└── OptimizerDebugPage
```

### `ProjectLibraryPage`

```text
ProjectLibraryPage
├── Header / title
├── MIDI import dropzone
├── Quick actions
├── Import naming subflow
├── Demo groups
└── Saved project list
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| import dropzone | Entry to MIDI import | file object | parse MIDI, create pending import |
| naming subflow | Normalize imported streams into named sounds | pending import streams, tempo, sections, voice profiles | rename sounds, apply drum presets, create project |
| demo groups | Provide bundled starting projects | demo project fixtures | duplicate demo, navigate to editor |
| saved project list | Re-entry into persisted work | project index entries | open project, remove from history, clear history |

### `PerformanceWorkspace`

```text
PerformanceWorkspace
├── Header
├── EditorToolbar
├── Left rail
│   ├── workflow helper
│   └── VoicePalette
├── Center region
│   ├── InteractiveGrid or CompareGridView
│   ├── EventDetailPanel
│   └── TransitionDetailPanel
├── Bottom drawer
│   ├── UnifiedTimeline
│   └── WorkspacePatternStudio
└── Slide-out panel
    ├── AnalysisSidePanel
    └── DiagnosticsPanel
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| `EditorToolbar` | Layout switching, save/export, generation, panel toggles | `layouts`, active layout, undo/redo, processing state | add/clone layout, save, export, generate, toggle analysis/diagnostics |
| workflow helper | Explain the intended relationship between timeline, grid, and composer | local UI state only | switch drawer mode |
| `VoicePalette` | Inventory of sounds and sound-level constraints | `soundStreams`, active layout, solver summary | drag stream, mute stream, set voice constraint |
| `InteractiveGrid` | Main spatial editor and event-linked visualization | active layout, selected assignments, compare mode, transport state | assign/move/swap/remove pad, select event, set pad context state |
| `CompareGridView` | Spatial comparison of two candidate layouts | selected and compare candidates | compare-only inspection |
| `EventDetailPanel` | Event-level explanation and pad-level constraint editing | selected event, active layout, assignments | set or clear finger constraint |
| `TransitionDetailPanel` | Current-to-next transition explanation | selected event, assignments | read-only inspection |
| `AnalysisSidePanel` | Candidate selection and comparison entry | `analysisResult`, `candidates`, selected candidate IDs | switch candidate, set compare candidate |
| `DiagnosticsPanel` | Aggregate analysis metrics and suggestions | `analysisResult.executionPlan` | read-only inspection |

### `UnifiedTimeline`

```text
UnifiedTimeline
├── Timeline toolbar
├── Voice sidebar
└── Event canvas
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| toolbar | import, filter, zoom, transport | streams, tempo, transport state | import MIDI files, set search, set zoom, play/stop/reset |
| voice sidebar | show visible voices | filtered `soundStreams` | none |
| event canvas | time-based visualization of stream events and finger assignments | streams, analysis assignments, selected event | select event, scrub time indirectly via transport |

### `WorkspacePatternStudio`

```text
WorkspacePatternStudio
├── Composer toolbar
├── PatternSelector
├── LoopLaneSidebar
├── LoopGridCanvas
├── RudimentEventStepper
└── RecipeEditorModal
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| composer toolbar | global loop config and transport | `LoopState.config`, playhead, playback state | set bars, subdivision, bpm, play/stop, save preset, clear |
| `PatternSelector` | choose built-in, saved, or random pattern recipes | presets, pattern engine data | generate pattern, randomize, load/delete preset, open recipe editor |
| `LoopLaneSidebar` | manage loop lanes | `LoopState.lanes` | add lane, rename, recolor, set MIDI note, mute/solo |
| `LoopGridCanvas` | step-grid authoring | `LoopState.events`, `LoopState.config` | toggle cells, set velocity |
| `RudimentEventStepper` | inspect generated pad/finger assignments and complexity | `PatternResult` or `RudimentResult` | step through generated event sequence |
| sync bridge in component | propagate composer output into project lanes and layout | local `LoopState`, project dispatch | upsert/remove lane source, bulk assign pads |

### `OptimizerDebugPage`

```text
OptimizerDebugPage
├── Header
├── Candidate selector
├── Sanity banner
├── Tab bar
└── Tab content
    ├── EventTimelineTab
    ├── FingerUsageTab
    ├── CostBreakdownTab
    ├── ViolationsTab
    ├── MovementTab
    ├── IrrationalTab
    └── SanityTab
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| candidate selector | pick candidate under inspection | debug candidates payload | switch current candidate |
| sanity banner | surface failing checks | sanity report | read-only |
| tab content | specialized optimization debugging views | debug evaluation records, violations, reports | sorting and inspection only |

## Retained `Version1/` Hierarchy

### `Dashboard`

```text
Dashboard
├── Portfolio header
├── Song card grid
└── Add song card
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| song grid | show song portfolio | `SongMetadata[]` | open workbench, link MIDI, delete song, update metadata |
| add song card | create portfolio item | none | create song |

### `Workbench`

```text
Workbench
├── Header / navigation / solver controls
├── LayoutDesigner
│   ├── GridEditor
│   ├── VoiceLibrary
│   ├── NaturalHandPosePanel
│   └── FingerLegend
└── AnalysisPanel
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| `LayoutDesigner` | Dedicated grid-editing surface | parked sounds, active mapping, engine result | assign/remove/update sounds, edit pose, import/export project |
| `VoiceLibrary` | staging area for unassigned voices | parked sounds, active mapping | drag voices, edit voice names |
| `NaturalHandPosePanel` | configure pose0 | natural hand pose state | edit pose assignments |
| `AnalysisPanel` | summary, comparison, optimization panels | engine result, solver results, active mapping | inspect solver metrics |

### `EventAnalysisPage`

```text
EventAnalysisPanel
├── Left panel
│   ├── EventTimelinePanel
│   └── EventLogTable
├── Center panel
│   └── OnionSkinGrid
└── Right panel
    ├── TransitionMetricsPanel
    └── PracticeLoopControls
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| `EventTimelinePanel` | event-by-event navigation spine | analyzed events, transitions | select event |
| `EventLogTable` | tabular event inspection | debug events | edit assignments |
| `OnionSkinGrid` | current/next/previous pad layering with arrows | onion skin model | visual inspection |
| `TransitionMetricsPanel` | transition difficulty detail | selected transition | read-only |
| `PracticeLoopControls` | repeated practice over hard transitions | selected event and transitions | set loop behavior |

### `TimelinePage`

```text
TimelinePage
└── Timeline
    ├── ruler
    ├── voice label column
    └── note lanes
```

| Component / zone | Responsibility | Data consumed | Actions triggered |
|---|---|---|---|
| ruler | time grid | performance duration, zoom | seek |
| voice column | label per mapped voice | active mapping voices | none |
| note lanes | show note blocks and finger labels | performance events, finger assignments | seek / inspect |

## UI Reading

The current component tree proves that the product has already converged on one large workspace. The retained `Version1/` tree proves that the repo still understands three responsibilities as separate experiences:

- dashboard / project entry
- workbench / layout editing
- event analysis / transition inspection
- timeline / time-based visualization

Those retained boundaries are useful because they expose the screen responsibilities the unified runtime is now compressing into a single page.
