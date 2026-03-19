# CLAUDE.md

## Project

PushFlow V3 is a performance-mapping and playability-analysis tool for Ableton Push 3. The active codebase (TypeScript + React + Vite) lives at the repository root.

The product promise is not "generate a layout." The product promise is: **converge on a Layout plus Execution Plan that is playable, understandable, and worth keeping.**

## Repository Structure

```
PushFlow-Modified/
├── CLAUDE.md                     # This file — agent instructions
├── README.md                     # Product overview
├── src/                          # Active source code
│   ├── engine/                   # Core optimization + analysis engine
│   ├── ui/                       # React UI layer
│   ├── types/                    # Domain types and contracts
│   ├── import/                   # MIDI file import
│   ├── utils/                    # Utilities
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
├── test/                         # Test suite
├── docs/
│   ├── canonical/                # CANONICAL SOURCE OF TRUTH (4 canon docs)
│   ├── product/                  # Terminology, milestones, bugs, source of truth
│   └── screenshots/              # UI screenshots
├── archive/                      # Historical reference material — NOT active
│   ├── v1-reference/             # V1 codebase (reference only)
│   ├── engine-comparison/        # V1 vs V2 engine analysis (10 docs)
│   ├── reconciliation/           # Legacy planning artifacts
│   ├── v2-planning/              # V2-era planning markdowns
│   ├── v2-docs/                  # V2-era product synthesis docs
│   ├── cost-model-planning/      # Cost evaluation audit docs
│   ├── tasks/                    # Historical task/audit docs
│   ├── superseded-workflow/      # Superseded workflow reports
│   └── superseded-canonical/    # Old canonical docs (replaced by new canon)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Build config
├── vitest.config.ts              # Test config
├── tailwind.config.js            # Tailwind CSS config
├── postcss.config.js             # PostCSS config
└── index.html                    # App entry HTML
```

## Canonical Source Of Truth

These four files are the **only** canon for PushFlow. Read them first for any planning or implementation work:

1. `docs/canonical/PUSHFLOW_CANON.md` — product canon (workflow and state truths)
2. `docs/canonical/PUSHFLOW_ENGINE_CONTRACT.md` — workflow-facing engine contract
3. `docs/canonical/PUSHFLOW_SURFACE_FEATURES.md` — concrete feature specs per surface
4. `docs/canonical/PUSHFLOW_TERMINOLOGY.md` — stable term definitions

Rules:
- These four canon files are the **only** planning source of truth.
- If any other document conflicts with them, the canon files win.
- Do not treat archived artifacts as active requirements.
- Do not use files in `archive/superseded-canonical/` — those are the old canonical docs, now replaced.

Historical reference (not canon, use only for engine salvage context):
- `archive/engine-comparison/` — V1 vs V2 engine analysis
- `archive/cost-model-planning/` — cost evaluation audit

## Historical Reference Material

Use these only to salvage useful elements or understand regressions:
- V1 reference codebase: `archive/v1-reference/`

Do not use archived material as source of truth.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.2 (strict mode, ES2020 target) |
| UI Framework | React 18.2 + React Router 7 |
| Build | Vite |
| Test | Vitest |
| Styling | Tailwind CSS + PostCSS |
| MIDI Parsing | @tonejs/midi |
| Icons | lucide-react |
| Utilities | uuid, chroma-js, clsx, tailwind-merge |

## Development Commands

All commands run from the repository root:

```bash
npm install              # Install dependencies
npm run dev              # Dev server at http://localhost:5173
npm run build            # TypeScript check + Vite production build
npm run typecheck        # TypeScript type checking only
npm test                 # Run Vitest in watch mode
npm run test:run         # Run tests once (CI mode)
npm run test:coverage    # Run tests with coverage report
```

## Codebase Architecture

```
src/
├── engine/                        # Core optimization + analysis engine
│   ├── optimization/              # Annealing solver, multi-candidate generator, mutation, ranker
│   ├── evaluation/                # Canonical evaluator, cost functions, difficulty scoring, objective
│   ├── solvers/                   # Beam solver for finger assignment (~54KB)
│   ├── prior/                     # Biomechanical model, feasibility checking, ergonomic constants
│   ├── analysis/                  # Baseline compare, candidate comparison, constraint explainer, diversity
│   ├── structure/                 # Performance structure analysis, role inference, event grouping
│   ├── rudiment/                  # Rudiment library, pattern generation, coherence metrics
│   ├── pattern/                   # Pattern engine, presets, rhythm resolvers
│   ├── mapping/                   # Pad-to-event mapping, coverage, seed from pose
│   ├── debug/                     # Debug utilities, sanity checks, constraint validator
│   ├── diagnostics/               # Fatigue model, legacy costs
│   ├── surface/                   # Hand zone, pad grid
│   └── index.ts                   # Main engine export
├── types/                         # Domain types and contracts (~20 files)
│   ├── layout.ts                  # Layout, LayoutRole, cloneLayout, hashLayout
│   ├── voice.ts                   # Voice (Sound identity)
│   ├── executionPlan.ts           # ExecutionPlan, FingerAssignment, DiagnosticFactors
│   ├── candidateSolution.ts       # CandidateSolution, TradeoffProfile
│   ├── diagnostics.ts             # DifficultyBreakdown, DifficultyAnalysis
│   ├── engineConfig.ts            # EngineConfiguration, AnnealingPreset
│   ├── performanceEvent.ts        # PerformanceEvent
│   ├── performanceStructure.ts    # Performance, PerformanceEvent
│   ├── padGrid.ts                 # Grid model
│   └── fingerModel.ts             # Finger/biomechanical types
├── ui/
│   ├── components/                # React components
│   │   ├── Grid/                  # PadGrid, InteractiveGrid, CompareGridView
│   │   ├── Panels/                # DiagnosticsPanel, AnalysisSidePanel, EventDetailPanel
│   │   ├── Timeline/              # ExecutionTimeline, UnifiedTimeline, TimelinePanel
│   │   ├── Candidates/            # CandidateCard, CandidateCompare
│   │   ├── Voice/                 # VoicePalette, PadContextMenu
│   │   ├── Editor/                # EditorToolbar, DifficultyHeatmap
│   │   ├── Lanes/                 # PerformanceLanesView, LaneRow, LaneSidebar, LaneTimeline
│   │   ├── LoopEditor/            # LoopEditorView, LoopGridCanvas, PatternLayerEditor
│   │   └── Workspace/             # PerformanceWorkspace, WorkspacePatternStudio
│   ├── pages/                     # ProjectLibraryPage, ProjectEditorPage, OptimizerDebugPage
│   ├── state/                     # ProjectContext, projectState, reducers, undo/redo
│   ├── persistence/               # projectStorage, loopStorage, presetStorage (localStorage)
│   ├── hooks/                     # useAutoAnalysis, useKeyboardShortcuts, useLaneImport
│   └── fixtures/                  # demoProjects, feasibilityDemos
├── import/                        # MIDI file import (midiImport.ts)
├── utils/                         # idGenerator, midiNotes, seededRng
└── main.tsx                       # Application entry point
```

### Test Suite

```
test/
├── types/                 # Voice identity round-trip, layout role validation
├── engine/
│   ├── optimization/      # Candidate generation tests
│   ├── evaluation/        # Execution plan, diagnostics, performability, canonical evaluator
│   ├── solvers/           # Beam solver smoke tests
│   ├── prior/             # Feasibility atomic/regression tests
│   ├── rudiment/          # Coherence, pattern generation, coordination, transforms
│   ├── pattern/           # Rhythm resolvers, pattern engine
│   └── structure/         # Constraint corrections
├── ui/state/              # Lanes reducer, lanes-to-streams conversion
└── golden/                # End-to-end golden scenario tests
```

Key test invariants:
- Voice IDs survive clone, promote, variant save, and discard
- Active/Working/Variant lifecycle transitions are correct
- Execution Plans are layout-bound with staleness detection
- Feasibility tiers (Strict/Relaxed/Fallback) have correct boundaries
- Generated candidates differ meaningfully from baseline
- Same solver input produces consistent output

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

### Cost Evaluation Architecture

Cost evaluation has three layers (see `archive/cost-model-planning/CANONICAL_COST_EVALUATION_PLAN.md` for full audit):

1. **Solver-Internal Cost Functions** (`src/engine/evaluation/costFunction.ts`) — pure functions called thousands of times during beam search (pose naturalness, transition cost, alternation, hand balance)
2. **Objective Combination** (`src/engine/evaluation/objective.ts`) — two coexisting models: `PerformabilityObjective` (3-component, used for beam ranking) and `ObjectiveComponents` (7-component, legacy diagnostic display)
3. **Post-Hoc Analysis** (multiple modules) — event metrics, transition analysis, passage difficulty scoring on `ExecutionPlanResult`

The 5 canonical `DiagnosticFactors`: `transition`, `gripNaturalness`, `alternation`, `handBalance`, `constraintPenalty`.

A canonical evaluator (`src/engine/evaluation/canonicalEvaluator.ts`) was implemented to provide solver-independent cost evaluation.

## Current Workspace Reality

The active codebase lives at the repository root (`src/`, `test/`).
Historical V1 and reconciliation material is archived under `archive/`.

Working assumptions:
- The current codebase is the active implementation to develop against
- V1 is a reference for salvageable interaction ideas, validation habits, and missing capabilities
- Any deep rewrite must be justified against the canonical workflow and implementation sequence

### Completed Implementation Phases

Based on git history, these phases are done:
1. V3 Workflow State Model (Layout lifecycle, role transitions)
2. Execution Plan Layout Binding (Plans track which layout they belong to)
3. Staleness Detection (Analysis invalidation on layout changes)
4. Candidate Diversity Enforcement (Meaningful differences from baseline)
5. Baseline-Aware Compare and Event Diagnostic Explainer
6. Terminology Normalization, Validation, Role Invariant Hardening
7. Promote-Candidate UI Wiring, Staleness Indicator, Voice Identity Tests
8. Event and Finger Constraint Corrections (Phases 1-5)
9. Canonical Cost Evaluator (solver-independent cost evaluation)

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
- be explicit about what is salvageable from V1
- separate resolved decisions from open questions
- use defaults from the canonical decisions doc when possible
- avoid giant matrices and duplicate planning artifacts

When implementing:
- prefer surgical changes over broad rewrites
- avoid duplicate sources of truth
- do not hide bad state modeling behind UI patches
- do not silently convert analysis-only state into persistent truth
- preserve explainability and debuggability

## Product Invariants

These rules are non-negotiable and must be preserved across all changes:

1. **Desktop-only application.** Do not add mobile-specific styles, responsive breakpoints, or touch-event handling unless explicitly requested.

2. **Learn More sync.** Any changes to cost factors, constraints, or analysis metrics MUST be reflected in the Learn More modal (`LearnMoreModal.tsx`). The Constraints tab must accurately display the current active constraints.

3. **Pattern Composer preservation.** The Pattern Composer (`WorkspacePatternStudio.tsx`) MUST always be accessible from the main workspace via a tab in the bottom drawer. Never remove or disconnect it from `PerformanceWorkspace.tsx` without explicit user confirmation.

4. **Timeline completeness.** The timeline MUST show ALL sound streams, even those marked unplayable by the solver. Unplayable/unassigned events should be rendered with a distinct visual style, never hidden.

5. **MIDI pitch independence.** A sound's MIDI pitch (`originalMidiNote`) is metadata only — it must NEVER determine grid placement. `bottomLeftNote` must remain at the default (36/C1) and must not be auto-adjusted during MIDI import.

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
