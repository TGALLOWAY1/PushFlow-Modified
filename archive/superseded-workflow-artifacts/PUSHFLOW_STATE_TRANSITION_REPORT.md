# PushFlow State Transition Report

## Executive Summary

PushFlow needs a product state model that cleanly separates committed truth, exploration, generated options, and inspection-only context.

The simplest readable model is:

- one Active Layout as the committed baseline
- one optional Working/Test Layout as the current exploratory branch
- many Saved Layout Variants as curated retained options
- many Candidate Solutions as engine-generated proposals
- explicit locks that constrain generation or movement
- analysis-only UI state that never becomes truth by itself

The current product has most of the ingredients, but the codebase still blurs visible state and editable state, especially around candidate selection and layout display.

## Core State Concepts

### Active Layout

**What it means**  
The Active Layout is the project’s committed layout baseline.

**How it is created**  
By creating a new project, promoting a Working/Test Layout, or promoting a Candidate Solution.

**How it changes**  
Only through explicit promotion or an explicitly committed edit path.

**How it ends / is discarded**  
It does not disappear casually; it is replaced only when another layout is promoted.

**Whether it should persist**  
Yes. It is persistent project truth.

**How it should appear in the UI**  
Always labeled as Active. It should be the default comparison baseline and the default reopened layout.

### Working/Test Layout

**What it means**  
A temporary, editable layout branch for manual experimentation.

**How it is created**  
When the user begins exploratory editing from the Active Layout or from a Candidate Solution.

**How it changes**  
Through manual pad moves, sound placement changes, or lock adjustments.

**How it ends / is discarded**  
It can be discarded, saved as a variant, or promoted to Active.

**Whether it should persist**  
Only if the user explicitly saves it or leaves the session with unsaved work the product chooses to preserve.

**How it should appear in the UI**  
Clearly marked as Working/Test, unsaved if applicable, and distinct from the Active Layout.

### Saved Layout Variant

**What it means**  
A named, persistent alternative layout retained for later review.

**How it is created**  
By explicitly saving the Working/Test Layout or saving a Candidate Solution as a variant.

**How it changes**  
Usually by reopening it into a new Working/Test Layout, not by silently mutating the saved variant itself.

**How it ends / is discarded**  
By explicit delete or archive action.

**Whether it should persist**  
Yes. It is a project artifact.

**How it should appear in the UI**  
As a named saved option, separate from generated candidates and separate from the single Active Layout.

### Candidate Solution

**What it means**  
An engine-generated proposal that includes Layout, Execution Plan, and analysis.

**How it is created**  
By running generation from the Active Layout or Working/Test Layout, optionally with locks.

**How it changes**  
It generally should not be edited in place. The user should inspect, compare, save, or promote it.

**How it ends / is discarded**  
When replaced by a new candidate run, cleared, or left ephemeral. It may also be saved as a variant or promoted.

**Whether it should persist**  
Ephemeral by default, optionally persistent if the product intentionally retains recent candidate sets.

**How it should appear in the UI**  
Clearly labeled as Candidate Solution, never mistaken for the Active Layout.

### Explicit Placement Lock

**What it means**  
A user-declared rule that a sound identity or Grid Position must remain fixed during exploration or generation.

**How it is created**  
By locking a sound identity to a specific Pad or locking a placement relationship in the layout workflow.

**How it changes**  
It can be added, removed, or edited as the user decides what is non-negotiable.

**How it ends / is discarded**  
When the user removes the lock or the layout branch is discarded.

**Whether it should persist**  
Usually yes within the relevant layout state, because it expresses user intent.

**How it should appear in the UI**  
Visibly on the affected sound identity or Pad, and visibly referenced during generation.

### Analysis-Only State

**What it means**  
Read-only UI context such as selected event, compare mode, diagnostics visibility, transport time, and current inspection target.

**How it is created**  
Through user inspection actions like selecting events, opening compare mode, or toggling diagnostics.

**How it changes**  
Constantly during analysis and playback.

**How it ends / is discarded**  
It can be cleared, changed, or safely lost on reload without changing project truth.

**Whether it should persist**  
Usually no, or only lightly.

**How it should appear in the UI**  
As contextual state, not as committed project data.

### Execution Plan / Finger Assignment context

**What it means**  
The Execution Plan and its Finger Assignments are analysis artifacts bound to a specific layout state.

**How it is created**  
By analyzing or generating against the Active Layout, Working/Test Layout, or a Candidate Solution.

**How it changes**  
Whenever the underlying layout, locks, or performance material changes.

**How it ends / is discarded**  
When it becomes stale, is replaced, or is no longer valid for the current layout state.

**Whether it should persist**  
Optionally as a snapshot, but it should always be treated as layout-bound and invalidatable.

**How it should appear in the UI**  
Always labeled with the state it belongs to: Active, Working/Test, Saved Variant reopened for testing, or Candidate.

## State Transition Flows

### Active -> Working edit session

**Start state**  
Project has an Active Layout and no current Working/Test Layout.

**Trigger**  
User begins manual layout editing or explicitly chooses "test this layout."

**What changes**  
A Working/Test Layout is created as a branch from the Active Layout.

**What stays preserved**  
The Active Layout, existing Saved Layout Variants, and prior Candidate Solutions.

**What the user must understand**  
They are editing an exploratory branch, not overwriting the Active Layout yet.

**Persistence impact**  
Working/Test state may be session-persistent, but it should remain visually distinct from committed truth.

### Working -> discarded / revert to active

**Start state**  
User has a Working/Test Layout with unsaved changes.

**Trigger**  
User clicks discard, revert, or closes the branch intentionally.

**What changes**  
The Working/Test Layout is removed and the Active Layout becomes the visible working context again.

**What stays preserved**  
The Active Layout and any Saved Layout Variants.

**What the user must understand**  
Only exploratory changes are being thrown away.

**Persistence impact**  
Unsaved Working/Test changes are lost.

### Working -> saved variant

**Start state**  
User has a Working/Test Layout worth keeping.

**Trigger**  
User clicks save as Saved Layout Variant.

**What changes**  
A persistent named variant is created.

**What stays preserved**  
The Working/Test Layout can continue, and the Active Layout remains unchanged.

**What the user must understand**  
Saving a variant is retention, not promotion.

**Persistence impact**  
A new persistent project artifact is added.

### Working -> promoted to active

**Start state**  
User has a Working/Test Layout that is better than the current baseline.

**Trigger**  
User explicitly promotes it.

**What changes**  
The Working/Test Layout becomes the Active Layout.

**What stays preserved**  
The previous Active Layout should usually remain available as a Saved Layout Variant or rollback target.

**What the user must understand**  
This is the new committed baseline for future work.

**Persistence impact**  
Project truth changes and should persist.

### Active -> generate candidates

**Start state**  
User has an Active Layout and wants alternatives.

**Trigger**  
User runs generation.

**What changes**  
Candidate Solutions are created against the current baseline and any active locks.

**What stays preserved**  
The Active Layout remains committed truth.

**What the user must understand**  
Candidate generation does not itself promote anything.

**Persistence impact**  
Candidates may be retained temporarily, but should not automatically replace the Active Layout.

### Candidate -> compare

**Start state**  
At least one Candidate Solution exists.

**Trigger**  
User selects compare mode.

**What changes**  
The UI enters analysis-only comparison between two states.

**What stays preserved**  
All underlying layout truths. Compare does not mutate them.

**What the user must understand**  
Compare is inspection, not commitment.

**Persistence impact**  
Usually none beyond ephemeral UI state.

### Candidate -> promoted to active

**Start state**  
User has chosen a Candidate Solution they trust.

**Trigger**  
User clicks promote.

**What changes**  
The candidate’s Layout becomes the Active Layout, and its Execution Plan becomes the current analysis baseline.

**What stays preserved**  
Previous Active Layout should remain retrievable as a variant or history entry.

**What the user must understand**  
They are committing an engine proposal into project truth.

**Persistence impact**  
Active project truth changes and should persist.

### Lock added / removed

**Start state**  
User is working with an Active Layout, Working/Test Layout, or candidate-generation baseline.

**Trigger**  
User adds or removes an Explicit Placement Lock.

**What changes**  
The set of allowed moves or generation freedoms changes.

**What stays preserved**  
Other placements and saved artifacts remain intact unless regenerated.

**What the user must understand**  
Locks express non-negotiable intent and may reduce candidate diversity.

**Persistence impact**  
Locks should persist with the relevant layout state.

### Analysis-only toggles on/off

**Start state**  
User is in normal workspace editing or review.

**Trigger**  
User opens compare, diagnostics, event analysis, or playback context.

**What changes**  
Inspection context changes, but underlying layout truth does not.

**What stays preserved**  
Active, Working/Test, Saved Variant, Candidate, and lock states.

**What the user must understand**  
Opening analysis does not commit anything.

**Persistence impact**  
Usually none or minimal.

## State Confusions in Current Product

- Active vs Working: the current product does not provide a first-class Working/Test Layout concept, even though the workflow clearly needs one.
- Candidate vs Saved Variant: the codebase has both multi-layout support and Candidate Solutions, but no product contract for how they differ in lifecycle.
- Lock vs ordinary placement: pad-level finger constraints materially affect solving, voice-level constraints are visible but weaker, and there is no explicit placement-lock concept yet.
- Analysis-only vs persistent truth: selected candidate, selected event, compare mode, transport time, and current analysis results are all transient, but the current UI can make them look closer to truth than they are.
- Displayed layout vs editable layout: in the current workspace, the visible grid can reflect a selected candidate while edits still target the project’s active layout state, which is a direct state-model ambiguity.
- Saved project truth vs saved analysis cache: the current persistence model retains layouts and candidates but clears the live analysis result on reload, which reinforces that layout state is project truth while analysis is currently treated as refreshable cache.

## Recommended Product State Model

The recommended state model is:

The project owns one Active Layout. Exploration happens in one Working/Test Layout at a time. Useful exploratory results become Saved Layout Variants. Engine-generated proposals exist as Candidate Solutions until the user either discards them, saves them, or promotes one to Active. Locks travel with the layout state they constrain. Execution Plans and Finger Assignments are always analysis artifacts attached to a specific layout state, never free-floating truth.

That model is simple enough for users to reason about and strong enough to guide implementation later without prematurely dictating store structure.

## Open Questions

- Should every manual edit branch from Active automatically, or should there be an explicit "Start Testing" action?
- When promoting a Candidate Solution, should the previous Active Layout always be saved automatically as a variant?
- Should Explicit Placement Locks apply to sound identity, Pad, or both?

## What This Clarifies

- Which states are committed, exploratory, generated, saved, locked, or analysis-only.
- Why Candidate Solutions and Saved Layout Variants should not be collapsed into one idea.
- Why Execution Plan truth must remain attached to a specific layout state.
- Why compare mode and event selection are inspection state, not project truth.
- Why the product needs a Working/Test Layout concept even though the current codebase does not express it cleanly.

## What Still Needs User Confirmation

- Whether Working/Test Layout should be automatic or explicit.
- Whether promotion should auto-save the replaced Active Layout.
- Whether locks are intended to be placement locks, finger locks, or both.
