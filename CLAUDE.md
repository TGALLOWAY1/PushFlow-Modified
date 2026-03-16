# CLAUDE.md
## Project
PushFlow V3 is being defined from a workflow-first product contract before deep re-engineering begins.
This workspace contains:
- canonical V3 workflow and planning artifacts
- a V2 codebase used as the primary salvage source
- a V1 codebase used as a secondary salvage source
The goal is to turn approved workflow decisions into a clear implementation path without letting legacy structure dictate the product.
## Canonical Source Of Truth
Read these first for any planning or implementation work:
1. `product-reconciliation/output/PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`
2. `product-reconciliation/output/PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md`
3. `product-reconciliation/output/PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md`
4. `product-reconciliation/output/PUSHFLOW_SOURCE_ARTIFACT_INDEX.md`
Rules:
- These four files are the only planning source of truth.
- If older docs conflict with them, the canonical files win.
- Do not treat archived artifacts as active requirements.
## Historical Reference Material
Use these only to salvage useful elements or understand regressions:
- Primary salvage codebase: `product-reconciliation/v2/v2 repo`
- Secondary salvage codebase: `product-reconciliation/v1/v1 Repo`
Use V1 and V2 docs as reference material only.
They do **not** determine current product direction.
Do not use these as source of truth:
- `product-reconciliation/v1/archive/exported-doc-bundles/`
- `product-reconciliation/v2/archive/exported-doc-bundles/`
- `product-reconciliation/v2/v2 repo/Version1/`
- `product-reconciliation/output/archive/`
- `archive/superseded-workflow-artifacts/`
## Product Mission
PushFlow is a performance-mapping and playability-analysis tool for Push.
The product helps the user:
- define stable Sound identity
- inspect an Active Layout
- explore a Working/Test Layout
- analyze feasibility and difficulty
- generate Candidate Solutions
- compare alternatives
- save a Saved Layout Variant
- promote one choice to become the new Active Layout
- inspect difficult passages with event analysis
The product promise is not "generate a layout."
The product promise is: converge on a Layout plus Execution Plan that is playable, understandable, and worth keeping.
## Canonical Terms
Use these terms precisely:
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
Additional rules:
- `Project` is the top-level container.
- There is one canonical performance timeline per project.
- `Execution Plan` is derived from a specific layout state.
- `Candidate Solution` is a proposal, not hidden project truth.
## State And Workflow Rules
These are non-negotiable unless the canonical docs change:
- Manual edits default to `Working/Test Layout`.
- Ordinary manual edits are exploratory, not hard-preserved constraints.
- `Promote` is the normal path that makes a layout the new `Active Layout`.
- `Save as variant` creates a durable `Saved Layout Variant` without changing active baseline.
- `Discard` abandons the `Working/Test Layout` and returns to `Active Layout`.
- Explicit placement locks are the hard user-facing placement rule.
- Hand/finger preferences are soft unless explicitly elevated later.
- Compare is read-only.
- Analysis-only state is not project truth.
## Engine Touchpoint Contract
The engine exists to support:
- manual testing
- layout evaluation
- alternative generation
- comparison
- explainability
The workflow depends on:
- clear feasibility verdicts
- one coherent cost story
- factorized diagnostics
- meaningful diversity relative to the `Active Layout`
- layout-bound `Execution Plan` outputs
- event-level explanations
- stable `Sound identity`
Do not let engine internals outrun the approved workflow contract.
## Current Workspace Reality
The workspace is primarily reconciliation and salvage material.
There is not yet a single clean V3 implementation root.
Working assumptions:
- V2 is the main codebase to reshape
- V1 is a reference for salvageable interaction ideas, validation habits, and missing capabilities
- Any deep rewrite must be justified against the canonical workflow and implementation sequence
## Priority Implementation Order
Unless there is a direct blocker, implementation should generally follow this order:
1. Align product state and persistence with the approved workflow
2. Align solver inputs with workflow concepts
3. Unify feasibility, scoring, and diagnostics
4. Make candidate generation baseline-aware
5. Tighten compare and event analysis
6. Only then consider deeper engine refactor
Do not jump to solver-family redesign first.
## Agent Behavior Expectations
Before changing code:
- read the canonical docs
- inspect relevant files
- identify current state boundaries and invariants
- explain the mismatch between current code and approved workflow
When planning:
- optimize for workflow clarity first
- be explicit about what is salvageable from V2 and V1
- separate resolved decisions from open questions
- use defaults from the canonical decisions doc when possible
- avoid giant matrices and duplicate planning artifacts
When implementing:
- prefer surgical changes over broad rewrites
- avoid duplicate sources of truth
- do not hide bad state modeling behind UI patches
- do not silently convert analysis-only state into persistent truth
- preserve explainability and debuggability
## Default Decision Handling
If a still-open question blocks progress, use these defaults unless the user says otherwise:
- `Working/Test Layout` is session-scoped unless saved or promoted
- replaced `Active Layout` should be auto-saved if it can be done cleanly
- per-sound hand/finger preferences are deferred unless clearly soft
- a real `Candidate Solution` must show at least one unlocked placement change or a materially different tradeoff profile
- inline event analysis can ship before a dedicated event-analysis mode if sequencing is tight
## Expected Deliverables
For implementation plans, provide:
1. Objective
2. Current-state reading
3. Gap analysis against canonical workflow
4. Salvage strategy
5. Phase-by-phase implementation sequence
6. Validation and exit criteria
7. Risks
8. Only truly blocking open questions
For code changes, provide:
1. What changed
2. Why it changed
3. Files affected
4. Validation performed
5. Residual risks
## Validation Expectations
Prefer:
- deterministic tests around state transitions
- validation of Active vs Working vs Candidate behavior
- persistence checks
- feasibility/scoring consistency checks
- candidate diversity checks
- compare-mode correctness
- event-analysis correctness on simple known passages
If simple cases fail, stop trusting complex cases.
## Final Reminder
Do not let legacy docs, current file structure, or existing engine internals define the product by accident.
The canonical workflow and product contract come first.
The historical codebases exist to be salvaged selectively, not obeyed.
