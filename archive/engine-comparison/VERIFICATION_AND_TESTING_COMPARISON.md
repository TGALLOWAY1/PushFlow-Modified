# VERIFICATION_AND_TESTING_COMPARISON

## Executive Verdict

V1 has the stronger regression discipline. V2 has the stronger practical debugging stack. V3 should merge them rather than choosing one side.

## Unit Tests

### V1

- broad fixture suite, policy suite, monotonicity suite, edge-case suite, project-state integration suite, performance/runtime suite (`../PushFlow/Version1/src/engine/__tests__/README.md:80-94`)
- behavioral contracts documented in prose plus code (`../PushFlow/Version1/src/engine/__tests__/helpers/semantics.ts:1-123`)
- important mismatch: V1 semantics docs describe chord grouping as exact startTime equality (`../PushFlow/Version1/src/engine/__tests__/README.md:73-76`, `../PushFlow/Version1/src/engine/__tests__/helpers/semantics.ts:79-90`), but the actual beam solver groups with a 1ms epsilon (`../PushFlow/Version1/src/engine/solvers/BeamSolver.ts:133-154`)

### V2

- strong targeted tests around feasibility, performability objective, smoke scenarios, golden scenarios, synthetic stress, and deep optimization
- examples:
  - atomic feasibility rules (`../PushFlow/test/engine/prior/feasibility.atomic.test.ts:1-296`)
  - regression-specific violated-rule detection (`../PushFlow/test/engine/prior/feasibility.regression.test.ts:24-86`)
  - performability objective mapping (`../PushFlow/test/engine/evaluation/performabilityObjective.test.ts:1-318`)

### Assessment

- V1 wins on breadth and contract discipline.
- V2 wins on targeted tests for the new debug/feasibility architecture.

## Golden Tests

### V1

- fixture-and-band approach with rebaselining workflow (`../PushFlow/Version1/src/engine/__tests__/README.md:50-63`, `:111-150`)

### V2

- 10 scenario golden suite with universal checks (`../PushFlow/test/golden/goldenScenarios.test.ts:1-214`)

### Assessment

- V1 golden approach is stronger for regression tracking over time because it encodes bands and rebaseline procedure.
- V2 golden approach is simpler and easier to read, but mostly fallback-mode validity checks.

## Sanity Checks

### V1

- mostly via helper assertions and broad fixture expectations

### V2

- explicit sanity-check subsystem with thresholds for pinky usage, thumb usage, zone violations, impossible moves, hand imbalance, average cost, and same-finger rapid repeats (`../PushFlow/src/engine/debug/sanityChecks.ts:21-68`, `:98-281`)

### Assessment

- V2 is better for operational debugging and human review.

## Violation Detection Scenarios

### V1

- many solver tests catch bad outcomes indirectly, but do not produce a unified violation artifact

### V2

- actual violation reports exist:
  - impossible reach
  - simultaneous collision
  - speed exceeded / tempo infeasible
  - zone violations
  (`../PushFlow/src/engine/debug/constraintValidator.ts:31-47`, `:57-99`, `:105-154`, `:164-209`, `:219-277`)
- regression tests explicitly assert expected violation kinds after controlled pad moves (`../PushFlow/test/engine/prior/feasibility.regression.test.ts:35-67`)

### Assessment

- V2 is clearly stronger here.

## Debug Dashboards

### V1

- `CostDebugPage` is useful for per-event cost inspection (`../PushFlow/Version1/src/pages/CostDebugPage.tsx:1-145`)
- but it is mostly a cost viewer, not a rule-violation debugger

### V2

- `OptimizerDebugPage` exposes event timeline, finger usage, costs, violations, movement, irrational assignments, and sanity checks (`../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:1-257`)

### Assessment

- V2 is much more useful for actual engine debugging.

## Cost-Debug Tools

### V1

- event metrics and cost page provide aggregated debugging (`../PushFlow/Version1/src/engine/eventMetrics.ts:1-202`, `../PushFlow/Version1/src/pages/CostDebugPage.tsx:100-145`)

### V2

- evaluation recorder reconstructs per-event debug records (`../PushFlow/src/engine/debug/evaluationRecorder.ts:26-137`)
- candidate report aggregates those records (`../PushFlow/src/engine/debug/candidateReport.ts:28-65`, `:141-226`)

### Assessment

- V2 is more actionable for triage.
- Caveat: these are post-hoc reconstructions, not full solver decision traces.

## Explicit Irrational-Assignment Detection

### V1

- no dedicated irrational detector

### V2

- dedicated rule-based irrational detector for pinky misuse, thumb abuse, same-finger streaks, and unnecessary cross-hand use (`../PushFlow/src/engine/debug/irrationalDetector.ts:1-250`)
- end-to-end synthetic tests exercise this path (`../PushFlow/test/optimizer/syntheticStressTests.test.ts:107-115`)

### Assessment

- Strong V2 improvement. Preserve.

## Event-Level vs Note-Level Debugging

### V1

- event-level cost inspection exists, but many behaviors are only visible indirectly

### V2

- event timeline is first-class in the debug dashboard (`../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:237-338`)
- evaluation records include prior pad, prior hand, prior finger, movement distance, and reconstructed cost components (`../PushFlow/src/engine/debug/evaluationRecorder.ts:32-70`)

### Assessment

- V2 is stronger.

## Are Failures Easy To Interpret Visually?

### V1

- moderately, for cost-centric debugging only

### V2

- yes, materially more so, because violation tables and sanity banners surface failure categories directly (`../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:195-209`, `:249-252`)

## Does the System Support Real Debugging Beyond Cost Totals?

### V1

- partially

### V2

- yes

Reason:

- V2 can tell a developer "same finger used twice simultaneously" or "left hand used outside zone" rather than only "cost got worse".

## Assessment of the Claim

Claim: "V2 had a more useful test/verification setup because actual violations of constraints could be detected and surfaced in a more practical way."

Verdict: verify.

Why:

- `validateExecutionPlan()` returns concrete violations (`../PushFlow/src/engine/debug/constraintValidator.ts:31-47`)
- `irrationalDetector.ts` surfaces suspicious biomechanical decisions (`../PushFlow/src/engine/debug/irrationalDetector.ts:31-55`)
- `OptimizerDebugPage` makes those artifacts visible (`../PushFlow/src/ui/pages/OptimizerDebugPage.tsx:151-158`, `:237-253`)
- regression tests assert specific rejection categories in feasibility diagnostics (`../PushFlow/test/engine/prior/feasibility.regression.test.ts:59-66`)

Important caveat:

- V2 verification is more useful operationally, but V1 still has the stronger regression-spec discipline.

## Gaps in V2 Verification

- no direct tests found for `multiCandidateGenerator.ts`
- no direct tests found for `candidateRanker.ts`
- no runtime/O(n^2) performance-regression suite comparable to V1's `solver.performance.test.ts`
- debug recorder reconstructs costs rather than consuming true solver trace
- `constraintValidator.ts` advertises span detection but does not implement it

## Recommended V3 Verification Stack

1. Preserve V1-style policy and semantics documents as executable contracts.
2. Preserve V1-style runtime/performance regression tests.
3. Preserve V2-style atomic rule tests and violation-category regression tests.
4. Preserve V2 debug dashboard and irrational/sanity tooling.
5. Add solver-trace capture so post-hoc reconstructions are no longer the only explanation path.
6. Add direct tests for:
   - candidate generation wiring
   - candidate ranking integration
   - manual-override behavior inside simultaneous groups
   - soundId-based mapping once V3 domain model changes
