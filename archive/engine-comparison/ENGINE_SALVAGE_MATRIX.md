# ENGINE_SALVAGE_MATRIX

| Engine Capability / Concept | V1 quality | V2 quality | Keep from V1 / Keep from V2 / Merge / Rewrite | Reason | Risk | V3 recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| MIDI import transformation | Good | Good | Merge | V2 is mostly a terminology port of V1; both are operationally fine | still pitch-centric | Keep import extraction, then re-key to soundId |
| Sound identity model | Weak | Medium | Rewrite | V2 moves in right direction but still recouples to original pitch | wrong canonical truth will poison V3 | Canonical soundId, rawPitch only provenance |
| Performance timeline model | Weak-medium | Good | Keep from V2 | `SoundStream` is better than flat-only events | solver path not fully migrated | Preserve streams, finish migration |
| Event grouping | Medium | Good | Keep from V2 | extracted utility + same effective behavior | tolerance still implicit in multiple places | Centralize epsilon and tests |
| Layout representation | Medium | Medium-good | Merge | V2 naming cleaner, V1 same core mechanics | still pitch keyed | Keep immutable layout, map to soundId |
| Candidate representation | Weak | Strong | Keep from V2 | first-class `CandidateSolution` is correct | ranking not fully integrated | Preserve and integrate ranking |
| Beam solver | Medium with major bugs | Good with unresolved bugs | Merge | V2 fixes important simultaneous-note defects | manual overrides and score semantics still broken | Start from V2 beam core, rewrite override/result semantics |
| Annealing | Medium | Good | Keep from V2 | deeper presets, restarts, telemetry, richer mutations | objective plumbing and manual constraints wrong | Keep infrastructure, rewrite objective/constraint plumbing |
| Cost model | Medium-conceptual, poor semantics | Medium-good internal, poor semantics externally | Rewrite | V2 internal objective is better, both versions mislabel costs | severe explainability drift | Canonical objective + clean diagnostic taxonomy |
| Constraint model | Medium | Good | Keep from V2 | centralized anatomical constants and tiering are superior | some implied rules and override ambiguity remain | Keep V2 structure, add explicit precedence |
| Hand pose integration | Medium | Good | Merge | V2 removes Pose0 overconstraint; V1 has stricter persistence validation | validation vs runtime still split | Use V2 runtime behavior + V1 validation rigor |
| Stale-analysis invalidation | Weak | Strong | Keep from V2 | V2 separates cache from truth | none if maintained | Preserve |
| Debug instrumentation | Medium | Strong | Keep from V2 | actual violations, irrational flags, sanity tools | post-hoc rather than trace-native | Keep and add solver trace |
| Verification scenarios | Strong | Medium-good | Merge | V1 breadth + V2 rule-focused scenarios is ideal | if only one side is kept, coverage becomes lopsided | Merge |
| Cost debug explanation | Medium | Good | Keep from V2 | event timeline + report tooling are more useful | still legacy labels | Keep tooling, rewrite labels |
| Optimized-result generation pipeline | Weak-medium | Good | Keep from V2 | candidate generation and packaging cleaner | candidate ranking unused, manual assignments dropped in annealing path | Preserve architecture, fix wiring |
| Persistence validation | Strong | Medium | Merge | V1 strict validation is better | V1 persists stale derived outputs | Use V1 strict validation with V2 stale-cache invalidation |
| Performance/runtime regression checks | Strong | Weak | Keep from V1 | V1 explicitly guards O(n^2) regressions | V2 may regress silently | Restore in V3 |

