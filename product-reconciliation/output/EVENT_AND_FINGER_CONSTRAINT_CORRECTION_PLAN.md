# Event and Finger Constraint Correction Plan

## 1. Current Incorrect Behavior

### 1.1 Event Misunderstanding

The system treats each individual MIDI note trigger as its own "event." A chord (Kick + HiHat at time 0.0) produces two separate `PerformanceEvent` objects, each independently indexed.

**Where events are incorrectly constructed:**

| File | Function | Problem |
|---|---|---|
| `src/import/midiImport.ts` | `importMidi()` (lines 86-109) | Each MIDI note-on creates a separate event. `events.push({...})` inside a `forEach(note)` loop. No grouping by timestamp. |
| `src/ui/state/projectState.ts` | `getActivePerformance()` (lines 141-150) | `flatMap` across all SoundStreams + `sort` by startTime. Produces flat per-note array with no grouping. |

**Where consumers re-derive grouping from the flat array:**

| File | Function | Epsilon | Problem |
|---|---|---|---|
| `src/engine/structure/eventGrouping.ts` | `groupEventsByTime()` | 0.001s | Re-groups events for structural analysis |
| `src/engine/solvers/beamSolver.ts` | `groupEventsByTimestamp()` | 0.001s | Re-groups events before solving |
| `src/engine/evaluation/eventMetrics.ts` | `groupAssignmentsIntoMoments()` | 1e-4 | Re-groups solver output for evaluation |
| `src/ui/analysis/selectionModel.ts` | `buildEventMoments()` | exact match | Re-groups solver output for UI selection |
| `src/engine/structure/performanceAnalyzer.ts` | `analyzePerformance()` | calls `groupEventsByTime` | Re-groups for structural analysis |
| `src/engine/analysis/eventExplainer.ts` | `identifyHardMoments()` | calls `groupAssignmentsIntoMoments` | Re-groups for difficulty reporting |

The same grouping is computed 5+ times with inconsistent epsilon values (0.001s vs 1e-4 vs exact match), creating potential for different subsystems to produce different groupings from the same data.

**Where solver output is per-note with diluted cost:**

The beam solver computes a single step cost for each temporal group (moment), then divides it equally among individual notes:

```
beamSolver.ts lines 1022-1043:
  const costPerNote = displayStepCost / n;       // n = notes in group
  const componentsPerNote = {
    transition: stepComponents.transition / n,    // divided
    stretch: stepComponents.stretch / n,          // divided
    ...
  };
```

A 3-note chord with group cost 9.0 reports three separate `FingerAssignment` objects each with `cost: 3.0`. This misrepresents difficulty: the UI shows three "Medium" events instead of one "Hard" moment. Aggregate statistics (`unplayableCount`, `hardCount`, `averageMetrics`) are inflated by note count rather than reflecting moment count.

**Where `selectedEventIndex` refers to a per-note index:**

`ProjectState.selectedEventIndex` (line 121 of `projectState.ts`) stores a `FingerAssignment.eventIndex` — a single note's index in the flat `PerformanceEvent[]` array. Every UI consumer must independently re-derive which moment the selected note belongs to:

- `InteractiveGrid.tsx`: Finds selected assignment's timestamp, then highlights all pads at that timestamp
- `selectionModel.ts`: `getMomentIndexForSelectedEvent()` looks up the assignment, finds its moment
- `EventDetailPanel.tsx`: Shows info for one note only, not the full moment

### 1.2 Finger-Assignment Misunderstanding

**The beam solver violates the one-pad-one-finger rule.** It can produce solutions where the same physical pad is assigned to different fingers at different points in the performance.

**Root cause:** The solver processes temporal groups sequentially but generates grips for each group independently, with no memory of which finger was used for a pad in previous groups.

**How the violation happens:**

1. `expandNodeForGroup()` (beamSolver.ts lines 245-406) calls `generateValidGripsWithTier(uniquePads, hand)` for the current group's pads. This function receives NO information about prior finger-to-pad assignments.

2. `generateValidGripsWithTier()` (feasibility.ts lines 685-707) takes only `activePads` and `hand`. It generates all geometrically valid hand poses. No constraint filters grips to maintain consistency with previous groups.

3. `BeamNode` tracks `leftPose` and `rightPose` (current hand positions) and accumulates `assignments[]`, but provides NO index of `padKey → finger` for cross-temporal enforcement.

4. Within a group, pads are deduplicated to prevent two fingers on the same pad at the same moment. But there is no check that says "pad (2,3) was played by left-index in group 0, so it must remain left-index in group 5."

**Concrete violation scenario:**

```
Group 0: pad (2,3) → left-index     (grip generated independently)
Group 5: pad (2,3) → right-middle   (grip generated independently, VIOLATION)
Group 10: pad (2,3) → left-pinky    (grip generated independently, VIOLATION)
```

**Where validation is missing:**

| File | What It Checks | What It Misses |
|---|---|---|
| `engine/debug/constraintValidator.ts` | Impossible reach, simultaneous collision, tempo feasibility | No check for pad-to-finger consistency across time |
| `engine/debug/sanityChecks.ts` | Pinky/thumb usage, zone violations, hand balance | No check for same pad assigned to different fingers |

**Where manual edits can conflict:**

`Layout.fingerConstraints` (a static pad-level constraint like "pad (2,3) = L-Ix") is applied at the layout level, not enforced across the temporal solution. The solver's `manualAssignments` can override per-event, and there is no validation that manual overrides are temporally consistent.

**Where no canonical pad-to-finger ownership model exists:**

There is no `Map<padKey, { hand, finger }>` type or equivalent anywhere in the codebase. The concept of "pad ownership" across a solution does not exist as a data structure.

---

## 2. Correct Canonical Model

### 2.1 Event

An Event is a time slice: the set of all notes occurring at the same moment.

```ts
interface PerformanceEvent {
  momentIndex: number;
  startTime: number;
  notes: NoteInstance[];
}

interface NoteInstance {
  soundId: string;
  padId: string;           // "row,col" key
  noteNumber: number;      // MIDI provenance
  velocity?: number;
  duration?: number;
  noteKey?: string;        // Deterministic unique ID
}
```

### 2.2 Layout

Where sounds are placed on pads. Unchanged from current model.

```ts
interface Layout {
  id: string;
  padToVoice: Record<string, string>;     // padKey → voiceId
  placementLocks: Record<string, boolean>; // padKey → locked
  // ...
}
```

### 2.3 PadFingerAssignment (NEW)

A stable mapping of pads to fingers for an active solution. This is the canonical ownership model.

```ts
type PadFingerAssignment = Record<PadId, {
  hand: 'left' | 'right';
  finger: FingerType;
}>;
```

### 2.4 Solution / Performance State

A complete solved performance: a pad-finger ownership map plus a sequence of moment executions.

```ts
interface ExecutionPlanResult {
  /** Stable pad-to-finger ownership for the entire solution. */
  padFingerOwnership: PadFingerAssignment;

  /** Per-moment assignments (ordered by time). */
  momentAssignments: MomentAssignment[];

  /** Total score (lower = better). */
  score: number;

  /** Moment-level counts. */
  unplayableMomentCount: number;
  hardMomentCount: number;

  // ... diagnostics, telemetry, layoutBinding ...
}

interface MomentAssignment {
  momentIndex: number;
  startTime: number;
  noteAssignments: NoteAssignment[];
  cost: number;                        // Moment-level, NOT divided per-note
  difficulty: DifficultyLevel;
  costBreakdown: DifficultyBreakdown;
}

interface NoteAssignment {
  noteNumber: number;
  soundId: string;
  padId: string;
  row: number;
  col: number;
  hand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  noteKey?: string;
}
```

### 2.5 Required Invariants

**Invariant A — Canonical Event Construction:**
An Event contains all notes sharing a timestamp (within canonical epsilon = 0.001s). A single-note moment is still an Event. Events are the atomic timeline unit; no downstream system should split or re-derive them.

**Invariant B — Stable Pad-to-Finger Ownership:**
Within an active solution, each pad maps to exactly one finger. That mapping does not change across the performance. A solution is invalid if any pad is assigned to multiple fingers.

**Invariant C — Finger-to-Pad is Many-to-One (allowed):**
A finger may play multiple pads. But a pad cannot belong to multiple fingers.

**Invariant D — Ownership is Solution-Scoped:**
Different candidate solutions may assign different fingers to the same pad. Ownership is per-solution, not global.

**Invariant E — Cost is Per-Moment:**
The difficulty of a moment reflects the combined hand pose required to play all notes simultaneously. Cost is not divided among individual notes.

---

## 3. Required Code Changes

### 3.1 Event Model Changes

*These overlap with EVENT_MODEL_CORRECTION_PLAN.md. Summarized here for completeness.*

| File | Change |
|---|---|
| `src/types/performanceEvent.ts` | Introduce `NoteInstance`. Redefine `PerformanceEvent` as moment-based with `notes: NoteInstance[]`. |
| `src/types/executionPlan.ts` | Introduce `MomentAssignment`, `NoteAssignment`. Add `padFingerOwnership: PadFingerAssignment` to `ExecutionPlanResult`. |
| `src/import/midiImport.ts` | Group notes by timestamp at end of import. |
| `src/ui/state/projectState.ts` | `getActivePerformance()` returns moments. |
| `src/engine/structure/eventGrouping.ts` | Becomes an import-time utility. Single canonical `MOMENT_EPSILON = 0.001`. |
| All re-derivation sites | Remove independent re-grouping; consume moments directly. |

### 3.2 Finger Constraint Changes

#### 3.2.1 Canonical pad-to-finger ownership structure

| File | Change |
|---|---|
| `src/types/executionPlan.ts` | Add `PadFingerAssignment` type: `Record<string, { hand, finger }>`. Add `padFingerOwnership` field to `ExecutionPlanResult`. |

#### 3.2.2 Solver: enforce one-pad-one-finger during beam search

| File | Change |
|---|---|
| `src/engine/solvers/beamSolver.ts` — `BeamNode` | Add `padOwnership: Map<string, { hand, finger }>` to track which finger owns each pad across the solve. Initialize empty on root node. |
| `beamSolver.ts` — `expandNodeForGroup()` | After generating grip candidates, filter or heavily penalize any grip that assigns a different finger to a pad already in `node.padOwnership`. When a grip is accepted, update `padOwnership` for all newly touched pads. |
| `beamSolver.ts` — `expandNodeForSplitChord()` | Same constraint enforcement as `expandNodeForGroup()`. |
| `beamSolver.ts` — output assembly | Extract final `padFingerOwnership` from the winning `BeamNode.padOwnership` map. |

#### 3.2.3 Grip generation: accept historical context

| File | Change |
|---|---|
| `src/engine/prior/feasibility.ts` — `generateValidGripsWithTier()` | Add optional parameter `priorOwnership?: Map<string, { hand, finger }>`. When provided, filter generated grips to only those consistent with prior ownership (or add a large penalty for violations). |

#### 3.2.4 Validation: post-solve consistency check

| File | Change |
|---|---|
| `src/engine/debug/constraintValidator.ts` | Add `validatePadOwnershipConsistency(assignments)` check. Walk all assignments and verify no pad appears with two different fingers. |
| `src/engine/debug/sanityChecks.ts` | Add ownership consistency to the sanity check suite. |

#### 3.2.5 Scoring: remove per-note cost division

| File | Change |
|---|---|
| `beamSolver.ts` lines 1022-1048 | Remove `costPerNote = displayStepCost / n`. Each `MomentAssignment` gets the full moment cost. Individual `NoteAssignment` objects carry finger info but not split cost. |
| `beamSolver.ts` emergency fallback (lines 1080-1110) | Same: remove per-note penalty division. |

#### 3.2.6 UI/manual editing safeguards

| File | Change |
|---|---|
| `src/ui/components/EventDetailPanel.tsx` | When setting a finger constraint for a pad, check if that pad already has an ownership assignment in the current solution. Warn or block if the edit would create a conflict. |
| `src/ui/state/projectReducer.ts` | `SET_FINGER_CONSTRAINT` should validate that the constraint does not conflict with existing pad ownership in the active solution. |

---

## 4. Hard vs Soft Constraints

### Hard Constraints (must never be violated)

| Rule | Current Status | Fix |
|---|---|---|
| Event = grouped timestamp slice (all notes at same time = one event) | **VIOLATED**: each note is a separate PerformanceEvent | Define canonical event builder; eliminate per-note event identity |
| One pad = one finger in active assignment | **VIOLATED**: solver generates grips per-group independently with no cross-temporal constraint | Add `padOwnership` tracking to BeamNode; filter/reject inconsistent grips |
| Solution with ownership violation = invalid | **NOT CHECKED**: no validation exists | Add post-solve validation in constraintValidator.ts |
| Cost is per-moment, not divided per-note | **VIOLATED**: `costPerNote = stepCost / n` | Remove division; assign full cost to MomentAssignment |

### Soft Constraints (preferences, can be overridden)

| Rule | Status | Notes |
|---|---|---|
| Hand preference per voice | Correct | Stored in `voiceConstraints`, applied as solver soft bias |
| Finger preference per voice | Correct | Same mechanism |
| Alternation cost (same-finger repetition penalty) | Correct concept, but currently computed per-note | Recompute per-moment after event model fix |
| Hand balance | Correct | Aggregate preference, not hard rule |

### Currently Soft but Should Be Hard

| Rule | Current Treatment | Required Treatment |
|---|---|---|
| Pad deduplication within a group | Hard within a single moment | Correct — keep hard |
| Pad-to-finger consistency across time | Not enforced at all | Must become hard constraint |

---

## 5. Migration Strategy

### Phase 1: Define canonical types (non-breaking)

1. Define `NoteInstance`, `PerformanceMoment` types.
2. Define `PadFingerAssignment` type: `Record<string, { hand: 'left' | 'right'; finger: FingerType }>`.
3. Define canonical `MOMENT_EPSILON = 0.001` in one shared location.
4. Define `MomentAssignment` and `NoteAssignment` types.
5. Write `buildMoments(events: PerformanceEvent[]): PerformanceMoment[]` utility.
6. Write `extractPadOwnership(assignments: FingerAssignment[]): PadFingerAssignment` utility that walks existing solver output and detects violations.
7. Write `validatePadOwnershipConsistency(assignments: FingerAssignment[]): { valid: boolean; violations: Array<{ padKey, fingers }> }`.

**Validation:** Run `extractPadOwnership` on existing test fixtures and demo projects to measure how often the violation currently occurs. Existing tests pass unchanged.

### Phase 2: Implement canonical event builder

1. Create `buildPerformanceMoments()` that groups flat notes by timestamp.
2. Wire `getActivePerformance()` to produce moments alongside the legacy flat array (dual output).
3. Wire `midiImport.ts` to group at import time.

**Validation:** New unit tests:
- Single note at a timestamp → one moment with one note
- Multiple simultaneous notes → one moment with multiple notes
- Consecutive timestamps → multiple moments

### Phase 3: Enforce one-pad-one-finger in solver

1. Add `padOwnership: Map<string, { hand, finger }>` to `BeamNode`.
2. In `expandNodeForGroup()` and `expandNodeForSplitChord()`:
   - After generating grip candidates, check each grip against `node.padOwnership`.
   - **Hard filter**: reject grips that assign a different finger to a pad already in `padOwnership`.
   - When a grip is accepted: update `padOwnership` for all newly touched pads.
3. Optionally: pass `padOwnership` into `generateValidGripsWithTier()` so invalid grips are never generated (performance optimization, not required for correctness).
4. Extract `padFingerOwnership` from winning beam node and attach to `ExecutionPlanResult`.
5. Add post-solve `validatePadOwnershipConsistency()` check as a debug assertion.

**Validation:**
- Synthetic test: single pad played 10 times → same finger every time.
- Synthetic test: two pads, alternating → each pad keeps its finger.
- Solver output passes `validatePadOwnershipConsistency()` for all test fixtures.
- If any existing test fixture produces a violation, the test documents it as now-fixed behavior.

### Phase 4: Adapt event consumers to moment-indexed data

1. Solver output: produce `MomentAssignment[]` (full moment cost) alongside legacy `FingerAssignment[]`.
2. Remove per-note cost division (`costPerNote = stepCost / n`).
3. `selectionModel.ts`: rewrite to index into `MomentAssignment[]` directly.
4. `InteractiveGrid.tsx`: use `MomentAssignment[]` and `selectedMomentIndex`.
5. `UnifiedTimeline.tsx`: dispatch `SELECT_MOMENT`.
6. `EventDetailPanel.tsx`: show moment info (all notes, combined cost, all finger assignments).
7. `TransitionDetailPanel.tsx`: use direct moment lookup.
8. `projectState.ts`: `selectedMomentIndex` replaces `selectedEventIndex`.

**Validation:** Visual verification of selection, transitions, detail panels. Moment-level statistics (hardMomentCount, unplayableMomentCount) are correct.

### Phase 5: Add validation guards and tests

1. Post-solve assertion: `validatePadOwnershipConsistency()` runs on every solver output.
2. Manual-edit guard: `SET_FINGER_CONSTRAINT` warns if it would conflict with existing ownership.
3. Comprehensive test suite (see Section 6).

### Phase 6: Remove legacy ambiguous logic

1. Remove `fingerAssignments` from `ExecutionPlanResult` (or make derived).
2. Remove `selectedEventIndex` from `ProjectState`.
3. Remove `SELECT_EVENT` action.
4. Remove `buildEventMoments()`, `getMomentIndexForSelectedEvent()`, `groupAssignmentsIntoMoments()`.
5. Remove per-note cost division code paths.
6. Consolidate epsilon definitions to one canonical constant.

---

## 6. Test Plan

### Event Construction Tests

```
Test: single note at timestamp 0.5
  Input: [{noteNumber: 60, startTime: 0.5}]
  Expected: 1 moment with 1 note

Test: three simultaneous notes at timestamp 0.5
  Input: [{note: 60, time: 0.5}, {note: 62, time: 0.5}, {note: 64, time: 0.5}]
  Expected: 1 moment with 3 notes

Test: notes within epsilon are grouped
  Input: [{note: 60, time: 0.500}, {note: 62, time: 0.5008}]
  Expected: 1 moment (within 0.001s epsilon)

Test: notes outside epsilon are separate moments
  Input: [{note: 60, time: 0.5}, {note: 62, time: 0.6}]
  Expected: 2 moments

Test: mixed — chord then single note
  Input: [{60, 0.5}, {62, 0.5}, {64, 1.0}]
  Expected: 2 moments — first has 2 notes, second has 1 note

Test: moment cost is not divided
  Given: solver produces a grip for a 3-note chord with total cost 9.0
  Expected: MomentAssignment.cost = 9.0 (not 3.0 per note)
```

### Finger Ownership Tests

```
Test: same pad assigned to two fingers → invalid
  Input: assignments where pad (2,3) has left-index at moment 0
         and right-middle at moment 5
  Expected: validatePadOwnershipConsistency() returns {valid: false}

Test: stable ownership across all moments → valid
  Input: pad (2,3) always left-index, pad (4,5) always right-middle
  Expected: validatePadOwnershipConsistency() returns {valid: true}

Test: solver output never violates ownership rule
  Given: any performance with repeated pads
  Expected: solver output passes validatePadOwnershipConsistency()

Test: solver produces consistent padFingerOwnership map
  Given: performance with 3 pads used across 10 moments
  Expected: padFingerOwnership has 3 entries, each with one finger
            All NoteAssignments for each pad match the ownership map

Test: beam search filters inconsistent grips
  Given: performance where pad (2,3) is assigned left-index in moment 0
  When: moment 5 also uses pad (2,3)
  Expected: solver only considers grips where pad (2,3) is still left-index

Test: manual edit conflicting with ownership is surfaced
  Given: active solution where pad (2,3) = left-index
  When: user sets pad (2,3) constraint to right-middle
  Expected: conflict is detected and communicated

Test: different solutions can have different ownership
  Given: Candidate A assigns pad (2,3) = left-index
         Candidate B assigns pad (2,3) = right-middle
  Expected: both are individually valid (ownership is per-solution)

Test: extractPadOwnership produces correct map
  Given: 10 FingerAssignments where pad (2,3) appears 4 times, always left-index
  Expected: ownership map has (2,3) → {hand: 'left', finger: 'index'}

Test: extractPadOwnership detects violation
  Given: 10 FingerAssignments where pad (2,3) appears as left-index
         and right-middle
  Expected: violation detected for pad (2,3)
```

### Integration Tests

```
Test: full pipeline — import → solve → validate → display
  Given: MIDI file with repeated notes on same pads
  Expected: moments are correctly grouped
            pad ownership is consistent
            moment costs are not diluted
            selection operates on moments

Test: demo project "Simple Drum Groove" produces valid solution
  Expected: all pads have stable ownership
            no moment has divided cost
```

---

## 7. Relationship to EVENT_MODEL_CORRECTION_PLAN.md

This plan supersedes and extends `EVENT_MODEL_CORRECTION_PLAN.md`. The event model corrections described in that document are incorporated here as Phase 1-2 and Phase 4. The finger ownership constraint (Phases 3, 5) is new to this plan.

The migration phases are designed to be compatible:
- Phases 1-2 (types + event builder) can proceed independently
- Phase 3 (solver ownership enforcement) can proceed independently
- Phase 4 (consumer migration) depends on Phases 1-2
- Phase 5-6 (validation + cleanup) depends on Phases 3-4
