# PushFlow Source Artifact Index

## Purpose

This index maps the older planning and audit artifacts to the canonical review set and organizes the V1/V2 documentation as salvage-reference material.

## Canonical Source Of Truth

After this consolidation pass, the canonical files to review are:

- `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`
- `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md`
- `PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md`
- `PUSHFLOW_SOURCE_ARTIFACT_INDEX.md`

These four files determine the current workflow, product contract, decision set, engine touchpoints, and sequencing direction.

The V1 and V2 docs do not determine how PushFlow will be developed. They are reference material only, used to identify what can be salvaged, learned from, or intentionally not repeated from the two earlier codebases.

Archive locations:

- legacy output planning docs: `product-reconciliation/output/archive/legacy-planning-artifacts/`
- earlier root-level workflow drafts: `archive/superseded-workflow-artifacts/`
- V1 exported doc bundle archive: `product-reconciliation/v1/archive/exported-doc-bundles/v1 docs/`
- V2 exported doc bundle archive: `product-reconciliation/v2/archive/exported-doc-bundles/v2 docs/`

## V1 And V2 Salvage Reference Organization

### How To Read These Folders

- Start with the four canonical files above.
- Use V1 and V2 docs only when you need salvage evidence, screen/workflow precedent, terminology history, or technical lessons from the older codebases.
- If a V1 or V2 doc conflicts with a canonical doc, the canonical doc wins.
- Archived exported doc bundles are mirror material, not primary references.

### V1 Reference Layers

| Reference location | Status | Use | Note |
|---|---|---|---|
| `product-reconciliation/v1/v1 Repo/*.md` | salvage reference | Product model, task flows, screen architecture, wireframes, and design gaps from the V1 codebase. | Best starting point for understanding what V1 was trying to be. |
| `product-reconciliation/v1/v1 Repo/docs/` | salvage reference | V1 implementation-facing docs such as architecture, terminology, MIDI workflow, workbench behavior, roadmap, and backlog. | Useful when tracing feature intent into the V1 implementation. |
| `product-reconciliation/v1/v1 Repo/docs/audit/` | salvage reference | Audit findings about state, UI, bugs, cleanup, risk, and maintainability inside V1. | Use to understand failure modes, not to define V3 scope directly. |
| `product-reconciliation/v1/v1 Repo/docs/product-synthesis/` | salvage reference | Synthesized V1 workflow, terminology, state, screen, and feedback interpretations. | Helpful bridge material when comparing V1 intent against the canonical contract. |
| `product-reconciliation/v1/archive/exported-doc-bundles/v1 docs/` | archive only | Historical exported mirror of V1 product docs and synthesis docs. | Archived because it duplicated repo-native docs and added confusion about which copy to consult. |

### V2 Reference Layers

| Reference location | Status | Use | Note |
|---|---|---|---|
| `product-reconciliation/v2/v2 repo/*.md` | salvage reference | V2 product model, feature inventory, terminology, milestones, PRDs, and top-level workflow intent. | Best starting point for understanding V2 direction and explicit product framing. |
| `product-reconciliation/v2/v2 repo/docs/` | salvage reference | V2 canonical spec, UX audit, debugging tools, terminology, repo map, and restructure planning. | Useful for understanding V2 implementation shape and where it drifted from product goals. |
| `product-reconciliation/v2/v2 repo/docs/product-synthesis/` | salvage reference | Synthesized V2 workflow, screen, state, terminology, and visualization interpretation. | Helpful for comparing V2 intent with the canonical V3 workflow contract. |
| `product-reconciliation/v2/v2 repo/tasks/` | salvage reference | Focused audit and planning notes around engine, UX, solver, and verification work. | Use as planning evidence only where it supports workflow-approved sequencing. |
| `product-reconciliation/v2/v2 repo/Version1/` | archive only | Embedded legacy V1 copy that traveled with the V2 repo. | Treat as duplicate historical material, not as a separate source of truth. |
| `product-reconciliation/v2/archive/exported-doc-bundles/v2 docs/` | archive only | Historical exported mirror of V2 product docs and synthesis docs. | Archived because it duplicated repo-native docs and increased reference sprawl. |

## Source Mapping

| Original filename | Status | Canonical destination file | Brief note on value contributed |
|---|---|---|---|
| `PHASE_1_ENGINE_REFACTOR_REPORT.md` | partially merged | `PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md` | Contributed engine mismatches, touchpoints, and phased sequencing; deep refactor detail intentionally demoted. |
| `V3_ENGINE_AUDIT_INTEGRATION.md` | merged | `PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md`, `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Contributed workflow-relevant engine decisions, especially feasibility, scoring, locks, diversity, and diagnostics. |
| `V3_IMPLEMENTATION_ALIGNMENT_PACKAGE.md` | merged | `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`, `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md`, `PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md` | Contributed the clearest active/working/saved/candidate model plus promotion, save, discard, and implementation-order logic. |
| `V3_MERGE_PLAN_MANUAL_EDIT_RECONCILIATION.md` | merged | `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`, `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md`, `PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md` | Supplied the corrected manual-edit policy: ordinary edits are draft state, explicit locks are hard preserve. |
| `MANUAL_EDIT_DECISION_MATRIX.csv` | archive only | `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Kept only as historical record; matrix format and earlier policy assumptions are not canonical. |
| `MANUAL_EDIT_DECISION_MATRIX.md` | superseded | `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Contributed the preserve/soft/temp taxonomy, but its ordinary-manual-edit-as-hard-preserve policy was later corrected. |
| `V3_OPEN_QUESTIONS_FINAL.md` | merged | `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Main source for deduped remaining questions and for identifying which earlier questions were already resolved. |
| `V3_PRODUCT_DECISIONS.md` | merged | `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`, `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Contributed mission, user, workflow spine, terminology direction, and source-of-truth principles. |
| `V1_VS_V2_PRODUCT_COMPARISON.md` | partially merged | `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`, `PUSHFLOW_SOURCE_ARTIFACT_INDEX.md` | Contributed the clearest V1-vs-V2 synthesis and the reasoning for what V3 should keep from each. |
| `SALVAGE_MATRIX.md` | partially merged | `PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`, `PUSHFLOW_SOURCE_ARTIFACT_INDEX.md` | Contributed keep/merge/rewrite judgments and helped prioritize workflow, analysis, screen architecture, and state-model salvage. |
| `SALVAGE_MATRIX_EXPANDED_COMPARISON.md` | archive only | `PUSHFLOW_SOURCE_ARTIFACT_INDEX.md` | Rich historical comparison, but too large and repetitive to remain part of the canonical review package. |
| `V3_OPEN_QUESTIONS.md` | superseded | `PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md` | Early question list; fully replaced by the later reconciliation pass and the new canonical question set. |
| `V3_ARTIFACT_PLAN.md` | superseded | `PUSHFLOW_SOURCE_ARTIFACT_INDEX.md` | Useful for showing what artifact sprawl was trying to solve, but replaced by the new four-file canonical package. |

## How To Use This Index

- Review the four canonical files first.
- Use V1 and V2 repo-native docs only if you need salvage rationale from the older codebases.
- Use older output artifacts only if you need historical rationale for why the canonical package was formed.
- Treat anything marked `superseded` or `archive only` as non-canonical.

## Additional Archived Drafts

These were not part of the original output-sprawl list, but they were also superseded by the canonical package and moved out of the active review path:

- `PUSHFLOW_END_TO_END_WORKFLOW_REPORT.md`
- `PUSHFLOW_PAGE_RESPONSIBILITY_REPORT.md`
- `PUSHFLOW_STATE_TRANSITION_REPORT.md`
- `PUSHFLOW_ENGINE_TOUCHPOINT_REPORT.md`

They now live in `archive/superseded-workflow-artifacts/`.
