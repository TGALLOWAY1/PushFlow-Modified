# V3 Artifact Plan

The artifacts below should be authored before implementation work begins. Their
job is to lock mission, scope, vocabulary, workflow, and source-of-truth rules
so V3 does not repeat V2's product drift.

## USER_MISSION.md

**Purpose**

Define the single sentence that states what PushFlow V3 is for and what it is
not for.

**Inputs**

- `V1_VS_V2_PRODUCT_COMPARISON.md`
- `V3_PRODUCT_DECISIONS.md`
- source evidence from both synthesis sets, especially the overview and goals
  documents

**Expected structure**

- one-sentence mission
- one-paragraph product framing
- primary user
- primary problem solved
- explicit exclusions

**Why it must be created before implementation**

Without a mission artifact, implementation work will keep treating verification,
composition, optimization, and debug as equal priorities.

## CORE_USER_GOALS.md

**Purpose**

Rank the goals V3 must serve first, second, and not yet.

**Inputs**

- `V3_PRODUCT_DECISIONS.md`
- `V1_VS_V2_PRODUCT_COMPARISON.md`
- both `USER_GOALS_AND_JOBS_TO_BE_DONE.md` source artifacts

**Expected structure**

- primary goals
- secondary goals
- deferred goals
- anti-goals
- rationale for ranking

**Why it must be created before implementation**

Feature decisions cannot be made coherently until the team agrees which user
outcomes are core and which are merely possible.

## JTBD.md

**Purpose**

Turn the chosen user goals into one lead JTBD and a small set of supporting
JTBDs.

**Inputs**

- `CORE_USER_GOALS.md`
- `V3_PRODUCT_DECISIONS.md`
- both product overview and JTBD source artifacts

**Expected structure**

- lead JTBD
- 2-3 supporting JTBDs
- success outcomes
- failure outcomes
- scope boundary notes

**Why it must be created before implementation**

JTBD is the behavioral anchor for workflow and screen decisions. Without it,
feature prioritization becomes ad hoc.

## CANONICAL_TERMINOLOGY.md

**Purpose**

Lock the user-facing vocabulary and clearly separate it from internal
implementation terms.

**Inputs**

- `V3_PRODUCT_DECISIONS.md`
- `SALVAGE_MATRIX.md`
- both domain and terminology source artifacts

**Expected structure**

- approved terms
- definitions
- forbidden or deprecated terms
- implementation-only terms
- copy rules for UI and docs

**Why it must be created before implementation**

V2 shows that terminology drift is not cosmetic. It directly creates domain and
workflow confusion.

## DOMAIN_SOURCE_OF_TRUTH.md

**Purpose**

Define the canonical V3 product objects, which ones are durable, which ones are
derived, and which one owns each type of state.

**Inputs**

- `V3_PRODUCT_DECISIONS.md`
- `SALVAGE_MATRIX.md`
- both domain model and state/source-of-truth source artifacts

**Expected structure**

- durable objects
- derived objects
- ownership rules
- lifecycle diagram
- invalidation rules
- persistence rules

**Why it must be created before implementation**

This is the highest-risk ambiguity from V2. If the canonical performance model
is not settled first, the UI and state layers will diverge again.

## CANONICAL_WORKFLOW_MAP.md

**Purpose**

Describe the single primary V3 workflow plus the approved alternate branches.

**Inputs**

- `USER_MISSION.md`
- `JTBD.md`
- `DOMAIN_SOURCE_OF_TRUTH.md`
- both workflow and task-flow source artifacts

**Expected structure**

- primary end-to-end flow
- entry conditions
- decision points
- alternate branches
- completion states
- unsupported paths

**Why it must be created before implementation**

V1 and V2 both had the right features, but neither artifact set fully locked the
primary happy path. V3 cannot leave that ambiguous.

## SCREEN_ARCHITECTURE_SPEC.md

**Purpose**

Define the V3 screen model, including what belongs in the library, workspace,
event analysis, and internal debug layers.

**Inputs**

- `CANONICAL_WORKFLOW_MAP.md`
- `CANONICAL_TERMINOLOGY.md`
- `V1_VS_V2_PRODUCT_COMPARISON.md`
- both screen architecture and wireframe source artifacts

**Expected structure**

- screen inventory
- responsibilities per screen
- allowed actions per screen
- drill-down rules
- internal-only surfaces
- navigation model

**Why it must be created before implementation**

V2 proved that simply collapsing screens into one workspace is not enough.
Responsibilities must be defined before UI work starts.

## TASK_BASED_UX_SPEC.md

**Purpose**

Translate the workflow map into concrete user tasks, states, decisions, and
feedback expectations.

**Inputs**

- `CANONICAL_WORKFLOW_MAP.md`
- `SCREEN_ARCHITECTURE_SPEC.md`
- `DOMAIN_SOURCE_OF_TRUTH.md`
- both workflow, visualization, and constraints source artifacts

**Expected structure**

- task by task breakdown
- prerequisites
- user actions
- system responses
- empty/error/stale states
- success criteria

**Why it must be created before implementation**

This is the bridge between product definition and interaction design. Without
it, screens become collections of panels instead of task-support systems.

## WIREFRAME_BRIEF.md

**Purpose**

Provide the information hierarchy and interaction priorities for low-fidelity V3
wireframes.

**Inputs**

- `SCREEN_ARCHITECTURE_SPEC.md`
- `TASK_BASED_UX_SPEC.md`
- `CANONICAL_TERMINOLOGY.md`
- both visualization and wireframe source artifacts

**Expected structure**

- screen goals
- information hierarchy
- dominant focal object per screen
- critical interactions
- mode strategy
- visual emphasis rules

**Why it must be created before implementation**

Wireframes created without a brief will simply restyle the same unresolved
product collisions. The brief ensures that layout follows product decisions
rather than existing implementation habits.

## Recommended Authoring Order

1. `USER_MISSION.md`
2. `CORE_USER_GOALS.md`
3. `JTBD.md`
4. `CANONICAL_TERMINOLOGY.md`
5. `DOMAIN_SOURCE_OF_TRUTH.md`
6. `CANONICAL_WORKFLOW_MAP.md`
7. `SCREEN_ARCHITECTURE_SPEC.md`
8. `TASK_BASED_UX_SPEC.md`
9. `WIREFRAME_BRIEF.md`

## Why This Sequence Matters

V3 does not primarily lack features or implementation detail. It lacks a locked
hierarchy of mission, model, workflow, and screen responsibility. These
artifacts resolve that hierarchy in the right order.
