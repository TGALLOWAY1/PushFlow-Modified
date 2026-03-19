# PushFlow Surface Features
## Purpose
This file defines the concrete product features for the core objects in PushFlow.
It is intentionally simple and should stay aligned with the workflow contract and state model.
---
## 1. Portfolio Page
### Purpose
The Portfolio Page is the project library and re-entry surface.
It helps the user start work, reopen work, and understand what projects exist.
### Core features
- create project
- open existing project
- import MIDI
- open demo project
- show project cards
- show project name
- show last updated status
- show timeline or project summary
- show current active layout status
- quick access to continue working
### Should not be responsible for
- deep layout editing
- compare workflow
- event-level analysis
- candidate review details
---
## 2. Sounds / Events Panel
## Purpose
This is a shared panel with two tabs:
- `Sounds`
- `Events`
It should help the user inspect the material and navigate the performance without mixing in too many unrelated responsibilities.
### Sounds tab core features
- list of sound identities (from a imported MIDI file or files)
- editable sound name
- sound color
- assigned or unassigned status
- lock or unlock placement state visibility
- drag sound to grid
- move sound between assigned and unassigned states
- optional grouping if helpful
- filter assigned, unassigned, or locked sounds
### Events tab core features
- list of performance events
- event difficulty indicator
- event selection
- selecting an event updates grid and timeline context
- quick navigation through difficult moments
### Should not be responsible for
- hidden solver-only controls
- candidate comparison as its main job
- raw debug output
---
## 3. Grid Editor
### Purpose
The Grid Editor is the main interaction surface for placement and inspection.
It should remain the visual center of the workspace.
### Core features
- display current layout state clearly
- indicate whether the user is viewing `Active Layout`, `Working/Test Layout`, or `Candidate Solution`
- assign sound to pad
- move assignment
- swap assignments
- clear assignment
- drag-and-drop editing
- visual lock state on pads or sounds
- selected event overlay
- show active pads for the selected event
- optional finger assignment overlay
- optional compare overlay
- promote current layout
- discard working draft
### Must preserve
- the grid is a primary truth surface
- the user can tell what state is on screen
- ordinary edits go to `Working/Test Layout` by default
---
## 4. Timeline / Composer
### Purpose
The Timeline / Composer represents the canonical performance timeline and lets the user inspect what happens over time.
### Core features
- show the canonical performance timeline
- scrub or move through time
- select events or moments
- show simultaneity clearly
- show dense or difficult passages
- sync selection with the grid
- support local event inspection
- clearly indicate which layout state is being analyzed
### Notes
The timeline should support moment-based inspection rather than forcing the user to reason only from scattered note rows or opaque indices.
---
## 5. Cost Breakdown
### Purpose
The Cost Breakdown explains why a layout is good, bad, feasible, awkward, or difficult.
### Core features
- clear total score story
- separate feasibility, ergonomics, and difficulty
- factor-level contributors
- event-level contributor breakdown
- transition-level contributor breakdown
- baseline-relative explanation
- show what improved
- show what worsened
- readable rejection reasons
- visual summary for the currently analyzed state
### Should not become
- a raw debug dump
- multiple conflicting score systems
- a place where the user cannot tell what the main burden actually is
---
## 6. Layout Candidates
### Purpose
The Layout Candidates surface presents generated alternatives and helps the user decide whether one is worth saving or promoting.
### Core features
- candidate list
- short summary of each tradeoff profile
- diff versus `Active Layout`
- diff versus `Working/Test Layout` when relevant
- reject or hide trivial duplicates
- select candidate for compare
- save candidate as variant
- promote candidate to active
- explain when diversity is low because constraints limit freedom
### Should not do
- pretend a candidate is already committed
- fill the list with cosmetic copies
- show scores without explaining what changed
---
## Cross-Surface Rules
These rules apply across the core objects:
- the user must always know which layout state is being viewed or analyzed
- `Analyze` and `Generate` must remain distinct
- compare is inspection-only
- stable sound identity should remain consistent across every surface
- event analysis should be a local explanation layer, not a separate hidden truth model
