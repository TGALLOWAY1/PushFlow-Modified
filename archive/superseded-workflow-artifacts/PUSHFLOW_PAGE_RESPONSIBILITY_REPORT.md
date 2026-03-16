# PushFlow Page Responsibility Report

## Executive Summary

PushFlow has already moved in the right direction by collapsing older route-level fragmentation into one Performance Workspace. The remaining problem is not route count. It is responsibility overlap.

Today, timeline authoring, layout editing, candidate review, event analysis, diagnostics, and pattern composition all coexist, but they do not yet have crisp boundaries. The cleanup direction should be:

- keep the workspace unified
- reduce responsibility ambiguity inside that workspace
- distinguish editing surfaces from inspection surfaces
- distinguish committed state from exploratory state

## Design Principle

Every page or panel should answer one primary workflow question.

If a panel cannot clearly answer "what is this for?" in one sentence, it is probably carrying too much responsibility or competing with another surface.

## Page / Panel Reviews

### Project Library / Project Overview

**Primary purpose**  
Enter the product, create or import work, and reopen known projects.

**What the user should do here**  
Start a project, import MIDI, import a project file, open a demo, or reopen saved work.

**What should not happen here**  
Detailed layout editing, candidate comparison, or event-level ergonomic inspection.

**Inputs shown here**  
Project metadata, import controls, demo groups, saved project cards.

**Outputs shown here**  
A chosen project context and an initial project state.

**Relationship to Active / Working / Candidate state**  
The library should show project summaries, not become the place where Active Layout or Candidate Solution decisions are made.

**Confusions in current product/codebase**  
The library mixes blank-project creation, import, demo evaluation, and history management without a strong sense of the "default first step."

**Recommended responsibility**  
Make this the project-entry and project-selection surface only. It should answer "what am I opening or creating?" and nothing deeper.

### Timeline / Arrange Area

**Primary purpose**  
Represent the canonical sequence of Performance Events over time.

**What the user should do here**  
Inspect timing, scrub playback, select events, filter sound identities, and import or organize performance material.

**What should not happen here**  
Primary layout comparison, detailed candidate scoring decisions, or hidden rewriting of the user’s mental model without explanation.

**Inputs shown here**  
Performance Events, sound identity rows, beat structure, transport state, event selection.

**Outputs shown here**  
Selected event context, timeline understanding, and updated project performance material.

**Relationship to Active / Working / Candidate state**  
The timeline should be largely state-agnostic about which layout is under evaluation. It should stay the canonical time view while the grid and analysis explain how the chosen layout performs against it.

**Confusions in current product/codebase**  
The timeline is both a view and a source-of-truth editor. In the current codebase, lane changes can regenerate solver-facing stream data, but this is not strongly framed in the UX.

**Recommended responsibility**  
Treat this as the canonical performance-material surface. It owns time, event selection, and timeline structure, not layout commitment decisions.

### Pattern Composer

**Primary purpose**  
Create or sketch new performance material that can feed the timeline.

**What the user should do here**  
Generate patterns, edit steps, load presets, and create musical material to test on Push.

**What should not happen here**  
Silent promotion of new layout truth or hidden replacement of the user’s established baseline without clear messaging.

**Inputs shown here**  
Step-grid lanes, recipes, presets, BPM, bar count, subdivision.

**Outputs shown here**  
New or revised Performance Events and, when relevant, provisional pad suggestions.

**Relationship to Active / Working / Candidate state**  
Composer results should feed a Working/Test Layout or timeline update, not behave like an unannounced rewrite of the Active Layout.

**Confusions in current product/codebase**  
The current composer writes directly into shared project timeline state and can bulk-replace pad assignments, which makes it feel more like a co-equal editor than a feeder workflow.

**Recommended responsibility**  
Keep it as a feeder workflow inside the workspace, but clearly label when it is applying changes to shared timeline state and when it is proposing pad suggestions only.

### Grid Editor / Layout Editor

**Primary purpose**  
Edit and inspect the currently evaluated Layout on the Push surface.

**What the user should do here**  
Place sound identities on Pads, inspect hand-zone fit, study Grid Positions, and test whether layout ideas improve performance.

**What should not happen here**  
Hide whether the user is seeing the Active Layout, a Working/Test Layout, or a Candidate Solution.

**Inputs shown here**  
Current layout state, event selection context, onion-skin overlay, movement arcs, active-playing highlights.

**Outputs shown here**  
Manual placement decisions, spatial understanding, and layout-state changes.

**Relationship to Active / Working / Candidate state**  
This is the surface where the distinction matters most. The grid must clearly label which layout state is currently being displayed and whether edits are exploratory or committed.

**Confusions in current product/codebase**  
The current workspace can render a selected candidate’s layout in the grid while the reducer still treats the project’s active layout as the editable truth. That blurs what the user is actually changing.

**Recommended responsibility**  
Make this the canonical layout-editing surface. It should always say exactly which layout state is on screen and whether edits affect a Working/Test Layout or the Active Layout.

### Sound Panel

**Primary purpose**  
Present the inventory of sound identities available to the layout workflow.

**What the user should do here**  
Inspect sound identity names, mute or unmute sounds, drag them onto Pads, and review high-level assignment status.

**What should not happen here**  
Carry hidden solver semantics that the user would mistake for hard locks or committed finger truth.

**Inputs shown here**  
Sound identities, event counts, color, current pad location, light assignment summaries.

**Outputs shown here**  
Sound-level placement actions and high-level sound inventory understanding.

**Relationship to Active / Working / Candidate state**  
The panel should show where each sound identity sits in the currently displayed layout state, whether that is Active, Working/Test, or Candidate.

**Confusions in current product/codebase**  
The panel currently mixes inventory, placement affordance, mute state, and voice-level constraints whose runtime impact is less clear than pad-level constraints.

**Recommended responsibility**  
Keep it focused on sound identity inventory and placement. If sound-level preferences remain, they should be presented as preferences, not as the same thing as hard placement locks.

### Event Analysis Surface

**Primary purpose**  
Explain why a specific event or transition is easy, hard, or impossible.

**What the user should do here**  
Select an event, inspect the current and next moments, read movement and finger pressure, and understand local difficulty.

**What should not happen here**  
Compete with aggregate candidate ranking or act like a generic diagnostics dump.

**Inputs shown here**  
Selected Performance Event, neighboring events, current layout state, Finger Assignments, per-event cost factors.

**Outputs shown here**  
Local explanation and practice-relevant understanding.

**Relationship to Active / Working / Candidate state**  
Event analysis must always stay bound to whichever layout state is currently under evaluation.

**Confusions in current product/codebase**  
The current event-detail and transition-detail panels are useful, but they do not yet read as one named analysis surface. They feel embedded rather than first-class.

**Recommended responsibility**  
Treat event analysis as the local explanation layer of the workspace. It should own "what happened here and why," not candidate navigation.

### Candidate / Alternative Review Area

**Primary purpose**  
Review engine-generated Candidate Solutions as options.

**What the user should do here**  
Browse alternatives, see their tradeoff summaries, and choose which ones deserve comparison, saving, or promotion.

**What should not happen here**  
Pretend Candidate Solutions are already the project’s committed truth.

**Inputs shown here**  
Candidate list, overall verdicts, passage-level deltas, tradeoff summaries, lock context.

**Outputs shown here**  
A user decision about which candidate to inspect, compare, save, or promote.

**Relationship to Active / Working / Candidate state**  
This surface owns Candidate Solutions only. It should never erase the distinction between candidate review and committed layout state.

**Confusions in current product/codebase**  
Candidate selection currently lives under the Analysis slide-out, which makes alternative review feel like a subfeature of analysis instead of a core step in the workflow.

**Recommended responsibility**  
Make this the place where generated options are curated. It should answer "which alternative do I care about?" before compare mode answers "why?"

### Compare Mode

**Primary purpose**  
Show meaningful differences between two layout states.

**What the user should do here**  
Compare Active vs Working/Test, Active vs Candidate, or Candidate vs Candidate.

**What should not happen here**  
Become the default layout editor or hide what the baseline is.

**Inputs shown here**  
Two selected layout states, their Execution Plans, feasibility and score deltas, changed Pads, changed Finger Assignments.

**Outputs shown here**  
Decision-quality understanding of what changed and whether the change is worth keeping.

**Relationship to Active / Working / Candidate state**  
Compare mode is a read-only relationship between states. It should not itself mutate truth.

**Confusions in current product/codebase**  
Compare currently sits under the Analysis panel and partly duplicates what users expect from diagnostics and candidate review.

**Recommended responsibility**  
Frame compare as a dedicated inspection mode. It should answer "how do these two options differ?" and remain explicitly analysis-only.

### Diagnostics Panel

**Primary purpose**  
Summarize feasibility, burden, and factor-level explanations at the layout level.

**What the user should do here**  
Read score summaries, hand balance, fatigue, factor breakdowns, and actionable suggestions.

**What should not happen here**  
Own candidate navigation or event-by-event reasoning.

**Inputs shown here**  
Execution Plan metrics, passage summaries, factor breakdowns, suggestion logic.

**Outputs shown here**  
High-level understanding of whether the current layout state is broadly healthy or problematic.

**Relationship to Active / Working / Candidate state**  
Diagnostics should always be labeled against the currently analyzed state.

**Confusions in current product/codebase**  
The label "Analysis" is weaker than the actual explanation depth in Diagnostics, which makes the side panel taxonomy feel inverted.

**Recommended responsibility**  
Treat Diagnostics as the aggregate-evaluation layer, separate from event analysis and separate from candidate review.

## Overlaps and Conflicts

- Timeline vs Pattern Composer: both author or reshape performance material, but they currently feel like co-equal editors instead of canonical timeline plus feeder workflow.
- Timeline vs Grid Editor: both influence what the user thinks is "the current truth," but only the grid should own pad placement decisions.
- Analysis vs Compare vs Event Analysis: candidate selection, aggregate metrics, and local transition reasoning are all real, but they currently share labels and panel real estate in a way that weakens clarity.
- Sound Panel vs Grid Editor: both express assignment state, but only the grid should be authoritative for Grid Position decisions.
- Candidate Review vs Saved Variant management: generated alternatives and curated retained options are distinct product concepts that are not yet clearly separated.

## Proposed Clean Page Model

The cleanest page and panel model is:

1. Project Library
   Entry, import, demos, reopen.

2. Performance Workspace
   The main project surface with four clear responsibilities:
   timeline for time truth, grid editor for layout truth, sound panel for inventory, diagnostics/event analysis for explanation.

3. Candidate Review and Compare
   Still inside the workspace, but clearly presented as read-only alternative evaluation rather than general analysis clutter.

4. Pattern Composer
   Embedded feeder workflow, not a competing primary page.

5. Optimizer Debug Dashboard
   Explicitly advanced and out of the core workflow.

## Open Workflow Questions

- Should Compare be a full-stage mode or remain a side-panel-driven mode inside the workspace?
- Should the Pattern Composer apply changes immediately, or stage them for explicit apply/revert?
- Does PushFlow need a richer project-overview screen beyond the current library cards?

## What This Clarifies

- The workspace can stay unified without every panel being responsible for everything.
- Timeline, grid, candidate review, compare, and diagnostics each have a distinct job.
- Event analysis should be treated as a named local-explanation surface.
- Candidate review and compare are different responsibilities.
- The Pattern Composer should feed the workflow, not compete with the timeline for canonical truth.

## What Still Needs User Confirmation

- Whether Pattern Composer changes should be immediate or staged.
- Whether Compare should compare Candidate vs Candidate only, or also Active vs Working/Test by default.
- Whether the current library is enough as the project-level overview surface.
