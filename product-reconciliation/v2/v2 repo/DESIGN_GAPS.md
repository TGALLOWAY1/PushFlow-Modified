# Design Gaps

## Goal

These are the missing product design artifacts that should exist before a serious UI redesign. They are gaps in definition, not requests for new features.

## High-Priority Missing Artifacts

| Missing artifact | What question it should answer | Why the repo needs it now | Evidence of the gap |
|---|---|---|---|
| Primary mission statement | Is the editor primarily for verification, manual layout design, candidate comparison, or pattern composition? | The current workspace tries to serve all four equally | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `docs/product-synthesis/USER_GOALS_AND_JOBS_TO_BE_DONE.md` |
| Canonical source-of-truth model | What is the one user-facing performance object: streams, lanes, or something else? | Current runtime uses `soundStreams`, `performanceLanes`, and `LoopState` at once | `src/ui/state/projectState.ts`, `src/ui/components/UnifiedTimeline.tsx`, `src/ui/components/workspace/WorkspacePatternStudio.tsx` |
| Screen responsibility matrix | Which responsibilities deserve dedicated screens, modes, or embedded panels? | Current app collapsed older routes without fully resolving their roles | `src/ui/components/workspace/PerformanceWorkspace.tsx`, `Version1/src/pages/*.tsx` |
| Interaction model for timeline-grid-analysis coupling | What should always stay synchronized when an event is selected or time moves? | Current coupling exists, but is distributed across many files and not written down as a contract | `src/ui/analysis/selectionModel.ts`, `src/ui/components/InteractiveGrid.tsx`, `src/ui/components/UnifiedTimeline.tsx` |
| Constraint model spec | What is the difference between voice-level constraints, pad-level constraints, and solver feasibility rules? | The repo uses all three, but only one clearly drives the solver | `src/ui/components/VoicePalette.tsx`, `src/ui/components/EventDetailPanel.tsx`, `src/ui/hooks/useAutoAnalysis.ts` |
| Analysis taxonomy | What belongs under analysis, diagnostics, compare, event analysis, and debug? | The product currently spreads "analysis" across multiple incoherent surfaces | `AnalysisSidePanel`, `DiagnosticsPanel`, `TransitionDetailPanel`, `/optimizer-debug`, `Version1/EventAnalysisPage` |

## Medium-Priority Missing Artifacts

| Missing artifact | What it should define | Why it matters |
|---|---|---|
| Candidate lifecycle contract | When candidates are generated, stored, invalidated, promoted to active, and compared | Current candidates persist, but `analysisResult` and `candidates` have overlapping meanings |
| Structural metadata refresh contract | When sections, voice roles, and other structure should be recomputed after timeline edits | Imported structure can drift after lane edits or composer sync |
| Composer integration contract | Whether the composer is a sandbox, a co-equal timeline editor, or a feeder workflow | Composer currently mutates shared lanes and bulk layout assignments silently |
| Route strategy | Which legacy dedicated pages are still conceptually part of the product | `Version1/` still defines clearer analysis/timeline boundaries than the live shell |
| Layout principles document | What makes a layout "good" beyond raw score: hand zones, adjacency, grouping, learnability | The engine encodes these values, but the UI lacks a product-facing articulation |
| Explainability contract | Which explanations should be available at song, passage, event, and transition levels | Engine/debug depth is greater than current user-facing explanation depth |

## Lower-Level Design Contracts Still Missing

| Missing artifact | What it should specify |
|---|---|
| Component contracts for `InteractiveGrid`, `UnifiedTimeline`, `WorkspacePatternStudio`, `DiagnosticsPanel`, and comparison views | Inputs, outputs, selection semantics, and ownership boundaries |
| Empty/loading/error/stale state matrix | Expected behavior for empty project, raw imported state, stale analysis, no candidates, invalid layout, no debug payload |
| Terminology-to-UI translation guide | Which implementation terms stay internal and which user-facing labels should be used consistently |
| Export contract | What exactly constitutes a finished project versus a downstream export-ready performance |
| Mode strategy | Which parts of the workspace are persistent panels, which are focus modes, and which are optional advanced tools |

## The Largest Product-Level Gaps

### 1. No single canonical performance model

The repo has three serious contenders for "what the user is editing":

- `soundStreams`
- `performanceLanes`
- composer-local `LoopState`

That is the most important missing artifact because every major UI redesign depends on it.

### 2. No written responsibility split between workspace and dedicated analysis

`Version1/` clearly separated:

- Dashboard
- Workbench
- Event Analysis
- Timeline

The current runtime reunifies them, but there is no artifact explaining which separations should stay conceptual even if the UI stays unified.

### 3. No first-class analysis model

The repo has:

- candidate selection
- diagnostics metrics
- selected event detail
- selected transition detail
- debug dashboard
- retained `Version1/` onion-skin analysis

Without an analysis model artifact, redesign work will keep re-litigating what "analysis" means.

## Minimum Artifact Set Needed Before Redesign

1. Product mission hierarchy.
2. Canonical domain/state truth diagram.
3. Screen responsibility map with current versus legacy reading.
4. Timeline-grid-selection interaction model.
5. Constraint model.
6. Analysis taxonomy.
7. Component contracts for the main workspace modules.

If those artifacts are not written first, redesign work will continue to treat symptoms instead of resolving the underlying product ambiguity already visible in the repository.
