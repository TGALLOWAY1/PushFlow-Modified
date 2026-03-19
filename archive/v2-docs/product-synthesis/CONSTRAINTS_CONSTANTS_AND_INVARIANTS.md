# Constraints, Constants, and Invariants

## Scope

This document captures behavior-shaping rules found in the current codebase. It includes explicit domain constraints, product assumptions, technical constraints, and major tunable constants that materially affect system behavior.

Primary evidence:

- `docs/canonical_product_spec.md`
- `src/types/padGrid.ts`
- `src/ui/state/projectState.ts`
- `src/ui/hooks/useAutoAnalysis.ts`
- `src/engine/prior/biomechanicalModel.ts`
- `src/engine/prior/feasibility.ts`
- `src/engine/prior/naturalHandPose.ts`
- `src/engine/solvers/beamSolver.ts`
- `src/engine/evaluation/difficultyScoring.ts`
- `src/engine/optimization/annealingSolver.ts`
- `src/engine/optimization/mutationService.ts`
- `src/engine/structure/sectionDetection.ts`
- `src/ui/components/UnifiedTimeline.tsx`
- `src/ui/components/InteractiveGrid.tsx`
- `src/engine/debug/sanityChecks.ts`

## Product Constraints

| Name | Description | Where Defined / Enforced | Enforced Consistently? | Risk If Violated |
|---|---|---|---|---|
| Push surface is fixed 8x8 | Product assumes an 8-row, 8-column Push grid | canonical docs, `src/types/padGrid.ts`, `InstrumentConfig` defaults | Mostly yes | Many layout, mapping, and visualization assumptions break |
| Pad identity is physical, not MIDI identity | Physical pad `(row,col)` is the canonical spatial location | canonical docs, mapping files, grid components | Yes | Product would confuse instrument geometry with note numbering |
| Layout and execution are coupled artifacts | Layout alone is not the full answer; execution over time matters | canonical docs, candidate types, solver/optimizer | Yes in engine/docs | Product degrades into static mapping tool |
| Events must be evaluated temporally | Transitions, simultaneity, and sequence burden matter | beam solver grouping, difficulty analysis, tests | Yes | Could claim playability for impossible transitions |
| Unmuted material defines active analysis | Muted sounds are excluded from derived performance | `getActivePerformance()`, `getActiveStreams()` | Yes | User sees analysis for sounds they are not intending to perform |
| Current workspace couples time and space | Timeline and grid are intended to remain visible parts of one workflow | `docs/ux-v1-restructure-plan.md`, `PerformanceWorkspace` | Partially | User mental model fragments into separate tools again |
| Composer output affects the shared project, not a sandbox copy | Pattern edits sync into the shared performance timeline | `WorkspacePatternStudio` | Yes in code | Users may unintentionally overwrite or reshape main project state |

## Domain Constraints

| Name | Description | Where Defined / Enforced | Enforced Consistently? | Risk If Violated |
|---|---|---|---|---|
| One imported sound stream per unique MIDI note | Import groups by note number, not by source track | `src/import/midiImport.ts` | Yes for library import | Musical identity can be oversimplified for multi-track sources |
| Timeline import creates one lane per unique pitch per file | Lane import preserves source files and groups by pitch | `src/ui/hooks/useLaneImport.ts` | Yes | Imported authoring model diverges unpredictably from library import model |
| Simultaneous events are solved as groups | Chords/coincident hits must be assigned together | `beamSolver`, `eventGrouping`, feasibility code | Yes | Solver could assign impossible overlapping fingers |
| No two simultaneous notes may share the same finger | Grip generation rejects finger conflicts | `src/engine/prior/feasibility.ts` | Yes | Unrealistic chord solutions |
| Feasibility uses strict -> relaxed -> fallback tiers | Solver always tries hard realism first, then softened rules, then fallback | `feasibility.ts`, `beamSolver.ts` | Yes | Either too brittle or too permissive if tiers collapse |
| Fallback grip must still preserve anatomical order | Last-resort assignment still respects left-to-right finger ordering per hand | `src/engine/prior/feasibility.ts` | Yes | Solver would invent visibly irrational assignments |
| Hand zones are soft, not absolute | Cross-hand use is allowed but penalized | canonical docs, prior model, debug heuristics | Mostly | Hard partitions would overconstrain real playability |
| Pad-level finger constraints become hard solver assignments | Constrained pads force hand/finger on all matching events | `src/ui/hooks/useAutoAnalysis.ts` | Yes | Constraint UI would become cosmetic and misleading |
| Layout edits invalidate analysis | Any pad assignment change marks analysis stale and clears cache | `projectState.ts` | Yes | Users would trust stale analysis |

## Technical Constraints

| Name | Description | Where Defined / Enforced | Enforced Consistently? | Risk If Violated |
|---|---|---|---|---|
| LocalStorage is the primary persistence layer | Projects, presets, and older loop state are stored locally | `projectStorage.ts`, `presetStorage.ts`, `loopStorage.ts` | Yes | Loss of state if browser storage is cleared or schema drifts |
| No schema versioning for projects | Load uses validation/hydration fallbacks rather than explicit version migration | `projectStorage.ts` | Partially | Old projects can hydrate ambiguously |
| Analysis auto-runs only after debounce | Re-analysis is delayed rather than immediate | `useAutoAnalysis.ts` | Yes | Short windows where analysis is stale |
| Timeline sync silently mutates source model | `performanceLanes` can regenerate `soundStreams` and vice versa | `UnifiedTimeline.tsx` | Yes | Hidden data-shape changes confuse authorship/source-of-truth |
| Candidate generation count is fixed to 3 in current UI flow | Full generation produces three candidates | `useAutoAnalysis.ts`, candidate generator | Yes in current surface | Product implies broader search than the UI currently exposes |
| Empty layouts are auto-filled chromatically before generation | Generate from scratch first creates visible pad assignments | `useAutoAnalysis.ts` | Yes | Users may mistake heuristic seed for optimized intent |
| Debug dashboard depends on global window payload | Debug route is not independently data-loading | `OptimizerDebugPage.tsx` | Yes | Hidden route fails silently without external setup |

## Constants and Tunables

Only constants that materially affect current product behavior are listed here.

### Surface and UI Constants

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| `GRID_ROWS` | `8` | Push grid row count | `src/types/padGrid.ts` | Fixed geometry |
| `GRID_COLS` | `8` | Push grid column count | `src/types/padGrid.ts` | Fixed geometry |
| `GRID_SIZE` | `64` | Total pads | `src/types/padGrid.ts` | Fixed geometry |
| `IMPOSSIBLE_REACH_THRESHOLD` | `5` | Grid highlight threshold for impossible moves in current grid UI | `src/ui/components/InteractiveGrid.tsx` | Shapes user-facing warning overlays |
| `MIN_ZOOM` / `MAX_ZOOM` / `DEFAULT_ZOOM` | `30 / 500 / 80` px per second | Timeline zoom bounds | `src/ui/components/UnifiedTimeline.tsx` | Controls how dense performances can be inspected |
| `TRACK_HEIGHT` | `32` | Timeline lane row height | `src/ui/components/UnifiedTimeline.tsx` | Affects readability of dense projects |
| `AUTO_ANALYSIS_DEBOUNCE_MS` | `1000` ms | Delay before re-analysis after stale change | `src/ui/hooks/useAutoAnalysis.ts` | Creates visible stale-analysis window |

### Engine Defaults and Core Parameters

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| default `beamWidth` | `30` | Main solver search width in project defaults | `createEmptyProjectState()` | Governs search breadth |
| default `stiffness` | `0.3` | Engine configuration default | `createEmptyProjectState()` | Affects movement/home-pose behavior |
| default `restingPose` centroids | left `(1.5,3.5)`, right `(5.5,3.5)` | Initial hand-centroid priors | `createEmptyProjectState()` | Influences naturalness/drift interpretation |
| `TIME_EPSILON` | `0.001` s | Timestamp grouping tolerance for simultaneous events | `beamSolver.ts` | Determines what counts as the same event group |
| alternation weight | `0.8` | Weight of alternation signal in beam score | `beamSolver.ts` | Shapes preference for finger alternation |
| hand balance weight | `0.3` | Weight of hand-balance term in beam score | `beamSolver.ts` | Shapes left/right workload distribution |
| lookahead bonus | up to `20%` of step cost | Future-aware planning bonus | `beamSolver.ts` | Makes solver less greedy |

### Biomechanical / Feasibility Constants

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| `MAX_FINGER_SPAN_STRICT` | `5.5` | Strict same-hand finger spread limit | `biomechanicalModel.ts` | Rejects unrealistic stretches |
| `RELAXED_SPAN_MULTIPLIER` | `1.15` | Relaxed-mode stretch allowance | `biomechanicalModel.ts` | Allows fallback-but-costly grips |
| `MAX_HAND_SPAN` | `5.5` | Maximum hand span | `biomechanicalModel.ts` | Hard anatomical bound |
| `MAX_REACH_GRID_UNITS` | `5.0` | Reach limit in grid units | `biomechanicalModel.ts` | Influences feasibility and movement reasoning |
| `MAX_SPEED_UNITS_PER_SEC` | `12.0` | Maximum movement speed | `biomechanicalModel.ts` | Makes tempo matter physically |
| `RELAXED_GRIP_PENALTY` | `200` | Penalty for relaxed grip tier | `biomechanicalModel.ts` | Strongly discourages non-ideal grips |
| `FALLBACK_GRIP_PENALTY` | `1000` | Penalty for last-resort grip tier | `biomechanicalModel.ts` | Marks solutions as technically possible but poor |
| `ALTERNATION_DT_THRESHOLD` | `0.25` s | Time threshold for alternation penalty logic | `biomechanicalModel.ts` | Defines when repeated finger use becomes undesirable |
| `ALTERNATION_PENALTY` | `1.5` | Repetition burden penalty | `biomechanicalModel.ts` | Influences repeated-hit ergonomics |
| `HAND_BALANCE_TARGET_LEFT` | `0.45` | Target left-hand share | `biomechanicalModel.ts` | Defines preferred asymmetry rather than perfect 50/50 |
| `ACTIVATION_COST` | `5.0` | Cost of finger activation | `biomechanicalModel.ts` | Affects event cost structure |

### Difficulty / Optimization Tunables

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| difficulty thresholds | `easy 0.2`, `moderate 0.45`, `hard 0.7` | Passage difficulty cutoffs | `difficultyScoring.ts` | Drives labeling and interpretation |
| role weights | backbone `1.5`, lead `1.3`, fill `0.8`, texture `0.7`, accent `0.6` | Relative role importance in difficulty analysis | `difficultyScoring.ts` | Musical role changes burden interpretation |
| fast optimization config | `3000` iterations, temp `500`, cooling `0.997`, restarts `0` | Faster annealing preset | `annealingSolver.ts` | Defines current `Quick` behavior |
| deep optimization config | `8000` iterations, temp `500`, cooling `0.9985`, restarts `3` | Deeper annealing preset | `annealingSolver.ts` | Defines current `Thorough` behavior |
| mutation distribution | swap `35%`, move `35%`, cluster swap `15%`, row/col shift `15%` | Layout mutation mix | `mutationService.ts` | Shapes candidate exploration |
| candidate strategies | baseline, compact-right, compact-left | Seeded strategy set | `multiCandidateGenerator.ts` | Hardcodes current comparison space |

### Structural Analysis Constants

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| `DEFAULT_GAP_THRESHOLD` | `2.0` s | Section split gap threshold | `sectionDetection.ts` | Affects detected sections and passage difficulty |
| `MIN_SECTION_DURATION` | `0.5` s | Minimum section duration | `sectionDetection.ts` | Prevents micro-sections |
| density window / step | `1.0` s / `0.25` s | Density-analysis sampling | `densityAnalysis.ts` | Shapes density profile and difficulty framing |

### Debug and Sanity Thresholds

| Name | Value | Meaning | Where Defined | Product Impact |
|---|---|---|---|---|
| max pinky share | `20%` | Sanity threshold | `sanityChecks.ts` | Flags suspicious overuse |
| max thumb share | `15%` | Sanity threshold | `sanityChecks.ts` | Flags suspicious thumb dependence |
| max zone violations | `10%` | Sanity threshold | `sanityChecks.ts` | Encodes acceptable zone crossing rate |
| max impossible moves | `0` | Sanity threshold | `sanityChecks.ts` | Treats impossible moves as unacceptable |
| max hand imbalance | `80%` | Sanity threshold | `sanityChecks.ts` | Flags extreme workload skew |
| max same-finger repeat | `30%` | Sanity threshold | `sanityChecks.ts` | Flags poor alternation |

## Invariants

| Invariant | Description | Where Defined or Enforced | Enforced Consistently? | Risk If Violated |
|---|---|---|---|---|
| Active project always has an active layout ID | Projects are created with a default layout and active layout reference | `ProjectLibraryPage`, `createEmptyProjectState()` | Mostly | Grid/editor actions fail or go null |
| Any layout mutation invalidates analysis cache | Edits set `analysisStale: true` and clear layout `scoreCache` | `projectState.ts` | Yes | User trusts obsolete results |
| Transport state is ephemeral | Playback position and processing state are not part of undo/persisted truth | `projectState.ts`, `projectStorage.ts` | Yes | Undo history becomes polluted with UI motion |
| Project load resets ephemeral state | Loading clears selected event, compare mode, processing, errors, playback | `LOAD_PROJECT` reducer branch | Yes | Old UI selection leaks across sessions |
| `soundStreams` only include active imported/derived voices | Streams are the basis for derived `Performance` | `getActivePerformance()` | Yes | Solver consumes incorrect timeline |
| When lanes exist, timeline sync can overwrite streams | Lane model becomes a practical source of truth | `UnifiedTimeline.tsx` | Yes | User edits one representation and unexpectedly changes another |
| Pad keys use `"row,col"` format | Grid mapping lookup and constraints depend on canonical key strings | `layout.ts`, reducer, grid components | Yes | Mapping and constraint lookups break |
| Candidate solutions package layout and execution together | Candidate is not only layout or only metrics | `CandidateSolution` type | Yes | Comparison loses meaning |
| Hidden debug route requires external data | Debug page assumes `window.__PUSHFLOW_DEBUG__` availability | `OptimizerDebugPage.tsx` | Yes | Route appears empty/broken without setup |

## First-Draft Constraint Reading

The repo contains many explicit physical and algorithmic constraints, and those are relatively disciplined. The weaker area is product-level constraint clarity: several hidden behavioral rules, especially lane/stream synchronization and composer live sync, act like major product constraints without being framed that way in the UI. Those invisible rules are likely a major source of confusion because they materially change the user's "real" project state.
