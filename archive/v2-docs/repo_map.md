# Repo Map

This file describes the current repository structure and implementation entry points for the performance ergonomics system.

## Purpose

This document is intentionally implementation-specific.

Use it to:
- orient new contributors
- locate current entry points
- identify source-of-truth state
- identify fragile or high-impact flows
- connect canonical product intent to current code

This file is **not canonical product truth**.
It is a map of the current repository.

---

## How to Maintain This File

Whenever major refactors happen, update:
- entry points
- state ownership
- import pipeline
- optimizer entry points
- persistence / hydration flow
- current fragile areas

Prefer concise summaries over exhaustive code dumps.

---

## Current Project Summary

### 1. Runtime Entry Points

**Files**
- `src/main.tsx` — React app bootstrap (StrictMode → `<App />`)
- `src/ui/App.tsx` — BrowserRouter with two routes
- `src/ui/pages/ProjectLibraryPage.tsx` — `/` route, project gallery + MIDI import + demo loading
- `src/ui/pages/ProjectEditorPage.tsx` — `/project/:id` route, grid editor + analysis workflow

**Current responsibility**
- `main.tsx` mounts the React root
- `App.tsx` provides routing; no global state provider at this level
- `ProjectEditorPage` loads project from localStorage by route param `id`, wraps children in `ProjectProvider`

**Important invariants**
- All project state is scoped to `ProjectProvider` inside the editor page
- No global state leaks between routes

---

### 2. Core State Ownership

**Files**
- `src/ui/state/projectState.ts` — `ProjectState` type, `projectReducer`, action types
- `src/ui/state/ProjectContext.tsx` — React context provider wrapping `useReducer` + `useUndoRedo`
- `src/ui/state/useUndoRedo.ts` — Undo/redo stack with ephemeral action filtering

**Source of truth**
- `ProjectState` (via `projectReducer`) owns all authoritative state
- `soundStreams[]` — canonical performance data (one SoundStream per unique MIDI note)
- `layouts[]` + `activeLayoutId` — layout selection
- `analysisResult` + `candidates[]` — analysis cache
- `engineConfig` — solver parameters (beamWidth, stiffness, restingPose)

**Derived state**
- `getActivePerformance(state)` — builds `Performance` from unmuted streams (derived, not stored)
- `getActiveLayout(state)` — finds active layout by ID (derived)
- `getActiveStreams(state)` — filters unmuted streams (derived)

**Ephemeral state** (not persisted, not in undo stack)
- `selectedEventIndex`, `compareCandidateId`, `isProcessing`, `error`, `analysisStale`
- Filtered via `isEphemeralAction()` in the undo/redo middleware

**Important invariants**
- Layout edits (`ASSIGN_VOICE_TO_PAD`, `SWAP_PADS`, etc.) always set `analysisStale: true` and clear `scoreCache`
- Ephemeral actions bypass the undo stack entirely
- `soundStreams` is the canonical source; `Performance` is always derived at use-time

---

### 3. MIDI Import Pipeline

**Files**
- `src/import/midiImport.ts` — `parseMidiFile()`

**Pipeline**

1. **File entry** — `ProjectLibraryPage` accepts `.mid` files via file input
2. **Parsing** — `@tonejs/midi` library parses the MIDI binary
3. **Normalization** — auto-adjusts `instrumentConfig.bottomLeftNote` to fit the MIDI note range into the 8×8 grid
4. **Event extraction** — iterates all tracks/notes, creates `PerformanceEvent[]` with deterministic `eventKey` format: `"{ticks}:{noteNumber}:{channel}:{ordinal}"`
5. **Identity grouping** — groups by unique `noteNumber`, creates one `Voice` per unique pitch with deterministic color assignment
6. **Output** — returns `MidiProjectData`: `Performance` + `Voice[]` + `InstrumentConfig` + empty `Layout`

**Important types**
- `Performance` (`src/types/performance.ts`) — `{ events, tempo, name }`
- `PerformanceEvent` (`src/types/performanceEvent.ts`) — `{ noteNumber, startTime, duration, velocity, channel, eventKey }`
- `Voice` (`src/types/voice.ts`) — `{ id, name, sourceType, originalMidiNote, color }`

**Known assumptions**
- Layout starts empty after import; no auto-mapping occurs at import time
- One Voice per unique noteNumber (no multi-track splitting for same pitch)
- Channel information is preserved in eventKey but not used for grouping

---

### 4. Layout / Mapping Model

**Files**
- `src/types/layout.ts` — `Layout` type
- `src/types/padGrid.ts` — `PadCoord`, `GRID_ROWS`, `GRID_COLS`, `padKey()`
- `src/engine/mapping/mappingResolver.ts` — `buildNoteToPadIndex()`, `resolveNoteToPad()`
- `src/engine/mapping/mappingCoverage.ts` — `computeMappingCoverage()`
- `src/engine/mapping/seedFromPose.ts` — `seedLayoutFromPose0()`

**Current types**
- `Layout` — `{ id, name, padToVoice: Record<string, Voice>, fingerConstraints, scoreCache, layoutMode? }`
- `PadCoord` — `{ row: number, col: number }`
- `padKey(row, col)` — canonical string key `"row,col"`

**Grid conventions**
- Row 0 = bottom, row 7 = top (bottom → top)
- Col 0 = left, col 7 = right (left → right)
- `GRID_ROWS = 8`, `GRID_COLS = 8`

**Mapping resolution**
- `buildNoteToPadIndex(layout)` — O(1) lookup from noteNumber → PadCoord
- Two modes: `strict` (fails on unmapped notes) and `allow-fallback` (chromatic row/col fallback)
- Fallback formula: `row = floor((note - bottomLeftNote) / cols)`, `col = (note - bottomLeftNote) % cols`

**Layout seeding**
- `seedLayoutFromPose0(voices)` — places voices on Pose0 anchor pads in finger-priority order, ensuring 100% coverage before optimization

**Important invariants**
- Pad identity is physical `(row, col)`, never conflated with MIDI note number
- `padToVoice` keys use `padKey()` format
- `scoreCache` is nulled on any layout mutation

---

### 5. Execution / Finger Assignment Pipeline

**Files**
- `src/engine/solvers/beamSolver.ts` — `BeamSolver` class, `createBeamSolver()`
- `src/engine/solvers/types.ts` — `Solver` interface, `SolverConfig`
- `src/types/executionPlan.ts` — `ExecutionPlanResult`, `FingerAssignment`
- `src/engine/prior/feasibility.ts` — `generateValidGripsWithTier()`
- `src/engine/evaluation/costFunction.ts` — all cost functions

**How it works**

The `BeamSolver` processes events **in chronological order**, maintaining K best candidate states (hand poses) at each step:

1. Events grouped by timestamp (`TIME_EPSILON = 0.001s`) into `PerformanceGroup`s
2. For each group, resolves note → pad via `mappingResolver`
3. Generates valid grips using tiered feasibility (`strict` → `relaxed` → `fallback`)
4. Scores each candidate by `PerformabilityObjective` (3-component):
   - `poseNaturalness` = 0.4 × attractor + 0.4 × perFingerHome + 0.2 × dominance
   - `transitionDifficulty` = Fitts's law movement cost with speed constraint
   - `constraintPenalty` = penalty for relaxed/fallback grips
5. Keeps top-K states across beam, advances to next group
6. Returns `ExecutionPlanResult` with per-event `FingerAssignment[]`

**Key types**
- `FingerAssignment` — `{ startTime, noteNumber, row, col, eventIndex, assignedHand, finger, cost, costBreakdown, gripTier }`
- `ExecutionPlanResult` — `{ fingerAssignments[], score, averageDrift, averageMetrics, fingerUsageStats, unplayableCount }`

**Simultaneity handling**
- Events at the same timestamp are grouped and solved as a chord
- Grip generation ensures no two notes share the same finger
- Both single-hand and split-hand chord assignments are considered

**Important invariants**
- Execution plan is genuinely temporal — hand state (left/right pose) evolves across the sequence
- Lookahead hints future pads for better planning
- Layout must be fixed before execution plan generation (they are coupled via the outer optimizer)

---

### 6. Optimization / Evaluation Entry Points

**Files**
- `src/engine/optimization/annealingSolver.ts` — `AnnealingSolver`, layout-level optimizer
- `src/engine/optimization/multiCandidateGenerator.ts` — `generateCandidates()`
- `src/engine/optimization/mutationService.ts` — `applyRandomMutation()`, `getEmptyPads()`
- `src/engine/optimization/candidateRanker.ts` — `rankCandidates()`, `filterPareto()`

**Candidate generation**
- `generateCandidates(performance, voices, config)` produces 3 candidates:
  1. Baseline (Pose0 seed → annealing)
  2. Compact-right (biased seed → annealing)
  3. Compact-left (biased seed → annealing)
- Each candidate runs `AnnealingSolver` (1000 iterations, temp=500, cooling=0.99) which:
  - Mutates layout (swap pads, move voices)
  - Re-evaluates execution plan via `BeamSolver` at each iteration
  - Uses Metropolis criterion for acceptance

**Evaluation modules**
- `src/engine/evaluation/objective.ts` — `PerformabilityObjective` (3-component scoring), legacy `ObjectiveComponents` (7-component, diagnostic only)
- `src/engine/evaluation/costFunction.ts` — all cost function implementations
- `src/engine/evaluation/difficultyScoring.ts` — `analyzeDifficulty()`, `computeTradeoffProfile()`
- `src/engine/evaluation/passageDifficulty.ts` — per-passage scoring with factor breakdowns

**Biomechanical / ergonomic modules**
- `src/engine/prior/biomechanicalModel.ts` — all constants: `MAX_HAND_SPAN`, `FINGER_PAIR_MAX_SPAN_STRICT/RELAXED`, `FINGER_ORDER`, `FINGER_DOMINANCE_COST`, `MAX_HAND_SPEED`
- `src/engine/prior/feasibility.ts` — tiered grip generation (Tier 1 strict → Tier 2 relaxed → Tier 3 fallback)
- `src/engine/prior/handPose.ts` — neutral hand centers, resting pose computation
- `src/engine/prior/naturalHandPose.ts` — Pose0 definition, offset application
- `src/engine/prior/ergonomicConstants.ts` — finger weights, fatigue decay/accumulation

**Structure analysis**
- `src/engine/structure/performanceAnalyzer.ts` — facade producing `PerformanceStructure`
- `src/engine/structure/sectionDetection.ts` — density-based section splitting
- `src/engine/structure/roleInference.ts` — classifies voices as backbone/lead/fill/texture/accent
- `src/engine/structure/cooccurrence.ts` — simultaneity graph
- `src/engine/structure/transitionGraph.ts` — voice-to-voice transition frequencies

**Important invariants**
- Layout and execution are coupled: `AnnealingSolver` modifies layout, re-evaluates execution plan
- `biomechanicalModel.ts` is the single source of truth for all physical constants
- Feasibility always returns at least one grip (Tier 3 fallback prevents hard failures)

---

### 7. Analysis and Debugging Surfaces

**Files**
- `src/ui/components/AnalysisSidePanel.tsx` — main analysis panel with difficulty overview and candidate switcher
- `src/ui/components/DifficultyHeatmap.tsx` — per-pad difficulty visualization
- `src/ui/components/DiagnosticsPanel.tsx` — advanced debugging (finger usage, fatigue, constraints)
- `src/ui/components/EventDetailPanel.tsx` — inspection panel when an event is selected
- `src/ui/components/ExecutionTimeline.tsx` — per-voice swim lane showing finger assignments over time
- `src/ui/components/TimelinePanel.tsx` — collapsible timeline visualization
- `src/ui/components/CandidateCard.tsx` — summary card for a single candidate
- `src/ui/components/CandidateCompare.tsx` — side-by-side candidate comparison
- `src/ui/components/CompareGridView.tsx` — overlay two candidate layouts on the grid

**Explainability modules**
- `src/engine/analysis/passageAnalyzer.ts` — `analyzePassages()`, `getHardestPassages()`
- `src/engine/analysis/candidateComparator.ts` — `compareCandidates()`, `summarizeComparison()`
- `src/engine/analysis/constraintExplainer.ts` — `explainConstraints()`, `identifyBottlenecks()`

---

### 8. Persistence / Hydration Flow

**Files**
- `src/ui/persistence/projectStorage.ts` — localStorage CRUD + JSON file export/import

**Mechanism**
- localStorage key pattern: `pushflow_project_{id}` for project data, `pushflow_projects` for library index
- `saveProject(state)` strips ephemeral state before persisting
- `loadProject(id)` validates and hydrates with `createEmptyProjectState()` defaults
- `exportProjectToFile()` / `importProjectFromFile()` for `.pushflow.json` files

**Hydration**
- `ProjectEditorPage` calls `loadProject(id)` on mount, dispatches `LOAD_PROJECT`
- `LOAD_PROJECT` resets all ephemeral state and sets `analysisStale: true`
- `useAutoAnalysis` hook watches `analysisStale` flag and triggers re-analysis after debounce

**Known risks**
- `analysisResult` is persisted but cleared on reload via `LOAD_PROJECT` (forces re-analysis)
- `candidates[]` are persisted but may be stale if engine logic changes between sessions
- No schema versioning — old project files may have missing fields (handled by `validateProjectState` fallbacks)

---

### 9. Test Locations

**Root directory:** `test/`

**Configuration:** `vitest.config.ts` — includes `test/**/*.test.ts`, coverage for `src/engine/**/*.ts`

| File | Type | What it tests |
|---|---|---|
| `test/golden/goldenScenarios.test.ts` | Integration | 10 canonical scenarios from the test spec, each with 7 universal pass/fail checks |
| `test/golden/fixtureGenerator.ts` | Fixtures | Programmatic generators for all 10 golden scenarios |
| `test/golden/feasibilityFixtures.ts` | Fixtures | Shared fixture data for atomic and regression feasibility tests |
| `test/engine/solvers/beamSolver.smoke.test.ts` | Unit | BeamSolver basic correctness: single note, sequences, chords, empty input |
| `test/engine/evaluation/performabilityObjective.test.ts` | Unit | 3-component scoring model, cost functions, backward compatibility |
| `test/engine/prior/feasibility.atomic.test.ts` | Unit | 8 atomic feasibility constraint scenarios (A1–A8) |
| `test/engine/prior/feasibility.regression.test.ts` | Regression | 3 pad-move regression scenarios (R1–R3) |
| `test/helpers/testHelpers.ts` | Helpers | Solver creation, assertion functions, test data generators |
| `test/helpers/setup.ts` | Config | Vitest setup (currently empty) |

**Test status:** All 68 tests pass.

**Coverage gaps:**
- No UI component tests
- No persistence/hydration tests
- No AnnealingSolver / multiCandidateGenerator integration tests
- No structure analysis unit tests (sectionDetection, roleInference, etc.)

---

### 10. Known Fragile Areas

**Layout ↔ analysis staleness**
- Any layout edit sets `analysisStale: true`, but analysis only re-runs after debounce in `useAutoAnalysis`
- If the user edits rapidly, stale analysis may briefly display

**Candidate persistence**
- Candidates are persisted to localStorage but their execution plans reference specific layout states
- If the layout is manually edited after candidate generation, persisted candidates become inconsistent

**Chromatic fallback in solver**
- When `mappingResolverMode: 'allow-fallback'`, unmapped notes get chromatic row/col positions
- These fallback positions may not correspond to any voice in the layout, creating phantom pad assignments

**Active layout selection**
- `activeLayoutId` may reference a deleted layout if removal logic doesn't update the ID
- `getActiveLayout()` returns `null` in this case, which callers must handle

**Event key determinism**
- `eventKey` format is `"{ticks}:{noteNumber}:{channel}:{ordinal}"` — stable for the same MIDI file
- Re-importing the same file produces identical keys, but different MIDI renderings of the same music will not match

**UI `cells` variable naming**
- `InteractiveGrid.tsx` and `PadGrid.tsx` use a local variable named `cells` for JSX iteration
- This is not a domain term violation (it's a React rendering detail), but could cause confusion during code review

---

## Important Rule

If current implementation conflicts with canonical product intent:

1. document the current implementation honestly
2. document the mismatch clearly
3. do not silently elevate implementation quirks into product truth
