# PushFlow Engine Touchpoint Report

## Executive Summary

The engine matters in PushFlow because it makes the workflow believable.

Without engine support, the product becomes a layout toy. With the right engine touchpoints, it becomes a performance decision tool that can tell the user:

- whether a layout is feasible
- where it is hard
- why it is hard
- what alternatives exist
- how those alternatives differ

This report stays at the product-contract level. It does not prescribe solver internals. It describes what the engine must make visible in the workflow so the UX makes sense.

## Core Principle

The engine exists to support:

- manual testing
- layout evaluation
- alternative generation
- comparison
- explainability

The engine is not the product by itself. It is the system that makes the user’s layout decisions legible and trustworthy.

## Touchpoint 1 — Feasibility

Feasibility matters anywhere the user is deciding whether a layout is even worth considering.

Where the user encounters feasibility:

- during manual layout testing
- when reading diagnostics
- when reviewing hard passages
- when comparing alternatives
- when deciding whether to promote a layout

What "impossible" or "invalid" means in UX terms:

- a Performance Event cannot be assigned a playable Finger Assignment
- a transition cannot be executed at the required tempo and distance
- a simultaneity cannot be played by plausible hands and fingers
- the layout does not cover the sound identity required by the performance

How feasibility should surface during manual editing:

- immediate warnings when a placement causes obvious coverage problems
- visible counts of unplayable or invalid events after analysis
- event-level explanation of which moments failed and why

How feasibility should affect generation:

- infeasible candidates should not be presented as normal alternatives without explanation
- low-feasibility outputs should be visibly labeled
- if all alternatives are constrained into poor feasibility by locks, the UI should say so directly

How feasibility should appear in explanations:

- not just as a bad score
- as a human-readable verdict with local reasons
- with a distinction between "impossible" and "playable but awkward"

Current gap exposed:

The current product surfaces unplayable and hard counts, but the richer rejection reasons still live mostly in deeper diagnostics and debug-oriented tooling rather than in the main workflow.

## Touchpoint 2 — Scoring / Cost

Scoring matters after the user has something to evaluate or compare.

Where cost metrics appear:

- diagnostics summaries
- candidate comparison
- passage-level difficulty views
- selected-event and transition detail

What the user is trying to learn from them:

- which layout is better overall
- which passages got easier or harder
- which factor is causing pain
- whether a local improvement created a global penalty elsewhere

How scoring helps compare layouts and candidates:

- it gives a compact way to rank options
- it reveals tradeoffs instead of forcing a yes/no judgment
- it lets the user compare similar-looking layouts that behave differently over time

Why factor-level explanations matter:

- a single total score cannot tell the user whether the issue is movement, stretch, drift, fatigue, crossover, or repeated same-finger pressure
- the user needs to know what to change next, not just that something is worse

Current gap exposed:

The current codebase has real factorized metrics, but score semantics are still hard to read consistently. Different surfaces use overall score, execution cost, and percentage-like candidate labels in ways that can confuse the reviewer.

## Touchpoint 3 — Diversity / Alternatives

When users ask for alternatives, they are asking for meaningful variety, not multiple copies of the same idea.

What users expect:

- distinct layout strategies
- distinct tradeoff profiles
- alternatives that are still relevant to the same performance problem

Why alternatives must differ meaningfully:

- otherwise compare mode teaches nothing
- the user cannot discover tradeoffs if every option is a near-duplicate
- the product promise of exploration depends on visible difference

How locks and hard constraints may reduce diversity:

- fixed Kick/Snare placements can compress the search space
- strong hand or finger rules can force similar execution outcomes
- highly dense or highly constrained material may only allow a small number of viable layouts

How low-diversity output should be explained in the UX:

- "alternatives are limited because locked placements leave little room to move"
- "all feasible solutions collapse toward the same cluster"
- "three candidates requested, two meaningfully distinct found"

Current gap exposed:

The current candidate generation is useful but still narrow. In practice it is mostly baseline, compact-right, and compact-left, which is a real starting point but not yet a strong product-level diversity story.

## Touchpoint 4 — Diagnostics / Explainability

Diagnostics should answer clear user questions, not just expose internal numbers.

Where diagnostics should appear:

- aggregate diagnostics for the currently evaluated layout state
- passage-level hotspot summaries
- event-level and transition-level detail
- comparison explanations between alternatives

What diagnostics should answer:

- Is this feasible?
- If it is feasible, what is hard?
- Where is the burden concentrated?
- Which factor dominates?
- What changed between two options?
- What should I try next?

What distinctions must remain visible:

- feasibility
- ergonomics
- performance difficulty

Those are related but not identical:

- feasibility asks whether it can be played at all
- ergonomics asks whether the posture and movement are sensible
- performance difficulty asks how hard it is in real sequence and tempo context

Current gap exposed:

The current product already has diagnostics, event detail, transition detail, candidate comparison, and debug tooling, but those surfaces do not yet form one clean explainability ladder for the user.

## Touchpoint 5 — Event Analysis

Event analysis matters because layout quality is ultimately experienced one moment and one transition at a time.

How event analysis relates to the Active Layout or Working/Test Layout:

- it must always be tied to the specific layout state under evaluation
- it must show how that layout assigns fingers and hand movement to a specific Performance Event or transition

What it should teach the user:

- which Pads are active at the selected moment
- which fingers are being used
- what moves next
- what local factor is causing the spike
- whether a different placement would likely help

How it differs from a generic score summary:

- score summary tells the user that something is hard
- event analysis tells the user exactly where, why, and how it is hard

Current gap exposed:

The current workspace has useful event and transition detail, but event analysis still reads like embedded support panels rather than a fully named workflow touchpoint.

## Workflow Requirements Implied by Engine Touchpoints

The workflow implies that the engine must eventually support:

- feasibility verdicts that distinguish impossible from merely awkward
- factorized scores rather than one opaque number
- layout-bound Execution Plan outputs with clear Finger Assignments
- candidate comparison support at overall, passage, and local levels
- diversity-aware alternative generation
- lock-aware generation behavior
- human-readable explanations for hard passages and bad transitions

These are product-contract requirements. They say what the workflow needs from the engine, not how the engine must be implemented internally.

## Current Gaps Exposed

- Feasibility explanation is still stronger in debug-oriented surfaces than in the main UX.
- Score semantics are not yet consistent enough across diagnostics, candidate buttons, and overall summaries.
- Diversity output is currently narrower than the product language implies.
- Compare, diagnostics, and event analysis are all present, but they are not yet organized as one clear explainability stack.
- The current product does not clearly separate committed layout truth from candidate display state, which weakens trust in any engine-backed explanation.

## Recommendations

- Make feasibility a first-class verdict in the main workflow, not only a metric side effect.
- Normalize score language so overall score, execution cost, and passage difficulty are easy to interpret together.
- Explain low-diversity candidate sets explicitly rather than pretending variety where there is little.
- Tie every diagnostic view to a clearly labeled layout state.
- Treat event analysis as the final explanation layer that turns engine output into human understanding.

## What This Clarifies

- Why feasibility, scoring, diversity, diagnostics, and event analysis all matter to the workflow.
- Why engine output must be explainable, not just numerically strong.
- Why alternatives only help if they differ meaningfully.
- Why event analysis is the most human-readable place where engine logic becomes useful.
- Why the product contract should ask for verdicts, deltas, and explanations instead of solver internals.

## What Still Needs User Confirmation

- How strong the product’s default diversity promise should be.
- Whether the product should show infeasible candidates at all, or only surface them as rejected explanations.
- How much candidate explanation should be visible by default versus tucked into deeper diagnostics.
