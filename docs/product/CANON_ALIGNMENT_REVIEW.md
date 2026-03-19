# Canon Alignment Review

**Date:** 2026-03-19
**Scope:** Full codebase review against the four canonical documents.

---

## Overall Assessment

The engine layer is **strongly aligned** with the canon. The state model and workflow actions are **correctly implemented**. The main gaps are in UI presentation: cost breakdown structure, terminology consistency, and a few missing surface features.

---

## 1. Layout State Model

**Status: Strong**

The canon requires four distinct states: Active Layout, Working/Test Layout, Saved Layout Variant, and Candidate Solution. The codebase implements all four correctly.

### What works

- `LayoutRole` type (`src/types/layout.ts:30`) correctly enumerates `'active' | 'working' | 'variant'`.
- Strict role validation enforces invariants (active has no baselineId, working requires baselineId, variant requires both baselineId and savedAt).
- All manual edits target Working/Test Layout by default via `updateWorkingLayout()` (`src/ui/state/projectState.ts:333-346`).
- Promotion auto-saves the replaced Active Layout as a variant (`projectState.ts:665-675`).
- Discard correctly abandons the Working/Test Layout and invalidates analysis.
- Working layouts are session-scoped and stripped on save/load.

### Deviations

| Issue | Location | Canon requirement |
|---|---|---|
| **Candidates are persisted** | `projectStorage.ts:317` loads candidates from storage | Canon treats candidates as ephemeral proposals. Currently they survive save/load, contradicting their "proposal" nature. Either strip on save or document as intentional. |
| **No explicit "Candidate Solution" label in UI** | `CandidatePreviewCard.tsx` | Cards show rank (#1, #2) and strategy name but never say "Candidate Solution". The user may not understand these are a distinct workflow state. |
| **Candidate layouts have ambiguous roles** | `candidateSolution.ts` | A CandidateSolution contains a Layout, but that layout doesn't carry `role='candidate'`. Its role is inherited from the source layout, creating ambiguity about the layout's workflow state in execution plans. |

---

## 2. Sound Identity

**Status: Functionally correct, terminology mixed**

### What works

- MIDI pitch is correctly treated as metadata only (`midiImport.ts:137-141`).
- `bottomLeftNote` always stays at 36/C1. No auto-adjustment.
- Sound identity (Voice) is stable across grid, timeline, compare, diagnostics, and persistence.
- Voice IDs survive clone, promote, variant save, and discard.

### Deviations

| Issue | Location | Canon requirement |
|---|---|---|
| **"Voice" used instead of "Sound identity"** | `src/types/voice.ts`, `VoicePalette.tsx`, action names like `REMOVE_VOICE_FROM_PAD` | Canon defines "Sound identity" as the canonical term. Internal types use "Voice" throughout. UI labels are mixed: some say "Sounds" (workspace tab), others imply "Voice" (component names). |

This is a cosmetic/terminology issue. No functional impact, but creates confusion when reading code against the canon.

---

## 3. Engine Contract

**Status: Strongly aligned across all six dimensions**

### 3a. Feasibility

- `FeasibilityVerdict` (`diagnostics.ts:77-84`) with explicit levels: feasible/degraded/infeasible.
- Five named reason types: `unplayable_event`, `unmapped_note`, `fallback_grip`, `extreme_stretch`, `hard_event`.
- No silent fallback. Grips are binary (strict only) since Phase 8.

### 3b. Scoring and Cost

- Single `PerformabilityObjective` (`objective.ts:39-46`) with 3 components.
- `CostDimensions` (`costBreakdown.ts:29-42`) with 5 stable named factors.
- Canonical evaluator (`canonicalEvaluator.ts`) provides solver-independent evaluation using the same atomic cost functions as the beam solver.
- Legacy 7-component `ObjectiveComponents` explicitly removed in Phase 8.

### 3c. Diversity

- `computeLayoutDiversity()` (`diversityMeasurement.ts:70-132`) measures against baseline.
- `classifyDiversityLevel()` returns explicit levels: identical/trivial/low/moderate/high.
- `filterTrivialDuplicates()` rejects cosmetic copies during generation.
- `explainLowDiversity()` generates user-facing explanations.

### 3d. Diagnostics

- `DiagnosticsPayload` (`diagnostics.ts:287-298`) carries feasibility, factors, topContributors.
- `DiagnosticFactors` has 5 stable named fields.
- Beam solver correctly populates complete payload (`beamSolver.ts:923-928`).

### 3e. Event Analysis

- `ExecutionPlanLayoutBinding` (`executionPlan.ts:195-202`) tracks layoutId, layoutHash, layoutRole.
- `checkPlanFreshness()` (`executionPlanValidation.ts:36-76`) detects staleness.
- `EventExplainer` produces structured explanations with canonical factor mapping.

### 3f. Stable Sound Identity

- Voice.id used consistently as canonical identity across layout, execution plan, and diagnostics.

**No engine contract issues found.**

---

## 4. UI Surface Features

### 4a. Portfolio Page

**Status: Partial alignment**

- Project cards with name, last updated, and grid thumbnail: present.
- Avoids deep editing: correct.
- **Gap:** No timeline or event sequence visualization on cards. Canon requires "show timeline or project summary."
- **Gap:** Some card data (improvementScore, practiceStatus) appears to be mock/placeholder, not derived from real project state.

### 4b. Sounds / Events Panel

**Status: Well aligned**

- Shared tabbed panel with Sounds and Events tabs in workspace.
- Sounds tab: editable name, color picker, assigned/unassigned grouping, drag-to-grid, event count, hand/finger preference dropdowns.
- Events tab: event list with difficulty indicators (color-coded cost), event selection syncing with grid/timeline, keyboard navigation.
- **Gap:** Lock state display is minimal. No explicit lock icon in the Sounds panel. Canon says "lock or unlock placement state visibility."

### 4c. Grid Editor

**Status: Strong alignment**

- Layout state badge in toolbar: "Working Draft" (amber) vs "Active" (emerald) (`WorkspaceToolbar.tsx:162-170`).
- Full assignment support: assign, move, swap, clear, drag-and-drop.
- Event overlay with finger labels.
- Promote, Save Variant, and Discard buttons in toolbar when working changes exist.
- **Gap:** No per-pad visual lock icon. Lock state only visible in tooltips.

### 4d. Timeline / Composer

**Status: Adequate**

- Swim-lane timeline showing all sound streams.
- Playhead with time tracking.
- Event selection syncs with grid.
- Pattern Composer accessible via toolbar toggle.
- **Gap:** No per-event difficulty coloring in the timeline. Canon requires "show dense or difficult passages."

### 4e. Cost Breakdown -- MOST SIGNIFICANT GAP

**Status: Structurally misaligned**

The canon explicitly requires: **"separate feasibility, ergonomics, and difficulty"** as a clear three-layer presentation.

Current implementation (`CostBreakdownBars.tsx`):
- Shows four bars: Stretch, Movement, Speed, Repetition.
- These are raw cost factors, not organized into the canon's three-layer structure.
- **"Speed" maps to `constraintPenalty`** which is documented as "always 0 in V1" -- this bar is permanently empty and misleading.
- **"Repetition" maps to `handBalance`** -- label does not match the actual metric.
- No feasibility verdict shown alongside cost bars.
- No separation between "can this be played" (feasibility), "how comfortable is it" (ergonomics), and "how hard are the passages" (difficulty).
- Event-level cost breakdown exists in `EventCostChart` but is labeled as generic "cost," not classified by difficulty tier.

**What the canon expects:**
1. First: feasibility verdict (can this layout be played?)
2. Then: ergonomic cost breakdown (grip quality, movement, balance, alternation)
3. Then: difficulty analysis (which events/passages are hardest and why)

**What exists:** A flat list of four mislabeled cost bars with no hierarchy.

### 4f. Layout Candidates

**Status: Strong alignment**

- Candidate list with tradeoff profile summaries (playability, compactness, balance, transition efficiency).
- Promote and Save Variant actions on cards.
- Compare selection with multi-select checkboxes.
- **Gap:** No explicit "N pads differ from Active" count on candidate cards. Diffs only visible in CompareModal.
- **Gap:** No user-facing explanation when diversity is low due to constraints.

### 4g. Cross-Surface Rules

| Rule | Status | Detail |
|---|---|---|
| User always knows which layout state is being viewed | Partial | Toolbar badge works for Active/Working. No explicit label when viewing analysis for a selected candidate. |
| Analyze and Generate are visually distinct | Partial | Generate has a prominent button. Analysis is passive/auto-triggered. No visual "Analyze" action or phase indicator. Canon says these "must remain visibly distinct." |
| Compare is inspection-only | Aligned | CompareModal is read-only. |
| Stable sound identity across surfaces | Aligned | Sound data consistent everywhere. |
| Event analysis is local explanation, not separate truth | Aligned | Event selection shows local cost detail inline. |

---

## 5. Priority Gaps (Ordered by Impact)

### P1: Cost Breakdown structure does not match canon

The cost presentation is the most significant gap. The canon requires a three-layer story (feasibility, ergonomics, difficulty) and the UI shows a flat, partially mislabeled bar chart. This directly undermines the product promise of helping users understand *why* a layout is good or bad.

**Files:** `CostBreakdownBars.tsx`, `ActiveLayoutSummary.tsx`, `DiagnosticsPanel.tsx`

### P2: Analyze vs Generate not visually distinct

Canon rule 9 says "Generation and analysis are different actions" and they "must remain visibly distinct." Currently analysis auto-runs silently while Generate has a button. The user cannot tell when they are in an "analysis phase" vs a "generation phase."

**Files:** `WorkspaceToolbar.tsx`, `PerformanceWorkspace.tsx`

### P3: Candidate persistence contradicts ephemeral nature

Candidates surviving save/load blurs the line between "proposal" and "project truth." Either strip candidates on save or explicitly document this as an intentional design choice.

**Files:** `projectStorage.ts`

### P4: Timeline lacks difficulty indication

The timeline shows events but not their difficulty. Dense or problematic passages are not visually highlighted. This makes the timeline a structural display rather than an analytical one.

**Files:** `UnifiedTimeline.tsx`, `ExecutionTimeline.tsx`

### P5: Lock state not visually prominent

Placement locks are the "main hard user-facing placement rule" per the canon, but they have minimal visual presence (tooltips only, no pad-level icons).

**Files:** `InteractiveGrid.tsx`, `VoicePalette.tsx`

### P6: Voice/Sound terminology inconsistency

Internal code uses "Voice" while the canon uses "Sound identity." UI labels are mixed. Not blocking but creates confusion.

**Files:** `src/types/voice.ts`, `VoicePalette.tsx`, action types in `projectState.ts`

---

## 6. What Does Not Need to Change

- Engine feasibility, scoring, diversity, diagnostics, and event analysis are all aligned.
- Layout state model (Active/Working/Variant) is correctly implemented with proper invariants.
- Promotion, discard, and save-as-variant workflows are correct.
- Sound identity is functionally stable across all surfaces.
- MIDI pitch independence is correctly enforced.
- Staleness detection works properly.
- Compare mode is correctly read-only.
