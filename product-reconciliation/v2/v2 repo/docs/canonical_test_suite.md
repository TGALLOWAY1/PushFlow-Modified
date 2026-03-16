# Canonical Test Suite

Use this suite as the golden set for validating:

`MIDI import → performance events → layout → hand/finger assignment`

These fixtures should be **system-generated**, deterministic, versionable, and suitable for regression testing.

---

## Shared Expectations

For all tests, good solutions should generally:

- stay near natural hand pose
- keep left hand mostly on the left and right hand mostly on the right
- favor compact clusters
- avoid unnecessary crossover
- avoid single-finger overuse
- minimize travel and strain
- preserve phrase-level coherence

---

## Test 1 — Two-note alternation, medium tempo

### What is being tested
Basic sanity of import, layout, and finger alternation.

### MIDI
- notes alternate: `36, 38, 36, 38...`
- 8th notes
- 1–2 bars
- system-generated

### Expected result
Acceptable outcomes:
- both notes near right-hand resting zone
- both notes near left-hand resting zone
- split across hands if equally natural

Examples:
- `R2, R3`
- `L2, L3`
- `R2, L2`

### Should not
- use one finger for all hits
- scatter notes across the grid
- bias one hand for no clear reason

---

## Test 2 — Two-note alternation, fast tempo

### What is being tested
Whether higher speed pushes the solution toward tighter spacing and better alternation.

### MIDI
- same pattern as Test 1
- fast 16ths or 32nds
- system-generated

### Expected result
- notes placed very close together
- prefers alternating fingers or hands
- avoids unrealistic repeated use of one finger

### Bad signs
- distant pads
- one finger doing all the work
- unnecessary hand switching

---

## Test 3 — Single repeated note

### What is being tested
Repeated-hit handling and bounce / fatigue behavior.

### MIDI
- one note repeated: `36 x 16`
- medium-fast tempo
- system-generated

### Expected result
- repeated hits should not always use the same strained finger
- if duplicate pad choices are allowed, nearby alternates may be preferred
- placement should stay near resting zone

### Bad signs
- same pinky forever
- same finger forever when easy alternation is available
- far-from-home placement
- no load sharing when obvious

---

## Test 4 — Three-note repeating phrase

### What is being tested
Compact clustering and sensible local finger order.

### MIDI
- `36, 38, 42` repeated
- medium tempo
- system-generated

### Expected result
- all three notes in a small cluster
- natural mini-rudiment feel
- likely one hand unless cross-hand is clearly better

### Bad signs
- notes spread across the grid
- awkward finger ordering
- no phrase continuity

---

## Test 5 — Four-note run

### What is being tested
Sequential ergonomic pathing.

### MIDI
- `36, 38, 40, 41` repeated
- medium tempo
- system-generated

### Expected result
- notes form a short ordered path
- likely row, arc, or shallow diagonal
- finger order mostly monotonic

### Bad signs
- zig-zag layout
- hand crossover in a simple phrase
- non-compact mapping

---

## Test 6 — Hand-split call-and-response

### What is being tested
Whether the optimizer uses both hands when the phrase clearly suggests it.

### MIDI
- Beat 1: `36, 38`
- Beat 2: `45, 47`
- Repeat 2–4 bars
- system-generated

### Expected result
- one cluster in left-hand zone
- one cluster in right-hand zone
- both hands used naturally

### Bad signs
- everything assigned to one hand
- repeated center crossing
- both groups on same side without justification

---

## Test 7 — Simultaneous hits / stacked onsets

### What is being tested
Handling of same-time events.

### MIDI
Example:
- `0.0`: `36 + 42`
- `0.5`: `38`
- `1.0`: `36 + 38 + 42`
- system-generated

### Expected result
- simultaneous notes assigned to different feasible fingers
- compact multi-finger shapes
- no impossible same-finger simultaneity

### Bad signs
- same finger assigned to two simultaneous notes
- impossible reach
- random wide spacing

---

## Test 8 — Crossover prevention

### What is being tested
Whether left/right hand ordering is preserved.

### MIDI
- phrase designed as left-group then right-group
- system-generated

### Expected result
- left hand stays left
- right hand stays right
- minimal crossover

### Bad signs
- mirrored or crossed hand logic
- left hand covering right side while right hand covers left
- frequent crossing in a simple phrase

---

## Test 9 — Large-jump phrase with return

### What is being tested
Lookahead vs greedy local behavior.

### MIDI
- `36, 36, 48, 36, 50, 36`
- system-generated

### Expected result
- repeated anchor note placed in a comfortable home position
- jump notes placed as reachable satellites
- phrase-level planning beats greedy note-by-note behavior

### Bad signs
- anchor note placed poorly
- repeated long hops
- no evidence of whole-phrase planning

---

## Test 10 — Simple drum groove

### What is being tested
Musically realistic handling of kick / snare / hat roles.

### MIDI
- kick = `36`
- snare = `38`
- closed hat = `42`
- optional accent = `46`
- 1–2 bar groove
- system-generated

### Expected result
- hats on easy repeatable pads
- kick and snare on strong home pads
- compact playable groove cluster
- lower-row or thumb use may be reasonable

### Bad signs
- roles scattered across the grid
- entire groove assigned to one hand without musical reason
- repeated hats requiring excessive travel

---

## Universal Pass / Fail Checks

For every test, record:

### Import correctness
- note count
- event timing correctness
- unique note count
- simultaneity correctness

### Compactness
- how tightly related events are clustered
- whether spacing is justified by phrase structure

### Hand sanity
- left mostly left
- right mostly right
- center crossing only when justified

### Finger sanity
- no impossible simultaneity
- no absurd repeated overuse
- plausible alternation where available

### Natural pose bias
- placements stay near rest zones unless the phrase clearly demands otherwise

### Crossover
- low in simple cases
- only used intentionally when beneficial

### Phrase flow
- reasonable travel and strain over the full phrase
- no obviously greedy local decisions that hurt the sequence

---

## Regression Standard

The system should not be trusted on complex songs if it fails obvious simple cases.

Any significant optimizer or evaluator change should be checked against this suite before broader conclusions are drawn.

---

## Fixture Guidance

Canonical fixtures should be:
- system-generated
- deterministic
- version-controlled
- easy to regenerate
- easy to automate in tests

Avoid relying on hand-authored MIDI unless a specific musical nuance requires it.