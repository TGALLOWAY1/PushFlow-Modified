# V3 Implementation Alignment Package

This document turns the resolved merge policy into an implementation-ready contract for the PushFlow merge.

## Quick Read

- `Active Layout` is the preserved baseline.
- `Working/Test Layout` is the mutable draft used for experimentation.
- ordinary manual pad edits are not hard-preserved rules.
- explicit sound-panel locks are the real hard placement constraints.
- `Candidate Solution` generation must produce real alternatives, not baseline lookalikes.
- the only remaining user-input surface is unresolved preference classification.

## 1. Rewritten Decision Matrix

### Layout editing and promotion

| Action / Rule | Affected Entity | Classification | Preserved by Optimizer? | Can Alternatives Differ? | Persistence Scope | UI Affordance | Notes |
|---|---|---|---|---|---|---|---|
| manually place sound on pad | Working `Layout` mapping | Working/test state | No | Yes | Session-scoped until saved or promoted | Drag/drop onto `Pad`; working-draft badge; compare-to-active shortcut | Exploratory edit by default |
| move sound | Working `Layout` mapping | Working/test state | No | Yes | Session-scoped until saved or promoted | Drag between pads; changed-pad highlight | If the sound is locked, the move must be blocked or routed through explicit conflict handling |
| swap sounds | Working `Layout` mapping | Working/test state | No | Yes | Session-scoped until saved or promoted | Swap action; dual diff highlight | Still draft state |
| remove sound to unassigned | Working `Layout` mapping + sound assignment state | Working/test state | No | Yes | Session-scoped until saved or promoted | Remove action returns sound to unassigned list | Removal clears the current binding only |
| discard working layout changes | Working draft `Layout` + working execution draft | Working/test state | No | Yes | Session-scoped only | Revert/discard action with unsaved-change warning | Must restore the current `Active Layout` cleanly |
| save layout variant | Saved `Layout` variant set | Active baseline state | Yes, as a saved artifact | Yes | Project-scoped, persisted | Save-as-variant dialog with required name | Saves the draft without making it active |
| promote working layout to active | Active `Layout` selection | Active baseline state | Yes, after promotion | Yes, relative to the new baseline | Project-scoped, persisted | Promote button, confirmation sheet, active marker update | This is when draft state becomes the new baseline |

### Constraints and scoring rules

| Action / Rule | Affected Entity | Classification | Preserved by Optimizer? | Can Alternatives Differ? | Persistence Scope | UI Affordance | Notes |
|---|---|---|---|---|---|---|---|
| explicit sound placement lock | Explicit placement lock set | Explicit hard constraint | Yes | No, standard generation must respect it | Project-scoped, persisted | Lock icon in sound panel and lock badge on assigned `Pad` | Lock is keyed by sound identity to a required `Grid Position (row,col)` |
| remove explicit lock | Explicit placement lock set | Explicit hard constraint | No, after removal | Yes | Project-scoped, persisted | Unlock action from sound panel; constraint count updates immediately | Unlocking does not create a fallback preference |
| per-sound hand preference | Per-sound scoring prior | Soft scoring bias | No | Yes | Project-scoped, persisted | Hand-preference control; honored/violated status in diagnostics | Default recommendation: soft bias |
| per-sound finger preference | Per-sound scoring prior | Soft scoring bias | No | Yes | Project-scoped, persisted | Finger-preference control; honored/violated status in diagnostics | Default recommendation: soft bias |
| natural hand pose | Pose profile / ergonomic prior | Soft scoring bias | No, not as a hard lock | Yes | Project-scoped, persisted | Pose editor plus pose-aware analysis language | Core modeling primitive, not a casual option |
| finger capability region rule | Feasibility rule set | Explicit hard constraint | Yes | No | Project-scoped or engine-config-scoped, persisted | Constraint explanation when a proposal is illegal | This replaces exact pad-to-single-finger lock semantics |
| anti-conflict uniqueness rule for pad ownership | Layout/execution ownership rule | Explicit hard constraint | Yes | No | Canonical rule, persisted in model/config | Direct conflict error in diagnostics and candidate rejection messaging | No ambiguous multi-finger ownership of the same `Pad` |

### Analysis and metadata behavior

| Action / Rule | Affected Entity | Classification | Preserved by Optimizer? | Can Alternatives Differ? | Persistence Scope | UI Affordance | Notes |
|---|---|---|---|---|---|---|---|
| event-driven manual edit | Working `Execution Plan` assumptions and possibly Working `Layout` | Working/test state | Preserve for the current working draft only | Yes | Session-scoped until saved, promoted, or discarded | Event Analysis edit controls labeled as working-draft changes | Default interpretation is broader working-state edit |
| analysis-only filter/toggle | Analysis session state | Temporary analysis-only input | Only for the current run/view | Yes | Session-scoped only | Filter chips, compare toggle badges, overlay toggles | Must never silently become project truth |
| metadata edits | Sound/project metadata | Metadata only | Yes, as metadata | No | Project-scoped, persisted | Standard metadata editors; propagation across palette, grid, timeline, compare | Includes sound name, color, group, and labels |

## 2. State Model

### `Active Layout`

Represents: the preserved baseline `Layout` for the `Project`.

Changes when: the user explicitly promotes a working draft or explicitly activates a saved variant.

Persisted: yes.

Affects optimizer inputs: yes, as the default baseline and default generation source.

Affects compare mode: yes, it is the default compare reference.

Scope: layout-scoped within the project.

### `Working/Test Layout`

Represents: the mutable exploratory `Layout` draft derived from the current baseline.

Changes when: the user places, moves, swaps, removes, or clears sound assignments, or otherwise edits the draft.

Persisted: no by default. It becomes durable only if saved as a variant or promoted.

Affects optimizer inputs: yes, when the user analyzes the draft or intentionally generates from it.

Affects compare mode: yes, it is the primary draft-vs-baseline compare subject.

Scope: session-scoped draft attached to the current layout context.

### `Saved Layout Variant`

Represents: a durable named alternative `Layout`.

Changes when: the user saves a draft as a variant, renames a variant, or deletes one.

Persisted: yes.

Affects optimizer inputs: only when the user explicitly activates it or uses it as a generation source.

Affects compare mode: yes, it can be a compare target or later become the new baseline.

Scope: project-scoped collection of layout artifacts.

### `Explicit Placement Locks`

Represents: the set of sound-placement rules that the optimizer must preserve.

Changes when: the user explicitly locks or unlocks a sound from the sound panel, or explicitly replaces locked state during promotion.

Persisted: yes.

Affects optimizer inputs: yes, always.

Affects compare mode: yes, compare and promotion must show lock conflicts.

Scope: project-scoped constraint set keyed by sound identity.

### `Finger Capability / Allowed Region Rules`

Represents: canonical feasibility rules that define which `Finger Assignment` values are legal for which `Pad` and zone contexts.

Changes when: model or engine configuration changes, not ordinary editing.

Persisted: yes.

Affects optimizer inputs: yes, always.

Affects compare mode: indirectly, through validity and diagnostics.

Scope: project-scoped or engine-config-scoped.

### `Execution Plan / Finger Assignment` state

Represents: either a derived solver output or a working execution draft for the current performance.

Changes when: the solver runs, the user selects a candidate, or the user makes an event-driven manual edit that changes the working execution interpretation.

Persisted: candidate execution plans may persist with candidates; working execution drafts do not persist unless they are saved or promoted through a durable artifact.

Affects optimizer inputs: yes.

Affects compare mode: yes, event and candidate compare depend on it.

Scope: candidate-scoped or session-scoped draft, depending on source.

### Analysis session state

Represents: compare targets, selected event, filters, overlays, stale flags, and the current analyzed subject.

Changes when: the user changes view state, compare state, or reruns analysis.

Persisted: no.

Affects optimizer inputs: only as temporary scoped inputs for the current run or view; never as canonical truth.

Affects compare mode: yes, this is the compare/view control layer.

Scope: session-scoped.

### Required invariants

- Exploratory edits must never silently mutate the `Active Layout`.
- Explicit placement locks must be stored separately from ordinary `Layout` assignment state.
- Generated alternatives must differ meaningfully from the `Active Layout` unless true hard constraints make divergence impossible.
- Analysis-only state must never silently persist as canonical project truth.
- No ambiguous multi-finger ownership of the same `Pad` is allowed in the relevant `Layout` or `Execution Plan` representation.
- Working execution edits and working layout edits must stay synchronized enough that grid state, event analysis, and diagnostics describe the same tested state.
- Promotion is the only path by which working or candidate state becomes the new active baseline.
- Saved variants remain durable without silently becoming active.
- A locked sound placement cannot be invalidated by ordinary drag/drop.

## 3. Solver Contract

### Hard constraints

Only these inputs should be enforced as non-negotiable:

- canonical `Performance Event` timing and sound identities
- instrument bounds and valid `Grid Position` values
- explicit sound placement locks represented as `soundId -> required Grid Position`
- finger capability and allowed-region rules
- hard ergonomic feasibility rules
- anti-conflict uniqueness rules preventing ambiguous multi-finger pad ownership

### Soft biases

These inputs should affect scoring and ranking, but may be violated with explanation:

- `Natural Hand Pose`
- per-sound preferred hand
- per-sound preferred finger
- hand-zone defaults or tendencies
- compactness and locality preferences
- other ergonomic ranking priors that are not part of legal feasibility

### Baseline and context inputs

These inputs define the run context without automatically becoming preserved rules:

- declared source `Layout`: `Active Layout` or `Working/Test Layout`
- selected pose profile
- saved layout variant chosen as source
- current sound identities and project metadata
- prior `Candidate Solution` used as a compare reference

### Analysis-only inputs

These inputs may shape the current view or scoped analysis, but must never silently become persistent solver truth:

- muted or hidden sounds used only for the current analysis pass
- compare toggles and overlay controls
- selected event or time slice for single-event diagnostics
- temporary diagnostic focus filters

### Operational rules

#### Using the active layout for generation

- `Active Layout` is the default baseline reference for generation.
- Candidate diversity is measured against the `Active Layout`, even if the run seeds from a working draft.

#### Using the working layout for manual analysis

- `Working/Test Layout` is the source state for exploratory analysis.
- Solver output from that run is a working-draft `Execution Plan`, not a replacement of the active baseline.
- Diagnostics must label the analyzed subject as `Working Layout`.

#### Representing explicit locked placements

- Locked placements must be stored separately from `Layout.padToVoice`.
- Minimum shape: `lockedPlacements: Record<soundId, GridPosition>`.
- The solver must reject or repair any candidate that violates a locked placement before ranking it.

#### Applying finger capability zones

- Model them as legal or illegal assignment predicates, not as sticky pad-level finger picks.
- Invalid `Finger Assignment` proposals must be pruned before scoring.
- Diagnostics must name the violated capability rule.

#### Enforcing candidate diversity

- A candidate counts as real only if it changes at least one unlocked sound placement relative to the `Active Layout`, or produces a materially different `Execution Plan` tradeoff profile when movement is blocked by hard constraints.
- Near-duplicates should be rejected after hard-constraint filtering.
- Baseline copies should not win ranking simply because they are safe.

#### Saved variants and promoted layouts

- Promoted layouts become the new `Active Layout` baseline for later runs.
- Saved variants affect future runs only when explicitly activated or chosen as the source state.
- Analysis-only muted or hidden scope should not feed generation. Generation should use full canonical `Performance Event` truth unless the product later adds an explicit scoped-generation mode.

## 4. UI Workflow Contract

### A. Manual test edit

Source state: `Active Layout` baseline, with an empty or existing `Working/Test Layout` draft.

User action: move, place, swap, or remove sound assignments on the grid.

State transition: create or update the `Working/Test Layout`; leave `Active Layout` unchanged.

Persistence behavior: keep only in session unless saved as a variant or promoted.

Optimizer impact: rerun analysis against the working draft when the user analyzes the edited state.

Required UI indicators: working-draft badge, changed-pad highlights, compare-to-active entry point, and a clear analyzed-subject label.

Failure or conflict handling: if the edit conflicts with an explicit placement lock, require unlock or explicit conflict resolution instead of silently overriding the lock.

### B. Lock a sound placement

Source state: a sound already assigned to a `Pad`.

User action: click the lock icon in the sound panel.

State transition: add or update an explicit placement lock for that sound’s current `Grid Position`.

Persistence behavior: persist immediately as project-scoped constraint state.

Optimizer impact: all future solver and generation runs must preserve that placement unless the lock is removed or explicitly replaced during promotion.

Required UI indicators: lock badge in the sound panel, lock marker on the assigned `Pad`, and diagnostics count of active hard placement locks.

Failure or conflict handling: locking is unavailable for unassigned sounds. Later conflicts must surface an explicit replacement flow.

### C. Save alternative layout

Source state: current `Working/Test Layout` draft.

User action: save as named variant.

State transition: create a `Saved Layout Variant`; keep `Active Layout` unchanged.

Persistence behavior: persist the variant and keep the working draft open so iteration can continue.

Optimizer impact: none until the variant is activated or chosen as the generation source.

Required UI indicators: save dialog, named variant entry, and separate markers for active baseline versus saved alternatives.

Failure or conflict handling: if the variant conflicts with explicit locks, allow save but mark the conflict so later activation or promotion requires review.

### D. Promote to active

Source state: current `Working/Test Layout` or selected `Candidate Solution`.

User action: promote or accept.

State transition: selected layout becomes the new `Active Layout`.

Persistence behavior: persist the new active baseline immediately.

Optimizer impact: future analysis, compare, and candidate diversity checks use the new baseline.

Required UI indicators: confirmation sheet, before/after diff summary, explicit list of changed locked placements if relevant, and updated active marker.

Failure or conflict handling: if promotion would replace explicit locked state, require explicit replacement confirmation before completion.

### E. Revert or discard

Source state: existing `Working/Test Layout` and optional working execution draft.

User action: discard or revert.

State transition: clear working draft state and restore the view to `Active Layout`.

Persistence behavior: do not persist the discarded draft.

Optimizer impact: subsequent analysis returns to active-baseline inputs.

Required UI indicators: unsaved-change warning before discard and removal of working-draft indicators after discard.

Failure or conflict handling: if no working draft exists, disable the action or make it a clear no-op.

### F. Generate alternatives

Source state: declared source state, either `Active Layout` or intentionally selected `Working/Test Layout`.

User action: generate alternatives.

State transition: create a set of `Candidate Solution` artifacts without mutating the active baseline.

Persistence behavior: candidate sets may persist for review; generation metadata must include the source state.

Optimizer impact: preserve explicit hard constraints, use soft biases for ranking, and return meaningfully different alternatives.

Required UI indicators: generation source label, per-candidate diff versus active baseline, hard-constraint compliance summary, and soft-bias violation summary.

Failure or conflict handling: if hard constraints collapse the search space, say that divergence was blocked by constraints rather than implying the system ignored the diversity requirement.

## 5. Preference / Constraint Classification Questions

Only unresolved preference-classification questions appear here.

### Per-sound preferred hand

Current best interpretation: sound-specific hand tendency that should usually guide ranking.

Likely default classification: `Soft scoring bias`.

Why it matters: this determines whether user hand intent is advisory or binding.

User choice: `A)` keep it soft only `B)` allow an optional hard mode later.

### Per-sound preferred finger

Current best interpretation: sound-specific finger tendency for comfort or technique.

Likely default classification: `Soft scoring bias`.

Why it matters: this changes how strongly the system preserves a user’s preferred technique.

User choice: `A)` keep it soft only `B)` allow an optional hard mode later.

### Hand-zone defaults

Current best interpretation: left/right zone tendencies used when no stronger rule applies.

Likely default classification: `Soft scoring bias`.

Why it matters: this determines whether zone realism is advisory or partially binding.

User choice: `A)` all soft `B)` some outer-zone limits hard.

### Compactness / locality preference

Current best interpretation: preference for keeping related sounds spatially close.

Likely default classification: `Soft scoring bias`.

Why it matters: this materially affects candidate ranking and diversity behavior.

User choice: `A)` scoring only `B)` add minimum locality rules.

### Dominant-finger preference

Current best interpretation: preference for keeping stronger fingers on higher-frequency or higher-demand sounds.

Likely default classification: `Soft scoring bias`.

Why it matters: this affects explainability and technique realism.

User choice: `A)` keep it soft `B)` make it partially hard in specific contexts.

### Weak-finger avoidance

Current best interpretation: avoid assigning frequent or difficult passages to weaker fingers when possible.

Likely default classification: `Soft scoring bias`.

Why it matters: this can materially change candidate ordering.

User choice: `A)` keep it as bias only `B)` treat some patterns as infeasible.

### Repetition comfort / fatigue bias

Current best interpretation: penalize repeated use of the same finger or hand over time.

Likely default classification: `Soft scoring bias`.

Why it matters: this affects long-passages and real performance comfort.

User choice: `A)` keep it cost-based `B)` add hard exhaustion thresholds.

### Layout symmetry preference

Current best interpretation: prefer visually or physically symmetric layouts when available.

Likely default classification: `Soft scoring bias`.

Why it matters: if symmetry matters, it can materially influence candidate ranking and generation.

User choice: `A)` omit it `B)` include it as a soft bias.

## 6. Implementation-Oriented Merge Impact

### State and store shape

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/state/ProjectContext.tsx`
- `product-reconciliation/v2/v2 repo/src/types/layout.ts`
- `product-reconciliation/v2/v2 repo/src/types/candidateSolution.ts`
- `product-reconciliation/v2/v2 repo/src/types/executionPlan.ts`

Mismatch to look for:

- active baseline, editable layout, and analysis cache are still conflated
- `Layout` still carries `fingerConstraints` as pad-level sticky state

Refactor needed:

- split active versus working state
- separate explicit placement locks from ordinary layout assignment
- add working execution draft state

### Persistence layer

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/persistence/projectStorage.ts`
- `product-reconciliation/v2/v2 repo/src/ui/fixtures/demoProjects.ts`

Mismatch to look for:

- persistence currently saves one mutable project shape without explicit draft or lock separation

Refactor needed:

- persist active layout, saved variants, explicit placement locks, pose profile, and bias settings
- keep session-only state out of persistence

### Compare flow

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CandidateCompare.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CompareGridView.tsx`

Mismatch to look for:

- compare likely treats candidate and current state generically without strong baseline labeling

Refactor needed:

- make compare explicitly baseline-relative
- support `Active` vs `Working` and `Active` vs `Candidate`

### Candidate generation flow

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/hooks/useAutoAnalysis.ts`
- `product-reconciliation/v2/v2 repo/src/engine/optimization/multiCandidateGenerator.ts`
- `product-reconciliation/v2/v2 repo/src/engine/mapping/mappingResolver.ts`

Mismatch to look for:

- generation still starts from mutable current state
- pad-level finger constraints are still promoted into hard manual assignments

Refactor needed:

- rebuild generation input construction around declared source state
- preserve only true hard constraints
- enforce meaningful diversity

### Active-layout promotion flow

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/components/EditorToolbar.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/PerformanceWorkspace.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`

Mismatch to look for:

- promotion, save-as-variant, and ordinary editing are not clearly separated

Refactor needed:

- add explicit promote, save-as-variant, and discard flows
- add conflict review for locked-state replacement

### Event-analysis integration

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/components/EventDetailPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/TransitionDetailPanel.tsx`
- `product-reconciliation/v1/v1 Repo/src/workbench/EventAnalysisPanel.tsx`

Mismatch to look for:

- event detail still exposes pad-level finger constraint controls
- current semantics still imply local override behavior

Refactor needed:

- convert event edits into working execution-draft edits
- remove exact pad-finger lock policy
- keep event, grid, and diagnostics synchronized

### UI indicators for active, working, and locked state

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/components/VoicePalette.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/InteractiveGrid.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/PerformanceWorkspace.tsx`

Mismatch to look for:

- UI currently exposes stream-level hand/finger controls but not explicit placement-lock controls or draft-state signaling

Refactor needed:

- add sound-panel lock control
- add active and working badges
- add changed-pad highlights
- add visible conflict states

### Solver input builder

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/hooks/useAutoAnalysis.ts`
- `product-reconciliation/v2/v2 repo/src/engine/solvers/beamSolver.ts`
- `product-reconciliation/v2/v2 repo/src/engine/prior/feasibility.ts`
- `product-reconciliation/v2/v2 repo/src/engine/surface/handZone.ts`

Mismatch to look for:

- hard, soft, baseline, and analysis-only inputs are not cleanly separated

Refactor needed:

- build an explicit solver contract object separating hard constraints, soft biases, baseline source, and analysis-only inputs

### Diagnostics output

Inspect:

- `product-reconciliation/v2/v2 repo/src/ui/components/DiagnosticsPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/pages/OptimizerDebugPage.tsx`
- `product-reconciliation/v2/v2 repo/src/engine/analysis/constraintExplainer.ts`
- `product-reconciliation/v2/v2 repo/src/engine/debug/candidateReport.ts`

Mismatch to look for:

- diagnostics may still blur feasibility, ergonomics, difficulty, and baseline-versus-draft context

Refactor needed:

- report the analyzed subject
- separate hard-constraint conflicts from soft-bias violations
- explain candidate divergence from the active baseline

## 7. Final Output

### A. Resolved and ready for implementation

- Ordinary manual sound placement, movement, swapping, and removal are `Working/Test Layout` edits by default.
- `Active Layout` is the preserved baseline and cannot be silently mutated by exploratory interaction.
- Explicit sound-panel placement locks are the real hard-preserve placement rule.
- Exact persistent pad-to-single-finger locks are not part of the canonical model.
- Finger capability regions, hard ergonomic feasibility rules, and pad-ownership uniqueness rules are the real hard constraint layer.
- Event-driven manual edits default to working layout and execution changes, not tiny isolated overrides.
- `Natural Hand Pose` is a core modeling primitive used for seeding, scoring, and diagnostics.
- `Candidate Solution` generation must return genuinely different alternatives unless hard constraints make that impossible.
- Promotion, save-as-variant, and discard are distinct workflows and must stay distinct.

### B. Needs user input

- per-sound preferred hand classification
- per-sound preferred finger classification
- whether any hand-zone boundaries should become hard limits
- whether compactness or locality needs any hard minimum rule
- whether dominant-finger preference is ever partially hard
- whether weak-finger avoidance should stay purely bias-based
- whether fatigue should remain cost-based or include hard thresholds
- whether layout symmetry should be modeled at all

### C. Recommended implementation order

1. Split `Active Layout`, `Working/Test Layout`, saved variants, and explicit placement locks in the state model and persisted schema.
2. Replace pad-level finger-lock semantics with explicit placement locks plus capability-region and feasibility rules in the solver contract.
3. Add working-versus-active-versus-candidate UI indicators, plus explicit save, discard, promote, and lock workflows.
4. Rebuild the solver input builder and candidate generator around declared source state, true hard constraints, and diversity enforcement.
5. Rewire Event Analysis so manual event edits feed the working-draft model instead of hidden local overrides.
6. Update diagnostics and compare views so every run explains baseline source, hard-constraint compliance, soft-bias violations, and candidate divergence.
