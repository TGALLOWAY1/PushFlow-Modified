# V3 Engine Audit Review Report

## Executive Summary

The engine audit confirms that V2 is the right structural starting point for V3, but not the right model to carry forward unchanged. V2 has the better feasibility architecture, better candidate packaging, and a much stronger debugging stack. It also still carries several legacy problems that would directly undermine the V3 merge if left in place.

The most important conclusions are straightforward:

- hard feasibility needs to be separated cleanly from soft ergonomic scoring
- canonical engine truth needs to move from imported MIDI pitch to stable sound identity
- explicit sound placement locks should be the real preserved hard constraints, not ordinary manual edits
- candidate diversity needs to be measured against the `Active Layout`, not just against whichever seed produced a candidate
- beam search, annealing, candidate ranking, and displayed totals need to agree on one canonical `objectiveCost`
- diagnostics need to evolve from useful post-hoc reconstruction into first-class solver explanations

This does not change the resolved V3 product policy. It sharpens the implementation plan by showing where the current engine still conflicts with that policy and what needs to be corrected in the merge.

## Resolved Decisions

### Canonical Engine Truth Uses Sound Identity

**Decision**  
The merged V3 engine should treat stable sound identity and stable performance-event identity as canonical truth. Imported MIDI pitch should remain provenance, not the long-term solver key.

**Why**  
The audit confirmed that V2 introduces a better sound-stream model but still flattens back to `originalMidiNote` in solver-facing code. That leaves the engine split between a sound-centric UI and a pitch-centric solver.

**Implementation impact**  
The solver input builder, mapping resolver, structural analysis layer, and layout indexing all need to move from `noteNumber` truth to `soundId` and `performanceEventId` truth.

### Hard Feasibility Must Be Separate From Scoring

**Decision**  
Mapping validity, explicit placement locks, finger capability rules, uniqueness rules, anatomical span and topology limits, and hard speed limits belong in hard feasibility. They should be enforced before or during optimization, not treated as ordinary weighted costs.

**Why**  
The audit showed that the current engine still mixes hard-rule failures, fallback penalties, and legacy diagnostic labels in ways that make it difficult to tell what is impossible versus what is merely undesirable.

**Implementation impact**  
Beam search, annealing, candidate generation, and validator code all need to share one hard-feasibility layer. Infeasible candidates should be pruned or explicitly marked as degraded, not silently ranked as normal results.

### Soft Ergonomic Terms Stay Soft

**Decision**  
Natural Hand Pose, pose attractor, per-finger home distance, finger dominance, alternation, hand balance, zone pressure, and locality should remain scoring terms rather than hidden hard rules.

**Why**  
The audit confirms these terms explain quality differences and ranking tradeoffs. They are central to playability, but they are not all physical impossibilities.

**Implementation impact**  
The cost model should expose these terms clearly in ranking and diagnostics, while keeping them separate from hard feasibility failures in solver behavior and UI explanations.

### Explicit Sound Locks Replace Legacy Pad-Finger Constraint Thinking

**Decision**  
Explicit sound placement locks are the canonical hard placement rule. Exact pad-to-single-finger locking is not.

**Why**  
The audit repeatedly references pad-level finger constraints because that is how the current V2 code is wired. That conflicts with the resolved V3 policy, which rejects exact persistent pad-to-finger locking as the main product rule.

**Implementation impact**  
The merge should replace `layout.fingerConstraints` as a canonical rule path with explicit sound placement locks plus hard finger capability and allowed-region rules. The lock affordance belongs in the sound panel, not as a hidden solver convention.

### Candidate Diversity Must Be Measured Against the Active Layout

**Decision**  
A candidate counts as a real alternative only if it is meaningfully different from the `Active Layout`, unless hard constraints leave almost no room to diverge.

**Why**  
The audit shows that V2 has useful seed strategies but does not fully wire ranking and deduplication into the normal generation path. Without a baseline-relative diversity rule, the system can emit trivial or cosmetic alternatives.

**Implementation impact**  
Candidate generation needs an explicit diversity filter, candidate diff logic against the active baseline, and low-diversity explanations when constraints collapse the space.

### One Canonical Objective Cost Must Drive the Engine

**Decision**  
Beam search, annealing, candidate comparison, and displayed totals must all agree on one canonical `objectiveCost`. Public score or quality grade, if retained, must be a separate presentation concept.

**Why**  
The audit found that annealing still optimizes `averageMetrics.total`, legacy diagnostic names still mislabel real costs, and public score semantics still do not match the optimized objective.

**Implementation impact**  
The scoring layer needs a cleanup pass: rename legacy fields, fix totals aggregation, switch annealing to the real objective, and separate objective cost from user-facing grade.

### Diagnostics Must Become First-Class Solver Output

**Decision**  
The merged V3 engine should preserve V2’s useful debugging surfaces, but move from post-hoc reconstructed explanations toward solver-emitted explainability.

**Why**  
The audit confirms that the validator, sanity tooling, and debug pages are already useful, but much of the current explanation stack is still reconstructed after the solve rather than emitted directly from solver decisions.

**Implementation impact**  
The solver should emit a canonical diagnostic payload that compare mode, Event Analysis, and debug pages can all consume without inventing or renaming cost semantics after the fact.

## Comparison Review

### Sound Identity vs Imported Pitch Identity

**Current interpretation**  
The current engine still resolves layouts and solver behavior largely through `originalMidiNote`, even though the persisted UI model introduces `SoundStream` as the conceptual truth.

**Alternative**  
Keep imported pitch as the core solver identity because it is already wired through the current system and is operationally simple.

**Recommended interpretation**  
Use stable `soundId` and `performanceEventId` as canonical engine truth. Keep imported pitch only as provenance and import metadata.

**Why**  
This is the only interpretation that matches the resolved V3 product direction and avoids a split-brain model where the editor is sound-centric but the solver is still pitch-centric.

**Impact on solver/UI/state**  
The solver input builder, layout resolver, structural analysis graphs, and candidate explanations all need to re-key on sound identity. UI state becomes more faithful to the engine instead of translating back and forth through pitch.

### Hard Feasibility vs Soft Penalty

**Current interpretation**  
The current engine has a strong feasibility core, but the audit shows that hard-rule failures, relaxed penalties, fallback penalties, and legacy display terms still blur together in some outputs.

**Alternative**  
Treat most rule violations as weighted costs so the optimizer can explore more broadly.

**Recommended interpretation**  
Prune true impossibilities before scoring. Keep relaxed grips as explicit penalized-but-valid states if allowed. Keep degraded fallback separate and explicitly labeled.

**Why**  
This preserves the biomechanical correctness that V2 improved while still allowing the ergonomic cost model to rank real tradeoffs. It also makes explanations trustworthy.

**Impact on solver/UI/state**  
The feasibility checker becomes a first-class input to beam and annealing. Diagnostics can distinguish “invalid” from “valid but worse,” and the UI can explain why a result failed instead of only showing a larger number.

### Explicit Sound Locks vs Legacy Pad-Finger Constraints

**Current interpretation**  
The current code turns `layout.fingerConstraints` into hard `manualAssignments`, and the audit refers to preserving that concept because it exists in the engine today.

**Alternative**  
Retain exact pad-to-single-finger constraints as a main preserved rule and make the entire optimization stack honor them universally.

**Recommended interpretation**  
Preserve explicit sound placement locks as the canonical hard user constraint. Use finger capability and allowed-region rules for feasibility. Do not preserve exact pad-to-single-finger lock semantics as a main product concept.

**Why**  
This aligns the engine with the resolved V3 interaction model and avoids carrying forward a solver-oriented legacy rule that the product has already rejected.

**Impact on solver/UI/state**  
The state model needs explicit placement-lock storage. The solver needs capability predicates instead of sticky pad-finger ownership. The UI needs a visible sound-panel lock flow rather than hidden constraint semantics.

### Event-Level Overrides vs Working-State Edits

**Current interpretation**  
The current solver still treats event-level overrides as hard manual assignments, and it still has the simultaneity bug where one constrained event can coerce an entire simultaneous group.

**Alternative**  
Keep event-level overrides as a small local hard-constraint feature, but fix the group-scope bug.

**Recommended interpretation**  
Fix the group-scope bug, but treat event-driven manual edits as changes to the `Working/Test Layout` and working execution assumptions by default.

**Why**  
That is the V3 product model. The engine should support human testing and iteration, not quietly accumulate tiny persistent override rules unless the user explicitly asks for a preserved constraint.

**Impact on solver/UI/state**  
Event Analysis must stop behaving like a hidden hard-override editor. Working-state analysis, compare mode, and promotion flow all need to understand event-driven manual edits as draft-state changes.

### Candidate Seeds vs Real Candidate Diversity

**Current interpretation**  
The current engine has real seed diversity through baseline, compact-left, compact-right, and pose-based strategies, but the production path does not fully rank or deduplicate the resulting candidates.

**Alternative**  
Keep the seed strategies and rely on them alone to provide enough variety.

**Recommended interpretation**  
Keep the seed strategies, but add explicit baseline-relative diversity checks, dedupe logic, and candidate explanations that say why a result is meaningfully different.

**Why**  
Seed diversity is useful, but not sufficient. Without active-baseline comparison, the engine can still present trivial alternatives as if they were genuinely different.

**Impact on solver/UI/state**  
The candidate generator needs diversity filtering, the compare flow needs better diff summaries, and the UI needs a way to explain low-diversity outputs when locks or hard feasibility reduce the search space.

### Legacy Cost Names vs Canonical V3 Naming

**Current interpretation**  
The current engine still exposes legacy display categories such as `bounce`, `fatigue`, and `crossover` even when those labels no longer match what the solver is actually optimizing.

**Alternative**  
Keep the old names for backward compatibility and let the UI translate them however it wants.

**Recommended interpretation**  
Move the canonical engine vocabulary to terms that reflect actual behavior: `poseAttractor`, `perFingerHome`, `alternation`, `constraintPenalty`, and a single `objectiveCost`.

**Why**  
The audit found real semantic drift between runtime behavior and displayed labels. Leaving the old naming in place would make the merged system harder to trust and harder to debug.

**Impact on solver/UI/state**  
Execution-plan types, diagnostics payloads, debug views, and compare explanations all need a naming cleanup. Migration aliases may exist briefly, but not as canonical truth.

### Reconstructed Debug Output vs True Solver Trace

**Current interpretation**  
The current debug stack is genuinely useful, but much of it is reconstructed after the solver runs rather than emitted from the actual decision process.

**Alternative**  
Keep reconstruction-only diagnostics because they are already useful enough for engineering review.

**Recommended interpretation**  
Preserve the current validator and debug tooling, but evolve the engine toward first-class solver-trace output.

**Why**  
The current approach is good enough for debugging regressions, but not ideal for explaining exactly why one candidate beat another or why a working draft changed cost in a particular way.

**Impact on solver/UI/state**  
The solver contract needs a richer diagnostic payload. Compare mode, Event Analysis, and debug pages can then share one explanation source instead of each reconstructing partial interpretations.

## Open Questions

1. Should relaxed grips remain valid but heavily penalized in normal optimization, or should normal optimization require strict feasibility only?
2. Can hand-zone preference ever be promoted to a hard rule, or must it remain soft in all standard workflows?
3. Should per-sound preferred hand and preferred finger ever gain an optional hard mode later?
4. Should fatigue remain purely cost-based until a real fatigue model exists?
5. When layout movement is blocked by hard constraints, what minimum execution-plan difference should count as real diversity?
6. Should degraded fallback ever appear in normal candidate generation, or only in explicit preview/debug workflows?

## Recommended Next Steps

1. Rewrite the feasibility layer so beam, annealing, and candidate generation share the same hard-rule contract.
2. Unify the scoring layer around one canonical `objectiveCost` and remove the legacy naming drift.
3. Add baseline-relative diversity filtering and production candidate ranking.
4. Define the canonical diagnostics payload and wire it through compare mode and Event Analysis.
5. Re-key solver truth, mapping, and structural analysis from imported pitch to stable sound identity.
