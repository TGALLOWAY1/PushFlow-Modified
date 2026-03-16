# PushFlow UI/UX Audit & Improvement Plan

**Date:** 2026-03-13
**Updated:** 2026-03-13 (with user feedback + V1 codebase analysis)
**Scope:** Full application audit — ProjectLibraryPage, ProjectEditorPage (Editor, Lanes, Loop Editor tabs), all panels and interactions.

---

## Part 1 — Product Understanding

### What the Application Is Trying to Accomplish

PushFlow converts MIDI-derived musical material into physically playable performances on the Ableton Push 3 8×8 pad grid. It jointly optimizes:

1. **Layout** — which sound goes on which pad
2. **Execution Plan** — which hand/finger plays each event over time

### Product Goals (Updated per User Feedback)

1. **Playability verification** — A digital version of the Push grid where musicians can verify a layout is playable *before* committing it to hardware. Saves the time of physically rearranging drum racks.

2. **Ableton export** — Export the finalized layout as a drum rack with updated MIDI pitch mappings (pitch = cell coordinates on the finalized layout), so the optimized layout transfers directly to hardware.

3. **Cross-song standardization** — Layouts should follow conventions across songs (e.g., left hand plays drums, right hand plays musical/melodic elements). Consistency reduces the learning burden across a setlist.

4. **Musical pattern generation** — Generate novel rhythmic patterns (MIDI note sequences following musical rhythmic structures) with layouts optimized for playability. These act as compositional seeds — the user adds sounds later.

5. **Event-by-event performance analysis** — Step through each event and see the exact finger assignments, movement arrows, and transitions on the grid. This is the **critical visualization** for understanding playability.

### Terminology (Canonical)

- **Note / Hit** — A single sound being played (one pad activation)
- **Event** — A set of notes played simultaneously (all notes at the same timestamp). For every event, there must be a valid finger assignment that works for all notes in that event simultaneously.
- **Transition** — The movement from one event to the next (N → N+1)
- **Layout** — Full static pad-assignment artifact
- **Execution Plan** — Full timeline of hand/finger assignments across all events

### Core Interaction Model

1. **Import** MIDI → auto-splits into sound streams (one per unique pitch)
2. **Name** sounds (optional, with GM drum preset button)
3. **Generate** — auto-assigns sounds to pads AND optimizes the layout (the produced layout should be difficult for a human to improve on)
4. **Step through events** — scroll through events seeing finger assignments and curved movement arrows on the grid
5. **Constrain** — pin specific fingers to specific pads, re-analyze
6. **Compare** — view multiple candidate solutions side-by-side
7. **Export** — export optimized drum rack + remapped MIDI to Ableton

### Does the Interface Support That Task Clearly?

**Partially, with one critical gap.** The V1 codebase contains a complete event analysis visualization system (EventAnalysisPanel with three-column layout: event list + onion-skin grid + transition metrics) that has not been ported to the current codebase. This is the single most important feature for the product and it is missing.

---

## V1 Codebase Reference: Event Analysis System

The V1 codebase (`Version1/src/`) contains a mature event analysis visualization that should be adopted into the current codebase. Key components:

### Architecture

```
EventAnalysisPanel (three-column layout)
├── Left: EventTimelinePanel (scrollable event list with difficulty heatmap)
│   - Each row shows transition N → N+1
│   - Difficulty bar (green → red color coding)
│   - Finger indicators (L2 R3 format)
│   - Hand switch / finger change flags
│   - Click or ↑↓ arrow keys to navigate
│   - Auto-scroll selected row into view
├── Center: OnionSkinGrid (SVG-based 8×8 grid)
│   - Current event pads: solid, hand-colored (cyan=left, orange=right)
│   - Next event pads: ghosted, 20-30% opacity
│   - Previous event pads: very low opacity (context only)
│   - Shared pads: double halo + pulse animation
│   - Finger movement arrows: quadratic Bezier curves with arrowheads
│   - Impossible moves: red, thicker stroke
│   - Finger labels on pads (L2, R3 format)
└── Right: TransitionMetricsPanel + PracticeLoopControls
    - Detailed transition metrics for selected event
    - Practice loop speed controls
```

### Key V1 Files to Port

| V1 File | Purpose | Current Codebase Equivalent |
|---------|---------|----------------------------|
| `workbench/EventAnalysisPanel.tsx` | Three-column event analysis container | **Does not exist** |
| `workbench/EventTimelinePanel.tsx` | Scrollable event list with difficulty bars | Partially: `ExecutionTimeline.tsx` (swim lanes, not event list) |
| `components/vis/OnionSkinGrid.tsx` | SVG grid with onion-skin layers + arrows | Partially: `InteractiveGrid.tsx` (editing grid, no onion skin) |
| `components/grid-v3/GridVisContainer.tsx` | SVG container with layered rendering | **Does not exist** |
| `components/grid-v3/layers/VectorLayer.tsx` | Quadratic Bezier curve arrows | **Does not exist** |
| `components/grid-v3/layers/PadLayer.tsx` | SVG pad rendering (solid + ghost) | **Does not exist** |
| `components/grid-v3/layers/BaseGridLayer.tsx` | Static 8×8 grid background | **Does not exist** |
| `components/grid-v3/types.ts` | PadActivation, VectorPrimitive, GridTheme | **Does not exist** |
| `types/eventAnalysis.ts` | AnalyzedEvent, Transition, FingerMove, OnionSkinModel | **Does not exist** |
| `engine/eventMetrics.ts` | Groups events into moments, computes difficulty | Partially: `engine/evaluation/eventMetrics.ts` |
| `engine/transitionAnalyzer.ts` | Transition analysis between events | Partially: `engine/evaluation/transitionAnalyzer.ts` |
| `engine/onionSkinBuilder.ts` | Builds OnionSkinModel from events + transitions | **Does not exist** |
| `workbench/TransitionMetricsPanel.tsx` | Right panel showing transition detail | **Does not exist** |
| `workbench/PracticeLoopControls.tsx` | Practice loop speed controls | **Does not exist** |

### V1 Visual Conventions to Adopt

- **Left hand:** Cyan (#00FFFF)
- **Right hand:** Orange (#FF8800)
- **Impossible move:** Red (#FF0000), stroke width 3
- **Current event pads:** Solid, 100% opacity
- **Next event pads:** Ghost, 20-30% opacity, thin border
- **Shared pads:** White stroke, pulse animation (2s cycle)
- **Movement arrows:** Quadratic Bezier curves with perpendicular offset of 0.2
- **Arrow markers:** White polygon (10×7), 0.6 opacity
- **Finger labels:** "L2" (Left Index), "R3" (Right Middle), etc.
- **Difficulty colors:** Green (#00FF00) → Light Green (#88FF00) → Yellow (#FFAA00) → Orange (#FF8800) → Red (#FF0000)
- **Grid background:** #121212
- **Pad idle:** #1A1A1A

---

## Part 2 — UI/UX Audit

### 1. Event Stepping and Visualization (CRITICAL GAP)

**Current State:** The current codebase has NO event-by-event stepping visualization with finger movement arrows. The `ExecutionTimeline` shows swim lanes with event pills, but:
- No scrollable event list (V1's EventTimelinePanel)
- No onion-skin grid with current/next/previous event layers
- No curved Bezier arrows showing finger movement between events
- No difficulty color coding per transition
- No hand switch / finger change indicators per transition

**V1 had all of this.** The event analysis panel was the central feature of V1 and must be ported to the current codebase.

| # | Issue | Severity |
|---|-------|----------|
| E1 | **No event stepping panel** — Cannot scroll through events and see finger patterns on the grid. This is the product's core feature. | Critical |
| E2 | **No movement arrows** — No curved Bezier arrows showing finger transitions between events. | Critical |
| E3 | **No onion-skin rendering** — Cannot see current event (solid), next event (ghost), and movement arrows simultaneously. | Critical |
| E4 | **No per-transition difficulty scoring** — Transitions are not individually scored for difficulty (speed pressure, stretch, hand switch). | High |
| E5 | **No practice loop controls** — V1 had practice loop controls; current codebase does not. | High |

### 2. Timeline and Event Visualization

**Current State:** `ExecutionTimeline` renders per-voice swim lanes with 20px-wide event pills colored by hand (blue=left, purple=right, red=unplayable). Wrapped in collapsible `TimelinePanel`.

**What Works:**
- Swim-lane-per-voice layout is intuitive for multi-sound patterns
- Hand coloring is immediately readable
- Clicking an event selects it

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| T1 | **No zoom or scroll** — Fixed-width percentage layout. Dense patterns overlap badly. | Critical |
| T2 | **No rhythmic grid lines** — No beat/bar markers. | High |
| T3 | **Event pills overlap** — 20px fixed width, no offset for simultaneous events. | High |
| T4 | **No scrubbing or playback cursor.** | High |
| T5 | **Time axis only shows 3 labels.** | Medium |
| T6 | **No duration representation** — All events same-width regardless of note length. | Medium |

### 3. Push Grid Visualization

**Current State:** `InteractiveGrid` renders an 8×8 grid with editing capabilities (drag-drop, context menu, pad swapping). It does NOT support onion-skin rendering or movement arrows.

**What Works:**
- Physical Push 3 orientation preserved
- Left/right hand zones visually distinguished
- Drag-and-drop assignment works well
- Context menu for finger constraints

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| G1 | **No onion-skin mode** — Grid only shows static state. Cannot see current vs. next event. | Critical |
| G2 | **No movement arrows** — No Bezier curves showing finger transitions. | Critical |
| G3 | **Grid is HTML div-based** — V1 uses SVG for the grid, enabling proper layering (base grid → ghost pads → vectors → solid pads). The current HTML div approach cannot support vector overlays. | High |
| G4 | **Pad remove button opacity bug** — `style={{ opacity: undefined }}` overrides `opacity-0` className. | High |
| G5 | **No heatmap overlay mode.** | Medium |
| G6 | **Muted pads still interactive.** | Medium |

### 4. Metrics and Analysis Panels

**What Works:**
- DifficultyHeatmap passage bars with color coding
- Hand balance visualization
- Candidate switcher with percentage scores

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| A1 | **Metrics lack context** — "Score: 14.3", "Drift: 0.42" — no scale reference. | Critical |
| A2 | **Too many metrics at once** — ~20 numbers simultaneously. | High |
| A3 | **Cost breakdown labels are jargon** — "Bounce", "Drift", "Crossover" unexplained. | High |
| A4 | **No actionable suggestions** — Metrics describe problems but don't suggest fixes. | High |
| A5 | **Dominant factors hidden behind hover.** | Medium |
| A6 | **MetricBar max hardcoded to 2.** | Medium |

### 5. Auto-Layout Optimization

**Current State:** "Generate" either auto-assigns pads via chromatic grid position or generates 3 candidates via `multiCandidateGenerator`. The auto-assign uses a simple formula (`offset = noteNumber - bottomLeftNote`).

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| O1 | **Auto-assign is naive** — Uses chromatic grid position, not optimization. The layout should be difficult for a human to improve on. | Critical |
| O2 | **No hand-zone conventions** — No option to enforce "left hand = drums, right hand = melodic". | High |
| O3 | **Annealing solver exists but `useAnnealing: false`** — The optimization infrastructure exists but is disabled. | High |

### 6. Export and Ableton Integration

**Current State:** Export only supports JSON project export. No Ableton drum rack export.

**V1 Reference:** `Version1/adg_remapper.py` contains a working `DrumRackRemapper` class that:
- Loads `.adg` files (gzip-compressed XML)
- Finds drum rack branches by chain name (e.g., "Kick", "Snare")
- Remaps `ReceivingNote` (inverted: `128 - targetNote`) and `KeyRange` (direct: `Min`/`Max` set to target note)
- Writes the modified XML back as gzipped `.adg`
- Tested with fixture racks in `Version1/fixtures/drum_racks/` (empty rack, single kick, dual kit)

**Export Pipeline (from V1):**
1. User finalizes layout in PushFlow (sound → pad mapping)
2. Pad coordinates → MIDI note number: `note = row * 8 + col + bottomLeftNote`
3. Build mapping dict: `{ chainName: targetMidiNote }` for each sound
4. `DrumRackRemapper.remap_rack(source_adg, output_adg, mapping_dict)` patches the drum rack XML
5. Optionally re-export MIDI with pitches remapped to match new layout

**This Python pipeline needs to be ported to TypeScript/browser** or exposed as a downloadable script. The `.adg` format is gzip+XML, which is feasible in-browser using `pako` (gzip) + browser XML APIs.

| # | Issue | Severity |
|---|-------|----------|
| X1 | **No Ableton drum rack export** — V1's `adg_remapper.py` solves this but hasn't been ported to the web app. | High |
| X2 | **No MIDI re-export** — Cannot export MIDI with pitches remapped to match the optimized layout coordinates. | High |
| X3 | **No source drum rack import** — User needs to provide their original `.adg` so PushFlow can remap it. No upload UI exists. | High |

### 7. Navigation and Information Hierarchy

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| N1 | **Tab names are implementation-centric** — "Lanes" / "Loop Editor" / "Editor" don't communicate tasks. | High |
| N2 | **No onboarding flow.** | High |
| N3 | **Context menu can go off-screen.** | High |
| N4 | **Side panel no scroll container.** | High |

### 8. Performance and Responsiveness

**Issues:**

| # | Issue | Severity |
|---|-------|----------|
| R1 | **SET_PROCESSING not cleared on error** in `generateFull()` — Leaves Generate button permanently disabled. | Critical |
| R2 | **No progress indicator for generation.** | High |
| R3 | **No cancel for generation.** | Medium |

---

## Part 3 — Must-Have Fixes Before Release

### Critical (Ordered by Impact)

| # | Issue | Description | Recommended Fix |
|---|-------|-------------|-----------------|
| C1 | **Port V1 Event Analysis Panel** | The product's core visualization (event stepping with onion-skin grid + Bezier arrows) exists in V1 but not in the current codebase. | Port `EventAnalysisPanel`, `EventTimelinePanel`, `OnionSkinGrid`, `GridVisContainer`, all grid-v3 layers, `VectorLayer`, event analysis types, `onionSkinBuilder`, `eventMetrics` grouping, and `transitionAnalyzer`. Adapt to current state management (ProjectContext). |
| C2 | **Fix SET_PROCESSING stuck on error** | `generateFull()` catch doesn't reset `isProcessing`. | Add `dispatch({ type: 'SET_PROCESSING', payload: false })` in catch block. |
| C3 | **Enable real optimization in Generate** | Auto-assign is naive chromatic layout. Should produce layouts a human can't easily improve. | Enable `useAnnealing: true` in `generateCandidates()` or implement a proper layout optimizer that respects hand-zone conventions. |
| C4 | **Add metric explanations** | Scores have no reference scale or plain-language framing. | Add tooltips, "good/bad" labels, and reference ranges for every metric. |
| C5 | **Add timeline zoom** | Dense patterns are unreadable. | Add horizontal zoom (mouse wheel or slider) and scrolling. |

### High

| # | Issue | Description | Recommended Fix |
|---|-------|-------------|-----------------|
| H1 | **Add hand-zone convention enforcement** | No way to say "left hand = drums, right hand = melodic". | Add hand-zone assignment constraints to the engine config. |
| H2 | **Add beat grid lines to timeline** | No rhythmic reference in the timeline. | Add vertical lines at beat boundaries using tempo. |
| H3 | **Add onboarding flow** | New users have no guidance. | Add brief welcome text or 4-step guided tour. |
| H4 | **Fix context menu off-screen** | Menu goes off-screen near edges. | Clamp position to viewport bounds. |
| H5 | **Fix side panel overflow** | No scroll container for stacked panels. | Add `overflow-y-auto max-h-[calc(100vh-200px)]`. |
| H6 | **Add progress indicator for generation** | Only "Analyzing..." pulse during long operations. | Show step counter ("Evaluating candidate 2 of 3..."). |
| H7 | **Fix pad remove button opacity** | CSS/style conflict makes button always visible. | Remove inline style; use CSS-only hover. |
| H8 | **Add Ableton export** | No way to get the layout onto actual hardware. | Port `Version1/adg_remapper.py` logic to TypeScript. User uploads source `.adg`, PushFlow remaps `ReceivingNote` (128-note) and `KeyRange` per finalized layout, exports modified `.adg` + remapped MIDI. Use `pako` for gzip in browser. |

---

## Part 4 — UX Enhancements

### High Impact

| # | Enhancement | User Benefit | Implementation |
|---|-------------|-------------|----------------|
| E1 | **V1-style event analysis panel** | Step through events seeing finger patterns and movement arrows. The core feature. | Port the three-column layout from V1: event list (left), onion-skin grid (center), transition metrics (right). |
| E2 | **Cross-song layout templates** | Standardized layouts across songs (L=drums, R=melodic). | Add "layout template" system where users define hand-zone conventions that persist across projects. |
| E3 | **Musical pattern generation** | Generate novel playable rhythmic patterns as composition seeds. | Extend the existing pattern engine to generate rhythmically coherent MIDI sequences with optimized layouts. |
| E4 | **Ableton drum rack export** | Transfer optimized layout directly to hardware. | Port V1's `adg_remapper.py` (`DrumRackRemapper` class) to TypeScript. Add UI for uploading source `.adg` drum rack. Remap `ReceivingNote` (128-note) + `KeyRange` per layout. Export modified `.adg` (gzip+XML via pako) + MIDI with remapped pitches. Test fixtures in `Version1/fixtures/drum_racks/`. |
| E5 | **Practice loop with tempo control** | Slow down difficult transitions for practice. | Port V1's PracticeLoopControls with speed adjustment (0.75x, 0.85x, 1.0x, 1.1x). |

### Medium Impact

| # | Enhancement | User Benefit | Implementation |
|---|-------------|-------------|----------------|
| E6 | **Difficulty heatmap overlay on grid** | See which pads are hardest spatially. | Toggle that colors pad backgrounds by average difficulty score. |
| E7 | **Passage click-to-navigate** | Jump to difficult sections in the timeline. | Make DifficultyHeatmap passage bars clickable. |
| E8 | **Actionable suggestions** | Know what to do about high difficulty. | Show "Consider moving [Sound] closer to [Hand zone]" based on cost factors. |
| E9 | **Keyboard shortcut help** | Discover available shortcuts. | Add "?" shortcut showing all keyboard shortcuts. |
| E10 | **Export as Push 3 User Mode** | Direct hardware integration. | Export pad-to-MIDI mapping in Push 3 User Mode format. |

---

## Part 5 — QA Verification Checklist

### MIDI Import and Parsing

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| I1 | Drop a standard .mid file on the library page upload zone | File parsed; "Name Your Sounds" screen appears |
| I2 | Verify each unique MIDI pitch creates a separate sound stream | Stream count matches unique pitch count |
| I3 | Click "Apply GM Drum Names" | Streams with standard GM notes get preset names |
| I4 | Rename a sound stream | Name updates immediately |
| I5 | Click "Create Project" | Navigates to editor; project appears in library |
| I6 | Import a .mid file with 0 notes | Error message; no project created |
| I7 | Import a non-MIDI file | Error message; no crash |
| I8 | Import project JSON | Project loads and navigates to editor |

### Event Analysis (After V1 Port)

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| EA1 | Generate analysis for a project with multiple sounds | Event analysis panel appears with event list, grid, and metrics |
| EA2 | Click an event in the left panel | Grid shows current event pads (solid), next event (ghost), movement arrows |
| EA3 | Press ↓ arrow key | Next event selected; grid updates with new pads and arrows |
| EA4 | Press ↑ arrow key | Previous event selected; grid updates |
| EA5 | Verify difficulty bar per transition | Color ranges from green (easy) to red (hard) |
| EA6 | Verify finger labels on pads | Format: "L2" (Left Index), "R3" (Right Middle) |
| EA7 | Verify movement arrows | Curved Bezier arrows from current pad to next pad, colored by hand |
| EA8 | Verify impossible move | Red arrow, thicker stroke, for movements exceeding max reach |
| EA9 | Verify shared pads | Pads in both current and next event show white border + pulse |
| EA10 | Verify hand switch indicator | Orange "Hand Switch" label on transitions requiring hand change |
| EA11 | Verify finger change indicator | Yellow "Finger Change" label on transitions with same-hand finger changes |
| EA12 | Verify auto-scroll | Selected event row scrolls into view in the event list |

### Push Grid Visualization

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| PG1 | Drag sound from VoicePalette to empty pad | Pad shows sound name |
| PG2 | Drag pad to pad | Pads swap voices |
| PG3 | Right-click pad | Context menu at click position |
| PG4 | Right-click pad near bottom-right | Menu stays within viewport |
| PG5 | Set finger constraint via context menu | Constraint badge; re-analysis with constraint |
| PG6 | Verify row 0 bottom, row 7 top | Matches Push 3 orientation |
| PG7 | Verify "Left Hand" / "Right Hand" zone labels | Labels visible below grid |
| PG8 | Verify stale analysis indicator | Shows "Layout changed — analysis outdated" after pad change |

### Difficulty Metrics

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| DM1 | Click "Generate" with sounds assigned | Analysis completes; heatmap, scores, finger usage appear |
| DM2 | Verify overall difficulty bar | Width and color match overallScore |
| DM3 | Verify passage bars | Each passage has bar with correct color and percentage |
| DM4 | Hover over passage bar | Dominant factors appear |
| DM5 | Verify hand balance bar | Blue/purple proportions match L/R counts |
| DM6 | Verify "Hard Events" warning styling when > 0 | Amber highlight |
| DM7 | Change pad assignment | Auto-analysis re-runs after 1s debounce |

### Candidate Generation and Comparison

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| CG1 | Click "Generate" | 3 candidates generated; buttons appear |
| CG2 | Click different candidate | Grid + analysis update |
| CG3 | Switch to "Compare" tab | Side-by-side grids with diff highlighting |
| CG4 | Verify candidate layouts are meaningfully different | Not trivial variations |
| CG5 | Verify optimized layout is hard to improve manually | Pads are logically grouped by hand zone |

### Edge Cases

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| EC1 | Single note, single event | Trivial difficulty |
| EC2 | 64 unique pitches | All sounds created; grid fully populated |
| EC3 | Very dense pattern (>10 events/second) | Renders without crashing |
| EC4 | 300 BPM tempo | Correct analysis |
| EC5 | Close browser, reopen | Project persists from localStorage |
| EC6 | Export + reimport project | Restores correctly |
| EC7 | Undo all actions | Stops at empty; no errors |
| EC8 | Rapidly click Generate | Only one analysis runs |
| EC9 | Generate error → try again | Generate button re-enabled (requires C2 fix) |

### Project Library

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| PL1 | Open demo project | Creates copy; navigates to editor |
| PL2 | Expand/collapse demo categories | Toggles correctly |
| PL3 | Remove project from history | Disappears from list |
| PL4 | "Clear All" | All removed |
| PL5 | Click "← Library" from editor | Saves; returns to library |

---

## Part 6 — UX Summary

### Is the Current UI Fundamentally Sound?

**The architecture is sound but the critical visualization is missing.** The state management, data model, and optimization engine are well-structured. The grid editor, voice palette, and candidate comparison work well. However, the product's primary value — event-by-event stepping with finger movement visualization — exists in V1 but was not ported to the current codebase.

### Biggest Usability Risks

1. **No event stepping visualization** — The V1 codebase has a complete three-column event analysis panel (event list + onion-skin grid with Bezier arrows + transition metrics) that is the product's core feature. This must be ported.

2. **Auto-layout is not optimized** — The "Generate" button uses chromatic grid positioning, not the annealing solver. The produced layout should be difficult for a human to improve on.

3. **No Ableton export** — The whole point is to transfer the optimized layout to hardware. Without export, the workflow ends at a screen the musician can only look at.

### Top 3 Changes That Would Most Improve the Product

1. **Port V1's EventAnalysisPanel** — Three-column layout with event list (left), onion-skin SVG grid with Bezier movement arrows (center), and transition metrics (right). This is the product's primary visualization and it already exists in V1. Port the grid-v3 SVG system (`GridVisContainer`, `BaseGridLayer`, `PadLayer`, `VectorLayer`), the event analysis types (`AnalyzedEvent`, `Transition`, `FingerMove`, `OnionSkinModel`), the analysis engine (`eventMetrics` grouping, `transitionAnalyzer`, `onionSkinBuilder`), and the UI components (`EventTimelinePanel`, `TransitionMetricsPanel`). Adapt to current `ProjectContext` state management.

2. **Enable real layout optimization** — Enable the annealing solver or implement proper optimization that produces layouts respecting hand-zone conventions (left=drums, right=melodic). The generated layout should be difficult for a human to improve on.

3. **Add Ableton export** — Export the finalized layout as a drum rack with MIDI pitch remapping, so the optimized arrangement transfers directly to Push 3 hardware.

---

*This audit covers all UI surfaces as of 2026-03-13, incorporating user feedback on product goals, terminology, and the V1 codebase analysis. File-level references included for traceability.*
