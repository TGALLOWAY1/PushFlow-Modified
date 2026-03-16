# PushFlow Cost Model — Backlog

Items in this document are explicitly **not part of the V1 refactor**. Each is a candidate for future investigation once V1 is stable, tested, and validated on real Push 3 performances.

---

## Later Research / Experiments

### B-01: Soft Zone Boundaries

**Why deferred:** V1 enforces hand zones as hard constraints (left: cols 0–3, right: cols 4–7, shared: cols 3–4). This is simple and correct for most layouts. However, some advanced performances may benefit from intentional cross-hand use (e.g., left hand reaching into column 5 for a brief accent while right hand is busy).

**Question to answer:** Are there real Push 3 performances where strict zone enforcement prevents the only ergonomically viable solution?

**Evidence needed:** At least 3 real-world performance scenarios where soft zones produce meaningfully better solutions than hard zones. The improvement must be measurable in event-level cost, not just subjective preference.

**What reintroduction looks like:** A zone violation cost (distance-proportional, similar to current `zoneViolationScore`) applied only when the solver can prove that cross-hand use reduces total event cost below the threshold of same-hand alternatives.

---

### B-02: Passage-Level Optimization

**Why deferred:** The current passage difficulty scorer (`passageDifficulty.ts`, `difficultyScoring.ts`) adds a multi-factor scoring layer on top of event-level costs. For V1, the solver operates event-by-event. Passage-level optimization would require the solver to consider sequences of events jointly — a fundamentally different optimization approach (e.g., dynamic programming over windows, or phrase-aware annealing).

**Question to answer:** Does event-local optimization produce solutions that are locally optimal but globally poor? Specifically: are there patterns where a slightly worse assignment at event N makes events N+1 through N+5 significantly easier?

**Evidence needed:** Concrete examples from real performances where event-local solutions are measurably worse than passage-aware solutions. Quantify the improvement in total cost over a 4–8 event window.

**What reintroduction looks like:** A windowed optimization pass that runs after the initial beam solve, considering 4–8 event windows and re-optimizing finger assignments within each window. This is post-processing, not a replacement for beam search.

---

### B-03: Advanced Transition Modeling

**Why deferred:** V1 uses simplified Fitts's Law (distance + speed penalty). This treats all movements equivalently — lateral movement, vertical movement, diagonal movement, hand lift-and-place. In reality, some movement patterns are easier than others:

- Lateral slides (same row, different column) may be easier than diagonal jumps.
- Small movements to adjacent pads can be executed without lifting fingers.
- Repeated movement in the same direction may build momentum and become easier.
- Movement from a cramped grip to a relaxed grip may feel easier than the reverse.

**Question to answer:** Does the simplified Fitts's Law model systematically miscode certain transitions? Which transitions does it get most wrong?

**Evidence needed:** Video analysis or self-report from Push 3 performers comparing perceived difficulty against Fitts's Law predictions for at least 20 distinct transition types.

**What reintroduction looks like:** A transition cost lookup table or piecewise function that adjusts the base Fitts's Law cost by movement direction, start/end grip shape, and whether the movement requires a finger lift. The table would be calibrated from empirical data.

---

### B-04: Empirical Testing with Real Push Performances

**Why deferred:** All current cost parameters (span limits, finger preference values, speed limits, hand balance targets) are based on biomechanical reasoning and developer judgment. None have been validated against real Push 3 performance data.

**Question to answer:** Do the current parameter values produce solutions that actual Push performers rate as comfortable? Which parameters are most miscalibrated?

**Evidence needed:** A validation study where 3+ Push performers rate solver solutions for comfort, difficulty, and learnability on 10+ performance scenarios. Compare ratings against model predictions.

**What reintroduction looks like:** Parameter tuning based on regression analysis of performer ratings vs. model costs. Adjust `FINGER_PREFERENCE_COST` values, `MAX_HAND_SPEED`, span limits, and hand balance targets to minimize prediction error.

---

### B-05: Scenario-Based Ergonomic Calibration

**Why deferred:** The cost model uses fixed weights and thresholds. Different musical contexts (fast hi-hat patterns vs. slow chord progressions vs. polyrhythmic grooves) may require different weight balances.

**Question to answer:** Should cost weights be context-sensitive? For example, should finger preference matter more in fast passages and hand shape deviation matter more in chordal passages?

**Evidence needed:** Demonstrate that a single fixed weight set produces systematically poor solutions for at least one common performance type, and that context-sensitive weights fix the problem without degrading other scenarios.

**What reintroduction looks like:** A lightweight context classifier that detects passage type (monophonic, chordal, rapid alternation, polyrhythmic) and selects from a small set (3–5) of pre-calibrated weight profiles.

---

### B-06: Fatigue Modeling

**Why deferred:** Cumulative fatigue — where repeated use of a finger or hand over many events degrades performance quality — is real but hard to model accurately. The legacy `fatigue` field in `DifficultyBreakdown` was actually per-finger home distance, not cumulative fatigue. Real fatigue modeling would need to track per-finger usage density over time and apply an increasing cost.

**Question to answer:** At what event density and duration does finger fatigue become a meaningful constraint for Push 3 performance? Is it relevant for typical song lengths (3–5 minutes)?

**Evidence needed:** Performer reports of fatigue onset for different finger usage patterns on Push 3. Ideally: force/accuracy measurements over sustained performance.

**What reintroduction looks like:** A running fatigue accumulator per finger that increases with use density and decays over rest periods. The fatigue value would be added to the finger preference cost, making overused fingers progressively more expensive.

---

### B-07: Alternation as Left-Right Drumming Pattern Reward

**Why deferred:** The V1 refactor removes the current alternation cost because its formulation ("same-finger repetition is bad") is often wrong. The user's actual intent is to reward natural left-right hand alternation patterns common in drumming. Designing a correct formulation requires careful thought:

- What exactly constitutes a "natural drumming alternation"?
- Is it strictly LRLR, or can it be LLRR, LRRL, etc.?
- Does it depend on tempo?
- Does it apply only to single-note sequences, or also to chordal patterns?

**Question to answer:** What is the correct mathematical formulation for rewarding natural drumming alternation without penalizing legitimate same-hand or same-finger repetition?

**Evidence needed:** Analysis of 10+ real Push drumming patterns annotated with hand assignments by experienced performers. Identify which patterns feel natural and which feel forced.

**What reintroduction looks like:** A hand-level (not finger-level) alternation cost that rewards patterns matching common drumming idioms. Likely implemented as a context-aware bonus rather than a penalty — the solver would prefer solutions where rapid sequences naturally alternate between hands when doing so reduces total transition cost.

---

### B-08: Richer Hand Utilization Models

**Why deferred:** V1 uses a simple quadratic hand balance penalty. The user suggests hand utilization should emerge from all-ten-fingers reasoning and finger dominance logic rather than an explicit balance term. Post-V1 investigation should determine whether the explicit term is still needed once zone constraints and finger preference costs are in place.

**Question to answer:** With hard zone constraints and corrected finger preference costs, does the solver naturally produce balanced hand use? If not, what's the minimum additional signal needed?

**Evidence needed:** Run V1 solver on 10 diverse layouts with and without hand balance cost. Measure hand utilization ratios.

**What reintroduction looks like:** If hand balance cost is still needed, consider a formulation based on cumulative hand movement distance rather than event count — a hand that plays many easy notes may not need as much balance as a hand that plays fewer but harder notes.

---

## Potential Future Model Expansions

### B-09: Higher-Level Tradeoff Layers

**Why deferred:** The current `TradeoffProfile` (playability, compactness, handBalance, transitionEfficiency, learnability, robustness) is a 6-axis characterization of a candidate solution. For V1, the solver ranks by a single scalar objective. Multi-axis tradeoff profiles could enable Pareto-optimal candidate selection in later versions.

**Question to answer:** Do users actually want to choose between "easy but spread out" vs. "compact but harder" solutions? Or is a single "best" solution sufficient?

**Evidence needed:** User research on candidate selection behavior. Do users engage with tradeoff profiles, or do they always pick the lowest-difficulty option?

**What reintroduction looks like:** Pareto frontier computation over 2–3 axes (e.g., total cost, compactness, hand balance) with UI for exploring the tradeoff space.

---

### B-10: Robustness / Variance Scoring

**Why deferred:** Robustness scoring measures how consistently a solution performs across different passages. A solution with low average difficulty but one extremely hard passage may be worse than a solution with moderate average difficulty and no hard passages. V1 computes mean costs but does not penalize variance.

**Question to answer:** Do users prefer solutions with consistent difficulty, or is low average difficulty sufficient?

**Evidence needed:** A/B testing where users perform with low-mean-high-variance solutions vs. moderate-mean-low-variance solutions. Measure practice time to proficiency.

**What reintroduction looks like:** A variance penalty term added to the performance-level cost: `variancePenalty = weight × variance(eventCosts)`. The weight should be empirically calibrated.

---

### B-11: Role-Aware Weighting

**Why deferred:** The current role-weighted scoring multiplies passage difficulty by musical role importance (backbone × 1.5, accent × 0.6). The user believes this behavior should emerge from finger dominance costs — backbone sounds should be placed on easy-to-reach pads by the layout optimizer, not given special treatment by the cost model.

**Question to answer:** Does the layout optimizer naturally place high-importance sounds in ergonomically favorable positions, or does it need explicit role-based cost weighting?

**Evidence needed:** Compare layouts optimized with and without role weighting. If layouts are similarly good, role weighting is unnecessary.

**What reintroduction looks like:** If needed, a role-aware term that increases the cost of difficult assignments for backbone/lead sounds. This should be a multiplicative weight on existing costs, not a separate scoring system.

---

### B-12: Long-Horizon Optimization Beyond Event-Local Costs

**Why deferred:** V1's beam search optimizes greedily event-by-event (with beam width providing limited look-ahead). True long-horizon optimization would consider the full sequence jointly, potentially using techniques like:

- Simulated annealing over the full assignment sequence
- Genetic algorithms evolving candidate assignment sequences
- Dynamic programming over phrase boundaries

**Question to answer:** How much improvement does long-horizon optimization provide over beam search for real performances?

**Evidence needed:** Benchmark V1 beam search against an exhaustive solver on small (10–20 event) sequences. Measure the cost gap.

**What reintroduction looks like:** A two-phase solve: beam search for initial solution, followed by a local search phase that considers 8–16 event windows and re-optimizes assignments.

---

### B-13: Phrase-Aware Costs

**Why deferred:** Musical phrases have structure — a 4-bar pattern that repeats should ideally have the same finger assignments each time it repeats, even if the assignments within each repetition vary. V1 does not model phrase boundaries or repetition.

**Question to answer:** Do performers find it easier to learn patterns that use consistent assignments across phrase repetitions?

**Evidence needed:** Practice-time comparisons for performers learning consistent-assignment vs. varying-assignment solutions on repeating patterns.

**What reintroduction looks like:** A phrase-repetition consistency bonus that rewards solutions where repeated musical phrases receive the same finger assignments.

---

### B-14: Per-Sound Hand/Finger Preferences

**Why deferred:** Users may want to express preferences like "always play kick with right thumb" or "prefer left hand for bass sounds." V1 supports explicit placement locks but not softer per-sound preferences.

**Question to answer:** How should per-sound preferences interact with the optimization? As hard constraints (locks) or as cost biases?

**Evidence needed:** User research on how performers think about sound-to-hand associations.

**What reintroduction looks like:** A per-sound preference cost term that adds cost when a sound is assigned to a non-preferred hand or finger. Preferences would be user-specified per project.

---

### B-15: Stretch as Distinct Ergonomic Concept

**Why deferred:** The V1 refactor renames `stretch` to `fingerPreference` because the current implementation measures finger dominance cost, not actual anatomical stretch. However, true ergonomic stretch — the difference between current finger spread and comfortable spread — is a real concept that the legacy name tried to capture.

**Question to answer:** Should stretch (actual inter-finger distance strain) be a separate cost term from finger preference?

**Evidence needed:** Identify Push 3 scenarios where finger preference and stretch diverge — e.g., a grip using preferred fingers (index, middle) but at an uncomfortable spread.

**What reintroduction looks like:** A stretch cost based on pairwise finger distance compared to comfortable default distances, using the per-finger-pair span data from `FINGER_PAIR_MAX_SPAN_STRICT` as the reference. Cost would increase as the grip approaches (but stays within) the strict limit.
