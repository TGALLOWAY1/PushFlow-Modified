# PushFlow Canon
## Purpose
This file is the smallest product canon for PushFlow.
It preserves the workflow and state truths that should remain stable even if the engine or UI implementation changes.
It is intentionally simple and product-facing.
---
## Product Identity
PushFlow is a performance-mapping and playability-analysis product for Ableton Push 3. An 8x8 MIDI controller.
The user brings in or creates performance material, maps sound identity onto the grid, tests whether it is playable, explores alternatives, and deliberately chooses what becomes the Active Layout.
The core promise is to help the user converge on a layout that is playable, understandable, and worth keeping.
This is consistent with the existing workflow contract and decision record.
---
## Core Product Truths
### 1. One project = one performance problem
A `Project` is the top-level container.
A project contains:
- one canonical performance timeline
- one evolving family of sound layout and finger assignment options
- one set of analysis and comparison decisions
### 2. Layout state must be explicit
The product must clearly distinguish between:
- `Active Layout`
- `Working/Test Layout`
- `Saved Layout Variant`
- `Candidate Solution`
These are not interchangeable.
### 3. Active Layout is the committed baseline
The `Active Layout` is the current committed layout for the project.
It is the baseline for:
- inspection
- comparison
- promotion decisions
- candidate diversity evaluation
### 4. Working/Test Layout is the exploratory draft
Ordinary manual edits belong to the `Working/Test Layout` by default.
Examples:
- place a sound on a pad
- move a sound
- swap assignments
- clear an assignment
- test a different arrangement
These edits are exploratory unless the user later saves or promotes them.
### 5. Promotion is the commitment point
`Promote` is the action that turns a `Working/Test Layout` or `Candidate Solution` into the new `Active Layout`.
Promotion must be explicit.
### 6. Save Variant keeps an alternative without changing the baseline
`Save as variant` creates a durable `Saved Layout Variant`.
A saved variant is worth keeping, but it does not replace the `Active Layout`.
### 7. Compare is inspection-only
Compare mode exists to help the user understand tradeoffs.
It should make clear:
- what moved
- what changed
- what improved
- what worsened
- whether the change is worth keeping
Compare does not silently commit changes.
### 8. Analysis must always name its subject
Analysis always belongs to a specific layout state.
The user must always know whether the analysis describes:
- `Active Layout`
- `Working/Test Layout`
- `Candidate Solution`
### 9. Generation and analysis are different actions
`Analyze` evaluates the current state.
`Generate` proposes alternatives.
These actions must remain visibly distinct in the product.
### 10. Sound identity is stable across the product
`Sound identity` is the stable user-facing mapped object.
It must remain consistent across:
- grid
- timeline
- compare
- diagnostics
- saved outputs
Imported MIDI pitch is provenance and not tied to an important aspect of the sound or project. It is stripped from the sound.
### 11. Explicit placement locks are the main hard user-facing preserve rule
An explicit placement lock preserves a `Sound identity` at a specific `Grid Position`.
Locks are the main hard placement rule the user should rely on.
Hard feasibility rules remain separate from soft ergonomic preferences.
### 12. Event analysis is a local explanation layer
Event analysis explains the local consequences of the current layout state.
It should help the user understand:
- which pads are active at the selected moment
- which finger assignments are being used
- what transition comes next
- what local factor is causing difficulty
Event analysis is not a separate truth model. It is a local explanation layer for the same project, timeline, and layout states.
---
## Workflow Spine
The canonical workflow is:
1. Create or open a project.
2. Define or confirm sound identities.
3. Inspect the current `Active Layout`.
4. Enter a `Working/Test Layout` for exploration.
5. Analyze a candidate layout.
6. Generate `Candidate Solution` alternatives when manual iteration is not enough.
7. Compare `Active Layout`, `Working/Test Layout`, and `Candidate Solution` options.
8. Save a useful alternative as a `Saved Layout Variant`.
9. Promote one chosen layout to `Active Layout`.
10. Use event analysis to understand why the chosen layout works or fails.
This loop may repeat many times inside one project.
---
## What This Canon Intentionally Does Not Define
This file does not define:
- solver internals
- exact optimization strategy
- exact file structure
- exact TypeScript interfaces
- refactor plans
- archive reconciliation details
Those belong in implementation or archive documents, not in the smallest product canon.
