# Artifact Inputs Checklist

## Purpose

This checklist answers:

What raw material has now been extracted from the repo that is sufficient to draft missing product artifacts, and what remains unclear enough that a human should decide it before finalizing them?

## Inputs for a User Mission

### Successfully Extracted

- core product promise around Push 3 playability optimization
- repeated emphasis on joint optimization of `Layout` and `Execution Plan`
- current live workflow entry points: library, workspace, composer, debug route
- current candidate primary missions: verification, layout editing, timeline shaping, pattern generation

### Still Unclear

- which one of those missions is primary in the current intended product
- whether the composer is core scope or adjacent support tooling
- whether the user mission is framed more as optimization, verification, or authoring

### Key Human Decisions

- choose the single primary mission statement
- decide what is explicitly secondary but still supported

## Inputs for Core User Goals

### Successfully Extracted

- explicit goals from canonical docs, restructure docs, and audit notes
- current UI-supported goals around import, assignment, candidate generation, event inspection, and export
- implied goals around consistency, event-level understanding, and cross-song standardization

### Still Unclear

- the priority order of those goals
- whether export to Ableton is a present product goal or a future one
- whether composition/generation is a central goal or a feeder workflow

### Key Human Decisions

- rank primary, secondary, and optional user goals
- confirm which goals must be supported in v1-style clarity artifacts

## Inputs for JTBD

### Successfully Extracted

- core JTBD around converting MIDI into a playable Push performance
- secondary JTBD around comparing alternatives
- tertiary JTBD around generating new material and constraining technique

### Still Unclear

- which JTBD should anchor screen architecture and copy
- whether JTBD should be performance-verification-first or creation-first

### Key Human Decisions

- approve one lead JTBD statement
- approve 2-4 supporting JTBD statements and demote the rest

## Inputs for Workflow Maps

### Successfully Extracted

- library entry workflows
- import naming workflow
- manual grid assignment workflow
- candidate generation workflow
- analysis/compare workflow
- pattern-composer workflow
- hidden debug workflow

### Still Unclear

- which workflow is the primary happy path
- whether manual layout or automatic generation comes first for typical users
- whether timeline authoring is a core path or simply a support path

### Key Human Decisions

- choose the canonical end-to-end workflow spine
- decide which workflows are alternate branches versus side tools

## Inputs for Screen Architecture

### Successfully Extracted

- complete current live route map
- panel map for the unified workspace
- retained legacy/hidden screen surfaces
- page-level redundancies and overloaded regions

### Still Unclear

- whether retained hidden surfaces should influence future architecture or be treated as noise
- whether the current single large workspace is directionally right, or simply a consolidation step

### Key Human Decisions

- decide whether one workspace remains the target shell
- decide whether analysis and comparison deserve dedicated primary regions/modes

## Inputs for Task-Based UX Specs

### Successfully Extracted

- task inventory for import, assign, generate, compare, inspect, compose, export
- major confusion points for each workflow
- local feedback loops around selection, stale analysis, and transition inspection

### Still Unclear

- exact intended user sequence among those tasks
- the level of visibility composer and debug functionality should have
- how much state synchronization should remain implicit vs explicitly messaged

### Key Human Decisions

- define the canonical task order
- define which side effects must be explicit in UX copy and states

## Inputs for Wireframes / Mockups

### Successfully Extracted

- current panels, controls, and information density
- major overloaded zones
- duplicated concepts that should not be silently merged without decision
- visualization strengths and gaps, especially around event analysis

### Still Unclear

- which information should be primary on first view
- whether event analysis should get a dedicated mode or live in the workspace frame
- how prominent comparison should be relative to editing

### Key Human Decisions

- prioritize information hierarchy
- choose the dominant focal object on the editor page

## Inputs for a Terminology Canon

### Successfully Extracted

- canonical terminology intent from docs
- current code terms and where they drift
- major overloaded terms: analysis, score, sound/voice/stream/lane, pattern/rudiment, workbench/workspace

### Still Unclear

- whether some implementation terms should be kept out of user-facing artifacts entirely
- whether `sound stream` should survive as a user concept

### Key Human Decisions

- approve canonical user-facing term set
- decide which implementation terms are internal only

## Inputs for a Source-of-Truth Domain Model

### Successfully Extracted

- object inventory across project, engine, lane, and composer systems
- likely canonical artifacts: `Layout`, `Execution Plan`, `Candidate Solution`
- current practical app truths: `ProjectState`, `soundStreams`, `performanceLanes`, `LoopState`
- major duplication and synchronization rules

### Still Unclear

- the single canonical user-facing performance model
- the intended relationship between composer-local state and project-wide state
- whether `voiceConstraints` remain part of the product-level domain model

### Key Human Decisions

- choose the canonical timeline/performance object
- decide which derived models are internal scaffolding vs product-visible concepts

## Inputs for Acceptance Criteria / QA

### Successfully Extracted

- strong engine-level scenario fixtures and golden tests
- explicit physical constraints and sanity thresholds
- important invariants around analysis staleness and layout/execution coupling
- useful demo projects aligned with atomic and temporal constraint scenarios

### Still Unclear

- product-level acceptance criteria for workflow clarity
- UX-level success criteria for analysis comprehension and comparison
- whether export, cross-song consistency, and event-analysis depth belong in current acceptance scope

### Key Human Decisions

- define product-facing acceptance criteria beyond engine correctness
- decide what "clear enough to ship" means for the editor workflow itself

## Overall Readiness Summary

## Information We Now Have

- a solid first-draft understanding of the actual current product
- a comprehensive feature inventory
- a usable workflow map
- a terminology problem map
- a state/source-of-truth summary
- a concrete contradiction and duplication list

## Information Still Missing or Ambiguous

- single primary mission
- single primary workflow
- single canonical timeline/performance concept for users
- final scope stance on composer and export
- final analysis architecture and vocabulary

## Practical Conclusion

The repo now contains enough grounded material to author serious pre-implementation product artifacts. What is missing is not evidence. What is missing is human judgment about hierarchy: which concepts, workflows, and outputs are central versus incidental.
