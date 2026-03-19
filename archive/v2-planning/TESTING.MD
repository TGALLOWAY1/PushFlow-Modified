## Canonical Test Suite for MIDI → Layout Optimization

Use these as a **golden set** for validating:

`MIDI import → note events → pad layout → hand/finger assignment`

### Shared expectations

For all tests, good solutions should:

* stay near **natural hand pose**
* keep **left hand on left**, **right hand on right**
* favor **compact clusters**
* avoid **unnecessary crossover**
* avoid **single-finger overuse**
* minimize **travel / strain**

---

## 1) Two-note alternation, medium tempo

### What’s being tested

Basic sanity of import, layout, and finger alternation.

### MIDI

* 2 notes alternating: `36, 38, 36, 38...`
* 8th notes, 1–2 bars
* **System-generated**

### Expected result

Acceptable:

* both notes near right-hand resting zone
* both notes near left-hand resting zone
* split across hands if equally natural

Examples:

* `R2, R3`
* `L2, L3`
* `R2, L2`

Should not:

* use one finger for all hits
* scatter notes across grid
* bias one hand for no reason

---

## 2) Two-note alternation, fast tempo

### What’s being tested

Whether speed pushes the solver toward tighter spacing and better alternation.

### MIDI

* Same as Test 1
* Fast 16ths or 32nds
* **System-generated**

### Expected result

* notes placed very close together
* prefers alternating fingers or hands
* avoids unrealistic repeated use of one finger

Bad:

* distant pads
* one finger doing all work
* unnecessary hand switching

---

## 3) Single repeated note

### What’s being tested

Repeated-hit handling and bounce / fatigue behavior.

### MIDI

* One note repeated: `36 x 16`
* Medium-fast tempo
* **System-generated**

### Expected result

* repeated hits should not always use the same strained finger
* if duplicate pad options exist, should prefer nearby alternates
* should stay near resting zone

Bad:

* same pinky or same finger forever
* far-from-home placement
* no load sharing when obvious

---

## 4) Three-note repeating phrase

### What’s being tested

Compact local clustering and sensible finger order.

### MIDI

* `36, 38, 42` repeated
* Medium tempo
* **System-generated**

### Expected result

* all three notes in a small cluster
* natural mini-rudiment feel
* likely one hand unless cross-hand is clearly better

Bad:

* notes spread across grid
* awkward finger ordering
* no phrase continuity

---

## 5) Four-note run

### What’s being tested

Sequential ergonomic pathing.

### MIDI

* `36, 38, 40, 41` repeated
* Medium tempo
* **System-generated**

### Expected result

* notes form a short ordered path
* likely row / arc / shallow diagonal
* finger order mostly monotonic

Bad:

* zig-zag layout
* hand crossover in a simple phrase
* non-compact mapping

---

## 6) Hand-split call-and-response

### What’s being tested

Whether the optimizer uses both hands when the phrase clearly suggests it.

### MIDI

* Beat 1: `36, 38`
* Beat 2: `45, 47`
* Repeat 2–4 bars
* **System-generated**

### Expected result

* one cluster in left-hand zone
* one cluster in right-hand zone
* both hands used naturally

Bad:

* everything assigned to one hand
* repeated center crossing
* both groups on same side without reason

---

## 7) Simultaneous hits / stacked onsets

### What’s being tested

Handling of same-time events.

### MIDI

Example:

* `0.0`: `36 + 42`
* `0.5`: `38`
* `1.0`: `36 + 38 + 42`
* **System-generated**

### Expected result

* simultaneous notes assigned to different feasible fingers
* compact multi-finger shapes
* no impossible same-finger simultaneity

Bad:

* same finger assigned to two simultaneous notes
* impossible reach
* random wide spacing

---

## 8) Crossover prevention

### What’s being tested

Whether left/right hand ordering is preserved.

### MIDI

* Phrase designed as left-group then right-group
* Example: `A, B, C, D` with timing encouraging 2-note left cluster + 2-note right cluster
* **System-generated**

### Expected result

* left hand stays left
* right hand stays right
* minimal crossover

Bad:

* mirrored or crossed hand logic
* left hand covering right side while right hand covers left
* frequent crossing in a simple phrase

---

## 9) Large-jump phrase with return

### What’s being tested

Lookahead vs greedy local choices.

### MIDI

* `36, 36, 48, 36, 50, 36`
* **System-generated**

### Expected result

* repeated anchor note placed in a comfortable home position
* jump notes placed as reachable satellites
* good whole-phrase flow, not greedy note-by-note behavior

Bad:

* anchor note placed badly
* repeated long hops
* no phrase-level planning

---

## 10) Simple drum groove

### What’s being tested

Musically realistic behavior for kick / snare / hat roles.

### MIDI

* kick = `36`
* snare = `38`
* closed hat = `42`
* optional accent = `46`
* 1–2 bar groove
* **System-generated**

### Expected result

* hats on easy repeatable pad(s)
* kick/snare on strong home pads
* compact playable groove cluster
* lower-row / thumb use may be reasonable

Bad:

* roles scattered across grid
* whole groove assigned to one hand without reason
* repeated hats require excessive travel

---

## Universal pass/fail checks

For every test, record:

* **Import correctness** — note count, timing, unique note count
* **Compactness** — notes stay in a tight area
* **Hand sanity** — left mostly left, right mostly right
* **Finger sanity** — no impossible simultaneity, no absurd overuse
* **Natural pose bias** — mapping stays near rest zones unless phrase demands otherwise
* **Crossover** — low in simple cases
* **Phrase flow** — reasonable overall travel and strain

---

## Recommendation

All 10 should be **system-generated MIDI fixtures**, not hand-authored.

That makes them:

* deterministic
* versionable
* easy to regenerate
* easy to automate in regression tests