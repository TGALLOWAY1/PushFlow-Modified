# Recommended Next Artifacts

## Purpose

These are the next product-definition documents that should be authored by a human + LLM collaboration. They are ordered to resolve the highest-leverage ambiguities before visual redesign or implementation work.

## Recommended Creation Order

| Order | Artifact Name | Purpose | Why It Is Needed Now | Fed By | Suggested Output |
|---|---|---|---|---|---|
| 1 | User Mission | State the one primary mission of the product and editor | Current repo supports multiple plausible missions; this decision should anchor everything else | `PRODUCT_OVERVIEW_FIRST_DRAFT.md`, `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` | 1-page mission statement with exclusions |
| 2 | Core User Goals | Rank primary and secondary user goals | Prevents capability drift from masquerading as product scope | `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `ARTIFACT_INPUTS_CHECKLIST.md` | goal hierarchy with priorities |
| 3 | JTBD Doc | Finalize one lead JTBD and a small supporting set | Gives later workflow and wireframe work a stable behavioral anchor | `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `PRODUCT_OVERVIEW_FIRST_DRAFT.md` | concise JTBD set with priority labels |
| 4 | Canonical Terminology Doc | Approve user-facing and internal vocabulary | Current terminology drift is a major source of conceptual confusion | `DOMAIN_MODEL_AND_TERMINOLOGY.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` | short canon with approved/forbidden terms |
| 5 | Domain Source-of-Truth Spec | Define the canonical product entities and which model owns what | The timeline/performance model is currently the largest state ambiguity | `DOMAIN_MODEL_AND_TERMINOLOGY.md`, `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`, `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md` | domain object map + ownership decisions |
| 6 | Workflow Maps | Choose and visualize the canonical task spine and major branches | Current workflows are broad but not prioritized | `WORKFLOW_AND_TASK_INVENTORY.md`, `SCREEN_ROUTE_AND_PANEL_MAP.md` | 1 primary flow + alternate flows |
| 7 | Screen Architecture Spec | Define page/mode structure and panel responsibilities | Needed before wireframes because the editor is currently overloaded | `SCREEN_ROUTE_AND_PANEL_MAP.md`, `WORKFLOW_AND_TASK_INVENTORY.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` | route/mode/page spec |
| 8 | Task-Based UX Spec | Translate workflows into task states, transitions, and user-facing behavior rules | Prevents another round of merged-but-unclear workspace logic | workflows, state/source-of-truth, visualization docs | spec by user task |
| 9 | Wireframe Brief | Prepare human-design-ready layout guidance without prematurely styling screens | Needed once mission, workflows, and page architecture are settled | screen architecture, task UX spec, visualization model | low-fidelity brief and panel priorities |
| 10 | Human QA / Acceptance Checklist | Turn product decisions into testable acceptance criteria | Current tests are strong on engine logic but not product clarity | constraints/invariants, workflow maps, UX spec | checklist for review and QA |

## Artifact Details

## 1. User Mission

### Purpose

Define the single sentence that explains what the product is for and what the main editor is supposed to help the user accomplish.

### Why It Is Needed

The current repo clearly supports multiple adjacent missions. Without choosing one, every later artifact will inherit the same ambiguity.

### Inputs

- `PRODUCT_OVERVIEW_FIRST_DRAFT.md`
- `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
- `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

## 2. Core User Goals

### Purpose

Rank and finalize the goals the product must serve first.

### Why It Is Needed

The app has enough capability to satisfy several kinds of users. Goal hierarchy is needed to prevent every feature from staying equally important.

### Inputs

- `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
- `ARTIFACT_INPUTS_CHECKLIST.md`

## 3. JTBD

### Purpose

Finalize user-centered behavioral statements that will guide workflow and screen decisions.

### Why It Is Needed

JTBD will convert the current evidence into a cleaner design anchor than feature lists alone.

### Inputs

- `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
- `PRODUCT_OVERVIEW_FIRST_DRAFT.md`

## 4. Canonical Terminology Doc

### Purpose

Lock down the product vocabulary for future specs, mocks, and implementation.

### Why It Is Needed

The current repo already documents terminology discipline, but the live product still drifts heavily across subsystems.

### Inputs

- `DOMAIN_MODEL_AND_TERMINOLOGY.md`
- `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

## 5. Domain Source-of-Truth Spec

### Purpose

Define the canonical entities and the relationship between timeline, layout, execution, and composer artifacts.

### Why It Is Needed

This is the most important pre-implementation artifact for avoiding further workflow drift and duplicated state systems.

### Inputs

- `DOMAIN_MODEL_AND_TERMINOLOGY.md`
- `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`
- `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`

## 6. Workflow Maps

### Purpose

Turn the current workflow inventory into a chosen primary path with explicit secondary branches.

### Why It Is Needed

The repo does not lack workflows; it lacks agreement on which one the product centers.

### Inputs

- `WORKFLOW_AND_TASK_INVENTORY.md`
- `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
- `PRODUCT_OVERVIEW_FIRST_DRAFT.md`

## 7. Screen Architecture Spec

### Purpose

Define routes, pages, modes, and panel ownership for the chosen workflow architecture.

### Why It Is Needed

The current single workspace is overloaded. A screen architecture artifact is needed before any mockup or implementation restructure.

### Inputs

- `SCREEN_ROUTE_AND_PANEL_MAP.md`
- `WORKFLOW_AND_TASK_INVENTORY.md`
- `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

## 8. Task-Based UX Spec

### Purpose

Describe how each major user task should behave across states, decisions, and feedback loops.

### Why It Is Needed

This will prevent future UX work from treating panels as arbitrary containers instead of task-support systems.

### Inputs

- workflow map
- screen architecture spec
- `VISUALIZATION_AND_FEEDBACK_MODEL.md`
- `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`

## 9. Wireframe Brief

### Purpose

Provide the information hierarchy and interaction goals needed for human or AI-assisted wireframing.

### Why It Is Needed

The current repo already has enough UI complexity that wireframes without a brief would likely reproduce the same ambiguity.

### Inputs

- screen architecture spec
- task-based UX spec
- `VISUALIZATION_AND_FEEDBACK_MODEL.md`

## 10. Human QA / Acceptance Checklist

### Purpose

Translate the chosen product definition into testable product-facing acceptance criteria.

### Why It Is Needed

The current test suite proves a lot about engine behavior, but not enough about whether the product experience is clear, coherent, and complete.

### Inputs

- `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`
- workflow maps
- task-based UX spec
- screen architecture spec

## Recommended Sequencing Note

Do not jump straight from this synthesis package to wireframes or implementation. The highest-value sequence is:

1. mission
2. goal hierarchy
3. JTBD
4. terminology
5. source-of-truth domain model
6. workflows
7. screen architecture
8. task-based UX spec
9. wireframe brief
10. QA / acceptance checklist

This order matters because the repo's main problem is not absent UI detail. It is unresolved product definition hierarchy.
