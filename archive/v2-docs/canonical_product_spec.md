# Canonical Product Spec

## Purpose

The Performance Ergonomics Optimization Engine for Ableton Push 3 converts MIDI-derived musical material into physically playable Push 3 performances by jointly optimizing:

1. **Layout** — static assignment of musical identities to Push pads
2. **Execution Plan** — time-based hand/finger assignments over the event sequence

The product exists to close the gap between:

- material that is musically valid in software
- material that is physically playable by a human on Push 3

---

## Core Objective

The user is trying to perform a song on Push 3 without fighting the instrument.

The system should produce:

1. A playable **static placement** of sounds, notes, voices, or roles on the 8×8 pad surface
2. A **dynamic execution strategy** over time for how the material is actually played
3. Clear **analysis and comparison tools** so the user can understand and improve tradeoffs

A strong solution should improve:

- playability
- biomechanical realism
- motion efficiency
- learnability
- robustness across sections
- expressive usefulness

This is a **joint optimization problem**, not a static mapping problem.

---

## Canonical Outputs

The system should expose these outputs as first-class artifacts.

### 1. Static Layout
A full pad-assignment artifact describing which note, sound, voice, or role is placed on which Push pad.

Should support:
- positional clarity
- grouping logic
- adjacency logic
- hand-zone fit

### 2. Dynamic Execution Plan
A full timeline of hand/finger assignments for events.

Must account for:
- simultaneity
- transitions
- repetition burden
- phrase flow
- tempo-sensitive movement feasibility

### 3. Performance Difficulty Analysis
A composite view of total and localized difficulty across the song.

Should surface:
- overall burden
- passage-level hotspots
- factor-level explanations
- hand/finger overload
- section-specific breakdowns

### 4. Candidate Solutions
Multiple plausible layout + execution combinations with distinct tradeoff profiles.

The system should not imply that one universal layout is correct for all players.

### 5. Explanatory Output
The system should explain:
- why one candidate is easier or harder
- where constraints bind
- which passages are driving the score
- what changed between alternatives

---

## Core Use Cases

1. Import MIDI or equivalent performance source material
2. Extract meaningful performance structure from the input
3. Identify important notes, sounds, voices, or roles
4. Assign those identities to Push pads
5. Generate one or more playable layout candidates
6. Generate execution plans for those candidates
7. Analyze difficult passages and their causes
8. Compare alternative strategies
9. Iterate based on user preference, technique, or style
10. Preserve song identity while improving performability

---

## Canonical Domain Model

These concepts are implementation-agnostic anchors.

### Song
A complete musical work or clip set to be performed.

### Section
A macro temporal segment such as intro, verse, drop, chorus, or bridge.

### Phrase
A local musical unit within a section.

### Performance Event
A time-stamped trigger with attributes such as identity, onset, duration, and velocity.

### Note
A MIDI pitch or event identity.

### Sound
A timbral or perceptual identity, such as kick, snare, stab, or hat.

### Voice
A distinct mapped entity or stream tracked across the sequence.

### Musical Role
A functional role in the arrangement, such as pulse, accent, fill, lead, or texture.

### Layout
A static assignment from musical identities to pad positions.

### Pad
A physical Push button on the 8×8 grid.

### Grid Position
A stable coordinate `(row, col)` for a physical pad.

### Hand Zone
A preferred region of the grid for left vs right hand under natural posture assumptions.

### Finger Assignment
A per-event hand/finger decision.

### Execution Plan
The full timeline mapping from events to hand/finger actions.

### Performance Difficulty
A composite representation of physical and coordination burden over time.

### Ergonomic Prior
A structured prior describing likely comfort and plausible movement on Push.

### Natural Hand Pose
A canonical comfortable hand/finger geometry prior.

### Home Pose
The current neutral resting reference state for the hands in context.

### Transition Relationship
How one event or hand state leads into the next over time.

### Co-occurrence / Simultaneity
Events that occur together or nearly together.

### Candidate Solution
A complete proposal consisting of layout + execution plan + analysis.

### Learnability
The memorability and coherence burden for the performer.

### Robustness
How well a solution survives dense or varied sections without breaking down.

### Expressiveness
How well placement and execution support accents, dynamics, and musical intent.

---

## Push 3 Canonical Performance Surface

### Geometry
- Surface is **8 rows × 8 columns**
- Row index increases **bottom → top**
- Column index increases **left → right**
- Every pad has stable physical identity `(row, col)`

### Pad Identity Rules
- Pad identity is physical
- Pad identity must not be conflated with MIDI note number
- Layout logic should be grounded in physical coordinates, not arbitrary symbolic labels alone

### Spatial Meaning
- Adjacency matters
- Relative orientation matters
- Repeated transitions between distant pads are costly
- Diagonal, vertical, and horizontal relationships can carry different ergonomic meanings

### Hand Zones
- Left/right preferred regions should be modeled explicitly
- Zone boundaries are usually soft, not absolute
- Cross-hand use can be valid, but should be intentional and justified

### Natural Hand Pose Assumptions
- Hands have default home tendencies and finger ordering constraints
- Thumbs generally sit lower than the other fingers in natural pad interaction
- Index and middle fingers usually carry more agility load
- Ring, pinky, and thumb have distinct constraints
- Extreme spread or compression should be meaningfully penalized

### Biomechanical Realism
- Impossible reaches should be rejected or heavily penalized
- Impossible simultaneity should be rejected or heavily penalized
- Timing feasibility matters: reachable is not the same as playable at tempo
- Physical plausibility outranks visually neat but unrealistic solutions

---

## Performance Factor Families

These are canonical factor families, not a mandated formula.

### A. Feasibility
- impossible reach
- impossible simultaneity
- impossible timing for required travel
- finger conflicts or collisions

### B. Motion
- travel distance
- required movement speed
- directional awkwardness
- repositioning overhead

### C. Pose and Ergonomics
- hand-zone violations
- home-position drift
- overextension or compression
- unnatural thumb or pinky loading

### D. Repetition and Finger Independence
- same-finger overuse
- weak alternation
- independence bottlenecks
- jackhammer repetition burden

### E. Musical Robustness
- good locally but fails in dense sections
- brittle strategies
- section-to-section inconsistency

### F. Learnability / Simplicity
- intuitive grouping
- motif consistency
- useful symmetry
- manageable memory burden

### G. Expressiveness
- important accents or roles placed where control is comfortable
- ability to preserve dynamics and character under ergonomic constraints

---

## Input Interpretation Goals

Treat source material as **performance structure**, not a flat note list.

The system should infer or represent:

- event identity
- onset, duration, velocity
- simultaneity groups
- repeated-note runs
- rapid alternation patterns
- local temporal density
- phrase boundaries
- section boundaries
- transition graph structure
- co-occurrence structure
- recurring motifs
- relative role significance

The richer the inferred structure, the better the layout and execution coupling.

---

## Product Priorities

When making tradeoffs, prioritize in this order:

1. performability correctness
2. biomechanical plausibility
3. explainability
4. learnability and robustness
5. user control and editability
6. UI clarity
7. implementation simplicity
8. questionable legacy behavior compatibility

Do not preserve a behavior merely because it already exists.

---

## Invariants

These truths must survive any rebuild.

1. Layout and execution are a coupled problem
2. Physical pad position materially affects playability
3. Natural hand pose and hand-zone priors are core constraints
4. Evaluation must be temporal, not only spatial
5. A layout is only good relative to the sequence it supports
6. Dense and difficult sections must strongly influence evaluation
7. Finger/hand overload must not be hidden by coarse averages
8. Multiple plausible candidate solutions should be supported
9. Outputs must be explainable to users
10. Implementation strategy is flexible; canonical objective is not

---

## What Must Be Preserved In Any Rebuild

### Must survive
- joint layout + execution framing
- Push surface realism and coordinate consistency
- biomechanical prior as a first-class system component
- full-song difficulty reasoning
- multi-objective tradeoff handling
- explainability and iterative workflow support

### Flexible by design
- optimization algorithm choice
- search strategy
- internal data structures
- software architecture
- storage mechanism
- API boundaries
- exact scoring formulas

### Failure modes to avoid
- reducing the product to static layout only
- ignoring hand/finger sequencing over time
- treating MIDI as unstructured events
- optimizing local passages while breaking full-song coherence
- outputting opaque scores without causal explanation

---

## Out of Scope

These are not canonical product commitments:

- exact DAW integration details
- locking the system to one optimization algorithm
- treating current UI architecture as product truth
- treating one computed layout as universally optimal for all players

---

## Development Milestones

### Milestone 1 — Represent musical input as performance structure
Capture timing, recurrence, transitions, simultaneity, density, and section context.

### Milestone 2 — Define ergonomic and biomechanical prior
Formalize zones, reach, pose, finger capability, and timing realism.

### Milestone 3 — Define canonical Push layout model
Formalize 8×8 pad identity, coordinate conventions, and mapping semantics.

### Milestone 4 — Evaluate candidate solutions
Estimate difficulty for layout + execution pairs and provide factor breakdowns.

### Milestone 5 — Support coupled layout-execution reasoning
Assess layout quality through actual time-based play behavior.

### Milestone 6 — Generate diverse candidate solutions
Produce multiple plausible alternatives with distinct tradeoff profiles.

### Milestone 7 — Analyze difficult passages and tradeoffs
Show where and why difficulty occurs and what alternatives improve it.

### Milestone 8 — Optimize for learnability and robustness
Improve memorability and section-to-section reliability.

### Milestone 9 — Make the system explainable and debuggable
Make decisions inspectable and constraints visible.

---

## Open Design Questions

1. How should memorability vs raw ergonomic optimality be balanced by default?
2. Should musical roles be modeled explicitly beyond MIDI notes?
3. How many candidate solutions should be generated by default?
4. How should user-specific traits parameterize the prior?
5. How should section boundaries be auto-derived and user-overridden?
6. How much manual editing should participate in the optimization loop?
7. What execution-plan granularity is appropriate for different user types?
8. Should the system optimize for one tempo or a tempo range?
9. How should expressiveness be represented and validated?
10. What minimum explainability standard should each candidate satisfy?