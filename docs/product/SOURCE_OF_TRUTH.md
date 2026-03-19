# 1. Project Identity

**Canonical project name**  
Performance Ergonomics Optimization Engine for Ableton Push 3

**One-sentence summary**  
A system that converts MIDI-derived musical material into physically playable Ableton Push 3 performances by jointly optimizing pad layout and time-based hand/finger execution.

**Short product description**  
This product helps musicians remap musical material onto the Push 3 8×8 surface so the result is not only musically correct, but physically realistic and learnable for human hands.

**Who the product is for**
- Push 3 performers (especially finger drummers and hybrid performers) adapting MIDI to live playability.
- Producers who want to transform programmed material into performable arrangements.
- Advanced users iterating between layout strategy and physical technique.

**What user problem it solves**  
Raw MIDI structure often encodes musical events without considering hand reach, finger independence, simultaneity feasibility, and sustained movement burden on a finite pad surface.

**Why this problem matters**  
A musically valid sequence can still be physically unplayable. The value of this project is closing the gap between “sounds correct in software” and “can be performed by a human on Push 3 with control, consistency, and expression.”

---

# 2. Product Objective

In plain terms, the user is trying to perform a song on Push 3 without fighting the instrument.

The system should produce:
1. A playable **static placement** of sounds/roles on the 8×8 pads.
2. A **dynamic execution strategy** over time (hand/finger usage) for the actual event sequence.
3. Clear analysis so the user can understand and improve tradeoffs.

**Success means:**
- Difficult passages are made feasible or meaningfully easier.
- The full-song performance is robust, not just isolated bars.
- The layout remains coherent enough to learn and retain.
- The user can compare alternatives and choose based on priorities.

**Qualities to optimize for (multi-objective):**
- Playability and biomechanical feasibility
- Motion efficiency
- Ergonomic naturalness
- Learnability and consistency
- Expressive utility for important musical roles

**Out of scope (canonical):**
- Exact DAW/hardware integration implementation details.
- Locking to a specific optimization algorithm.
- Treating visual UI architecture as product truth.
- Treating one computed layout as universally optimal for all players.

---

# 3. Core Outputs of the System

The system should expose these outputs as first-class artifacts:

1. **Static Layout (Pad Assignment Map)**
   - Which note/sound/role is placed on which pad.
   - Includes positional rationale where possible (grouping, adjacency, hand zone fit).

2. **Dynamic Execution Plan (Performance Plan)**
   - Which hand and finger is expected to trigger each event over time.
   - Should account for simultaneity and transitions, not isolated hits.

3. **Performance Difficulty Analysis**
   - Total and localized difficulty estimates.
   - Passage-level breakdown of major burdens (reach, speed, collisions, drift, overuse, etc.).

4. **Candidate Solutions (Alternatives)**
   - Multiple plausible layout+execution pairs representing different tradeoffs.
   - Not just “best score,” but distinct strategic options.

5. **Explanatory Output**
   - Why a candidate is easier/harder.
   - Where constraints bind.
   - What changed between alternatives.

The system should support **generation + understanding + iteration**.

---

# 4. Core Use Cases

1. Import MIDI or equivalent performance source material.
2. Extract and inspect meaningful musical/performance structure.
3. Identify key sounds/notes/roles and usage patterns.
4. Map sounds/roles to Push pads.
5. Generate one or more playable layout candidates.
6. Generate execution plans for those candidates.
7. Analyze difficult passages and root causes.
8. Compare alternative strategies (e.g., compact vs distributed).
9. Iterate based on user preference, technique, or style.
10. Preserve song identity while improving performability.

---

# 5. Canonical Domain Model

Below are the canonical concepts. These are implementation-agnostic anchors.

## Song
A complete musical work or clip set to be performed.  
**Why it matters:** The optimization target is full-song usability, not isolated events.

## Section / Phrase
A meaningful temporal segment (e.g., intro, drop, chorus, fill phrase).  
**Why it matters:** Robust layouts should remain usable across sections with changing density/patterns.

## Performance Event
A time-stamped trigger with attributes (identity, onset, duration, velocity, etc.).  
**Why it matters:** This is the atomic timeline unit the execution plan must realize.

## Note / Sound / Voice / Musical Role
- **Note**: pitch/event identity in MIDI terms.
- **Sound**: timbral/perceptual identity (e.g., kick, snare, stab).
- **Voice**: distinct trackable stream/entity used in mapping.
- **Musical Role**: functional role in arrangement (pulse, accent, fill, lead, texture).

**Why it matters:** Optimization may need to prioritize roles beyond raw pitch numbers.

## Layout
A static assignment from musical identities (note/sound/role/voice) to pad positions.  
**Why it matters:** Layout defines the physical search space of every future action.

## Pad / Grid Position
A specific physical cell on the Push 8×8 surface with row/column identity.  
**Why it matters:** Physical coordinates directly influence reach, adjacency, and comfort.

## Hand Zone
Preferred region of the grid for left vs right hand under natural posture assumptions.  
**Why it matters:** Violating zones too often raises burden and inconsistency.

## Finger Assignment
Finger-level action choice for an event.  
**Why it matters:** Finger capability differences and independence are central to playability.

## Execution Plan
The full timeline mapping of events → hand/finger actions.  
**Why it matters:** Real playability is temporal and sequential.

## Performance Difficulty
A composite representation of physical/coordination burden.  
**Why it matters:** Primary optimization target and user feedback signal.

## Ergonomic Prior
A structured prior about likely human comfort and feasible movement on Push.  
**Why it matters:** Prevents mathematically neat but physically implausible outputs.

## Natural Hand Pose
Default comfortable resting geometry and finger ordering tendencies.  
**Why it matters:** Acts as baseline for drift/stretch penalties and feasibility checks.

## Transition Relationship
How one event/state leads into the next in time.  
**Why it matters:** Transition load often dominates difficulty.

## Co-occurrence / Simultaneity
Events that occur together or near-simultaneously.  
**Why it matters:** Requires multi-finger/multi-hand coordination feasibility.

## Candidate Solution
A complete proposal (layout + execution plan + analysis).

## Learnability
How easily the user can memorize and retain the mapping and motions.

## Robustness
How well a solution survives dense/varied song sections without breaking down.

## Expressiveness
How well placement/execution supports accents, dynamics, and musical intent.

---

# 6. Ableton Push 3 Canonical Performance Surface Model

This section defines physical truth that the project must preserve.

## Surface Geometry
- Device surface model: **8 rows × 8 columns (64 pads)**.
- Canonical indexing should be explicit and consistent:
  - Row index increases bottom → top.
  - Column index increases left → right.
- Every pad has stable identity `(row, col)`.

## Pad Identity Conventions
- A mapping assigns a musical identity (note/sound/role/voice) to pad identity.
- Pad identity is physical and should not be conflated with MIDI note number.

## Spatial Meaning
- Adjacency matters: nearby pads reduce movement burden.
- Relative orientation matters: diagonal/vertical/horizontal patterns affect comfort.
- Repeated transitions between distant pads are costly and destabilizing.

## Left vs Right Hand Zones
- The grid should be modeled with default left/right preferred regions.
- Zone boundaries can be soft (not absolute), but deviations should be meaningful in evaluation.
- Cross-hand use can be valid, but should be intentional and justified.

## Natural Hand Pose Assumptions
- Hands have default home tendencies and finger ordering constraints.
- Thumbs are generally lower (toward performer) than fingers in natural pad interaction context.
- Index/middle usually carry higher agility loads; ring/pinky and thumb have distinct constraints.
- Frequent extreme spread/compression should be penalized as unnatural burden.

## Typical Home Positions
- A canonical neutral pose should be definable for both hands.
- Distance from home and persistent drift are important ergonomic signals.

## Biomechanical Realism
- Impossible reaches/simultaneity must be rejected or heavily penalized.
- Timing feasibility matters: distance + tempo can make otherwise reachable moves unplayable.
- Physical plausibility should outrank purely abstract mapping neatness.

---

# 7. Canonical Performance Objective

The project should be framed as a **joint performance optimization problem**:

> Find layout and execution plan pairs that reduce total song-level performance difficulty while preserving musical usefulness, learnability, and physical naturalness.

The system must reason jointly about:
- **Layout decisions** (where things are)
- **Execution decisions over time** (how they are played)

A strong solution should satisfy:
- Biomechanical feasibility
- Natural-hand-pose compatibility
- Cross-section robustness
- Learnability/consistency
- Musical usefulness and expressive control

No single optimization algorithm is canonical. The behavior and constraints are canonical.

---

# 8. Performance Factors the System Should Consider

## A. Feasibility
- Impossible reach
- Impossible simultaneity
- Impossible inter-event timing for required travel
- Finger conflicts or collisions

## B. Motion
- Travel distance
- Required movement speed
- Directional awkwardness
- Hand repositioning overhead

## C. Pose and Ergonomics
- Zone violations
- Home-position drift
- Hand compression/overextension
- Unnatural thumb/pinky loading

## D. Repetition and Finger Independence
- Same-finger overuse
- Weak alternation patterns
- Independence bottlenecks
- “Jackhammer” repetition burdens

## E. Musical Robustness
- Failure in dense sections
- Brittle strategies that only work locally
- Inconsistent section-to-section behavior

## F. Learnability / Simplicity
- Intuitive grouping
- Recurring motif consistency
- Useful symmetry
- Memory burden minimization

## G. Expressiveness
- Placement of important accents/roles where control is comfortable
- Ability to preserve dynamic intention under ergonomic constraints

These are factor families, not a mandated formula.

---

# 9. Input Interpretation Goals

The system should interpret source material as **performance structure**, not a flat note list.

Required inference targets include:
- Event identity (note/sound/role hints)
- Onset, duration, velocity
- Simultaneity groups/chords
- Repeated-note runs
- Rapid alternation patterns
- Local temporal density
- Phrase/section boundaries
- Transition graph structure
- Co-occurrence structure
- Recurring motifs
- Relative role significance (e.g., backbone vs ornament)

The richer the inferred structure, the better the layout+execution coupling.

---

# 10. Canonical Development Objectives / Milestones

## Milestone 1 — Represent musical input as performance structure
**Goal:** Build a representation that captures timing, recurrence, transitions, simultaneity, density, and section context.

## Milestone 2 — Define ergonomic and biomechanical prior
**Goal:** Establish canonical constraints and tendencies (zones, reach, pose, finger capability, timing realism).

## Milestone 3 — Define canonical Push layout model
**Goal:** Formalize 8×8 pad identity, coordinate conventions, and mapping semantics.

## Milestone 4 — Evaluate candidate solutions
**Goal:** Given layout+execution, estimate difficulty and provide interpretable factor breakdowns.

## Milestone 5 — Support coupled layout-execution reasoning
**Goal:** Ensure layout quality is assessed through actual time-based play behavior.

## Milestone 6 — Generate diverse candidate solutions
**Goal:** Produce multiple plausible alternatives with distinct tradeoff profiles.

## Milestone 7 — Analyze difficult passages and tradeoffs
**Goal:** Surface where and why difficulty occurs, and what alternatives improve it.

## Milestone 8 — Optimize for learnability and song-level robustness
**Goal:** Improve coherence/memorability and reliability across all sections.

## Milestone 9 — Make the system explainable and debuggable
**Goal:** Make decisions inspectable; show active constraints and meaningful improvement levers.

---

# 11. Naming Conventions and Canonical Vocabulary

## Layout vs Mapping
- **Preferred:** Layout (for full pad-assignment artifact), Mapping (for assignment relation as data structure).
- **Avoid:** Using both interchangeably without context.

## Note vs Sound vs Voice vs Role
- **Preferred:**
  - Note = MIDI event identity
  - Sound = timbral identity
  - Voice = distinct mapped entity
  - Role = musical function
- **Avoid:** Calling all of these “notes.”

## Pad vs Cell vs Grid Position
- **Preferred:** Pad (physical button), Grid Position `(row,col)` (coordinate), Cell only if explicitly modeling abstract slots.
- **Avoid:** Using “cell” to mean physical pad.

## Performance Difficulty vs Ergonomics vs Feasibility
- **Preferred:**
  - Feasibility = can/cannot physically happen
  - Ergonomics = comfort/strain tendency
  - Performance Difficulty = composite burden
- **Avoid:** Treating these as synonyms.

## Execution Plan vs Finger Assignment
- **Preferred:** Finger assignment = per-event decision; Execution plan = full timeline plan.
- **Avoid:** Using “fingering” to mean both micro and full-sequence artifacts without distinction.

## Candidate Solution vs Best Solution
- **Preferred:** Candidate solution for each option; “best” only in relation to declared objective weights.
- **Avoid:** Implying absolute universal optimum.

## Section vs Phrase
- **Preferred:** Section for macro song segments; Phrase for local musical unit.
- **Avoid:** Mixing scales without specifying granularity.

## Natural Hand Pose vs Home Pose
- **Preferred:** Natural hand pose for biomechanical prior; home pose for current neutral reference state.
- **Avoid:** Treating these as always identical.

---

# 12. Invariants and Non-Negotiable Truths

1. Layout and execution are a coupled problem.
2. Physical pad position on Push 3 materially affects playability.
3. Natural hand pose and hand-zone priors are core constraints, not optional decorations.
4. Evaluation must be temporal, not only spatial.
5. A layout is only good relative to the sequence it supports.
6. Dense/difficult sections must strongly influence scoring.
7. Finger/hand overload should not be hidden by aggregate averages.
8. The system should support multiple plausible solutions.
9. Outputs must be explainable to users.
10. Implementation strategy is flexible; canonical objective is not.

---

# 13. What a New Developer Must Preserve

If rebuilding from scratch, preserve these truths:

## Must survive any rebuild
- Joint layout+execution optimization framing.
- Push physical surface realism and coordinate consistency.
- Biomechanical prior as a first-class system component.
- Song-level (not local-only) difficulty reasoning.
- Multi-objective tradeoff handling (playability, learnability, robustness, expressiveness).
- Explainability and iterative workflow support.

## Flexible by design
- Optimization algorithms and search strategies.
- Internal data structures and software architecture.
- UI framework, storage mechanism, and API boundaries.
- Exact scoring formula details and weight-learning methods.

## Common failure modes to avoid
- Reducing the product to static layout generation only.
- Ignoring hand/finger sequencing over time.
- Treating MIDI as unstructured events.
- Optimizing local passages while breaking full-song coherence.
- Producing opaque “scores” with no causal explanation.

---

# 14. Open Design Questions

1. How should memorability vs raw ergonomic optimality be balanced by default?
2. Should musical roles be modeled explicitly beyond MIDI notes, and how are roles inferred?
3. How many candidate solutions should be generated for practical user choice?
4. How should user-specific preferences and physical traits parameterize the prior?
5. How should section boundaries be auto-derived and user-overridden?
6. How much manual editing should be integrated into the optimization loop?
7. What level of execution-plan granularity is needed for different user types?
8. Should the system optimize for one target tempo or a tempo range?
9. How should expressiveness metrics be represented and validated?
10. What minimum explainability standard should each candidate satisfy?

---

# 15. Minimal Appendix on Current Repository Evidence

Repository evidence suggests strong alignment with this canonical framing:
- Existing docs and engine artifacts repeatedly center on MIDI performance analysis, biomechanical constraints, Push 8×8 mapping, and finger/hand assignment over time.
- Terminology discussions already highlight distinctions such as voice vs pad and the importance of assignment semantics.
- Current code appears to include several solver/evaluation strategies and UI analysis surfaces, indicating a multi-factor optimization and interpretation workflow.

What should **not** be considered canonical:
- Any specific current solver implementation.
- Current component/file structure.
- Current internal state management patterns.

This canonical spec is intended to preserve **intent** while allowing future technical redesign.