# Event Model Correction Plan

## 1. Current Behavior

### 1.1 What the system calls an "event"

The system defines `PerformanceEvent` as a single note trigger:

```ts
// src/types/performanceEvent.ts
interface PerformanceEvent {
  noteNumber: number;
  voiceId?: string;
  startTime: number;
  duration?: number;
  velocity?: number;
  eventKey?: string;  // "tick:startTime:noteNumber:ordinal"
}
```

Every MIDI note becomes one `PerformanceEvent`. A chord (Kick + HiHat at time 0.0) produces two separate events, each independently indexed.

### 1.2 How events are constructed

**MIDI import** (`src/import/midiImport.ts`): One `SoundStream` per unique MIDI pitch. Each note-on creates one `SoundEvent` within the stream.

**Performance assembly** (`getActivePerformance()` in `src/ui/state/projectState.ts`): Flattens all unmuted `SoundStream.events[]` into a single `PerformanceEvent[]` sorted by `startTime`. No grouping occurs.

### 1.3 Where temporal grouping happens (partially correct)

Several subsystems re-derive time-slice grouping from the flat per-note array:

| Subsystem | Grouping mechanism | Output unit |
|---|---|---|
| `eventGrouping.ts` | `groupEventsByTime()` with TIME_EPSILON=0.001s | `SimultaneityGroup { startTime, events[] }` |
| `beamSolver.ts` | `groupEventsByTimestamp()` internal | `PerformanceGroup { timestamp, notes[], eventIndices[], activePads[] }` |
| `eventMetrics.ts` | `groupAssignmentsIntoMoments()` with epsilon=1e-4 | `AnalyzedMoment { timestamp, assignments[], pads[] }` |
| `selectionModel.ts` | `buildEventMoments()` by exact startTime match | `EventMoment { startTime, assignments[] }` |
| `transitionAnalyzer.ts` | Operates on `AnalyzedMoment[]` | `Transition { fromMoment, toMoment }` |

Each subsystem independently re-derives the time-slice concept because the source data model lacks it.

### 1.4 Where the per-note model causes problems

**FingerAssignment is per-note.** The solver outputs one `FingerAssignment` per note with an individual `eventIndex` that indexes back into the flat `PerformanceEvent[]` array:

```ts
// src/types/executionPlan.ts
interface FingerAssignment {
  noteNumber: number;
  startTime: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  cost: number;          // Cost is divided per-note, not per-moment
  eventIndex?: number;   // Index into flat PerformanceEvent[]
  // ...
}
```

**selectedEventIndex is per-note.** State holds `selectedEventIndex: number | null` which refers to a `FingerAssignment.eventIndex` — a single note, not a moment. Selecting one note in a chord does not inherently select the moment. Multiple UI layers must independently work around this:

- `InteractiveGrid.tsx`: Finds the selected assignment's timestamp, then highlights ALL pads at that timestamp (manual re-grouping)
- `selectionModel.ts`: `getMomentIndexForSelectedEvent()` looks up the assignment by eventIndex, then finds which moment contains that timestamp
- `EventDetailPanel.tsx`: Shows info for one assignment only (the selected note), not the full moment
- `TransitionDetailPanel.tsx`: Uses `buildSelectedTransitionModel()` which rebuilds moments from scratch

**Cost is divided per-note within groups.** In `beamSolver.ts`, the solver computes a group-level step cost, then divides it equally among notes in the group (`displayStepCost / group.notes.length`). This produces fractional per-note costs that are artifacts of the per-note output format, not meaningful per-note difficulty assessments.

**Event counts and statistics conflate notes with events.** `ExecutionPlanResult.unplayableCount`, `hardCount`, and aggregate metrics all count per-note, inflating numbers for polyphonic moments.

### 1.5 Inconsistent epsilon values

Different grouping subsystems use different epsilon values:
- `eventGrouping.ts`: TIME_EPSILON = 0.001 (1ms)
- `beamSolver.ts`: TIME_EPSILON = 0.001 (1ms)
- `eventMetrics.ts`: EVENT_TIME_EPSILON = 1e-4 (0.1ms)
- `selectionModel.ts`: exact match (no epsilon)

This means the same performance can produce different groupings depending on which subsystem processes it.

---

## 2. Correct Event Model

### 2.1 Core definition

An **Event** (or "Moment") is a time slice: the set of all notes that occur at the same point in time. It is the atomic unit of the performance timeline.

```ts
interface PerformanceEvent {
  /** Canonical moment index (0-based, chronological). */
  momentIndex: number;
  /** Shared timestamp for all notes in this moment. */
  startTime: number;
  /** All note triggers at this moment. */
  notes: NoteInstance[];
}

interface NoteInstance {
  /** Which pad plays this note (row,col key or pad ID). */
  padId: string;
  /** Stable voice/sound identity. */
  soundId: string;
  /** MIDI velocity 0-127. */
  velocity: number;
  /** Solver-assigned finger (null if unsolved). */
  finger?: {
    hand: 'left' | 'right';
    finger: FingerType;
  } | null;
  /** MIDI note number (provenance metadata). */
  noteNumber: number;
  /** Duration in seconds (optional). */
  duration?: number;
  /** Deterministic unique identifier for this note within the moment. */
  noteKey?: string;
}
```

### 2.2 Key principles

1. **The timeline is a sequence of moments**, not a sequence of notes.
2. **Selection operates on moments.** `selectedMomentIndex: number | null` replaces `selectedEventIndex`.
3. **Solver input and output are moment-indexed.** The solver receives moments and returns moment-level assignments.
4. **Transition analysis is between consecutive moments** (already correct in `transitionAnalyzer.ts`).
5. **Cost is per-moment**, not divided per-note. A moment with 3 simultaneous notes has one cost reflecting the difficulty of the combined hand pose, not 3 fractional costs.
6. **One canonical epsilon** for temporal grouping (1ms = 0.001s), shared across the entire system.
7. **Event counts reflect moments**, not note triggers. "5 Hard events" means 5 difficult moments.

### 2.3 Execution plan output

```ts
interface MomentAssignment {
  /** Moment index in the timeline. */
  momentIndex: number;
  /** Timestamp of this moment. */
  startTime: number;
  /** Per-note finger assignments within this moment. */
  noteAssignments: NoteAssignment[];
  /** Moment-level cost (not divided per-note). */
  cost: number;
  /** Moment-level difficulty classification. */
  difficulty: DifficultyLevel;
  /** Moment-level cost breakdown. */
  costBreakdown: DifficultyBreakdown;
}

interface NoteAssignment {
  noteNumber: number;
  soundId: string;
  padId: string;
  row: number;
  col: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  noteKey?: string;
}
```

---

## 3. Required Code Changes

### 3.1 Types layer

| File | Change |
|---|---|
| `src/types/performanceEvent.ts` | Introduce `NoteInstance` type. Redefine `PerformanceEvent` as moment-based (or introduce a parallel `PerformanceMoment` type for incremental migration). |
| `src/types/executionPlan.ts` | Introduce `MomentAssignment` and `NoteAssignment`. Deprecate per-note `FingerAssignment` or retain as internal solver detail that gets rolled up before output. |
| `src/types/performanceStructure.ts` | `SimultaneityGroup` already has the right shape. Consider unifying with the new `PerformanceMoment` type. |

### 3.2 Event construction (import path)

| File | Change |
|---|---|
| `src/import/midiImport.ts` | After creating per-note events, group by timestamp to produce `PerformanceMoment[]`. |
| `src/ui/state/projectState.ts` | `getActivePerformance()` should return moments, not flat notes. `SoundEvent`/`SoundStream` remain per-note (they represent individual sound triggers within a stream). The grouping happens at the Performance assembly boundary. |

### 3.3 Solver

| File | Change |
|---|---|
| `src/engine/solvers/beamSolver.ts` | Already groups by timestamp internally (`PerformanceGroup`). Change: accept `PerformanceMoment[]` directly instead of re-grouping. Output `MomentAssignment[]` instead of per-note `FingerAssignment[]` with divided costs. The internal per-note grip assignment logic stays, but the output rolls up to moment level. |
| `src/engine/structure/eventGrouping.ts` | Becomes a utility used during import/assembly, no longer needed at every consumption point. Standardize on TIME_EPSILON = 0.001. |

### 3.4 Evaluation and analysis

| File | Change |
|---|---|
| `src/engine/evaluation/eventMetrics.ts` | `groupAssignmentsIntoMoments()` becomes unnecessary if solver output is already moment-indexed. `AnalyzedMoment` either unifies with `MomentAssignment` or wraps it with additional computed metrics. |
| `src/engine/evaluation/transitionAnalyzer.ts` | Already correct (operates on moments). Minimal change: accept `MomentAssignment[]` directly. |
| `src/engine/analysis/eventExplainer.ts` | Update to use moment-indexed data. `explainEvent()` becomes `explainMoment()`. |

### 3.5 State management

| File | Change |
|---|---|
| `src/ui/state/projectState.ts` | Replace `selectedEventIndex: number \| null` with `selectedMomentIndex: number \| null`. |
| `src/ui/state/projectReducer.ts` | Rename `SELECT_EVENT` action to `SELECT_MOMENT` (or alias for migration). |
| `src/ui/analysis/selectionModel.ts` | `buildSelectedTransitionModel()` simplifies dramatically — no more rebuilding moments from flat assignments. It directly indexes into `MomentAssignment[]`. `getMomentIndexForSelectedEvent()` becomes a direct lookup. `buildEventMoments()` becomes unnecessary. |

### 3.6 UI components

| File | Change |
|---|---|
| `InteractiveGrid.tsx` | Receives `MomentAssignment[]` instead of `FingerAssignment[]`. Selection highlights the current moment's pads directly (no manual re-grouping). `onEventClick` becomes `onMomentClick`. |
| `UnifiedTimeline.tsx` | Timeline rows map notes within moments. Selection highlights moment boundaries. Click dispatches `SELECT_MOMENT`. |
| `EventDetailPanel.tsx` | Shows moment-level info: all notes in the moment, combined cost, all finger assignments. No longer shows a single isolated note. |
| `TransitionDetailPanel.tsx` | Already moment-oriented via `selectionModel.ts`. Simplifies with direct moment data. |
| `PerformanceWorkspace.tsx` | Pass `selectedMomentIndex` instead of `selectedEventIndex`. |
| `useKeyboardShortcuts.ts` | Arrow key navigation moves between moments (already works because the grid re-groups, but becomes cleaner). |

### 3.7 Hooks

| File | Change |
|---|---|
| `src/ui/hooks/useAutoAnalysis.ts` | Feed `PerformanceMoment[]` to solver. Receive `MomentAssignment[]` back. |

### 3.8 Persistence

| File | Change |
|---|---|
| `src/ui/persistence/projectStorage.ts` | Migration: `selectedEventIndex` → `selectedMomentIndex` (both are ephemeral/not persisted, so no data migration needed). `executionPlan.fingerAssignments` → `executionPlan.momentAssignments` in cached analysis results. |

---

## 4. Impacted Systems

### 4.1 High impact (structural change required)

1. **Type definitions** (`performanceEvent.ts`, `executionPlan.ts`) — Foundation of the change
2. **Beam solver output** (`beamSolver.ts`) — Must output moment-level assignments
3. **Performance assembly** (`getActivePerformance()`) — Must produce moments
4. **Selection model** (`selectionModel.ts`, `projectState.ts`) — `selectedMomentIndex` replaces `selectedEventIndex`
5. **Event detail panel** (`EventDetailPanel.tsx`) — Must show moment, not single note

### 4.2 Medium impact (adapts to new types)

6. **Interactive grid** (`InteractiveGrid.tsx`) — New prop types, simplified highlight logic
7. **Unified timeline** (`UnifiedTimeline.tsx`) — Selection dispatch changes
8. **Transition detail panel** (`TransitionDetailPanel.tsx`) — Simplified data access
9. **Event metrics** (`eventMetrics.ts`) — May be simplified or partially eliminated
10. **Auto-analysis hook** (`useAutoAnalysis.ts`) — Input/output type changes
11. **Keyboard shortcuts** (`useKeyboardShortcuts.ts`) — `SELECT_MOMENT` action

### 4.3 Low impact (minimal or no change)

12. **Transition analyzer** (`transitionAnalyzer.ts`) — Already moment-based, minor type updates
13. **Event explainer** (`eventExplainer.ts`) — Rename + type updates
14. **Event grouping** (`eventGrouping.ts`) — Moves upstream to import; utility simplified
15. **MIDI import** (`midiImport.ts`) — Adds grouping step at end of import
16. **Persistence** (`projectStorage.ts`) — Ephemeral field rename only
17. **Sound streams** (`SoundStream`/`SoundEvent`) — Unchanged; per-note within a stream is correct

### 4.4 Unaffected

- Layout types and management (layout is pad-to-voice, not event-related)
- Optimization/mutation service (operates on layouts, not events)
- Voice constraints (per-stream, not per-event)
- Candidate solution management
- Compare mode (compares layouts/plans, adapts to new plan shape)

---

## 5. Migration Strategy

### Phase A: Foundation types (non-breaking)

**Goal:** Introduce new moment-based types alongside existing types. No behavioral changes.

1. Define `NoteInstance`, `PerformanceMoment`, `MomentAssignment`, `NoteAssignment` in new or existing type files.
2. Define a canonical `MOMENT_EPSILON = 0.001` constant in one shared location.
3. Add `selectedMomentIndex: number | null` to `ProjectState` alongside `selectedEventIndex` (temporary dual support).
4. Write a `buildMoments(events: PerformanceEvent[]): PerformanceMoment[]` utility that uses the canonical epsilon.
5. Write a `toMomentAssignments(assignments: FingerAssignment[]): MomentAssignment[]` adapter that rolls up per-note assignments.

**Validation:** Existing tests pass unchanged. New unit tests for `buildMoments` and `toMomentAssignments`.

### Phase B: Solver output adapter

**Goal:** Wrap solver output in moment-indexed form. Solver internals unchanged.

1. After `beamSolver.solve()` returns `FingerAssignment[]`, run `toMomentAssignments()` to produce `MomentAssignment[]`.
2. Store both `fingerAssignments` (legacy) and `momentAssignments` on `ExecutionPlanResult`.
3. Update `useAutoAnalysis.ts` to populate `momentAssignments`.

**Validation:** Verify `momentAssignments` match `groupAssignmentsIntoMoments()` output for all test cases.

### Phase C: Migrate consumers to moment-indexed data

**Goal:** Switch UI and analysis to read `momentAssignments` instead of rebuilding moments from `fingerAssignments`.

1. `selectionModel.ts`: Rewrite to index into `momentAssignments[]` directly.
2. `InteractiveGrid.tsx`: Read from `momentAssignments`, use `selectedMomentIndex`.
3. `UnifiedTimeline.tsx`: Dispatch `SELECT_MOMENT` with moment index.
4. `EventDetailPanel.tsx`: Display full moment (all notes, combined cost).
5. `TransitionDetailPanel.tsx`: Use direct moment lookup.
6. `useKeyboardShortcuts.ts`: Navigate by moment index.
7. `projectReducer.ts`: Add `SELECT_MOMENT` action, deprecate `SELECT_EVENT`.

**Validation:** Visual verification of selection, transitions, and detail panels. Timeline navigation by moment.

### Phase D: Clean up legacy path

**Goal:** Remove the per-note output path and redundant grouping.

1. Remove `fingerAssignments` from `ExecutionPlanResult` (or make it a derived view).
2. Remove `selectedEventIndex` from `ProjectState`.
3. Remove `SELECT_EVENT` action.
4. Remove `buildEventMoments()` and `getMomentIndexForSelectedEvent()` from `selectionModel.ts`.
5. Remove `groupAssignmentsIntoMoments()` from `eventMetrics.ts` (replaced by direct solver output).
6. Simplify `eventGrouping.ts` to a single import-time utility.
7. Optionally: modify beam solver to output `MomentAssignment[]` directly, eliminating the adapter.

**Validation:** Full test suite. No remaining references to `selectedEventIndex` or `FingerAssignment.eventIndex` in UI code. Grep for orphaned per-note grouping logic.

### Phase E: Upstream grouping (optional, lower priority)

**Goal:** Move temporal grouping to the import boundary so moments are first-class from MIDI import onward.

1. `midiImport.ts`: After building per-stream events, assemble moments at the project level.
2. `getActivePerformance()`: Return `PerformanceMoment[]` instead of flat `PerformanceEvent[]`.
3. Beam solver: Accept `PerformanceMoment[]` directly instead of re-grouping.

**Validation:** Solver produces identical results. Import → solve → display pipeline uses moments end-to-end.

---

## 6. Risks

1. **Beam solver internals depend on per-note indexing.** The solver's `PerformanceGroup` uses `eventIndices[]` to track back to the flat array. Phase B's adapter approach avoids touching solver internals, but Phase E will require careful refactoring of the solver's grouping and indexing.

2. **Manual override mapping uses eventIndex.** `beamSolver.ts` supports `manualAssignments` keyed by eventIndex or eventKey. This needs to be re-keyed by moment index + note identity during Phase E.

3. **Cost semantics change.** Per-moment cost will be numerically different from the sum of per-note divided costs (currently each note gets `totalStepCost / notesInGroup`). Downstream thresholds for difficulty classification (Easy/Medium/Hard) may need recalibration.

4. **Test expectations based on per-note counts.** Tests asserting specific `fingerAssignments.length`, per-note costs, or `unplayableCount` values will need updating when the output shape changes.

5. **Temporary dual-state overhead.** During migration (Phases B-C), `ExecutionPlanResult` carries both `fingerAssignments` and `momentAssignments`. This is intentional to allow incremental migration but adds temporary complexity.

---

## 7. Non-Goals

- **Changing `SoundStream`/`SoundEvent` to be moment-based.** Per-stream, per-note events are correct — they represent individual sound triggers within a voice. Moments are assembled at the Performance level, not the stream level.
- **Refactoring the beam solver's internal search algorithm.** The solver's internal per-note grip generation and beam expansion logic is correct. Only the output format changes.
- **Changing the layout model.** Layouts map pads to voices, independent of event timing.
