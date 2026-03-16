# Visualization and Feedback Model

## Goal

This document captures how the current app communicates information to the user: what it visualizes, how it signals difficulty or constraints, what feedback loops exist, and where those loops are weak or confusing.

Primary evidence:

- `src/ui/components/InteractiveGrid.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/VoicePalette.tsx`
- `src/ui/components/DifficultyHeatmap.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/components/EventDetailPanel.tsx`
- `src/ui/components/workspace/TransitionDetailPanel.tsx`
- `src/ui/components/CandidateCompare.tsx`
- `src/ui/components/CompareGridView.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/pages/OptimizerDebugPage.tsx`
- `tasks/ux-audit.md`
- `Version1/src/components/vis/OnionSkinGrid.tsx`

## Current Visualization Surfaces

| Surface | What It Shows | Feedback Type | Evidence |
|---|---|---|---|
| Project library cards | project name, sound/event count, difficulty badge, dates | status / navigation feedback | `ProjectLibraryPage.tsx` |
| Voice palette | sound list, event counts, current pad location, dominant solver assignment, constraints | object inventory + light analysis | `VoicePalette.tsx` |
| Interactive grid | current pad assignments, selected-event highlights, onion-skin overlays, shared pads, impossible moves, transition arcs | primary spatial visualization | `InteractiveGrid.tsx` |
| Unified timeline | voice lanes, event blocks, assignment pills, beat lines, transport/playhead | primary temporal visualization | `UnifiedTimeline.tsx` |
| Difficulty heatmap | per-passage difficulty bars | aggregate difficulty overview | `DifficultyHeatmap.tsx` |
| Diagnostics panel | score badges, metric bars, finger fatigue, balance, suggestions | analytical feedback | `DiagnosticsPanel.tsx` |
| Event detail panel | selected event facts and cost breakdown | local inspection feedback | `EventDetailPanel.tsx` |
| Transition detail panel | current-to-next movement and next-event pressure | local transition feedback | `TransitionDetailPanel.tsx` |
| Candidate compare | metric deltas between two candidates | comparison feedback | `CandidateCompare.tsx` |
| Compare grid | side-by-side candidate layouts | spatial comparison feedback | `CompareGridView.tsx` |
| Pattern composer stepper | per-event finger assignments and complexity for generated patterns | composer-local analysis feedback | `WorkspacePatternStudio.tsx`, `RudimentEventStepper.tsx` |
| Optimizer debug dashboard | low-level tables, flags, violations, sanity results | developer inspection feedback | `OptimizerDebugPage.tsx` |

## Visualizations Used

## 1. Spatial Grid Visualization

Current grid feedback includes:

- occupied pads with sound identity
- left/right activity cues
- selected event pad highlights
- onion-skin previous/next event layers
- shared pads between current and next event
- transition/movement arcs
- impossible move highlighting

Strength:

- keeps the Push surface visible as the main physical frame

Limitation:

- still less legible and less event-centered than the richer V1 onion-skin/event-analysis system described in retained docs and old components

Evidence:

- `src/ui/components/InteractiveGrid.tsx`
- `tasks/ux-audit.md`
- V1 onion-skin files

## 2. Timeline / Lane Visualization

Current timeline feedback includes:

- one row per visible stream
- event blocks colored by sound
- finger-assignment pills overlayed on events
- beat/measure lines
- transport playhead
- voice filtering and mute status

Strength:

- good at showing parallel streams and timing density

Limitation:

- the current timeline is more lane-oriented than event-step-oriented, so it is weaker at making one transition feel like the atomic unit of inspection

Evidence:

- `src/ui/components/UnifiedTimeline.tsx`

## 3. Aggregate Difficulty Visualization

Current aggregate views include:

- difficulty heatmap by section/passage
- score / drift / hard-event badges
- hand balance bar
- metric bars for movement, stretch, drift, bounce, fatigue, crossover

Strength:

- gives the user a compact high-level read on overall burden

Limitation:

- the numeric semantics are not always obvious, and "analysis" is split between multiple surfaces

Evidence:

- `src/ui/components/DifficultyHeatmap.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`

## 4. Comparison Visualization

Current comparison views include:

- candidate buttons with apparent percentage score
- side-by-side metric comparisons
- compare-grid spatial mode

Strength:

- reinforces the product idea that there are multiple plausible solutions

Limitation:

- comparison is somewhat hidden under the Analysis slide-out instead of being framed as a primary moment in the workflow

Evidence:

- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/CandidateCompare.tsx`
- `src/ui/components/CompareGridView.tsx`

## 5. Composer Visualization

Current composer feedback includes:

- step grid
- composer lanes
- playhead
- per-event stepping for generated results
- complexity label/analysis

Strength:

- powerful for local pattern creation

Limitation:

- uses a different visual and conceptual language from the main difficulty-analysis surfaces

Evidence:

- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- loop-editor components

## Metrics Shown to the User

| Metric / Label | Surface | Meaning As Presented | Clarity |
|---|---|---|---|
| `Score` | Diagnostics, debug | aggregate execution burden / total cost | Medium-low because semantics are inconsistent across repo |
| `Drift` | Diagnostics, event detail | hand movement away from home/natural position | Medium |
| `Hard` | Diagnostics | count of hard events | Medium |
| `Unplayable` | Diagnostics, debug | count of impossible events | High |
| hand balance | Diagnostics | split between left and right workload | High |
| finger usage | Diagnostics, debug | count of assignments per finger | High |
| fatigue | Diagnostics | accumulated per-finger workload | Medium |
| movement, stretch, bounce, crossover | Diagnostics, event detail, transition detail | cost components | Medium-low; tooltips help, but jargon remains |
| overall candidate `%` | Analysis panel | candidate quality shorthand | Low because it is not clear how it maps to other scores |
| complexity | composer stepper | burden of generated pattern | Medium-low relative to main difficulty model |

## Overlays, Highlights, and Selection Feedback

| Feedback Element | Where It Appears | What It Communicates | Notes |
|---|---|---|---|
| selected-event highlight | timeline pills, grid, event panel | currently focused event | central coordination mechanism |
| onion skin | grid | previous/next temporal context | valuable but lightweight |
| shared pad highlight | grid | same pad appears across current and next event | helps movement understanding |
| movement arcs | grid | finger path between events | strongest event-transition cue in current shell |
| stale analysis badge | toolbar | current visible metrics may be out of date | important honesty signal |
| dominant solver-assignment pill | voice palette | likely hand/finger identity for a sound | useful summary, but can go stale |
| compare mode grid swap | center grid area | user is comparing two layouts instead of editing one | clear, but mode activation is somewhat indirect |

## Feedback Loops

## Manual Layout Edit -> Analysis Feedback

Loop:

1. user moves or assigns a sound
2. reducer marks analysis stale
3. auto-analysis reruns after debounce
4. grid/timeline/diagnostics update

Strength:

- creates a sense of iterative playability tuning

Weakness:

- stale window can be confusing
- user is not always told what exactly was recomputed

Evidence:

- `projectState.ts`
- `useAutoAnalysis.ts`

## Event Selection -> Local Explanation Feedback

Loop:

1. user clicks event in timeline
2. grid highlights relevant pads and onion skin
3. event detail panel updates
4. transition detail panel shows next-event burden

Strength:

- this is the clearest local explanation loop in the current workspace

Weakness:

- there is no dedicated event list or event-analysis framing around it, so the feature can feel like a side effect rather than the main analysis flow

Evidence:

- `UnifiedTimeline.tsx`
- `InteractiveGrid.tsx`
- `EventDetailPanel.tsx`
- `TransitionDetailPanel.tsx`

## Candidate Generation -> Comparison Feedback

Loop:

1. user clicks Generate
2. candidates appear
3. one candidate becomes active
4. user may switch or compare alternatives

Strength:

- structurally supports exploration rather than single-answer output

Weakness:

- active candidate percentages and score semantics are not easy to interpret together

Evidence:

- `EditorToolbar.tsx`
- `useAutoAnalysis.ts`
- `AnalysisSidePanel.tsx`

## Composer Edit -> Shared Workspace Feedback

Loop:

1. user edits or generates pattern
2. composer result updates
3. composer syncs lanes into project
4. pattern pad assignments may bulk-update the main grid
5. shared timeline and analysis context can change

Strength:

- keeps composition integrated with the main workspace

Weakness:

- this is a powerful side effect with weak explicit feedback; users are told "live sync" but not necessarily the full consequence on shared state

Evidence:

- `WorkspacePatternStudio.tsx`

## System Feedback on Manual Edits vs Optimized Results

Current cues:

- layout mode metadata exists (`manual`, `optimized`, `auto`, etc.) but is not strongly surfaced in the main UI
- stale analysis badge warns after edits
- candidate comparison allows side-by-side evaluation

Gap:

- the current product does not strongly narrate "this is your manual layout" vs "this is a generated candidate" vs "this is a composer-driven assignment"

Evidence:

- `src/types/layout.ts`
- `src/ui/components/EditorToolbar.tsx`
- `WorkspacePatternStudio`

## Missing or Unclear Feedback Loops

### 1. No First-Class Event-Analysis Workflow Frame

The repo clearly values event-by-event playability reasoning, but the current shell does not present a dedicated event-analysis surface equal in importance to the grid and timeline.

Evidence:

- current event/transition panels
- V1 event-analysis docs and components
- `tasks/ux-audit.md`

### 2. Limited Explanation of What "Generate" Just Did

Generate may:

- auto-fill an empty layout
- produce three candidates
- select the first candidate
- update analysis metrics

But the user gets little narrative feedback about that sequence beyond a progress label.

### 3. Weak Distinction Between Analysis and Diagnostics

`Analysis` is mostly candidate switching.
`Diagnostics` contains actual metric explanation.

This mismatch likely reduces legibility.

### 4. Weak Feedback Around Hidden State Synchronization

Users are not directly told when:

- lanes regenerate streams
- composer updates lanes
- composer bulk-updates pad assignments

These are product-significant events with relatively subtle UI feedback.

### 5. Export Feedback Is Minimal

JSON export exists, but there is little broader downstream framing around what the export represents or whether it preserves the active/selected/analyzed result exactly.

## Comparison View Notes

Current comparison is stronger numerically than behaviorally.

What is visible:

- candidate deltas
- side-by-side layout view

What is less visible:

- why one candidate changes transition burden event by event
- how comparison relates to learnability or robustness beyond scalar summaries

## First-Draft Visualization Reading

The current app does many useful micro-visualizations well: grid overlays, event detail, transition detail, and diagnostics suggestions. The gap is not lack of visual elements. The gap is that those elements do not yet compose into one unmistakable analysis story. The repo still appears to be searching for the right frame that makes timeline, layout, and playability feedback feel like one continuous explanatory experience.
