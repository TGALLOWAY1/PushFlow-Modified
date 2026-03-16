# PushFlow Decisions and Open Questions

## Purpose

This document is the canonical decision record for PushFlow.

It does two things only:

- records resolved decisions
- lists truly unresolved questions that still need user judgment

Everything else from the older reconciliation set is superseded by this split.

## Resolved Decisions

### Mission and scope

- PushFlow is a performance-mapping and playability-analysis product for Push.
- The primary workflow is not generic composition and not debug tooling.
- Imported and manually created performance material both feed the same canonical workflow.
- Pattern generation is not a core product pillar for the approved workflow.
- Export beyond project-level artifacts is not required to define the first approved workflow pass.

### User and workflow

- The primary user is adapting performance material for Push and needs to make it physically playable.
- Manual mapping is a primary capability, not a fallback.
- Single-event and transition-level difficulty inspection is a core function.
- Summary analysis, compare, and event analysis are distinct layers and should not be blurred together.
- Analyze current state and generate alternatives are different actions and must remain visibly different.

### Canonical state model

- `Project` is the canonical top-level container term.
- There is one canonical performance timeline per project.
- `Layout` is the canonical static mapping artifact.
- `Execution Plan` is derived from a specific layout state, not stored as free-floating truth.
- `Candidate Solution` is a proposal, not a second hidden project model.
- The product needs explicit distinction between:
  - `Active Layout`
  - `Working/Test Layout`
  - `Saved Layout Variant`
  - `Candidate Solution`

### Manual edit policy

- Ordinary manual grid edits belong to `Working/Test Layout` by default.
- Ordinary manual edits are exploratory, not hard-preserved constraints.
- `Promote` is the action that turns exploratory state into the new `Active Layout`.
- `Save as variant` keeps a durable alternative without changing the `Active Layout`.
- `Discard` abandons the working draft and returns the user to the `Active Layout`.

### Lock and constraint semantics

- Explicit placement locks are the canonical hard user-facing placement rule.
- Explicit locks preserve a sound identity at a specific `Grid Position`.
- Hard feasibility rules remain separate from soft ergonomic preference.
- Persistent exact pad-to-single-finger locking is not the main product rule.
- Event-level manual hand or finger edits are draft testing behavior by default, not silent permanent truth.
- Analysis-only filters and overlays are temporary inspection inputs, not persistent project truth.

### Sound identity and terminology

- Use `Sound identity` as the stable user-facing mapped object.
- Imported pitch remains provenance, not the only durable identity hook.
- Keep terminology consistent around:
  - `Layout`
  - `Active Layout`
  - `Working/Test Layout`
  - `Saved Layout Variant`
  - `Candidate Solution`
  - `Execution Plan`
  - `Finger Assignment`
  - `Performance Event`
  - `Pad`
  - `Grid Position`
  - `Sound identity`

### Diversity and comparison

- Candidate diversity must be measured relative to the `Active Layout`.
- Meaningful alternatives matter more than raw candidate count.
- Trivial duplicates should not be presented as useful alternatives.
- Compare must surface what changed, not just that scores differ.

### Analysis and debug separation

- User-facing analysis hierarchy should be:
  - summary diagnostics
  - compare
  - event analysis
  - internal debug
- Debug tooling remains internal and should not define the product vocabulary.

## Short Policy Summary

The approved contract is:

Start from an `Active Layout`, explore in a `Working/Test Layout`, use explicit locks for hard preserved placement, review `Candidate Solution` alternatives, save useful drafts as `Saved Layout Variant`, and promote one selected result to become the new `Active Layout`.

## Open Questions

Only questions that still materially affect the approved workflow remain here.

### 1. Should Working/Test Layout survive a full reload by default?

Why this matters:
This determines whether exploratory work is session-scoped or auto-recoverable.

Short answer needed:
`Yes, auto-recover the last draft` or `No, drafts disappear unless saved or promoted`.

Current default if unanswered:
No. Drafts are session-scoped unless saved or promoted.

### 2. When promoting a new Active Layout, should the previous Active Layout be auto-saved as a Saved Layout Variant?

Why this matters:
This affects recoverability and how safe promotion feels.

Short answer needed:
`Yes, always auto-save the replaced baseline` or `No, only save it when the user asks`.

Current default if unanswered:
Yes, if the product can do it cleanly without clutter; otherwise ask explicitly.

### 3. Are per-sound hand and finger preferences in MVP, or should they wait until the lock and draft model is stable?

Why this matters:
These preferences are useful, but they are easier to misunderstand than explicit placement locks.

Short answer needed:
`Include soft per-sound preferences in MVP` or `Defer them until after core state and lock behavior is stable`.

Current default if unanswered:
Defer unless they can be presented very clearly as soft guidance only.

### 4. What minimum difference qualifies a Candidate Solution as a real alternative?

Why this matters:
The workflow depends on meaningful diversity, not cosmetic variation.

Short answer needed:
Pick the minimum threshold:
`at least one unlocked placement move`, `or materially different tradeoff profile`, or `both`.

Current default if unanswered:
Require at least one unlocked placement change or a clearly different tradeoff profile.

### 5. Does dedicated Event Analysis ship in MVP, or immediately after workflow approval as the next layer?

Why this matters:
Event analysis is already part of the product contract, but release sequencing still affects implementation priority.

Short answer needed:
`Ship dedicated Event Analysis in MVP` or `Ship inline event analysis first, then dedicated mode next`.

Current default if unanswered:
Ship inline event analysis first, then dedicated mode immediately after core workflow approval if schedule is tight.

## Questions Removed as Duplicates or Already Resolved

The following are no longer open:

- `Project` vs `Song Project`
- whether imported and manual entry paths are both valid
- whether manual mapping is primary
- whether event-level difficulty analysis matters
- whether analyze and generate are distinct
- whether pattern generation is a core pillar
- whether export defines the first workflow pass

They were repeated across older files, but they are settled enough to stop treating as open.
