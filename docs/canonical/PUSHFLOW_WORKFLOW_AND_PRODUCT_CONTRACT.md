# PushFlow Workflow and Product Contract

## Purpose

This is the main human-readable product contract for PushFlow.

It bridges:

- idea
- workflow
- page responsibility
- state behavior
- user-visible decision points

It is intentionally product-facing. It does not lock solver internals or UI implementation details beyond what the workflow requires.

## Product Summary

PushFlow is a performance-mapping and playability-analysis product for Push.

The user brings in or creates performance material, maps sound identity onto the grid, tests whether the result is physically playable, explores alternatives, and deliberately chooses what becomes the Active Layout.

The core promise is not "generate a layout." The core promise is:

Take performance material and converge on a Layout plus Execution Plan that is playable, understandable, and worth keeping.

## Primary User Goal

The primary user is adapting performance material for Push and needs to answer:

- What am I actually building?
- Which Grid Positions make this material playable?
- Where is it difficult?
- Is the problem feasibility, ergonomics, or performance difficulty?
- Which tested or generated option should become the Active Layout?

## Core Workflow Spine

The canonical flow is:

1. Create or open a project.
2. Define or confirm sound identity.
3. Inspect the current Active Layout.
4. Enter a Working/Test Layout for exploration.
5. Analyze the tested state.
6. Generate Candidate Solutions when manual iteration is not enough.
7. Compare Active Layout, Working/Test Layout, and Candidate Solutions.
8. Save a useful alternative as a Saved Layout Variant.
9. Promote one chosen layout to Active Layout.
10. Use event analysis to understand why the chosen layout works or fails.

This loop may repeat many times inside one project.

## Core Workflow Stages

### 1. Create or open project

The Project Library exists to start or reopen work.

A project represents one coherent performance problem:

- one performance timeline
- one evolving family of Layout choices
- one set of analysis and comparison decisions

Entry paths:

- create blank project
- import MIDI
- open saved project
- open demo

### 2. Define / inspect sounds

The user needs a readable sound identity model before layout work begins.

This stage should make clear:

- what each sound identity represents
- how imported or authored Performance Events were grouped
- which sounds are assigned or still unassigned

Sound identity must remain stable across:

- timeline
- grid
- compare
- diagnostics
- saved outputs

### 3. Inspect the Active Layout

The Active Layout is the committed baseline.

The user should immediately see:

- which Pads are assigned
- which sound identities are still unassigned
- what hand-zone strategy the layout implies
- what baseline they are about to compare against

### 4. Enter Working/Test Layout

Manual edits belong to a Working/Test Layout by default.

That includes:

- place sound identity on a Pad
- move a sound identity
- swap assignments
- remove a sound identity back to unassigned
- clear the test layout

These edits are exploratory unless the user later saves or promotes them.

### 5. Analyze the tested state

Analysis belongs to a specific layout state.

The user must always know whether analysis is describing:

- Active Layout
- Working/Test Layout
- Candidate Solution

Analysis should answer:

- Is this feasible?
- What is hard?
- Where is the burden concentrated?
- What changed relative to the baseline?

### 6. Generate Candidate Solutions

Generation creates Candidate Solutions from the current approved source state.

Generation must:

- preserve hard constraints
- explain when diversity collapses
- return meaningful alternatives, not cosmetic copies

Generation is distinct from analysis:

- analysis evaluates the current state
- generation proposes alternatives

### 7. Compare options

Compare mode is inspection-only.

It should make the following legible:

- which sound identities moved
- which Grid Positions changed
- whether feasibility changed
- which passages improved or worsened
- whether the change is worth keeping

### 8. Save as Saved Layout Variant

Saving creates a durable named alternative without changing the Active Layout.

A Saved Layout Variant means:

- keep this option
- do not make it the baseline yet

### 9. Promote to Active Layout

Promotion is the commitment point.

Promoting a Working/Test Layout or Candidate Solution makes it the new Active Layout.

Promotion must be explicit.

The user should see before promotion:

- what changed
- whether locked state will be replaced
- what tradeoff is being accepted

### 10. Event analysis

Event analysis explains the local consequences of the current layout state.

It should teach the user:

- which Pads are active at the selected moment
- which Finger Assignments are being used
- what transition comes next
- what local factor is causing difficulty

This is not a separate truth model. It is the local explanation layer for the same workflow.

## Page and Panel Responsibilities

### Project Library

Primary purpose:
Project entry, import, demos, and re-entry.

What belongs here:

- create project
- import MIDI
- import project file
- open saved work
- open demo

What does not belong here:

- deep editing
- compare decisions
- event-level analysis

### Performance Workspace

Primary purpose:
The main project surface for layout editing, timeline inspection, analysis, and alternative review.

The workspace should contain:

- sound panel
- grid editor
- timeline support surface
- diagnostics and compare surfaces

The workspace should not blur editing truth and inspection state.

### Sound Panel

Primary purpose:
Present sound identity inventory and assignment status.

What belongs here:

- sound identity list
- assignment status
- drag-to-grid
- lock controls
- metadata edits

What does not belong here:

- hidden solver semantics disguised as simple metadata

### Grid Editor

Primary purpose:
Edit and inspect the currently displayed Layout.

What belongs here:

- Pad assignment
- Working/Test Layout edits
- lock visibility
- selected-event context
- compare visibility when in compare mode

The grid must always show which layout state is on screen.

### Timeline

Primary purpose:
Represent the canonical sequence of Performance Events over time.

What belongs here:

- event inspection
- transport
- event selection
- source-material organization

The timeline is the time-based support surface. It should not silently rewrite the user’s understanding of what layout state is being tested.

### Candidate Review

Primary purpose:
Curate Candidate Solutions as options.

What belongs here:

- candidate list
- tradeoff summaries
- selection for compare
- save or promote decisions

What does not belong here:

- pretending the candidate is already the committed baseline

### Compare Mode

Primary purpose:
Show meaningful difference between two layout states.

Compare mode should support:

- Active Layout vs Working/Test Layout
- Active Layout vs Candidate Solution
- Candidate Solution vs Candidate Solution when helpful

Compare mode is read-only.

### Diagnostics

Primary purpose:
Summarize feasibility, burden, and factor-level explanations for the current analyzed state.

Diagnostics should sit above debug tooling and below full event analysis in depth.

### Event Analysis

Primary purpose:
Explain difficult passages and transitions in local detail.

It should remain part of the core product workflow, whether accessed inline or through a dedicated focus mode.

### Debug Tools

Primary purpose:
Internal-only inspection.

Debug tools are not part of the user-facing product contract.

## State Model

### Active Layout

The committed baseline Layout for the project.

Use it for:

- default browsing
- baseline comparison
- default persistence
- default promotion target replacement

### Working/Test Layout

The mutable exploratory Layout branch.

Use it for:

- manual edits
- exploratory analysis
- draft comparison
- save/discard/promote decisions

### Saved Layout Variant

A durable named alternative Layout.

Use it for:

- keeping a good option
- later reactivation
- deliberate comparison

### Candidate Solution

A generated proposal containing:

- Layout
- Execution Plan
- analysis

Use it for:

- review
- compare
- save
- promote

Do not treat it as committed truth until explicitly promoted.

### Execution Plan and Finger Assignment context

Execution Plan is always derived from a specific layout state.

Finger Assignment meaning must remain attached to:

- Active Layout
- Working/Test Layout
- Saved Layout Variant when reopened for testing
- Candidate Solution

### Analysis-only state

Examples:

- selected event
- overlay toggles
- compare selection
- playback time
- panel visibility

These are inspection state, not project truth.

## Manual Edit and Lock Behavior

### Default manual edit behavior

Ordinary manual placement edits modify the Working/Test Layout.

They do not automatically become:

- hard-preserved constraints
- Active Layout mutations
- hidden long-lived solver rules

### Lock behavior

Explicit locks are the real hard placement rule.

Default lock contract:

- the user locks a sound identity to a specific Grid Position
- generation must preserve that placement
- compare and promotion must show when locked state would be replaced

### Finger and hand behavior

Persistent exact pad-to-single-finger locking is not the main product rule.

The product-facing model is:

- explicit placement locks are hard
- hand and finger preferences are soft unless explicitly elevated later
- event-level manual edits are draft testing behavior by default

### Analysis-only filters

Analysis-only filters and overlays are temporary.

They should never silently become canonical project truth.

## Compare, Save, Promote, and Discard Flows

### Compare

Compare is used to inspect differences.

It never mutates project truth.

### Save

Save as Saved Layout Variant keeps a useful option without changing the Active Layout.

### Promote

Promote replaces the Active Layout with a selected Working/Test Layout or Candidate Solution.

Promotion is the only normal path by which exploratory or generated state becomes the new baseline.

### Discard

Discard removes the Working/Test Layout and returns the user to the Active Layout baseline.

## Event Analysis Role in the Workflow

Event analysis is where PushFlow becomes trustworthy.

It must answer:

- What happened at this moment?
- Which Pad and Finger Assignment choices are responsible?
- What is the next transition?
- Why is this passage hard?

It should support:

- inline selection from the timeline
- deeper focused review when needed

It should not be reduced to a side effect of candidate switching.

## Workflow Invariants

- One project has one canonical performance timeline.
- One Active Layout exists at a time.
- Working/Test Layout is distinct from Active Layout.
- Saved Layout Variants are durable but not automatically active.
- Candidate Solutions are proposals, not hidden mutations.
- Analysis must always identify its subject state.
- Compare mode is read-only.
- Explicit locks are the hard placement contract.
- Analysis-only state is never silent project truth.

## Out of Scope for This Contract

This document does not lock:

- deep solver redesign
- database schemas
- export pipeline details
- visual design system choices

Those belong after workflow approval.
