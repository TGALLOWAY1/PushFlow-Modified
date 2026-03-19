# User Goals and Jobs To Be Done

## Evidence Basis

This document combines explicit statements from product/docs material with inference from the current UI, state model, and engine behavior.

Primary evidence:

- `docs/canonical_product_spec.md`
- `PROJECT_CANONICAL_SOURCE_OF_TRUTH.MD`
- `docs/ux-v1-restructure-plan.md`
- `tasks/ux-audit.md`
- `src/ui/pages/ProjectLibraryPage.tsx`
- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/components/DiagnosticsPanel.tsx`
- `Version1/docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md`
- `Version1/docs/WORKBENCH_DOCUMENTATION.md`

## Explicit User Goals

These are directly supported by documentation, route/page labels, component copy, or comments.

| Goal | Evidence | Confidence | Notes |
|---|---|---|---|
| Verify whether a Push performance is physically playable before committing to hardware | `docs/canonical_product_spec.md`, `tasks/ux-audit.md` | High | Repeatedly stated as the central problem |
| Import MIDI-derived material and convert it into a project the user can work on | `src/ui/pages/ProjectLibraryPage.tsx`, `docs/canonical_product_spec.md` | High | Current first-run entry path |
| Create a static pad layout for Push | `docs/canonical_product_spec.md`, `src/types/layout.ts`, `src/ui/components/InteractiveGrid.tsx` | High | One of the two canonical output artifacts |
| Generate or inspect a dynamic execution plan over time | `docs/canonical_product_spec.md`, `src/types/executionPlan.ts`, `src/engine/solvers/beamSolver.ts` | High | The second canonical output artifact |
| Compare multiple candidate solutions rather than rely on a single answer | `docs/canonical_product_spec.md`, `src/ui/components/AnalysisSidePanel.tsx` | High | Candidate generation is central to current toolbar flow |
| Analyze difficult passages and identify causes | `docs/canonical_product_spec.md`, `src/ui/components/DiagnosticsPanel.tsx` | High | Current UI partially supports this |
| Edit the performance timeline and watch the grid update | `src/ui/components/workspace/PerformanceWorkspace.tsx` | High | Explicit workspace copy says this |
| Generate or sketch new pattern material into the same project timeline | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `src/ui/components/workspace/WorkspacePatternStudio.tsx` | High | Explicit in current live UI |
| Constrain pad/finger behavior and re-analyze | `src/ui/components/EventDetailPanel.tsx`, `src/ui/hooks/useAutoAnalysis.ts` | High | Clear editing loop |
| Export the resulting project state | `src/ui/components/EditorToolbar.tsx`, `src/ui/persistence/projectStorage.ts` | High | JSON export exists now |
| Export to Ableton-oriented artifact(s) | `tasks/ux-audit.md`, `Version1/adg_remapper.py` | Medium | Explicitly desired, not yet current UI reality |

## Implied User Goals

These are not always stated directly, but are strongly implied by the structure and behavior of the product.

| Goal | Why It Is Implied | Evidence | Confidence |
|---|---|---|---|
| Standardize layouts across multiple songs or contexts | Difficulty, learnability, and consistency are emphasized; `tasks/ux-audit.md` names cross-song standardization directly | `tasks/ux-audit.md`, candidate/learnability concepts in canonical docs | Medium |
| Preserve musical identity while improving physical ergonomics | The engine optimizes playability without discarding the imported event structure | `docs/canonical_product_spec.md`, `src/engine/solvers/beamSolver.ts`, test suite | High |
| Use pattern generation as a compositional seed rather than only analysis of preexisting material | Pattern composer includes presets, random generation, recipe editing, and live sync into the shared timeline | `src/ui/components/workspace/WorkspacePatternStudio.tsx`, `src/engine/pattern/*` | High |
| Evaluate transition quality event by event, not just aggregate score | The grid supports onion skin, transition arcs, selected-event detail, and a transition panel | `src/ui/components/InteractiveGrid.tsx`, `src/ui/components/workspace/TransitionDetailPanel.tsx` | High |
| Iterate interactively after every layout change | Any layout mutation marks analysis stale; auto-analysis reruns later | `src/ui/state/projectState.ts`, `src/ui/hooks/useAutoAnalysis.ts` | High |
| Use the grid as the primary spatial mental model for performance | The product centers Push grid layout, hand zones, pad identity, and natural pose | canonical docs, `InteractiveGrid`, `naturalHandPose` files | High |
| Use diagnostics to justify or challenge automatic results | There are suggestions, difficulty bars, compare views, and a deep debug route | `src/ui/components/DiagnosticsPanel.tsx`, `src/ui/pages/OptimizerDebugPage.tsx` | Medium |
| Organize imported performance material by lanes or grouped sources | Timeline import creates lanes and lane groups; the project state preserves them | `src/ui/hooks/useLaneImport.ts`, `src/types/performanceLane.ts` | High |

## Jobs To Be Done

Candidate JTBD statements, written from the current product evidence.

### Primary JTBD Candidates

1. When I have MIDI material I want to perform on Push, I want to map it onto the grid and see whether human hands can realistically play it so I can avoid building unplayable layouts.
2. When I am shaping a Push performance, I want the timeline and the grid to stay linked so I can understand what happens over time and where it happens physically.
3. When a layout seems awkward, I want the system to generate alternate candidate layouts and execution plans so I can compare tradeoffs instead of guessing.
4. When a passage feels hard, I want to inspect the exact event and transition pressures so I can understand whether the problem is reach, drift, hand balance, overuse, or simultaneity.

### Secondary JTBD Candidates

1. When I do not yet have final performance material, I want to sketch or generate rhythmic patterns inside the same project so I can explore playable ideas quickly.
2. When I discover a pad or finger convention that matters, I want to constrain it and re-run analysis so the result matches my technique or performance preference.
3. When I have multiple projects or songs, I want consistent layouts and conventions so I can reduce relearning burden.
4. When I am satisfied with a project, I want to preserve or export the state so I can reopen it later or move it downstream.

### Edge / Power-User JTBD Candidates

1. When the optimizer behaves oddly, I want a deep debug surface so I can inspect irrational assignments, violations, and sanity-check failures.
2. When I want to test the engine against controlled scenarios, I want demo/fixture projects that isolate atomic constraints and temporal sequences.

## Primary vs Secondary Goals

## Primary Goals

These appear closest to the product's core identity.

| Goal | Why It Appears Primary | Evidence |
|---|---|---|
| Make Push performances physically playable | This is the central promise repeated across docs, engine, and tests | canonical docs, `beamSolver`, golden tests |
| Map musical identities onto the Push grid | Layout is one of the two canonical output artifacts | `src/types/layout.ts`, canonical docs |
| Produce or inspect a time-based execution plan | Execution plan is the other canonical output artifact | `src/types/executionPlan.ts`, `beamSolver` |
| Compare alternatives and understand tradeoffs | Candidate solutions are first-class throughout the docs and current toolbar flow | canonical docs, candidate generator, comparison UI |
| Understand difficulty at passage/event/transition levels | Event and transition surfaces exist, and tests focus on playability realism | `DiagnosticsPanel`, `EventDetailPanel`, `TransitionDetailPanel`, tests |

## Secondary Goals

These are real, but they read more like support goals, accelerators, or possible adjacent missions.

| Goal | Why It Appears Secondary | Evidence |
|---|---|---|
| Generate new patterns from scratch | Powerful and integrated, but not as central in canonical product definition | `WorkspacePatternStudio`, pattern engine |
| Organize imported material into lanes/groups | Important authoring support model, but not the core value promise | `PerformanceLane` model, lane import |
| Save/load user presets for patterns | Useful convenience layer inside the composer | `presetStorage`, pattern UI |
| Inspect developer-level solver behavior | Present, but clearly separated into a debug route | `/optimizer-debug` |
| Export beyond project JSON | Desired in docs, but not present in current shell | `tasks/ux-audit.md`, V1 utilities |

## Conflicts / Ambiguity

## Competing User Missions

The product currently appears to support at least four plausible "main" user missions:

1. Verify the playability of imported MIDI.
2. Design a Push layout manually.
3. Generate alternative optimized layouts.
4. Compose new rhythmic material.

All four are plausible, but the current workspace does not decisively subordinate three of them to one dominant mission.

Evidence:

- `src/ui/components/workspace/PerformanceWorkspace.tsx`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/workspace/WorkspacePatternStudio.tsx`
- `src/ui/components/EditorToolbar.tsx`

## Persona Ambiguity

The repo suggests more than one persona:

- performer optimizing existing material
- producer generating new ideas
- technically minded user inspecting solver/debug detail

The current shell serves all three somewhat, but not with a clearly layered product strategy.

Evidence:

- canonical docs emphasize performers
- pattern composer emphasizes ideation
- debug dashboard emphasizes technical inspection

## Goal Conflict: Clarity vs Capability

The codebase contains substantial capability, but those capabilities do not yet collapse into one obvious user story. The current product risk is not lack of features; it is that multiple adjacent jobs coexist without a clear hierarchy.

## Goal Conflict: Timeline Authoring vs Timeline Verification

The app both:

- edits and imports timeline material
- and evaluates that timeline against ergonomic constraints

Those are compatible, but the UI does not always make clear whether the user is authoring the canonical performance or auditing it.

Evidence:

- `UnifiedTimeline` both imports and displays analysis
- composer writes into the same shared timeline
- canonical docs focus on optimization/verification rather than authoring model detail

## Working First-Draft Conclusion

The strongest product reading is:

PushFlow is primarily a Push performance verification and optimization tool, with authoring features wrapped around that core. The current app, however, often presents authoring, optimization, and analysis as co-equal jobs. That equality is likely one source of the product drift the repo itself now acknowledges.
