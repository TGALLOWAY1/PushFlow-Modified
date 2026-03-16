# PushFlow Engine Touchpoints and Implementation Sequence

## Purpose

This document captures only the workflow-relevant engine contract and the recommended implementation sequence after workflow approval.

It is not a deep refactor spec.

It answers:

- where engine behavior matters in the UX
- what the engine must provide for the workflow to make sense
- what order implementation should follow once the workflow contract is approved

## Core Principle

The engine exists to support:

- manual testing
- layout evaluation
- alternative generation
- comparison
- explainability

If the engine cannot make those workflow moments trustworthy, the rest of the product contract becomes cosmetic.

## Engine Touchpoint 1: Feasibility

### Why it matters in UX

Feasibility tells the user whether a layout is even a serious option.

The user encounters it during:

- analysis of the `Active Layout`
- analysis of the `Working/Test Layout`
- review of `Candidate Solution` alternatives
- promotion decisions
- event analysis

### What the UX needs

- a clear verdict when something is impossible
- clear distinction between impossible and merely awkward
- named reasons when a layout fails
- explicit indication when hard constraints collapsed the candidate space

### What the engine must provide

- shared hard-feasibility rules across normal solve paths
- explicit rejection reasons
- no silent fallback in standard generation
- layout-bound feasibility status for comparison and event analysis

## Engine Touchpoint 2: Scoring and cost

### Why it matters in UX

Scoring tells the user how one feasible option compares with another.

It matters in:

- diagnostics
- compare mode
- candidate review
- passage summaries
- event and transition analysis

### What the UX needs

- one coherent lower-is-better or higher-is-better story
- factor-level explanation, not only one total
- passage-level and event-level contributors
- readable explanation of why one option is better

### What the engine must provide

- one canonical objective cost used consistently
- factorized output with stable names
- baseline-relative comparison support
- enough local detail to explain difficult moments

## Engine Touchpoint 3: Diversity and alternatives

### Why it matters in UX

The product promises alternatives, not copies.

Diversity matters when the user asks for `Candidate Solution` alternatives and expects real strategy differences.

### What the UX needs

- meaningful difference relative to `Active Layout`
- explanation when alternatives are similar because hard constraints limit freedom
- candidate summaries that show how each option differs

### What the engine must provide

- baseline-relative diversity checks
- trivial-duplicate rejection
- meaningful-difference heuristics
- candidate diff support for compare mode

## Engine Touchpoint 4: Diagnostics and explainability

### Why it matters in UX

The product is not useful if it can say only "this is worse."

The user needs to understand:

- what failed
- what hurt
- where the burden lives
- what changed

### What the UX needs

- clear separation between feasibility, ergonomics, and performance difficulty
- top contributing factors
- explanation of soft-bias violations versus hard-rule violations
- baseline-relative summaries for compare and promotion

### What the engine must provide

- one canonical diagnostics payload
- stable names for output factors
- support for summary, compare, and event analysis from the same source
- human-readable rejection and difference reasons

## Engine Touchpoint 5: Event analysis

### Why it matters in UX

PushFlow gains trust when it can explain one difficult `Performance Event` or transition in detail.

### What the UX needs

- the current layout state attached to the explanation
- the current `Finger Assignment`
- the next transition
- the dominant local cost contributors
- an explanation of what changed between states

### What the engine must provide

- event-level and transition-level factor detail
- stable event identity
- layout-bound execution context
- the same semantics for `Active Layout`, `Working/Test Layout`, and `Candidate Solution`

## Engine Touchpoint 6: Stable sound identity

### Why it matters in UX

The workflow is built around `Sound identity`, not just imported pitch.

### What the UX needs

- consistent sound identity across grid, timeline, compare, diagnostics, and saved outputs

### What the engine must provide

- stable sound identity as canonical solver-facing truth
- imported pitch retained as provenance metadata rather than the only durable key

## Workflow Requirements Implied by These Touchpoints

For the approved workflow to make sense, the engine must eventually support:

- hard-feasibility verdicts with clear reasons
- one canonical cost story
- factorized diagnostics
- baseline-relative candidate diversity
- layout-bound `Execution Plan` outputs
- event-level explanation
- stable sound identity across the full workflow

## Current Gaps Exposed by the Consolidated Artifacts

- Hard feasibility is not described consistently across all engine paths in the older audit material.
- Score semantics drift between objective cost, display score, and candidate summaries.
- Candidate generation is richer than V1 but still weak at proving meaningful diversity.
- Diagnostics are useful but split across several outputs and naming schemes.
- Older artifacts repeatedly note that solver-facing truth still falls back toward pitch identity instead of stable sound identity.

## Recommended Implementation Sequence

This sequence starts after workflow approval. It is intentionally high level.

### Phase 0: Lock the workflow contract

Goal:
Confirm the workflow and state model before implementation churn.

What must be locked first:

- `Active Layout`
- `Working/Test Layout`
- `Saved Layout Variant`
- `Candidate Solution`
- explicit lock behavior
- compare, save, promote, and discard behavior

### Phase 1: Align product state and persistence

Goal:
Make the state model match the approved workflow.

Implementation focus:

- separate `Active Layout` from `Working/Test Layout`
- make saved variants first-class
- make explicit placement locks first-class
- keep analysis-only state out of canonical project truth

Why first:
Engine work is harder to reason about if the product state model still blurs baseline, draft, and candidate state.

### Phase 2: Align solver inputs with workflow concepts

Goal:
Make the engine consume the right product concepts.

Implementation focus:

- declared source state for analysis and generation
- explicit hard constraints versus soft preferences
- stable `Sound identity`
- layout-bound execution context

Why second:
This is the bridge between workflow contract and engine behavior.

### Phase 3: Unify feasibility, scoring, and diagnostics

Goal:
Make engine outputs consistent enough to trust in the UI.

Implementation focus:

- shared hard-feasibility contract
- one canonical objective cost
- one diagnostics payload
- stable factor naming

Why third:
The UI cannot explain or compare reliably until the engine semantics are coherent.

### Phase 4: Make candidate generation baseline-aware

Goal:
Ensure `Candidate Solution` alternatives are genuinely useful.

Implementation focus:

- diversity relative to `Active Layout`
- trivial-duplicate filtering
- candidate diff summaries
- low-diversity explanations

Why fourth:
Meaningful alternative generation depends on the earlier state and diagnostics alignment.

### Phase 5: Tighten compare and event analysis

Goal:
Turn engine output into reviewable user understanding.

Implementation focus:

- baseline-aware compare
- working-vs-active explanations
- candidate-vs-active explanations
- event and transition detail that uses the same canonical diagnostics

Why fifth:
This is where the workflow becomes convincingly human-readable.

### Phase 6: Only then consider deeper engine refactor

Goal:
Avoid premature redesign of solver internals before the workflow contract is working end to end.

Examples of work that should wait unless forced:

- solver-family redesign
- large-scale architectural rewrites
- new export pipelines
- unrelated persistence or schema expansion

## Implementation Exit Criteria by Phase

### Phase 1 exit criteria

- exploratory edits no longer silently mutate `Active Layout`
- explicit placement locks are distinguishable from ordinary edits
- saved variants are durable and separate from active baseline

### Phase 2 exit criteria

- analysis and generation clearly declare their source state
- engine input distinguishes hard constraints from soft preferences
- sound identity is stable enough across key surfaces

### Phase 3 exit criteria

- feasibility, scoring, and diagnostics tell one consistent story
- compare and diagnostics use stable names
- rejected or degraded states are explainable

### Phase 4 exit criteria

- candidate lists are not padded with cosmetic duplicates
- low-diversity cases are explained explicitly

### Phase 5 exit criteria

- compare tells the user what changed and why
- event analysis can explain difficult moments against the right layout state

## Out of Scope Here

This document does not define:

- low-level class or store design
- exact solver APIs
- database schemas
- final UI component hierarchy

Those should be driven by the approved workflow contract, not the other way around.
