# Implementation Plan: Rudiment & Ostinato Candidate Generator

## Overview

Implement a `RudimentGenerator` module that produces musically coherent two-hand performance patterns (rudiments, ostinatos, drum+bass phrases) and feeds them through the existing downstream pipeline (layout generation, finger assignment, execution-plan generation, difficulty analysis) to produce full `CandidateSolution` objects.

The codebase is **TypeScript** (not Python as the PRD examples suggest). All new code will use TypeScript interfaces/types matching the PRD's data models, placed in the existing `src/engine/rudiment/` directory and `src/types/` directory.

---

## File Plan

### New Type Files

1. **`src/types/patternCandidate.ts`** — PRD data models translated to TypeScript:
   - `PatternEvent` interface (bar, slot, sub_offset, sound_class, role, accent, duration_class, motif_id, transform_history)
   - `HandSequence` interface (hand, role_profile, motif_family, events)
   - `PatternCandidate` interface (id, bars, grid_type, phrase_plan, left_hand, right_hand, metadata)
   - `PatternCandidateMetadata` interface (all required metadata fields from PRD §5)
   - `GeneratorConfig` interface (all config fields from PRD §10)
   - `DEFAULT_GENERATOR_CONFIG` const
   - Export from `src/types/index.ts`

### New Engine Files (all under `src/engine/rudiment/`)

2. **`src/engine/rudiment/motifLibrary.ts`** — Stage 1: Motif Library and Seed Sampling
   - `MotifSeed` interface: motif_family, role_profile, density_target, syncopation_target, phrase_suitability, anchor_slots, events (PatternEvent[])
   - Left-hand seed families: `alternating`, `paradiddle_like`, `call_response`, `accent_cycle`
   - Right-hand seed families: `ostinato`, `anchor_pickup`, `syncopated_pulse`, `response_line`
   - All seeds on 8-slot backbone only (no sixteenth insertions)
   - `getMotifSeed(family: string, rng: () => number): MotifSeed`
   - `getAllMotifFamilies(bias: 'left' | 'right'): string[]`

3. **`src/engine/rudiment/transforms.ts`** — Stage 2: Phrase Construction transforms
   - Each transform as isolated pure function: `mirror`, `rotate`, `accentShift`, `subdivisionInsertion`, `densityLift`, `sparseReduction`, `callResponseSwap`
   - All operate on `PatternEvent[]` → `PatternEvent[]`
   - `subdivisionInsertion` is the only one allowed to create sub_offset=1 events
   - Each appends its name to `transform_history`

4. **`src/engine/rudiment/phraseBuilder.ts`** — Stage 2: Phrase plan expansion
   - Expand 1-bar seeds into 2, 4, or 8 bar phrases using phrase plans
   - Supported plans: `["A","A_prime"]`, `["A","A_prime","B","A_return"]`, `["A","A_prime","A_var","B","A_return","A_prime2","B_lite","A_final"]`
   - Apply bounded transforms per bar (max_transforms_per_bar from config)
   - At least one bar after bar 1 must remain recognizably similar to bar 1
   - `buildPhrase(seed: MotifSeed, bars: number, config: GeneratorConfig, rng: () => number): { events: PatternEvent[], phrasePlan: string[] }`

5. **`src/engine/rudiment/coordination.ts`** — Stage 3: Two-Hand Coordination
   - Generate companion stream conditioned on primary stream
   - Anchor alignment (slot 0 of each bar, phrase starts/returns)
   - Interlock (complementary slot occupation)
   - Collision pressure handling (scored set of edits, not blind shift)
   - Burst protection (simplify companion when primary is dense)
   - Phrase agreement (phrase starts/ends/returns aligned)
   - Coordination scoring: `anchorAlignmentScore`, `interlockScore`, `collisionPressureScore`, `independenceScore`, `phraseCoherenceScore`
   - `coordinateHands(primary: HandSequence, companionSeed: MotifSeed, bars: number, config: GeneratorConfig, rng: () => number): { left: HandSequence, right: HandSequence, scores: CoordinationScores }`

6. **`src/engine/rudiment/coherenceMetrics.ts`** — Stage 4: Generator-side metrics
   - `computeDensity(candidate: PatternCandidate): number`
   - `computeSyncopationRatio(candidate: PatternCandidate): number`
   - `computeIndependenceScore(candidate: PatternCandidate): number`
   - `computeRepetitionScore(candidate: PatternCandidate): number`
   - `computePhraseCoherenceScore(candidate: PatternCandidate): number`
   - `computeCollisionPressureScore(candidate: PatternCandidate): number`
   - `computeAllMetrics(candidate: PatternCandidate): PatternCandidateMetadata`

7. **`src/engine/rudiment/candidateFilter.ts`** — Stage 4: Filtering and diversity
   - Apply rejection thresholds from config (density > 0.70, repetition < 0.35, etc.)
   - Diversity enforcement: cluster/deduplicate by motif family + phrase plan + rhythm signature
   - Over-generate then select diverse subset
   - `filterAndDiversify(candidates: PatternCandidate[], targetCount: number, config: GeneratorConfig): PatternCandidate[]`

8. **`src/engine/rudiment/patternGenerator.ts`** — Main orchestrator (RudimentGenerator class)
   - `RudimentGenerator` class with `generate(n: number): PatternCandidate[]`
   - Orchestrates: motif sampling → phrase expansion → two-hand coordination → metric computation → filtering → diversity selection
   - Validates all outputs (slot 0..7, sub_offset 0|1, event ordering)
   - Over-generates internally (e.g. 3x target count)

9. **`src/engine/rudiment/patternToPipeline.ts`** — Bridge: PatternCandidate → existing pipeline
   - Convert `PatternCandidate` → `Performance` (PerformanceEvent[]) by mapping sound_class → MIDI note numbers and bar/slot/sub_offset → absolute time
   - Convert `PatternCandidate` → `Voice[]` and `Layout` for the sound classes used
   - Call existing `generateCandidates()` or `createBeamSolver().solve()` with the generated Performance
   - Return `CandidateSolution[]` from the existing pipeline
   - `generateCandidateSolutions(pattern: PatternCandidate, config: PipelineConfig): Promise<CandidateSolution[]>`

### Test Files

10. **`test/engine/rudiment/patternGenerator.test.ts`** — Main test file covering all PRD §12 test cases:
    - Invalid slot rejection (slot < 0 or > 7)
    - Invalid sub_offset rejection (sub_offset not in {0,1})
    - Subdivision insertion only via allowed transform
    - Phrase plan preservation
    - Repetition score behavior on identical vs unrelated bars
    - Independence score behavior on mirrored vs interlocked streams
    - Collision-pressure reduction after coordination
    - Candidate count and diversity guarantees
    - Boundary purity: no pad/finger/layout fields leak into outputs

11. **`test/engine/rudiment/coherenceMetrics.test.ts`** — Metric computation tests
    - Density calculation correctness
    - Syncopation ratio calculation
    - Independence score edge cases (fully mirrored, fully interlocked)
    - Repetition score (identical bars = 1.0, unrelated bars = low)
    - Phrase coherence score

12. **`test/engine/rudiment/transforms.test.ts`** — Transform isolation tests
    - Each transform preserves valid slot/sub_offset ranges
    - Only subdivisionInsertion creates sub_offset=1
    - Transform history tracking

13. **`test/engine/rudiment/coordination.test.ts`** — Coordination tests
    - Anchor alignment on downbeats
    - Interlock behavior
    - Burst protection
    - Collision pressure handling

---

## Implementation Order

1. **Types** (`src/types/patternCandidate.ts`) — data models first
2. **Motif library** (`motifLibrary.ts`) — seed patterns
3. **Transforms** (`transforms.ts`) — isolated transform functions
4. **Phrase builder** (`phraseBuilder.ts`) — expand seeds into multi-bar phrases
5. **Coherence metrics** (`coherenceMetrics.ts`) — scoring functions
6. **Coordination** (`coordination.ts`) — two-hand coordination + scoring
7. **Candidate filter** (`candidateFilter.ts`) — filtering and diversity
8. **Pattern generator** (`patternGenerator.ts`) — main orchestrator class
9. **Pipeline bridge** (`patternToPipeline.ts`) — connect to existing downstream
10. **Tests** — all test files
11. **Engine barrel export** — add new public API to `src/engine/index.ts`

---

## Key Design Decisions

### Boundary Purity
- No `PadCoord`, no grid positions, no `FingerType`, no biomechanical costs anywhere in the generator module
- The bridge file (`patternToPipeline.ts`) is the only file that touches downstream types
- PatternCandidate contains only musical abstractions (bar, slot, sound_class, role)

### Reuse of Existing Infrastructure
- `createSeededRng()` from `src/utils/seededRng.ts` for deterministic generation
- `generateId()` from `src/utils/idGenerator.ts` for candidate IDs
- `generateCandidates()` from `src/engine/optimization/multiCandidateGenerator.ts` for downstream pipeline
- `CandidateSolution`, `Performance`, `PerformanceEvent`, `Layout`, `Voice` types from existing type system

### Sound Class → MIDI Mapping
- The bridge file maps sound_class strings to MIDI note numbers (e.g., "kick" → 36, "snare" → 38)
- This is the only place where musical abstraction meets MIDI reality
- Mapping is configurable but has sensible defaults matching the existing `DEFAULT_MIDI_MAP`

### Grid Type
- All patterns use `"eighth_backbone_with_optional_sixteenth_insertions"` grid type
- 8 slots per bar (eighth-note backbone)
- Optional sixteenth insertions via sub_offset=1 only through the subdivisionInsertion transform

### Validation
- Every generated PatternCandidate is validated before returning
- Slot range: 0..7
- sub_offset: 0 or 1
- No duplicate events at same bar/slot/sub_offset for same hand
- Events sorted by bar, then slot, then sub_offset
