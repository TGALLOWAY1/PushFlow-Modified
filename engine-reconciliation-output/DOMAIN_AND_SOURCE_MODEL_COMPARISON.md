# DOMAIN_AND_SOURCE_MODEL_COMPARISON

Method: code-backed domain audit. The main question is not naming polish; it is whether the engine's canonical truth reduces optimization complexity while preserving user freedom.

## Core Finding

V2 is directionally closer to the right domain model because it introduces `PerformanceLane` and `SoundStream`. But the actual solver domain did not finish the migration. In code, V2 still reconstructs solver events as imported MIDI pitches (`../PushFlow/src/ui/state/projectState.ts:103-116`). So the important conceptual shift happened at the UI/state layer, not at the actual engine truth layer.

## The Claimed Decoupling Shift: verified, partial, not complete

### What changed in V2

- Authoring data is no longer only a flat `Performance.events` list.
- MIDI import is routed into lanes grouped by pitch (`../PushFlow/src/ui/hooks/useLaneImport.ts:46-98`).
- Lanes become `SoundStream[]`, each with its own event time series (`../PushFlow/src/ui/state/lanesToStreams.ts:21-48`, `../PushFlow/src/ui/state/projectState.ts:21-43`).

### Why that is better

- It gives the product a stable editable track-like object.
- It separates source-authoring concerns from immediate solver execution.
- It gives V3 a place to attach muting, grouping, renaming, and provenance.

### Why it is still incomplete

- `SoundStream.originalMidiNote` is still required.
- `getActivePerformance()` flattens streams into events whose `noteNumber` is the original MIDI pitch (`../PushFlow/src/ui/state/projectState.ts:103-116`).
- `buildPerformanceLanesFromStreams()` back-fills `rawPitch` from `stream.originalMidiNote` (`../PushFlow/src/ui/state/streamsToLanes.ts:17-24`).
- Layout mapping still indexes by `voice.originalMidiNote` (`../PushFlow/src/engine/mapping/mappingResolver.ts:39-53`).

### Recommendation for V3

- Canonical timeline truth should be a shared time series of `PerformanceEvent { eventId, soundId, startTime, duration, velocity, provenance }`.
- Imported pitch should remain provenance only.
- Layout should map pad -> soundId.
- Solver input should use soundId -> pad resolution, not noteNumber -> pad resolution.

## Domain Concept Comparison

| Concept | V1 model | V2 model | Cleaner? | Reduces optimization complexity? | Improves user freedom? | V3 recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Imported MIDI note / pitch identity | `NoteEvent.noteNumber` is both imported pitch and long-term engine identity (`../PushFlow/Version1/src/types/performance.ts:79-98`) | `PerformanceEvent.noteNumber` still exists; `LaneEvent.rawPitch` and `SoundStream.originalMidiNote` preserve import pitch (`../PushFlow/src/types/performanceEvent.ts:13-29`, `../PushFlow/src/ui/state/projectState.ts:36-43`) | V2 directionally cleaner, implementation still coupled | No, not yet | Yes, somewhat in authoring layer | Split imported pitch from engine identity completely |
| Sound identity | `Voice.originalMidiNote` is effectively the sound identity (`../PushFlow/Version1/src/types/layout.ts:17-30`) | `SoundStream.id` exists, but solving still routes through `originalMidiNote` (`../PushFlow/src/ui/state/projectState.ts:36-43`, `:103-116`) | V2 | Not fully | Yes | Use `soundId` as canonical |
| Performance timeline / time series | Flat `Performance.events` only | `SoundStream.events` + derived flattened `Performance` (`../PushFlow/src/ui/state/projectState.ts:21-43`, `:103-116`) | V2 | Yes, if fully finished | Yes | Preserve V2 time-series model, finish migration |
| Event identity | `eventKey` optional but widely propagated (`../PushFlow/Version1/src/types/performance.ts:96-97`) | `eventKey` still propagated; lanes also have `eventId` (`../PushFlow/src/types/performanceEvent.ts:24-29`, `../PushFlow/src/types/performanceLane.ts`) | V2 | Slightly | Yes | Keep stable event IDs independent of pitch |
| Simultaneous event grouping | Internal beam grouping by timestamp epsilon 1ms (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:133-154`) | Extracted structural utility `groupEventsByTime()` with same 1ms epsilon (`../PushFlow/src/engine/structure/eventGrouping.ts:14-58`) | V2 | Yes | Neutral | Keep extracted grouping utility |
| Layout | `GridMapping.cells` pad -> pitch-derived voice (`../PushFlow/Version1/src/types/layout.ts:50-75`) | `Layout.padToVoice` same idea, cleaner names (`../PushFlow/src/types/layout.ts:24-44`) | V2 naming | No structural reduction yet | Neutral | Keep immutable layout object; change key target to soundId |
| Candidate | No first-class candidate artifact | `CandidateSolution` is explicit (`../PushFlow/src/types/candidateSolution.ts:81-92`) | V2 | Yes | Yes | Preserve V2 candidate model |
| Execution plan | `EngineResult` + `debugEvents` (`../PushFlow/Version1/src/engine/solvers/types.ts:146-192`) | `ExecutionPlanResult` + `fingerAssignments` (`../PushFlow/src/types/executionPlan.ts:132-168`) | V2 naming only | Minimal | Neutral | Preserve artifact, fix score semantics |
| Analysis result | Usually one solver output stored in state and sometimes persisted (`../PushFlow/Version1/src/types/projectState.ts:54-64`) | Cached `analysisResult` plus `candidates`, explicitly stale-able (`../PushFlow/src/ui/state/projectState.ts:68-90`) | V2 | Yes | Yes | Preserve V2 cache model |
| Constraints | `manualAssignments` stored by layout/event in project state (`../PushFlow/Version1/src/types/projectState.ts:48-63`) | `layout.fingerConstraints` turned into hard event assignments; `voiceConstraints` also exist but are not wired into solve path | Mixed | Mixed | V2 exposes more UX degrees of freedom, but wiring is incomplete | Separate pad constraints, sound constraints, and event constraints explicitly |
| Hand pose / neutral pose | Resting pose in config + natural hand poses persisted (`../PushFlow/Version1/src/types/projectState.ts:165-196`, `../PushFlow/Version1/src/utils/projectPersistence.ts:78-107`) | Resting pose in engine config, optional neutral-pad override, plus Pose0 seeding path | V2 operationally cleaner | Yes | Yes | Keep V2 operational model, preserve V1 strict validation |
| Solver outputs | Result object mixes score, difficulty counts, and debug artifacts | Same pattern, renamed | Neither | No | Neutral | Keep artifact separation but rewrite semantics |

## Specific Recommendations By Concept

### Imported MIDI note / pitch identity

- V1 is simpler, but wrong for a long-lived editor because raw pitch becomes engine identity.
- V2 is only an intermediate step.
- V3 should keep `rawPitch` only as provenance and import reconstruction metadata.

### Sound identity

- V1 has no separate sound identity.
- V2 almost has one, but not at solver level.
- V3 should define a canonical `Sound` / `SoundStream` object with stable ID independent of pitch.

### Performance timeline

- V2 is conceptually cleaner because it introduces a reusable event series per sound stream.
- That reduces complexity for muting, grouping, and source editing even before it reduces solver complexity.
- V3 should preserve this model and make solver derivation explicit rather than implicit.

### Event identity

- Both versions are good enough on stable event keys.
- V3 should standardize one event ID and stop relying on fallback index-based manual assignment lookups.

### Layout and candidate representation

- V2 is cleaner and should be kept.
- The one required V3 change is that layout should reference canonical sounds, not imported pitches.

### Constraints and solver outputs

- V1 and V2 both blur "difficulty", "cost", and "score".
- V3 should explicitly separate:
  - optimization objective
  - diagnostic breakdown
  - user-facing difficulty labels
  - pass/fail rule violations

## Domain Truth Proposal for V3

Recommended canonical objects:

- `ImportedSourceFile`
- `ImportedEventProvenance { rawPitch, rawChannel, rawTick, sourceFileId }`
- `Sound { soundId, name, color, provenance }`
- `SoundTimeline { soundId, events[] }`
- `PerformanceEvent { eventId, soundId, startTime, duration, velocity, provenance }`
- `Layout { pad -> soundId, padConstraints }`
- `ExecutionPlan { eventId -> hand/finger/pad/pose transition data }`
- `CandidateSolution { layout, executionPlan, difficultyAnalysis, tradeoffProfile }`

This model is cleaner than V1, more flexible than V2, and it removes the pitch-coupling that still leaks through the V2 solver path.

