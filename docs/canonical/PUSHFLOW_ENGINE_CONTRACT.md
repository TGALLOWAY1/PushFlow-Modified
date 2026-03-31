# PushFlow Engine Contract
## Purpose
This file defines the small workflow-facing engine contract for PushFlow.
It describes what the engine must provide for the product workflow to make sense.
It does not define exact implementation details.
---
## Core Principle
The engine exists to support:
- manual testing
- layout evaluation
- alternative generation
- comparison
- explainability
If the engine cannot make those workflow moments trustworthy, the product contract becomes cosmetic.
---
## 1. Feasibility
### Product need
The user needs to know whether a layout is actually viable.
### The engine must provide
- a clear feasibility verdict
- a clear distinction between impossible and merely awkward
- a clear distinction between difficult layouts and easy ones
- named reasons when a layout fails
- no silent fallback in normal candidate generation
- feasibility that can be attached to a specific layout state
### Why it matters
This affects:
- analysis of the `Active Layout`
- analysis of the `Working/Test Layout`
- review of `Candidate Solution` alternatives
- promotion decisions
- event analysis
---
## 2. Scoring and cost
### Product need
The user needs one coherent story for why one layout is better or worse than another.
### The engine must provide
- one canonical objective cost story
- stable factor names
- factorized output rather than only one total
- event-level and passage-level contributors
- support for baseline-relative comparison
### Why it matters
This affects:
- diagnostics
- compare mode
- candidate review
- local event analysis
- promotion decisions
---
## 3. Diversity and alternatives
### Product need
The user expects meaningful alternatives, not cosmetic copies.
### The engine must provide
- diversity checks relative to the `Active Layout`
- rejection or filtering of trivial duplicates
- meaningful-difference heuristics
- support for candidate diffs in compare mode
- explanation when constraints collapse the candidate space
### Why it matters
Without this, the product appears to generate noise instead of useful choices.
---
## 4. Diagnostics and explainability
### Product need
The user must be able to understand what failed, what hurts, and what changed.
### The engine must provide
- one canonical diagnostics payload
- stable names for output factors
- clear separation between feasibility, ergonomics, and performance difficulty
- support for summary diagnostics, compare, and event analysis from the same source
- human-readable rejection reasons and difference reasons
### Why it matters
PushFlow should not only say that something is worse. It should help the user understand why.
---
## 5. Event analysis
### Product need
The user should be able to inspect one difficult moment or transition in detail.
### The engine must provide
- event-level factor detail
- transition-level factor detail
- stable event identity
- layout-bound execution context
- the same semantics across `Active Layout`, `Working/Test Layout`, and `Candidate Solution`
### Why it matters
This is what makes local difficulty legible and trustworthy.
---
## 6. Stable sound identity
### Product need
The workflow is built around `Sound identity`, not only imported pitch.
### The engine must provide
- stable sound identity as canonical truth across the workflow
- imported pitch retained as provenance metadata when useful
- consistency across grid, timeline, compare, diagnostics, and saved outputs
---
## Required Cross-Cutting Properties
For the approved workflow to make sense, the engine must eventually support:
- hard-feasibility verdicts with clear reasons (including outward-rotation rejection)
- one canonical cost story
- factorized diagnostics
- baseline-relative candidate diversity
- layout-bound execution outputs
- event-level explanation
- stable sound identity across the workflow
---
## What This Contract Intentionally Does Not Define
This file does not define:
- beam search versus hill climbing versus other optimization methods
- exact internal data structures
- exact payload schemas
- exact adapter layers
- refactor steps
- file-by-file implementation sequence
Those belong in implementation planning, not in the small engine contract.
