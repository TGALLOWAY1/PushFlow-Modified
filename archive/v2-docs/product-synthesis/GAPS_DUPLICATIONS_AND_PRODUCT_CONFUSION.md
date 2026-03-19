# Gaps, Duplications, and Product Confusion

## Purpose

This document is intentionally blunt. It isolates the places where the current repo most clearly fails to present one coherent product definition, even though the engine and many individual features are real and valuable.

Primary evidence:

- `docs/ux-v1-restructure-plan.md`
- `tasks/ux-audit.md`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/components/AnalysisSidePanel.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `src/ui/state/projectState.ts`
- `src/ui/components/lanes/PerformanceLanesView.tsx`
- `src/ui/components/loop-editor/LoopEditorView.tsx`
- `src/ui/components/TimelinePanel.tsx`
- `Version1/docs/WORKBENCH_DOCUMENTATION.md`
- `Version1/docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md`

## Duplicated Concepts

### Timeline

The product currently has multiple serious answers to the question "what is the timeline?":

- `UnifiedTimeline`
- retained lane-management view in `PerformanceLanesView`
- older `TimelinePanel` + `ExecutionTimeline`
- composer-local loop grid

Why this matters:

- timeline is the core performance object, so duplication here creates foundational ambiguity rather than minor UI redundancy

### Performance Representation

The product currently represents the same musical material as:

- `soundStreams`
- `performanceLanes`
- composer-local `LoopState`
- derived solver `Performance`

Why this matters:

- this is not just implementation duplication; it changes what the user is conceptually editing

### Analysis

The repo has multiple layers that all plausibly claim to be "analysis":

- candidate selection
- diagnostics metrics
- selected-event detail
- transition detail
- debug route
- structural analyzer output

Why this matters:

- analysis is a core promised value of the product, so fragmentation here directly weakens clarity

### Constraints

Constraint logic exists at multiple levels:

- voice-level constraints in `voiceConstraints`
- pad-level finger constraints in `Layout.fingerConstraints`
- hard physical feasibility rules
- debug sanity heuristics

Why this matters:

- a user cannot easily tell what kind of "constraint" they are setting and how strongly the system honors it

## Duplicated Pages / Workflows

### Arrange / Timeline Workflow Duplication

The repo still contains:

- a current unified timeline workflow
- a retained standalone performance-lanes workflow

This maps directly onto the older `Arrange` split that the restructure plan says the product needed to escape.

Evidence:

- `docs/ux-v1-restructure-plan.md`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/lanes/PerformanceLanesView.tsx`

### Pattern Workflow Duplication

The repo still contains:

- `WorkspacePatternStudio` with live sync into the shared project
- `LoopEditorView` with old local persistence and explicit commit-to-project

These are materially different product philosophies:

- one says the composer is part of the main timeline
- one says the composer is a separate staging tool

### Timeline Analysis Workflow Duplication

The repo still contains:

- modern timeline-linked event selection and transition panels
- older `ExecutionTimeline` and `TimelinePanel`
- V1 event-analysis documents and components that represent a stronger but different analysis frame

Result:

- the product has not yet fully decided what the canonical event-analysis surface is

## Inconsistent Terminology

### Sound / Voice / Stream / Lane

These terms are distinct in code but not consistently distinct in user-facing product meaning.

Symptoms:

- left rail label says `Sounds`
- layout stores `Voice`
- project performance stores `SoundStream`
- timeline authoring stores `PerformanceLane`

### Analysis / Diagnostics / Compare

`Analysis` panel is mostly about candidate switching.
`Diagnostics` panel contains richer analytical explanation.
`Compare` sits inside `Analysis`.

This is a naming mismatch, not just a layout quirk.

### Score / Difficulty / Complexity

The product currently uses three overlapping notions of burden:

- `score`
- `difficulty`
- `complexity`

They are not clearly nested or differentiated for the user.

### Workspace / Workbench / Grid Editor

The terminology guidance prefers `grid editor` in user-facing language, current code uses `Performance Workspace`, and older V1 uses `Workbench`.

This is manageable historically, but it reinforces that the product shell identity itself has moved around.

## Inconsistent Data Models

### Stream Model vs Lane Model

`soundStreams` are treated as canonical for solver input, but `UnifiedTimeline` actively synchronizes `performanceLanes` back into streams whenever lanes exist.

This means:

- the apparent canonical model and the practical editing model are not the same

### Composer Model vs Project Model

Composer uses:

- its own lane objects
- its own event map
- its own playback and result types

It then converts into `performanceLanes` and may bulk-update layout assignments.

This is a real subsystem boundary, but the current product surface makes it feel more seamless than it actually is.

### Structural Metadata vs Edited Timeline

`sections` and `voiceProfiles` are generated at import time.
The timeline can later change significantly.
There is no clearly exposed re-structuring pass tied to major authoring changes.

## Feature Drift

### The Product Has Drifted Toward Capability Accumulation

The repo contains:

- MIDI verification
- manual layout editing
- lane organization
- candidate optimization
- local event/transition analysis
- pattern generation
- preset management
- debug instrumentation

This is a large capability set. The problem is not too few features. The problem is that multiple capabilities now compete to define what the app fundamentally is.

### "Unified Workspace" Helped, But Did Not Finish the Job

The restructure plan correctly identified that separate tabs fragmented the user flow. The current workspace did remove those route-level walls. But the underlying concepts and state models were not reduced enough to give the merged screen one unmistakable purpose.

## Unclear Primary Workflow

At least four plausible primary workflows are still visible:

1. Import MIDI and verify playability.
2. Arrange a performance timeline manually.
3. Design a Push layout manually.
4. Generate or sketch patterns from scratch.

The current workspace asks the user to infer which one is "really" primary.

That is likely the central product-definition gap in the repo.

## Hidden Assumptions

### 1. Composer Changes the Shared Project, Not a Sandbox

This is true in code, but easy to miss in UX terms.

### 2. Timeline Authoring Can Rewrite Solver Inputs

Because lane synchronization can regenerate `soundStreams`, the timeline is not merely a view.

### 3. Empty Layout Generation Starts From a Chromatic Heuristic

Users may interpret the first visible generated layout as more intentional than it actually is.

### 4. Structural Analysis Is Treated as Stable Enough to Keep

The app does not strongly signal that sections/roles were inferred from earlier project state and may no longer match later edits.

## Suspected UX Confusion Points

### 1. The workspace is visually unified but mentally overloaded

Everything important is on one page, but that page now carries too many different product verbs:

- import
- edit
- analyze
- compare
- compose
- constrain
- export

### 2. The Analysis panel is underpowered relative to its label

Users opening `Analysis` may expect explanation, but primarily get candidate controls.

### 3. Users are asked to think in multiple object models

Without reading the code, a user can still feel the distinction indirectly:

- sounds in one place
- voices in another
- lanes in another
- pattern lanes somewhere else

### 4. The timeline does not yet feel like the canonical explanation surface

The current timeline is useful, but it does not yet provide the strong event-by-event analysis spine that V1 and the audit docs point to as especially valuable.

### 5. Compare mode is valuable but semi-hidden

Candidate comparison feels important enough to be a top-level workflow phase, yet it is accessed as a sub-tab inside a slide-out.

## Code / Docs Mismatch

### Match: Canonical engine intent is strong

The canonical docs and engine are well aligned around layout + execution as joint outputs.

### Mismatch: Export scope

Docs and task notes discuss Ableton/drum-rack export as a meaningful goal.
Current live shell only exports JSON project state.

### Mismatch: Event-analysis priority

Docs and audits elevate event-by-event ergonomic inspection as critical.
Current live shell offers fragments of that experience, but not a dedicated first-class event-analysis frame.

### Mismatch: Simplified route shell vs retained legacy code

The app presents a tiny route map, but the codebase still contains large retained alternate workflows. That makes the product look simpler on the surface than it really is underneath.

## Legacy vs Current Uncertainty

### What Seems Clearly Current

- project library
- unified workspace shell
- unified timeline
- main grid editor
- candidate generation
- diagnostics panel
- workspace pattern composer

### What Seems Clearly Legacy

- standalone `LoopEditorView`
- standalone `PerformanceLanesView`
- `TimelinePanel` / `ExecutionTimeline`
- older V1 dashboard/workbench framing

### What Is Still Uncertain

- whether V1 event-analysis concepts are a historical reference or an intended future baseline
- whether retained standalone views are temporary leftovers or still meaningful product fallbacks
- whether composer should stay equal in prominence to verification/optimization

## Questions That Need Human Product Judgment

1. What is the one sentence mission of the editor page?
2. Which user should the product optimize for first: verifier, arranger, layout designer, or generator?
3. What is the canonical user-facing timeline concept?
4. Should pattern generation be inside the main mission, adjacent to it, or separate from it?
5. What counts as "analysis" in the product: candidate selection, metrics, event explanation, or all of the above with a clear hierarchy?
6. Should the product explicitly restore a stronger event-analysis mode inspired by V1?
7. Which constraint level should users mainly interact with: sound-level or pad-level?
8. Is JSON export enough for the product's near-term definition, or is Push/Ableton export part of the actual core promise?
9. Should hidden legacy screens be removed from product consideration, archived, or reintroduced intentionally?

## Brutally Honest First-Draft Conclusion

The repo does not read like a product with too little capability. It reads like a product with an unusually clear core engine premise and an unusually crowded set of adjacent workflow interpretations wrapped around it. The main product problem is not missing features. It is that the app still has not made a definitive choice about which task the user is primarily here to complete.
