# PushFlow End-to-End Workflow Report

## Executive Summary

PushFlow should feel like a performance-mapping workspace for turning musical material into a physically playable Push performance.

The user is not primarily trying to "run an optimizer." The user is trying to take a set of Performance Events, understand their sound identity, place those sounds on Pads, test whether the result is playable, explore alternatives, and deliberately choose what becomes the Active Layout.

The clearest end-to-end product loop is:

1. Create or open a project.
2. Establish the performance material and sound identity model.
3. Inspect the current Active Layout.
4. Branch into a Working/Test Layout for exploration.
5. Analyze the current test state.
6. Generate Candidate Solutions when manual iteration is not enough.
7. Compare Active Layout, Working/Test Layout, and Candidate Solutions.
8. Save useful alternatives.
9. Promote one chosen layout to the Active Layout.
10. Use event-level and transition-level analysis to understand why the chosen layout works or fails.

The current V2 workspace already has most of these ingredients, but it still blurs the contract between the committed truth, exploratory edits, generated candidates, and saved alternatives.

## Primary User Goal

The core job-to-be-done is:

Take a musical performance, map its sound identity onto the Push grid, and arrive at a Layout plus Execution Plan that is playable, understandable, and worth practicing.

More concretely, the user wants to answer:

- Can I actually play this on Push?
- Which Grid Positions make the important sounds easiest to perform?
- Where are the hard passages?
- Is the problem feasibility, ergonomics, or performance difficulty?
- Which alternative should become the layout I actually commit to?

## Core Workflow Overview

The intended main flow is sequential, but iterative:

1. The user creates or opens a project that represents one performance problem.
2. The user confirms sound identity and timing data so the project means something musical, not just raw note numbers.
3. The user inspects the Active Layout as the current committed baseline.
4. The user enters a Working/Test Layout state to try manual pad moves without overwriting the baseline immediately.
5. The user analyzes the current test state to see feasibility, cost, passage hotspots, and event-level difficulty.
6. The user asks PushFlow to generate Candidate Solutions when they want non-obvious alternatives.
7. The user compares baseline, manual test version, and generated candidates.
8. The user saves any useful branch as a Saved Layout Variant.
9. The user explicitly promotes one tested or generated result to the Active Layout.
10. The user continues studying difficult Performance Events and transitions against the chosen layout.

## Detailed Workflow Stages

### 1. Create or open project

The user enters through the Project Library.

A project should represent one coherent performance problem:

- one song, loop, section, or arrangement slice
- one set of Performance Events over time
- one evolving family of layout choices for that material

The first user decision is not about solver settings. It is about choosing the material they want to make playable.

The product should make three entry paths obvious:

- start blank
- import MIDI
- reopen an existing project

The current product already supports all three, but the blank-project path still leaves the next step under-explained.

### 2. Define / inspect sounds

After import, the user should confirm how PushFlow names and groups sound identity.

This stage should answer:

- what each sound identity represents
- how imported MIDI got decomposed
- which sounds are musically important
- whether the naming is useful enough for layout work

This is where the user turns note-grouped input into a human-meaningful sound model such as Kick, Snare, Hat, Stab, or Vocal Chop.

The relationship to imported MIDI or timing data should stay explicit:

- MIDI provides the Performance Events and timing
- PushFlow groups them into sound identities the user can place on Pads
- the user should understand that timing and sound identity are related but not identical

### 3. Build or inspect a layout

The user should always be able to inspect the Active Layout as the currently committed baseline.

This view should make the following immediately legible:

- which sound identities are assigned
- which sounds are still unassigned
- which Pads carry the highest-value sounds
- which hand zones the layout is implying

The Active Layout is not just "whatever is on screen." It is the layout the project currently treats as committed truth.

### 4. Manually test layout ideas

Manual editing should happen in a Working/Test Layout, not directly against the committed baseline.

This stage is exploratory by design. The user is trying things like:

- move Kick closer to Snare
- split hats away from fills
- cluster a difficult phrase into one hand zone
- test whether a new Grid Position solves a painful transition

What should remain preserved during manual testing:

- the Active Layout baseline
- the project's performance material
- existing Saved Layout Variants
- any explicit locks the user applied

The user should feel free to experiment because discard and revert are safe and obvious.

### 5. Analyze the tested layout

Analysis is where PushFlow tells the user whether the current layout state is merely neat-looking or actually performable.

This stage should surface:

- cost metrics
- diagnostics
- passage-level hotspots
- selected-event facts
- transition-level difficulty

The user should be able to answer:

- Is this feasible?
- Is it globally better?
- Which passages improved?
- Which movements are still bad?
- Is one finger or one hand overloaded?

The important UX contract is that analysis belongs to a specific layout state. The user should always know whether the metrics refer to the Active Layout, the Working/Test Layout, or a Candidate Solution.

### 6. Generate alternatives

When the user asks for alternatives, they expect real alternatives, not merely a rerun of the same answer.

The user expectation is:

- preserve the important parts of the current intent
- vary the unlocked parts meaningfully
- return layouts with distinct tradeoff profiles
- explain when diversity is limited

How alternatives should differ from the Active Layout:

- different Grid Positions for some sound identities
- different hand-zone strategies
- different transition smoothness vs compactness tradeoffs
- possibly different Execution Plans even when placements are similar

How locks should affect generation:

- locked sound identity placements stay fixed
- unlocked placements may move
- the UI should explain when locks narrowed the search space so much that alternatives are similar

### 7. Compare active vs working vs candidate

Compare mode should reduce decision fatigue.

The user should be able to see quickly:

- which sounds moved
- which Pads changed
- which passages improved or worsened
- whether feasibility changed
- whether finger burden shifted

Compare mode is most useful when it answers "what changed and why it matters" rather than only dumping metrics.

The essential comparison set is:

- Active Layout: committed baseline
- Working/Test Layout: current manual experiment
- Candidate Solution: engine-generated proposal

### 8. Save as alternative

Saving as a Saved Layout Variant means:

- this layout is worth keeping
- it should remain selectable later
- it is not necessarily the Active Layout

This should happen when the user has a layout they may want to return to even if they are not ready to promote it.

Examples:

- "compact right-hand version"
- "locked drums version"
- "fast-fill variant"

Saving should feel like curating an option, not committing the project baseline.

### 9. Promote to active

Promoting to Active Layout is the commitment point.

A tested or generated layout becomes the new Active Layout when the user has enough confidence that it should replace the prior baseline for ongoing work, comparison, and practice.

Before promotion, the UI should make explicit:

- which layout is about to become Active
- how it differs from the current Active Layout
- whether it is feasible
- what major tradeoff changed

Promotion should never be accidental. It is the point where exploration becomes product truth.

### 10. Event analysis / performance understanding

Event analysis is where the user studies movement, transitions, and difficulty in musical context.

This is not a generic score screen. It should teach the user things like:

- this Snare-to-Hat jump is failing because of distance at tempo
- this phrase overloads the right index finger
- this chord is feasible but ergonomically poor
- this alternative reduces drift but increases crossover

This stage relates directly to layout choice because event-level difficulty only makes sense relative to a specific Layout and Execution Plan.

## Example User Journeys

### Journey 1: Manual drum layout experimentation

The user imports a drum MIDI clip, names the sound identities, inspects the Active Layout, and starts a Working/Test Layout. They move Kick, Snare, Closed HH, and Open HH into a tighter cluster, run analysis, notice that one fill passage is still hard, and save the result as a Saved Layout Variant before continuing.

### Journey 2: Optimize around locked sounds

The user already knows Kick and Snare must stay in familiar Grid Positions. They lock those placements, generate Candidate Solutions for the remaining sound identities, compare the alternatives, and promote the candidate that keeps the familiar core while improving ride-to-fill transitions.

### Journey 3: Compare two candidate strategies for a difficult passage

The user selects a hard passage in the timeline, generates alternatives, and compares one compact-right candidate against one more balanced candidate. One version has better overall compactness, but the other reduces a specific transition spike in the chorus. The user saves both as variants, then promotes the version that better supports the passage they care about.

## UX Risks / Ambiguities Exposed

- The current product has a unified workspace, but it does not yet express a clean Active Layout vs Working/Test Layout contract.
- The current codebase still treats timeline material through multiple adjacent models, which makes it harder to say what the user is truly editing.
- Candidate Solution, selected result, and current on-screen layout are too easy to blur together.
- Analysis, diagnostics, compare, event detail, and transition detail exist, but they do not yet read as one coherent analysis workflow.
- Pattern composition is integrated into the same workspace, but its effect on shared project truth is stronger than the UI currently signals.
- The product promise is "meaningful alternatives," but the current candidate-generation strategies are still fairly narrow.

## Recommendations

- Define the default workflow as baseline -> Working/Test Layout -> analyze -> compare -> save/promote.
- Make Candidate Solutions explicitly non-committed until saved or promoted.
- Treat Saved Layout Variants as curated project options, not as the same thing as generated candidates.
- Make event analysis a first-class part of the workflow rather than a side effect of clicking around.
- Make lock behavior explicit in generation and comparison language.

## What This Clarifies

- PushFlow is primarily building a performance-mapping workflow, not just an optimization button.
- The main loop should move through baseline, exploration, analysis, comparison, and deliberate commitment.
- Manual editing and automatic generation belong in the same workflow, but they should create different kinds of state.
- Saved alternatives and generated candidates should not be treated as the same product object.
- Event analysis is part of choosing a layout, not a separate afterthought.

## What Still Needs User Confirmation

- Should the first manual pad edit automatically create a Working/Test Layout, or should the user opt into that branch?
- Should Saved Layout Variants preserve a frozen analysis snapshot, or always re-analyze when reopened?
- Is the Pattern Composer a primary workflow pillar or a supporting feeder into the main performance workflow?
