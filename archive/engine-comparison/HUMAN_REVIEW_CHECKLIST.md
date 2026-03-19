# HUMAN_REVIEW_CHECKLIST

Use this checklist to manually verify the audit conclusions in code and behavior.

- Verify that V3 solver input no longer uses imported MIDI pitch as canonical sound identity.
- Verify that layout resolution is keyed by sound ID, not `originalMidiNote`.
- Verify that a single event-level override inside a chord does not force the whole simultaneous group onto one hand/grip.
- Verify that same-finger simultaneous conflicts on different pads are impossible in solver output and surfaced if they occur.
- Verify that relaxed grips and fallback grips are distinguished both in scoring and in debug output.
- Verify that annealing inner-loop evaluation receives the same hard constraints as the final evaluation.
- Verify that candidate generation with annealing honors pad-level finger constraints.
- Verify that candidate ranking is actually applied in the production generation path, not only implemented in a utility module.
- Verify that `objectiveCost` used by beam search is the same scalar used by annealing and candidate selection.
- Verify that public-facing `score` or `grade` is clearly separated from internal optimization cost.
- Verify that debug breakdown labels match what is actually computed; `constraintPenalty` should not be mislabeled as `crossover`.
- Verify that bounce / alternation and hand-balance terms are included in aggregate totals if they are part of the optimized objective.
- Verify that span violations can be detected explicitly in the verification stack if the validator claims to support them.
- Verify that event-level debug output is based on true solver trace where possible, not only post-hoc reconstruction.
- Verify that imported sounds are truly decoupled from original pitch identity in the canonical model.
- Verify that voice-level constraints, if kept, are actually read by the solver path.
- Verify that stale analysis is invalidated on load and after engine-relevant edits.
- Verify that runtime/performance regression tests exist for 50, 100, and 200 event workloads or equivalent budgets.
- Verify that golden tests cover both fallback-mode validity and optimized-layout behavior.
- Verify that structural analysis graphs (simultaneity, transitions, co-occurrence) are keyed on canonical sound IDs in V3.

