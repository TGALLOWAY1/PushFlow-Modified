# V3 Merge Plan Revision

This document supersedes the ordinary-manual-edit assumptions in `MANUAL_EDIT_DECISION_MATRIX.md` where they treated routine pad edits as hard-preserved constraints.

## Manual Edit / Active Layout / Alternative Generation Reconciliation

### Active Layout

The **Active Layout** is the preserved baseline `Layout` for the `Project`.

It is the default reference for:

- normal browsing
- current-layout analysis
- comparison reference
- Event Analysis reference
- default project persistence

The Active Layout is not silently mutated by exploratory editing. It changes only when the user explicitly promotes a Working Layout or `Candidate Solution` to active, or explicitly activates a previously saved variant.

### Working Layout / Test Layout

The **Working Layout** is the mutable exploratory `Layout` state used for:

- manual sound placement
- sound movement and swaps
- removal back to an unassigned state
- testing alternative arrangements
- rerunning analysis and Event Analysis under a changed layout/execution assumption
- staging a possible promotion or save-as-variant action

By default, grid edits land here, not in the Active Layout. The Working Layout may be:

- analyzed
- compared against the Active Layout
- saved as a named variant
- promoted to active
- discarded/reverted

### Saved Layout Variant

A **Saved Layout Variant** is a durable named `Layout` artifact. It is preserved, but it is not automatically the Active Layout.

This keeps the product aligned with a multi-candidate, human-in-the-loop workflow:

- the Active Layout remains the baseline
- the Working Layout remains the draft
- saved variants remain reusable reference points
- `Candidate Solution` outputs remain explicit alternatives rather than hidden mutations

### Explicit Locks

An **Explicit Lock** is the only user action that turns a sound placement into a true hard-preserved placement rule.

Default rule:

- manual place / move / swap is exploratory
- explicit lock from the sound panel is preserved

An explicit placement lock means:

- preserve this sound’s `Grid Position (row,col)` as a hard constraint
- generation must respect it
- promotion of a conflicting layout or candidate must surface the replacement explicitly

### Finger constraints: corrected model

The merge plan must not carry forward an exact persistent pad-to-single-finger lock as the main rule.

The corrected model is:

- `Finger Assignment` remains per-`Performance Event` / `Execution Plan`
- feasibility comes from geometric/ergonomic rules and allowed regions
- finger capability and hand-zone realism constrain what can be proposed
- uniqueness rules prevent ambiguous multi-finger ownership of the same pad where that would enlarge the search space and UI ambiguity

So the preserved hard layer is:

- sound placement locks
- feasibility rules
- finger capability restrictions
- uniqueness / anti-conflict rules

Not:

- exact long-lived pad -> one finger lock as a main product concept

### Promotion, save, discard

The intended interaction loop is:

1. Start from the Active Layout.
2. Create or modify a Working Layout.
3. Analyze the Working Layout and compare it against the Active Layout.
4. Either discard it, save it as a variant, or promote it to Active Layout.
5. Generate `Candidate Solution` alternatives from the relevant state while preserving only true hard constraints.

Promotion behavior:

- promoting a Working Layout makes it the new Active Layout
- promoting a `Candidate Solution` makes that candidate’s `Layout` the new Active Layout
- saving as variant creates a preserved `Layout` artifact without changing the Active Layout
- if promotion would replace explicit locked state, the replacement must be shown before confirmation

### Analysis-only actions vs real layout/execution edits

The merge plan must distinguish between:

- real Working Layout / Working Execution edits
- temporary analysis-only controls

Real working edits:

- manual pad edits
- per-event manual hand/finger edits that imply a changed execution interpretation being tested
- any change that the user can analyze, compare, save, promote, or discard

Temporary analysis-only inputs:

- filtered analysis scope
- hide/mute from the current analysis run
- compare-mode toggles
- diagnostic overlays

These temporary inputs should not silently become persistent project truth.

## Rewritten classification table

| User action / system rule | Affected object | Correct classification | Meaning | Must optimizer preserve? | Can generated alternatives differ? | Persistence scope | Required UI signaling | Notes / rationale |
|---|---|---|---|---|---|---|---|---|
| Active Layout baseline | Active `Layout` + active selection | Active baseline state | The preserved default `Layout` for browsing, analysis, compare reference, and default persistence. | Yes, as the default baseline reference. | Yes, and they should differ meaningfully unless blocked by true hard constraints. | Project-scoped, persisted. | Always-visible Active Layout indicator; compare views must label it as baseline. | This is the reference state, not the only state. |
| place sound on Pad | Working `Layout` mapping | Working/test state | Exploratory placement in the current Working Layout. | No, not as a hard rule. | Yes. | Session-scoped working draft until saved or promoted. | Unsaved working-change badge; compare against Active Layout available immediately. | Manual placement is not a lock. |
| move sound to another Pad | Working `Layout` mapping | Working/test state | Exploratory relocation in the Working Layout. | No, not as a hard rule. | Yes. | Session-scoped working draft until saved or promoted. | Unsaved working-change badge; moved-pad diff against Active Layout. | Movement changes the draft, not the baseline. |
| swap two sounds | Working `Layout` mapping | Working/test state | Exploratory swap in the Working Layout. | No, not as a hard rule. | Yes. | Session-scoped working draft until saved or promoted. | Unsaved working-change badge; swapped-pad diff against Active Layout. | Still exploratory unless later promoted or saved. |
| remove sound from pad | Working or Active editing context, resulting sound state | Working/test state | Remove the current binding and return the sound to an unassigned state. | No, not as a hard rule. | Yes. | Session-scoped working draft until saved or promoted. | Sound must visibly return to the unassigned list/panel state. | This is not a ban and not an opposite preference. |
| clear all pad assignments | Working `Layout` mapping | Working/test state | Reset the Working Layout to a blank/unassigned state. | No, not as a hard rule. | Yes. | Session-scoped working draft until saved or promoted. | Clear warning, blank-working-layout badge, revert option. | Useful for from-scratch exploration. |
| explicit sound placement lock from sound panel | Sound placement constraint set | Explicit hard constraint | Preserve one sound’s assigned `Grid Position (row,col)` as a true hard constraint. | Yes. | No, standard generation must respect it. | Project-scoped constraint state, persisted. | Lock icon on sound panel and on the relevant pad; candidate conflict counter if later replacement is attempted. | This replaces the old “manual place = preserve” assumption. |
| remove explicit sound placement lock | Sound placement constraint set | Explicit hard constraint | Remove the hard-preserve rule for that sound’s placement. | No after removal. | Yes. | Project-scoped constraint state, persisted. | Lock removal must be explicit and immediately widen the candidate space. | Clearing the lock does not preserve the prior pad as a preference. |
| save Working Layout as named variant | Saved `Layout` variant set | Active baseline state | Turn the current Working Layout into a durable saved `Layout` artifact. | Yes, as a saved variant artifact. | Yes. | Project-scoped, persisted. | Named save flow; variant list entry separate from Active Layout marker. | Save-as-variant does not change the Active Layout. |
| discard Working Layout / revert to Active Layout | Working draft state | Working/test state | Abandon exploratory changes and restore the Active Layout as the only visible working state. | No. | Yes. | Session-scoped only; discarded draft is not persisted. | Revert/discard action with unsaved-change warning. | This is the explicit escape hatch from experimentation. |
| promote Working Layout to Active Layout | Active `Layout` selection + persisted baseline | Active baseline state | Make the Working Layout the new Active Layout. | Yes, after promotion. | Yes, relative to the new baseline. | Project-scoped, persisted. | Promotion confirmation and updated Active Layout label. | Promotion is the moment exploratory state becomes preserved baseline. |
| analyze Active Layout | Derived `Candidate Solution` / analysis cache for baseline | Temporary analysis-only input | Evaluate the Active Layout without mutating it. | N/A. | N/A. | Derived analysis cache tied to Active Layout. | Clear “analyzing Active Layout” label. | Keeps explanation and mutation separate. |
| analyze Working Layout | Derived `Candidate Solution` / analysis cache for working state | Working/test state | Evaluate the current Working Layout and its associated execution assumptions. | Preserve the working state for that analysis run, not as a hard rule. | Yes. | Session-scoped analysis tied to the Working Layout draft. | Clear “analyzing Working Layout” label plus baseline-vs-working distinction. | This is how manual experimentation becomes explainable. |
| generate `Candidate Solution` alternatives from current state | Candidate set + generation input state | Working/test state | Produce multiple alternatives from the Active or Working Layout while respecting only true hard constraints. | Preserve explicit hard constraints only. | Yes, and they should differ meaningfully from the Active Layout. | Candidate set may persist with project; generation source state is session-scoped unless saved/promoted. | Generation source must be labeled; UI must show how many hard constraints were respected and which soft biases were violated. | Alternatives that are too close to Active Layout are not useful alternatives. |
| compare Working Layout against Active Layout | Compare state | Temporary analysis-only input | Inspect the Working Layout as a draft against the Active baseline. | N/A. | Yes. | Session-scoped compare mode. | Compare banner naming baseline and draft; changed pads and score deltas highlighted. | Compare itself is not a state mutation. |
| compare `Candidate Solution` against Active Layout | Compare state | Temporary analysis-only input | Inspect a candidate against the Active baseline. | N/A. | Yes. | Session-scoped compare mode with persisted candidate data. | Compare banner naming baseline and candidate; locked-state conflict list if relevant. | Compare is view state, not promotion. |
| promote `Candidate Solution` to Active Layout | Active `Layout` selection + persisted baseline | Active baseline state | Accept a candidate’s `Layout` as the new Active Layout. | Yes, after promotion. | Yes, before promotion. | Project-scoped, persisted. | Confirmation sheet must show what changes relative to Active Layout. | Candidate promotion is explicit, never automatic. |
| promote conflicting candidate that would replace explicit locked state | Active `Layout` + hard constraint set | Active baseline state | Explicitly replace prior locked state during promotion. | Only after explicit user approval. | Not in standard generation; replacement happens only in a deliberate replace/promote flow. | Project-scoped, persisted after confirmation. | Required conflict-review sheet listing each displaced lock and the new replacement state. | This is the only route for overriding hard placement locks without first removing them. |
| per-event manual `Finger Assignment` edit | Working execution assumptions | Working/test state | Edit the execution interpretation being tested, not merely a tiny local note annotation. | Preserve for the current Working Layout analysis state, not as a hard global rule. | Yes. | Session-scoped working execution state until saved, promoted, or discarded. | Event Analysis and workspace must label it as a Working Layout / Working Execution change, not a hidden local tweak. | Default should be “this changes the draft being tested.” |
| per-event manual hand edit | Working execution assumptions | Working/test state | Edit the hand interpretation being tested for the broader performance. | Preserve for the current Working Layout analysis state, not as a hard global rule. | Yes. | Session-scoped working execution state until saved, promoted, or discarded. | Same signaling as per-event finger edit. | Treat like a working execution change unless clearly marked analysis-only. |
| per-sound hand bias | Per-sound scoring prior | Soft bias / scoring prior | Bias ranking toward one hand for that sound when feasible. | No, not as a hard rule. | Yes. | Project-scoped by sound identity, persisted. | Diagnostics must show whether the bias was honored or violated. | Useful for personalization without freezing exploration. |
| per-sound finger bias | Per-sound scoring prior | Soft bias / scoring prior | Bias ranking toward one finger for that sound when feasible. | No, not as a hard rule. | Yes. | Project-scoped by sound identity, persisted. | Diagnostics must show whether the bias was honored or violated. | Weaker than explicit locks and weaker than feasibility. |
| `Natural Hand Pose` | Ergonomic prior / seed input | Soft bias / scoring prior | Core ergonomic prior used in seeding, scoring, and diagnostics. | No, not as a user hard lock. | Yes. | Active pose profile persisted with the project. | UI must show pose-aware seeding/scoring language, not casual “soft preference” wording. | This is a core modeling primitive, not a trivial option. |
| hand-zone defaults | Hand-zone prior model | Soft bias / scoring prior | Prefer left/right hand usage by zone when not contradicted by stronger rules. | No, not as a hard rule. | Yes. | Engine/project configuration, persisted. | Diagnostics must surface zone-pressure and zone-violation costs. | Hand zones guide ranking but do not replace feasibility. |
| finger capability regions / allowed pads | Feasibility rule set | Explicit hard constraint | Restrict which pads/finger combinations are allowed at all. | Yes. | No. | Engine/project rule set, persisted. | Constraint explanations must identify the violated capability rule. | Replaces the incorrect pad-to-single-finger lock framing. |
| ergonomic feasibility rules | Feasibility rule set | Explicit hard constraint | Enforce non-negotiable physical constraints on reach, simultaneous ordering, span, and collisions. | Yes. | No. | Engine rule set, persisted in config/model behavior. | Violations must be explicit in diagnostics and candidate rejection explanations. | Feasibility is not the same as ergonomics or difficulty. |
| uniqueness / anti-conflict rule | Layout/execution ownership rule | Explicit hard constraint | Prevent ambiguous multi-finger ownership of one pad where the model requires unique ownership. | Yes. | No. | Engine/layout rule set, persisted in canonical rules. | Candidate explanations must call out uniqueness conflicts directly. | Keeps search space and UI semantics manageable. |
| analysis-only filter / hide / mute from current run | Analysis scope | Temporary analysis-only input | Limit the current analysis scope without changing project truth. | Only for the current scoped run. | Yes, outside that filtered run. | Session-scoped only. | Visible filtered-analysis badge and list of excluded sounds/lanes. | Must not silently rewrite the `Performance` truth. |
| compare-mode toggles and diagnostic overlays | View state | Temporary analysis-only input | Control how current analysis is viewed without changing `Layout` or `Execution Plan` truth. | N/A. | Yes. | Session-scoped only. | Toggle state must be visible and non-persistent by default. | Includes compare-mode UI, onion-skin toggles, and similar overlays. |
| sound name, color, group, labels | Sound/project metadata | Metadata only | Preserve user-facing identity and organization without affecting optimization. | Yes, as metadata. | No, generated alternatives must inherit the same metadata identities. | Project-scoped, persisted. | Metadata changes must propagate consistently across palette, grid, timeline, compare, and output views. | Metadata is durable but not solver-constraining. |

## Preference/constraint taxonomy

| Preference / constraint type | Classification | Rationale |
|---|---|---|
| explicit sound placement lock | hard constraint | This is the only user action that turns a sound placement into a binding preserved rule. |
| ergonomic feasibility constraints | hard constraint | They define what is physically possible, not merely preferable. |
| finger capability regions / allowed pads | hard constraint | They bound the legal `Finger Assignment` search space. |
| uniqueness / anti-conflict ownership rules | hard constraint | They prevent ambiguous or contradictory pad/finger ownership states. |
| `Natural Hand Pose` | soft bias | It is a core ergonomic prior for seed/scoring/diagnostics, but not a user hard lock. |
| hand-zone defaults | soft bias | They influence ranking and hand realism without becoming absolute prohibitions. |
| per-sound hand bias | soft bias | It should shape ranking but may be violated if the global solution is better. |
| per-sound finger bias | soft bias | Same as above, at finer granularity. |
| manual place / move / swap / remove / clear | working state | These are exploratory Working Layout edits by default, not preserved constraints. |
| per-event manual hand/finger edit | working state | By default, these change the Working Layout / Working Execution interpretation being tested. |
| analysis-only filters | temporary analysis-only input | They change the current run or view, not canonical project truth. |
| compare-mode toggles / overlays | temporary analysis-only input | They are view controls, not domain edits. |
| sound name / color / group | metadata | They must persist and propagate, but they do not constrain optimization. |

## Merge-impact analysis

### State model

The current V2 state model conflates editable layout state, active baseline state, and analysis cache inside `src/ui/state/projectState.ts`. The corrected model requires:

- preserved Active Layout state
- session-scoped Working Layout draft state
- named saved `Layout` variants
- explicit placement-lock state separate from ordinary pad edits
- working execution-assumption state for manual per-event edits

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/state/ProjectContext.tsx`
- `product-reconciliation/v2/v2 repo/src/types/layout.ts`
- `product-reconciliation/v2/v2 repo/src/types/candidateSolution.ts`
- `product-reconciliation/v2/v2 repo/src/types/executionPlan.ts`

### Persistence model

Default persistence should preserve:

- Active Layout
- saved `Layout` variants
- explicit placement locks
- sound metadata
- pose profile
- project-level priors/biases

It should not silently persist as canonical truth:

- transient compare state
- analysis-only filters
- overlay toggles
- abandoned Working Layout drafts

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/persistence/projectStorage.ts`
- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/pages/ProjectEditorPage.tsx`

### Compare flow

Compare flow must become baseline-aware:

- Active Layout is compare reference by default
- Working Layout can be compared against Active Layout
- `Candidate Solution` can be compared against Active Layout
- compare itself never mutates project truth

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CandidateCompare.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CompareGridView.tsx`

### Generate flow

Generation must change from:

- “start from current mutable layout and produce nearby candidates”

To:

- “start from Active or Working state as declared input”
- “preserve only true hard constraints”
- “produce genuinely different `Candidate Solution` alternatives”

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/hooks/useAutoAnalysis.ts`
- `product-reconciliation/v2/v2 repo/src/engine/optimization/multiCandidateGenerator.ts`
- `product-reconciliation/v2/v2 repo/src/engine/mapping/mappingResolver.ts`
- `product-reconciliation/v2/v2 repo/src/engine/analysis/candidateComparator.ts`

### Save-as-alternative flow

The current shell has layout cloning, but not a clearly named “save Working Layout as variant” flow. The revised plan requires:

- durable named saved variants
- no automatic Active Layout switch
- preserved compare target identity

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/components/EditorToolbar.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/persistence/projectStorage.ts`

### Promote-to-active flow

Promotion becomes the only route by which exploratory or candidate state becomes the preserved baseline.

Required behavior:

- explicit promotion action
- Active Layout replacement
- conflict review if explicit locked placement state would be replaced

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EditorToolbar.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/PerformanceWorkspace.tsx`

### Event Analysis page behavior

V1’s dedicated Event Analysis remains important as the deep-inspection reference, but its edit semantics must align with the new model:

- per-event edits usually modify Working Layout / Working Execution assumptions
- clearly analysis-only actions must be marked as such
- the page must compare Working vs Active when relevant

Reference behavior and likely merge targets:

- `product-reconciliation/v1/v1 Repo/src/workbench/EventAnalysisPanel.tsx`
- `product-reconciliation/v1/v1 Repo/src/workbench/EventTimelinePanel.tsx`
- `product-reconciliation/v1/v1 Repo/src/pages/EventAnalysisPage.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EventDetailPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/TransitionDetailPanel.tsx`

### Solver input construction

Solver input must be built from:

- canonical `Performance Event` truth
- declared Active or Working `Layout`
- explicit hard constraints
- soft priors/biases
- optional working execution edits when testing

It must not encode ordinary drag/drop edits as preserved hard placement rules.

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/hooks/useAutoAnalysis.ts`
- `product-reconciliation/v2/v2 repo/src/engine/optimization/multiCandidateGenerator.ts`
- `product-reconciliation/v2/v2 repo/src/engine/prior/feasibility.ts`
- `product-reconciliation/v2/v2 repo/src/engine/surface/handZone.ts`
- `product-reconciliation/v2/v2 repo/src/engine/mapping/seedFromPose.ts`
- `product-reconciliation/v2/v2 repo/src/engine/solvers/beamSolver.ts`

### Diagnostics / explainability behavior

Diagnostics must explain:

- whether the analyzed state is Active or Working
- which explicit hard constraints were respected
- which soft biases were violated
- why a `Candidate Solution` differs from the Active Layout
- whether promotion would replace any preserved locked state

Likely affected modules:

- `product-reconciliation/v2/v2 repo/src/ui/components/DiagnosticsPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EventDetailPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/pages/OptimizerDebugPage.tsx`
- `product-reconciliation/v2/v2 repo/src/engine/analysis/constraintExplainer.ts`
- `product-reconciliation/v2/v2 repo/src/engine/debug/candidateReport.ts`

## Concrete implementation plan

### Phase 1. Domain/state model corrections

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/state/ProjectContext.tsx`
- `product-reconciliation/v2/v2 repo/src/types/layout.ts`
- `product-reconciliation/v2/v2 repo/src/types/candidateSolution.ts`
- `product-reconciliation/v2/v2 repo/src/types/executionPlan.ts`

**Key refactors**

- Split Active Layout baseline from Working Layout draft.
- Add explicit placement-lock state separate from ordinary `Layout` edits.
- Add Working Execution draft state for per-event manual edits.
- Make saved `Layout` variants explicit first-class artifacts.

**Invariants to preserve**

- `Layout` and `Execution Plan` remain coupled artifacts.
- One `Project` can hold multiple named layouts and multiple candidates.
- Active baseline remains stable until explicit promotion.

**Migration risks**

- Existing projects currently assume direct mutation of `activeLayoutId` + `layouts[]`.
- Old persisted projects may not distinguish locks from ordinary placements.

**QA checks**

- Load an existing project and confirm the Active Layout remains unchanged after exploratory edits.
- Confirm a discarded Working Layout leaves the Active Layout untouched.
- Confirm saved variants reload correctly.

### Phase 2. UI workflow corrections

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/PerformanceWorkspace.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EditorToolbar.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/VoicePalette.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/InteractiveGrid.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CompareGridView.tsx`

**Key refactors**

- Add Working Layout draft signaling.
- Add explicit sound-panel lock controls for placement preservation.
- Remove exact pad-to-single-finger lock UX as a main policy affordance.
- Add save-as-variant, discard, and promote flows that operate on Working state.

**Invariants to preserve**

- Grid/timeline/event selection linkage stays intact.
- Candidate comparison remains first-class.
- User can always understand whether they are viewing Active, Working, or Candidate state.

**Migration risks**

- Users may confuse Active and Working states if visual labeling is weak.
- Replacing current pad-level constraint controls may orphan existing affordances.

**QA checks**

- Place/move/swap a sound and confirm it edits Working state only.
- Lock a sound and confirm generation respects the lock.
- Compare Working vs Active and confirm no silent promotion occurs.

### Phase 3. Solver contract corrections

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/hooks/useAutoAnalysis.ts`
- `product-reconciliation/v2/v2 repo/src/engine/optimization/multiCandidateGenerator.ts`
- `product-reconciliation/v2/v2 repo/src/engine/mapping/mappingResolver.ts`
- `product-reconciliation/v2/v2 repo/src/engine/prior/feasibility.ts`
- `product-reconciliation/v2/v2 repo/src/engine/surface/handZone.ts`
- `product-reconciliation/v2/v2 repo/src/engine/solvers/beamSolver.ts`

**Key refactors**

- Feed explicit placement locks into the solver/generator as hard constraints.
- Remove the assumption that ordinary grid edits are hard preserves.
- Replace exact pad->finger lock policy with capability-region and uniqueness rules.
- Require candidate-generation diversity relative to the Active Layout.

**Invariants to preserve**

- Hard feasibility still outranks ergonomics and difficulty.
- `Candidate Solution` remains layout + execution + analysis.
- Temporal evaluation remains primary.

**Migration risks**

- Candidate generation may collapse into near-duplicates if diversity logic is weak.
- Existing constraint wiring may still assume pad-level finger locks generate hard event assignments.

**QA checks**

- Confirm alternatives differ meaningfully from Active Layout when enough unlocked freedom exists.
- Confirm hard locks are respected in generation and promotion conflict checks.
- Confirm feasibility rejects illegal finger-region or uniqueness violations.

### Phase 4. Compare / promotion / save flows

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/components/AnalysisSidePanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CandidateCompare.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/CompareGridView.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EditorToolbar.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/persistence/projectStorage.ts`

**Key refactors**

- Add compare modes for Active vs Working and Active vs Candidate.
- Add explicit save-as-variant.
- Add promotion confirmation flows.
- Add lock-replacement review when promoting conflicting layouts.

**Invariants to preserve**

- Comparison never mutates project truth.
- Promotion is explicit.
- Saved variants stay durable without becoming active automatically.

**Migration risks**

- Promotion and save-as-variant can blur if labels are weak.
- Candidate compare and Working compare may overlap unless clearly separated.

**QA checks**

- Save Working Layout as variant and confirm Active Layout remains unchanged.
- Promote Working Layout and confirm Active Layout updates.
- Attempt to promote a conflicting candidate and confirm replacement sheet appears.

### Phase 5. Diagnostics / QA

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/components/DiagnosticsPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/EventDetailPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/components/workspace/TransitionDetailPanel.tsx`
- `product-reconciliation/v2/v2 repo/src/ui/pages/OptimizerDebugPage.tsx`
- `product-reconciliation/v2/v2 repo/src/engine/analysis/constraintExplainer.ts`
- `product-reconciliation/v2/v2 repo/src/engine/debug/candidateReport.ts`
- `product-reconciliation/v1/v1 Repo/src/workbench/EventAnalysisPanel.tsx`

**Key refactors**

- Surface Active vs Working context in diagnostics.
- Explain soft-bias violations separately from hard-constraint violations.
- Show why candidates differ from the Active Layout.
- Preserve single-event explainability for both baseline and working states.

**Invariants to preserve**

- Outputs remain explainable and debuggable.
- Event Analysis remains a valid path for single-event difficulty inspection.
- Debug surfaces stay richer than normal UI but consistent with the same domain rules.

**Migration risks**

- Old score/constraint language may still blur feasibility, ergonomics, and difficulty.
- Event-detail edits may feel local if the Working-state framing is weak.

**QA checks**

- Select a `Performance Event` and confirm the grid, `Finger Assignment`, and diagnostics remain synchronized.
- Confirm diagnostics tell the user whether a bias was violated versus a hard rule being broken.
- Confirm debug views report the same lock set and working-state inputs as normal UI analysis.

### Phase 6. Migration / backward compatibility

**Files/modules likely affected**

- `product-reconciliation/v2/v2 repo/src/ui/persistence/projectStorage.ts`
- `product-reconciliation/v2/v2 repo/src/ui/state/projectState.ts`
- `product-reconciliation/v2/v2 repo/src/ui/fixtures/demoProjects.ts`
- `product-reconciliation/v2/v2 repo/test/*`

**Key refactors**

- Add loader migration for projects that only know `layouts[]` + `activeLayoutId`.
- Convert old pad-level finger locks into the new constraint model or mark them for explicit review.
- Initialize Working Layout draft as null/empty on migrated projects.

**Invariants to preserve**

- Old projects still open.
- Active Layout identity survives migration.
- Existing saved layouts remain usable.

**Migration risks**

- Old persisted projects may embed obsolete constraint semantics.
- Demo fixtures may silently encode old candidate or lock assumptions.

**QA checks**

- Load old saved projects and verify no ordinary manual placements become hard locks.
- Verify old layout variants still compare correctly.
- Verify migration warnings are shown if legacy pad-finger lock data is detected.

## Open issues list

Only two product-level issues remain crisp enough to require user confirmation:

1. **Working draft persistence across full reload**
   Default proposed policy: Working Layout / Working Execution drafts are session-scoped and are discarded on full reload unless saved or promoted.

2. **Candidate diversity floor**
   Default proposed policy: a generated `Candidate Solution` should count as a real alternative only if it changes at least one unlocked sound placement or materially changes the tradeoff profile relative to the Active Layout.

Everything else above is now corrected policy, not an open merge question.
