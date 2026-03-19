# CONSTRAINTS_AND_RULES_COMPARISON

## Executive Verdict

V2 has the better constraint architecture. It centralizes constants, uses per-finger-pair span rules, distinguishes relaxed from fallback tiers, and adds actual rule-detection tooling. But both versions still have ambiguous precedence around manual overrides, and V2 still leaves some constraint concepts as implied rather than truly enforced.

## Hard Constraints

| Rule type | V1 approach | V2 approach | What is actually enforced | Ambiguity / conflict | V3 recommendation |
| --- | --- | --- | --- | --- | --- |
| Max one-hand span | single global strict 5.5 / relaxed 7.5 (`../PushFlow/Version1/src/engine/feasibility.ts:32-43`) | per-pair strict spans + relaxed multiplier 1.15 (`../PushFlow/src/engine/prior/biomechanicalModel.ts:96-125`) | Both enforce during grip generation | V1 is too coarse; V2 comments and implementation are aligned | Keep V2 |
| Thumb vertical constraint | strict 1.0 / relaxed 2.0 (`../PushFlow/Version1/src/engine/feasibility.ts:48-53`) | same values, centralized (`../PushFlow/src/engine/prior/biomechanicalModel.ts:129-136`) | Both enforce in topology checks | Good in V2 | Keep V2 |
| Finger ordering / topology | ad hoc topology functions (`../PushFlow/Version1/src/engine/feasibility.ts:551-661`) | same idea, but coupled to centralized `FINGER_ORDER` and diagnostics (`../PushFlow/src/engine/prior/feasibility.ts:350-414`, `:564-611`) | Both enforce during grip generation | V2 is clearer | Keep V2 |
| Same pad collision within a hand grip | implied by one-finger-per-pad permutations | same, plus diagnostic reporting | enforced in grip generation | good | Keep |
| Transition speed max | `Infinity` if movement speed > 12 | same | enforced in transition cost | manual override path can coerce strange behavior | Keep hard constraint, but expose reason |

## Soft Constraints

| Rule type | V1 | V2 | Actually enforced? | Recommendation |
| --- | --- | --- | --- | --- |
| Alternation | yes | yes | yes in beam ranking | Keep |
| Hand balance | yes | yes | yes in beam ranking | Keep |
| Zone preference | mostly implicit / UI-side | explicit validator + surface heuristic, but not a hard feasibility rule (`../PushFlow/src/engine/debug/constraintValidator.ts:219-247`) | soft only | Keep as soft unless user explicitly hard-constrains zones |
| Finger dominance | indirect through stretch/static costs | explicit `FINGER_DOMINANCE_COST` inside `poseNaturalness` (`../PushFlow/src/engine/prior/biomechanicalModel.ts:173-179`) | yes | Keep V2 |

## Pad-Level Constraints

### V1

- `manualAssignments` exist in project state and can force event assignments (`../PushFlow/Version1/src/types/projectState.ts:48-63`).

### V2

- `layout.fingerConstraints` are converted into per-event hard `manualAssignments` in `useAutoAnalysis()` (`../PushFlow/src/ui/hooks/useAutoAnalysis.ts:44-79`, `:161-167`, `:227-240`).

### What is actually enforced

- In beam-only analysis: yes.
- In multi-candidate generation annealing path: not reliably, because the annealing solve call omits manual assignments (`../PushFlow/src/engine/optimization/multiCandidateGenerator.ts:314-324`).

### Recommendation

- Preserve pad-level constraint concept.
- Make enforcement universal across beam-only, annealing inner-loop, and final evaluation.

## Sound-Level Constraints

### V1

- Not a first-class concept.

### V2

- `voiceConstraints` exist in `ProjectState` (`../PushFlow/src/ui/state/projectState.ts:76-78`, `:141`, `:269-280`).

### What is actually enforced

- I did not find solver-path consumers of `voiceConstraints` in the source tree.
- `useAutoAnalysis()` only converts `layout.fingerConstraints`, not `voiceConstraints`, into `manualAssignments`.

### Recommendation

- Either wire sound-level constraints fully into the engine or remove them from canonical state.
- V3 should distinguish:
  - sound-level preferred hand/finger
  - pad-level enforced constraint
  - event-level exception override

## Event-Level / Manual Overrides

### V1

- If any event in a simultaneous group has an override, the solver applies a grip for the whole group and then spreads fingers across all notes (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:903-1003`).

### V2

- Same bug survives (`../PushFlow/src/engine/solvers/beamSolver.ts:895-1004`).

### What is actually enforced

- Not true per-event override semantics.
- It is effectively "if one event in the chord is constrained, solve the whole chord under that hand and finger set".

### Recommendation

- Rewrite. This is incorrect.

## Hand-Zone Assumptions

### V1

- Mostly implicit in solver behavior and UI expectations.

### V2

- Explicit zone logic exists in surface/debug layers and sanity checks.
- Zone is treated as soft preference, not hard feasibility.

### Recommendation

- Keep soft by default.
- Allow explicit user promotion to hard constraint for special modes.

## Finger-Order Assumptions

### V1

- Uses natural left/right order, but fallback grip finger priority is anatomically weak: `index, middle, ring, thumb, pinky` (`../PushFlow/Version1/src/engine/feasibility.ts:801-829`).

### V2

- Uses explicit anatomical left-to-right fallback orders:
  - left: pinky, ring, middle, index, thumb
  - right: thumb, index, middle, ring, pinky
  (`../PushFlow/src/engine/prior/feasibility.ts:613-641`)

### Recommendation

- Keep V2 fallback topology.

## Simultaneity Rules

### V1

- Groups by 1ms epsilon inside beam solver (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:133-154`).
- One-hand chord assignment bug can violate the intended note-to-finger mapping.

### V2

- Same epsilon grouping, extracted for reuse (`../PushFlow/src/engine/structure/eventGrouping.ts:14-58`).
- Exact coordinate matching improves simultaneity correctness.

### Recommendation

- Keep V2 handling.
- Make simultaneity grouping tolerance an explicit engine constant with tests.

## Same-Finger Conflicts

### V1

- Intended to avoid same-finger reuse within simultaneous groups, but one-hand mapping bug can undermine that intention.

### V2

- Actual simultaneous same-finger conflicts are now detectable by validator (`../PushFlow/src/engine/debug/constraintValidator.ts:105-154`).

### Recommendation

- Keep V2 validation.
- Add pre-result hard assertion in solver tests for simultaneous distinct-pad same-finger conflicts.

## Relaxed Fallback Tiers

### V1

- Three tiers exist, but relaxed tier is under-specified in scoring because it carries no explicit penalty.

### V2

- Tier system is explicit and diagnostically meaningful (`../PushFlow/src/engine/prior/feasibility.ts:685-707`).

### Recommendation

- Keep V2 tier semantics.

## Anatomical Assumptions

### V1

- Mostly embedded in scattered constants and heuristic stretch tables.

### V2

- Centralized in `biomechanicalModel.ts` with per-pair spans and finger-dominance costs.

### Recommendation

- Keep V2's centralized anatomy model.
- Add calibration/testing hooks if per-user adjustment is ever needed.

## Natural Hand Pose Integration

### V1

- Natural hand poses are persisted and validated.
- Pose0 doubles stiffness when present (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:834-845`).

### V2

- Pose0 override still influences resting pose, but stiffness doubling was removed (`../PushFlow/src/engine/solvers/beamSolver.ts:833-846`).

### Recommendation

- Keep V2 behavior.
- Keep V1 strict validation of persisted natural-hand-pose data.

## Rule Precedence

Current reality in both versions:

1. mapping resolution decides if event is even placeable
2. grip-generation hard constraints decide feasible one-hand shapes
3. fallback may still force a best-effort grip
4. manual override may bypass intended per-event semantics
5. soft costs rank surviving nodes

The weak point is step 4. It is not explicit and is implemented incorrectly.

## Constraint Precedence Proposal for V3

Recommended explicit hierarchy:

1. Canonical identity validity
   - event references valid sound
   - layout references valid sound IDs
2. Mapping validity
   - event's sound must resolve to a pad in optimization mode
3. Explicit user hard constraints
   - event-level overrides
   - pad-level enforced finger constraints
   - optional sound-level hard constraints
4. Biomechanical hard feasibility
   - one-finger-per-pad
   - pair-span limits
   - thumb delta
   - ordering/topology
   - max speed
5. Emergency fallback tier
   - allowed only if mode permits degraded solutions
   - always annotated as degraded
6. Soft optimization terms
   - transition difficulty
   - pose naturalness
   - alternation
   - hand balance
   - zone preference
7. Diagnostic-only derived rules
   - sanity checks
   - irrational detectors
   - explainability summaries

V3 should make this precedence machine-readable and testable.

