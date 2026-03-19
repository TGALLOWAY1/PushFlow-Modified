# PushFlow Audit + Next Steps

**Date:** 2026-03-19
**Baseline:** Post-homepage rewrite, pluggable optimizer, greedy solver, workspace polish, MIDI import fixes

## Executive Summary

PushFlow is in solid shape architecturally. The V3 workflow model is well-implemented, types are clean, the engine is modular, and 548 tests all pass. The main weaknesses are: (1) accumulated dead code and unused modules (~770+ lines removable immediately), (2) 5 TypeScript errors from a recent refactor that left prop mismatches, (3) the homepage dashboard has ambitious cards backed by fake data with no real data pipeline, and (4) the relationship between debug/analysis pages and the main workspace is unclear to a user. The highest-value next work is fixing the type errors, removing dead code, and deciding whether the homepage cards should show real data or be simplified.

## What Seems Strong

- **V3 workflow state model.** Active/Working/Variant layout lifecycle is clearly implemented in `projectState.ts` with proper clone-on-edit, promote, discard, and save-as-variant. This is the backbone of the product and it works correctly.

- **Type system.** 21 type files with 161 exports, all funneled through a barrel. Clear separation between Layout, ExecutionPlan, CandidateSolution, Voice, and Performance. No ad-hoc type duplication.

- **Test suite.** 32 test files, 548 tests, all passing in 3.3s. Good coverage of state transitions, feasibility tiers, voice identity round-trips, cost evaluation, candidate diversity, and MIDI import. Golden scenario tests provide end-to-end confidence.

- **Pluggable optimizer framework.** Clean `OptimizerMethod` interface with registry, three adapters (beam, annealing, greedy), and the greedy optimizer adds interpretable move history. Well-designed extension point.

- **Engine barrel exports.** `src/engine/index.ts` (226 exports) is well-organized by concern: surface, prior, evaluation, structure, solvers, optimization, pattern, analysis. Clear what the engine offers.

- **Canonical cost evaluator.** `canonicalEvaluator.ts` (780 lines) provides solver-independent evaluation with clean input/output types. This is the right abstraction for cost evaluation outside the beam search.

- **MIDI import.** Clean pipeline: parse → extract voices → build moments → create empty layout. Respects the MIDI-pitch-independence invariant. Deterministic moment grouping via MOMENT_EPSILON.

- **Workspace layout.** Three-column layout (Sounds/Events | Grid+Timeline | Analysis) with collapsible panels and bottom drawer for Pattern Composer. Well-structured component hierarchy.

## What Seems Weak or Unclear

- **5 TypeScript errors.** `PerformanceAnalysisPanel.tsx` passes an `onCompare` prop that `CandidatePreviewCard` doesn't accept (2 errors). `CompareModal.tsx` imports `MiniGridPreview` but doesn't use it. `PerformanceWorkspace.tsx` destructures `calculateCost` but doesn't use it. `WorkspaceToolbar.tsx` imports `exportProjectToFile` unused. These indicate a recent refactor left loose ends.

- **Dead code: `legacyCosts.ts` (392 lines).** Never imported by anything. Contains HandState-based cost functions that were replaced by HandPose-based scoring. Should be deleted.

- **Dead code: `feasibilityDemos.ts` (214 lines).** `src/ui/fixtures/feasibilityDemos.ts` is never imported. Leftover from removed demo projects.

- **Debug module usage.** `src/engine/debug/` (1,692 lines, 8 files) is only used by `OptimizerDebugPage.tsx` and one stress test. The irrational detector, candidate report generator, constraint validator, and sanity checks are valuable debugging tools but represent significant maintenance surface for limited usage. Worth keeping but should be recognized as developer-only tooling.

- **Homepage cards backed by fake data.** The Performance Practice Hub has 8 dashboard components (ReadinessScore, PracticeStats, ImprovementPlan, QuickActions, ContinuePracticingHero, SuggestedSimilarities, PerformanceCard, ImprovementBadge) all consuming `homepageDemoData.ts` which generates deterministic fake numbers from project IDs. There's no pipeline to compute real readiness scores, practice stats, or improvement plans from actual project data. This creates a polished-looking UI that doesn't reflect reality.

- **Temporal evaluator is a standalone island.** `src/ui/temporal/` (1,944 lines, 7 files) powers the Temporal Evaluator page but doesn't share state with the main workspace. It has its own engine, scenarios, and types. Useful for debugging but disconnected from the product workflow.

- **Constraint Validator page is also isolated.** `ConstraintValidatorPage.tsx` (186 lines) plus `test/validator/` is another standalone debugging tool. Two separate debug/validation pages plus an optimizer debug page = 3 developer pages with no clear user-facing purpose.

- **Pattern Composer / Loop Editor complexity.** `src/ui/components/loop-editor/` (10 files, ~1,600 lines) plus `WorkspacePatternStudio.tsx` (407 lines) and supporting state (`loopEditorReducer.ts`, 359 lines) is substantial infrastructure. It's unclear how much this is being used vs. the MIDI import path. If most users import MIDI, this is a large surface area to maintain for a secondary workflow.

- **`projectState.ts` is a monolith.** At 832 lines it combines ProjectState type, derived helpers, all action types, ephemeral action classification, reducer helpers, the full reducer, and empty state factory. It works but is getting close to the point where splitting (e.g., actions into their own file, derived helpers separate) would help readability.

- **`useAutoAnalysis.ts` (473 lines) does too many things.** It handles auto-analysis on layout changes, full multi-candidate generation, single cost calculation, pose0 initialization, constraint building, and optimizer dispatch. It's the integration hub but the responsibility is wide.

## Best Next Opportunities

### 1. Fix TypeScript errors (immediate, ~30 min)

Five type errors from a recent refactor. Two are prop mismatches (`onCompare` on `CandidatePreviewCard`), three are unused imports/destructures. These should be fixed before any other work — a broken `tsc` means regressions go undetected.

### 2. Remove dead code (~1 hour)

- Delete `src/engine/diagnostics/legacyCosts.ts` (392 lines) — zero imports
- Delete `src/ui/fixtures/feasibilityDemos.ts` (214 lines) — zero imports
- Delete `src/ui/components/AnalysisSidePanel.tsx` (163 lines) — defined but never imported
- Remove unused import of `MiniGridPreview` from `CompareModal.tsx`
- Remove unused `calculateCost` destructure from `PerformanceWorkspace.tsx`
- Remove unused `exportProjectToFile` import from `WorkspaceToolbar.tsx`

This is free complexity reduction. ~770 lines of dead code removed.

### 3. Decide on the homepage data strategy (decision needed)

The homepage has polished cards showing readiness scores, practice stats, improvement plans, and suggested similarities — all backed by fake data. There are two options:

- **Option A: Build real data pipelines.** Compute actual readiness from solver results, track practice history in localStorage, derive improvement suggestions from cost breakdowns. This is real product work but makes the homepage honest.
- **Option B: Simplify the homepage.** Strip the fake-data cards back to just project list + quick actions + recent activity. Less impressive but less misleading.

This is the biggest open product question. The current state is a liability: it looks finished but isn't.

### 4. Consolidate or clarify the dev/debug pages

Three separate pages (Optimizer Debug, Temporal Evaluator, Constraint Validator) serve developer/debugging purposes. Consider:
- Are these worth maintaining as separate routes, or should they be combined into a single "Developer Tools" page?
- Should they be behind a feature flag or settings toggle so they don't clutter the nav for regular users?
- The Temporal Evaluator (1,944 lines) is the most isolated — if it's not actively being used, it could be archived.

### 5. Split `useAutoAnalysis` responsibilities

The hook is the primary integration point between UI and engine, but at 473 lines it handles too many concerns. Consider splitting into:
- `useAutoAnalysis` — just the auto-reanalysis on layout change
- `useGenerateCandidates` — multi-candidate generation + optimizer dispatch
- `useCostEvaluation` — manual cost calculation

This makes each hook testable and the responsibilities clearer.

### 6. Assess Pattern Composer usage and maintenance burden

The loop editor / pattern composer system is ~2,400 lines across components, state, and storage. If the primary user workflow is MIDI import → layout → optimize → compare, the pattern composer may be over-invested. Worth deciding: is this a core workflow or an advanced feature? If advanced, it could be deprioritized for maintenance.

## What Should Wait

- **Beam solver refactoring.** At 1,293 lines it's large but stable. All 8 smoke tests pass. Refactoring the core solver is high-risk for low payoff right now.

- **Cost model unification.** The coexistence of CostDimensions (5D), V1CostBreakdown (7D), and DiagnosticFactors is intentional and documented. Unifying them would touch many files for marginal benefit. Wait until there's a concrete reason.

- **`projectState.ts` split.** At 832 lines it's approaching the point where splitting would help, but it works correctly and all state transitions are tested. Don't split preemptively — wait until the next time you need to add significant state.

- **Mobile/responsive.** The CLAUDE.md explicitly states desktop-only. Don't invest here.

- **Deeper engine architecture changes.** The priority order in CLAUDE.md is clear: align product state first, solver inputs second, then unify scoring, then candidates, then compare, and only then deeper engine refactor. The current codebase is roughly at step 4-5. Don't jump to step 6.

- **Pattern composer expansion.** Until the usage question is resolved (see #6 above), don't add new features to the pattern composer.

## Recommended Next Steps

### Step 1: Fix TypeScript errors and remove dead code

**Why:** This is pure hygiene with zero risk. A clean `tsc --noEmit` is the first line of defense against regressions. Dead code removal reduces cognitive load for anyone reading the codebase. Combined, this is ~1 hour of work that makes everything else easier.

**Scope:**
- Fix 5 TS errors (prop mismatch, unused imports)
- Delete `legacyCosts.ts`, `feasibilityDemos.ts`
- Verify all 548 tests still pass
- Verify `tsc --noEmit` is clean

### Step 2: Resolve the homepage data question

**Why:** The homepage is the first thing users see. Having polished cards with fake data creates a credibility gap — it looks like the product tracks practice data when it doesn't. This needs a deliberate decision, not gradual drift. Either invest in making it real or simplify it to what's honest.

**Approach:** Review the 8 homepage cards, identify which could plausibly be backed by real data from existing project/analysis results, and which require net-new data pipelines. Make a call on each card: keep with real data, simplify, or remove.

### Step 3: Tighten the workspace experience

**Why:** After cleanup and homepage resolution, the highest-value work is making the main editing → optimization → comparison loop as tight as possible. This means:
- Ensure the analysis panel updates correctly and quickly after layout changes
- Make candidate comparison intuitive (the compare modal exists but the `onCompare` prop error suggests it's partially wired)
- Make move-trace replay smooth for the greedy optimizer (the infrastructure exists via `moveHistory` state)
- Consider whether the Events tab in the left panel has the right information density

This is incremental UX refinement on the core workflow, not new feature work.
