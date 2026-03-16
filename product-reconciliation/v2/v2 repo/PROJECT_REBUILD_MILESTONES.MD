# PROJECT_REBUILD_MILESTONES

## Milestone 1 — Performance Structure Foundation
**Objective**  
Represent source MIDI as structured performance data (events, simultaneity, transitions, recurrence, density, sections).

**Why it matters**  
Without structure, downstream reasoning collapses into superficial note-by-note mapping.

**Expected output / capability gained**
- Canonical event timeline model
- Derived structural features for optimization and analysis

**Risks / design questions**
- Section detection quality
- Role inference confidence and fallback behavior

---

## Milestone 2 — Canonical Push Surface & Mapping Model
**Objective**  
Formalize the 8×8 surface model, coordinate conventions, and layout semantics.

**Why it matters**  
A stable physical model is required for consistent ergonomic reasoning.

**Expected output / capability gained**
- Unambiguous pad identity model `(row,col)`
- Clear layout artifact definition (musical identity → pad)

**Risks / design questions**
- Supporting multiple conceptual mapping layers (note/sound/role)
- Avoiding term drift (pad/cell/voice conflation)

---

## Milestone 3 — Ergonomic Prior & Feasibility Layer
**Objective**  
Define biomechanical priors: hand zones, natural pose, reachability, simultaneity realism, finger capability tendencies.

**Why it matters**  
Prevents physically implausible outputs and grounds optimization in human performance reality.

**Expected output / capability gained**
- Feasibility rules and ergonomic tendency model
- Parameterized constraints suitable for future personalization

**Risks / design questions**
- Overly rigid vs overly permissive constraints
- General defaults vs player-specific profiles

---

## Milestone 4 — Candidate Evaluation Engine
**Objective**  
Build a system that scores a candidate layout+execution plan and explains where difficulty comes from.

**Why it matters**  
Evaluation quality determines optimization direction and user trust.

**Expected output / capability gained**
- Composite difficulty estimation
- Factor-level breakdown (feasibility, motion, ergonomics, repetition, robustness)

**Risks / design questions**
- Weighting tradeoffs
- Calibration against real performer judgment

---

## Milestone 5 — Coupled Layout + Execution Reasoning
**Objective**  
Ensure layout generation is evaluated through temporal execution, not static geometry alone.

**Why it matters**  
Most difficulty emerges from transitions over time, not single-pad placements.

**Expected output / capability gained**
- Joint candidate artifact (layout + execution plan)
- Temporal validation across full sequence

**Risks / design questions**
- Search complexity and scalability
- Balancing global vs local optimization behavior

---

## Milestone 6 — Multi-Candidate Generation
**Objective**  
Produce diverse, high-quality alternatives instead of a single opaque recommendation.

**Why it matters**  
Different users prefer different tradeoffs (speed, comfort, memorability, expressiveness).

**Expected output / capability gained**
- Candidate set generation with tradeoff diversity
- Mechanism for ranking or filtering by preference profile

**Risks / design questions**
- Candidate diversity vs quality consistency
- UX burden of too many alternatives

---

## Milestone 7 — Explainability & Tradeoff Analysis
**Objective**  
Expose why candidates differ, where constraints bind, and which passages drive difficulty.

**Why it matters**  
Users need decision confidence and actionable iteration guidance.

**Expected output / capability gained**
- Passage-level diagnostics
- Comparative candidate reports with causal explanations

**Risks / design questions**
- Explanation depth vs cognitive overload
- Standardizing “difficulty reason” taxonomy

---

## Milestone 8 — Learnability & Song-Level Robustness
**Objective**  
Improve coherence/memorability and section-to-section stability.

**Why it matters**  
A layout that is locally easy but globally brittle fails real practice/performance conditions.

**Expected output / capability gained**
- Learnability-aware evaluation criteria
- Robustness checks across dense and sparse sections

**Risks / design questions**
- Quantifying memorability objectively
- Managing tradeoffs against raw ergonomic efficiency

---

## Milestone 9 — Human-in-the-Loop Iteration Controls
**Objective**  
Support user preference input, manual adjustment, and re-optimization feedback loops.

**Why it matters**  
Performability is partly personal; the system must adapt rather than dictate.

**Expected output / capability gained**
- Preference-aware candidate refinement
- Edit-and-recompute workflows preserving explainability

**Risks / design questions**
- Preference model complexity
- Maintaining optimization stability after manual edits